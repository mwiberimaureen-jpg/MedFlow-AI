import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateLearningSpark } from '@/lib/openrouter/client'
import type { SparkFormat } from '@/lib/types/learning-spark'

export const dynamic = 'force-dynamic'

const FORMATS: SparkFormat[] = ['senior_asks', 'quick_teach', 'know_your_drugs', 'clinical_twist']

function getDailyFormat(date: Date): SparkFormat {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / 86400000)
  return FORMATS[dayOfYear % FORMATS.length]
}

function getRandomFormat(excludeFormat?: string): SparkFormat {
  const options = excludeFormat ? FORMATS.filter(f => f !== excludeFormat) : FORMATS
  return options[Math.floor(Math.random() * options.length)]
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const refresh = request.nextUrl.searchParams.get('refresh') === 'true'
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    // Check for cached spark
    const { data: existingSpark } = await supabase
      .from('daily_learning_sparks')
      .select('*')
      .eq('user_id', user.id)
      .eq('spark_date', today)
      .single()

    if (existingSpark && !refresh) {
      return NextResponse.json({ spark: existingSpark })
    }

    // If refreshing, delete the old spark so we generate a fresh one
    if (existingSpark && refresh) {
      await supabase
        .from('daily_learning_sparks')
        .delete()
        .eq('id', existingSpark.id)
    }

    // Get today's analyses to extract conditions
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const { data: todayAnalyses } = await supabase
      .from('analyses')
      .select('raw_analysis_text, summary')
      .eq('user_id', user.id)
      .gte('created_at', startOfDay.toISOString())

    // On refresh, pick a different format than the previous one
    const formatOverride = (refresh && existingSpark)
      ? getRandomFormat(existingSpark.format_type)
      : undefined

    if (!todayAnalyses || todayAnalyses.length === 0) {
      // Fallback: use most recent analyses regardless of date
      const { data: recentAnalyses } = await supabase
        .from('analyses')
        .select('raw_analysis_text, summary')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!recentAnalyses || recentAnalyses.length === 0) {
        // Second fallback: use patient history text directly
        const { data: recentHistories } = await supabase
          .from('patient_histories')
          .select('history_text')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)

        if (!recentHistories || recentHistories.length === 0) {
          return NextResponse.json({ spark: null, message: 'Add a patient to unlock today\'s discussion!' })
        }

        return await generateAndStoreFromHistories(supabase, user.id, today, recentHistories, formatOverride)
      }

      // Use recent analyses — if extractConditions returns nothing, fall back to history text too
      const conditions = extractConditions(recentAnalyses)
      if (conditions.length === 0) {
        const { data: recentHistories } = await supabase
          .from('patient_histories')
          .select('history_text')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)

        if (recentHistories && recentHistories.length > 0) {
          return await generateAndStoreFromHistories(supabase, user.id, today, recentHistories, formatOverride)
        }
      }

      return await generateAndStore(supabase, user.id, today, recentAnalyses, formatOverride)
    }

    // Also guard against extractConditions returning nothing for today's analyses
    const todayConditions = extractConditions(todayAnalyses)
    if (todayConditions.length === 0) {
      const { data: recentHistories } = await supabase
        .from('patient_histories')
        .select('history_text')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentHistories && recentHistories.length > 0) {
        return await generateAndStoreFromHistories(supabase, user.id, today, recentHistories, formatOverride)
      }
    }

    return await generateAndStore(supabase, user.id, today, todayAnalyses, formatOverride)
  } catch (error: any) {
    console.error('Error in GET /api/learning-spark/today:', error)
    return NextResponse.json(
      { error: 'Failed to fetch learning spark' },
      { status: 500 }
    )
  }
}

async function generateAndStore(
  supabase: any,
  userId: string,
  today: string,
  analyses: Array<{ raw_analysis_text: string; summary: string }>,
  formatOverride?: SparkFormat
) {
  // Extract conditions from analyses
  const conditions = extractConditions(analyses)

  if (conditions.length === 0) {
    return NextResponse.json({ spark: null, message: 'No conditions found in analyses' })
  }

  const format = formatOverride || getDailyFormat(new Date())

  try {
    const content = await generateLearningSpark(format, conditions)

    // Store in database
    const { data: spark, error: insertError } = await supabase
      .from('daily_learning_sparks')
      .insert({
        user_id: userId,
        spark_date: today,
        format_type: format,
        content,
        source_conditions: conditions.slice(0, 10), // cap at 10
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error storing spark:', insertError)
      // Return the generated content even if storage fails
      return NextResponse.json({
        spark: {
          id: 'temp',
          user_id: userId,
          spark_date: today,
          format_type: format,
          content,
          source_conditions: conditions.slice(0, 10),
          generated_at: new Date().toISOString(),
        }
      })
    }

    return NextResponse.json({ spark })
  } catch (genError: any) {
    console.error('Error generating spark:', genError)
    return NextResponse.json(
      { error: 'Failed to generate learning content', message: genError.message },
      { status: 500 }
    )
  }
}

async function generateAndStoreFromHistories(
  supabase: any,
  userId: string,
  today: string,
  histories: Array<{ history_text: string }>,
  formatOverride?: SparkFormat
) {
  const conditions = extractConditionsFromHistories(histories)
  const format = formatOverride || getDailyFormat(new Date())

  try {
    const content = await generateLearningSpark(format, conditions)

    const { data: spark, error: insertError } = await supabase
      .from('daily_learning_sparks')
      .insert({
        user_id: userId,
        spark_date: today,
        format_type: format,
        content,
        source_conditions: conditions.slice(0, 10),
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({
        spark: {
          id: 'temp',
          user_id: userId,
          spark_date: today,
          format_type: format,
          content,
          source_conditions: conditions.slice(0, 10),
          generated_at: new Date().toISOString(),
        }
      })
    }

    return NextResponse.json({ spark })
  } catch (genError: any) {
    console.error('Error generating spark from histories:', genError)
    return NextResponse.json(
      { error: 'Failed to generate learning content', message: genError.message },
      { status: 500 }
    )
  }
}

/**
 * Extract clinical conditions from raw patient history text.
 */
function extractConditionsFromHistories(histories: Array<{ history_text: string }>): string[] {
  const conditions = new Set<string>()

  // Common clinical terms to match in free-form history text
  const pattern = /\b(hypertension|diabetes|malaria|pneumonia|anaemia|anemia|sepsis|tuberculosis|TB|HIV|cardiac failure|heart failure|renal failure|AKI|CKD|hepatitis|cirrhosis|jaundice|meningitis|stroke|seizure|epilepsy|eclampsia|pre-?eclampsia|placenta praevia|ectopic pregnancy|appendicitis|bowel obstruction|pancreatitis|peptic ulcer|GI bleed|DVT|pulmonary embolism|PE|asthma|COPD|sickle cell|typhoid|dengue|cellulitis|osteomyelitis|pyelonephritis|UTI|cholecystitis|GERD|IBD|Crohn|colitis|atrial fibrillation|AF|ACS|MI|STEMI|NSTEMI|chest pain|SOB|dyspnea|dyspnoea|syncope|hyponatraemia|hypokalemia|hyperglycaemia|DKA|hypoglycaemia|thrombocytopenia|leucocytosis|leukaemia|lymphoma|breast cancer|cervical cancer|prostate cancer|ovarian cyst|fibroids|preterm|postpartum haemorrhage|PPH|neonatal sepsis|birth asphyxia|malnutrition|dehydration|diarrhoea|diarrhea|vomiting|abdominal pain|jaundice|cholangitis|pancreatitis|peritonitis)\b/gi

  for (const h of histories) {
    const text = (h.history_text || '').slice(0, 2000)
    const matches = text.match(pattern)
    if (matches) {
      matches.forEach(m => conditions.add(m.trim()))
    }
  }

  // If regex found nothing, extract meaningful noun phrases from the history as context
  if (conditions.size === 0) {
    for (const h of histories) {
      const snippet = (h.history_text || '').slice(0, 400).replace(/\n/g, ' ').trim()
      if (snippet) conditions.add(snippet)
    }
  }

  return Array.from(conditions)
}

/**
 * Extract clinical conditions/impressions from analysis texts.
 */
function extractConditions(analyses: Array<{ raw_analysis_text: string; summary: string }>): string[] {
  const conditions = new Set<string>()

  for (const analysis of analyses) {
    const text = analysis.raw_analysis_text || ''

    // Extract from ## Impression(s) section
    const impressionMatch = text.match(/## Impression\(s\)\s*\n([\s\S]*?)(?=\n##|$)/)
    if (impressionMatch) {
      const lines = impressionMatch[1].trim().split('\n')
      for (const line of lines) {
        // Strip numbering and parenthetical context
        const cleaned = line.replace(/^\d+\.\s*/, '').replace(/\s*\(.*?\)\s*$/, '').trim()
        if (cleaned && cleaned.length > 3) {
          conditions.add(cleaned)
        }
      }
    }

    // Extract from ## Differential Diagnoses section
    const ddxMatch = text.match(/## Differential Diagnoses\s*\n([\s\S]*?)(?=\n##|$)/)
    if (ddxMatch) {
      const diagLines = ddxMatch[1].match(/\*\*(.+?)\*\*/g)
      if (diagLines) {
        for (const d of diagLines) {
          const cleaned = d.replace(/\*\*/g, '').trim()
          if (cleaned && cleaned.length > 3) {
            conditions.add(cleaned)
          }
        }
      }
    }
  }

  return Array.from(conditions)
}
