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

    // On refresh: if there's a cached spark, pick a different format.
    // If there's no cached spark (previous insert failed), still pick randomly
    // so the user doesn't always see the same deterministic format.
    const formatOverride = refresh
      ? getRandomFormat(existingSpark?.format_type)
      : undefined

    // Always fetch ALL patient histories to build a diverse condition pool.
    // Limiting to recent analyses caused sparks to always pick the same diagnosis
    // (e.g. HEI) if recent work happened to be on one patient type.
    const { data: allHistories } = await supabase
      .from('patient_histories')
      .select('history_text')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(30)

    // Build a broad condition set: today's analyses + recent analyses (across all patients)
    // + all history texts. This ensures the full case mix is represented.
    const { data: recentAnalyses } = await supabase
      .from('analyses')
      .select('raw_analysis_text, summary')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    const analysisConditions = extractConditions([
      ...(todayAnalyses || []),
      ...(recentAnalyses || []),
    ])
    const historyConditions = extractConditionsFromHistories(allHistories || [])

    // Merge, deduplicate, and shuffle so the AI sees a varied pool
    const allConditions = [...new Set([...analysisConditions, ...historyConditions])]

    if (allConditions.length === 0) {
      return NextResponse.json({ spark: null, message: 'Add a patient to unlock today\'s discussion!' })
    }

    // Shuffle so the AI doesn't always start with the same conditions
    for (let i = allConditions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allConditions[i], allConditions[j]] = [allConditions[j], allConditions[i]]
    }

    return await generateAndStoreWithConditions(supabase, user.id, today, allConditions, formatOverride)
  } catch (error: any) {
    console.error('Error in GET /api/learning-spark/today:', error)
    return NextResponse.json(
      { error: 'Failed to fetch learning spark' },
      { status: 500 }
    )
  }
}

async function generateAndStoreWithConditions(
  supabase: any,
  userId: string,
  today: string,
  conditions: string[],
  formatOverride?: SparkFormat
) {
  if (conditions.length === 0) {
    return NextResponse.json({ spark: null, message: 'No conditions found in patient records' })
  }

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
      console.error('Error storing spark:', insertError)
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

    // Extract complications
    const compMatch = text.match(/## Possible Complications[^#\n]*\n([\s\S]*?)(?=\n##|$)/i)
    if (compMatch) {
      const compLines = compMatch[1].match(/\*\*(.+?)\*\*/g)
      if (compLines) {
        for (const c of compLines) {
          const cleaned = c.replace(/\*\*/g, '').trim()
          if (cleaned && cleaned.length > 3) {
            conditions.add(cleaned)
          }
        }
      }
    }

    // Extract drug names from Management Plan recommended steps
    const mgmtMatch = text.match(/\*\*Recommended Plan:\*\*\s*([\s\S]*?)(?=\*\*Adjustments|##|$)/i)
    if (mgmtMatch) {
      const stepLines = mgmtMatch[1].match(/\d+\.\s*\*\*(.+?)\*\*/g)
      if (stepLines) {
        for (const s of stepLines) {
          // Extract just the drug name: first word(s) before a dose pattern
          const inner = s.replace(/^\d+\.\s*\*\*/, '').replace(/\*\*.*/, '').trim()
          // Strip dose suffix (numbers, mg, kg, ml, IU, %, route abbreviations)
          const drugName = inner
            .replace(/\s+\d[\d./]*\s*(mg|mcg|g|ml|IU|mmol|mEq|%|units?)[^,]*/gi, '')
            .replace(/\s+(IV|PO|IM|SC|PR|SL|oral|intravenous|intramuscular)[^,]*/gi, '')
            .trim()
          if (drugName && drugName.length > 2 && drugName.length < 50) {
            conditions.add(drugName)
          }
        }
      }
    }
  }

  return Array.from(conditions)
}
