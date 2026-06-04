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

    const formatOverride = refresh
      ? getRandomFormat(existingSpark?.format_type)
      : undefined

    // Fetch last 14 days of sparks so the AI knows what to avoid
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const { data: recentSparks } = await supabase
      .from('daily_learning_sparks')
      .select('content, source_conditions, spark_date')
      .eq('user_id', user.id)
      .gte('spark_date', fourteenDaysAgo.toISOString().split('T')[0])
      .order('spark_date', { ascending: false })

    const recentTopics: string[] = (recentSparks || []).flatMap(s => {
      const c = s.content as any
      return [c?.topic, c?.question, c?.drug_focus, ...(s.source_conditions || [])].filter(Boolean)
    })

    // Fetch patient histories WITH rotation from metadata
    const { data: allHistories } = await supabase
      .from('patient_histories')
      .select('history_text, metadata')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(30)

    // Fetch all analyses with rotation-aware context
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const { data: todayAnalyses } = await supabase
      .from('analyses')
      .select('raw_analysis_text, summary')
      .eq('user_id', user.id)
      .gte('created_at', startOfDay.toISOString())

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

    // Merge, deduplicate, and shuffle
    const allConditions = [...new Set([...analysisConditions, ...historyConditions])]

    if (allConditions.length === 0) {
      return NextResponse.json({ spark: null, message: 'Add a patient to unlock today\'s discussion!' })
    }

    for (let i = allConditions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allConditions[i], allConditions[j]] = [allConditions[j], allConditions[i]]
    }

    return await generateAndStoreWithConditions(supabase, user.id, today, allConditions, formatOverride, recentTopics)
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
  formatOverride?: SparkFormat,
  recentTopics?: string[]
) {
  if (conditions.length === 0) {
    return NextResponse.json({ spark: null, message: 'No conditions found in patient records' })
  }

  const format = formatOverride || getDailyFormat(new Date())

  try {
    const content = await generateLearningSpark(format, conditions, undefined, recentTopics)

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
 * Extract clinical conditions from raw patient history text, with rotation labels.
 */
function extractConditionsFromHistories(histories: Array<{ history_text: string; metadata?: any }>): string[] {
  const conditions = new Set<string>()

  const pattern = /\b(hypertension|diabetes|malaria|pneumonia|anaemia|anemia|sepsis|tuberculosis|TB|HIV|cardiac failure|heart failure|renal failure|AKI|CKD|hepatitis|cirrhosis|jaundice|meningitis|stroke|seizure|epilepsy|eclampsia|pre-?eclampsia|placenta praevia|ectopic pregnancy|appendicitis|bowel obstruction|pancreatitis|peptic ulcer|GI bleed|DVT|pulmonary embolism|PE|asthma|COPD|sickle cell|typhoid|dengue|cellulitis|osteomyelitis|pyelonephritis|UTI|cholecystitis|GERD|IBD|Crohn|colitis|atrial fibrillation|AF|ACS|MI|STEMI|NSTEMI|chest pain|SOB|dyspnea|dyspnoea|syncope|hyponatraemia|hyponatremia|hypokalemia|hypokalaemia|hyperkalemia|hyperkalaemia|hyperglycaemia|hyperglycemia|DKA|hypoglycaemia|hypoglycemia|thrombocytopenia|leucocytosis|leukocytosis|leukaemia|leukemia|lymphoma|breast cancer|cervical cancer|prostate cancer|ovarian cyst|fibroids|preterm|postpartum haemorrhage|PPH|neonatal sepsis|birth asphyxia|HIE|hypoxic.?ischaemic|malnutrition|dehydration|diarrhoea|diarrhea|vomiting|abdominal pain|cholangitis|peritonitis|meconium aspiration|respiratory distress|ARDS|pneumothorax|pleural effusion|ascites|osteomyelitis|fracture|trauma|burns|shock|hypotension|bradycardia|tachycardia|arrhythmia|coagulopathy|DIC|metabolic acidosis|metabolic alkalosis|respiratory acidosis|lactic acidosis|hyperlactataemia|BGA|ABG|blood gas|CPAP|oxygen therapy|mechanical ventilation|intubation|transfusion|dialysis|appendicitis|cholecystitis|hernia|obstruction|perforation|peritonitis|wound infection|post-?operative|pre-?operative|anaesthesia)\b/gi

  // Also extract lab parameters and tests that make good teaching topics
  const labPattern = /\b(haemoglobin|hemoglobin|WBC|white.?cell|platelet|creatinine|urea|electrolytes|sodium|potassium|chloride|bicarbonate|pH|pCO2|pO2|lactate|bilirubin|ALT|AST|albumin|INR|PT|PTT|fibrinogen|troponin|BNP|CRP|ESR|procalcitonin|glucose|HbA1c|TSH|T3|T4|cortisol|blood culture|urine culture|CSF|ECG|chest.?X.?ray|ultrasound|CT.?scan|MRI)\b/gi

  for (const h of histories) {
    const rotation: string = h.metadata?.rotation || ''
    const prefix = rotation ? `[${rotation}] ` : ''
    const text = (h.history_text || '').slice(0, 3000)

    const matches = text.match(pattern)
    if (matches) {
      matches.forEach(m => conditions.add(`${prefix}${m.trim()}`))
    }

    const labMatches = text.match(labPattern)
    if (labMatches) {
      labMatches.forEach(m => conditions.add(`${prefix}${m.trim()}`))
    }
  }

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

    // Extract test names from Test Interpretation section
    const testMatch = text.match(/## Test Interpretation\s*\n([\s\S]*?)(?=\n##|$)/i)
    if (testMatch) {
      const testLines = testMatch[1].match(/\*\*(.+?)\*\*/g)
      if (testLines) {
        for (const t of testLines) {
          const cleaned = t.replace(/\*\*/g, '').trim()
          if (cleaned && cleaned.length > 2 && cleaned.length < 60) {
            conditions.add(cleaned)
          }
        }
      }
    }

    // Extract confirmatory tests ordered
    const confirmMatch = text.match(/## Confirmatory Tests[^#\n]*\n([\s\S]*?)(?=\n##|$)/i)
    if (confirmMatch) {
      const confirmLines = confirmMatch[1].match(/\*\*(.+?)\*\*/g)
      if (confirmLines) {
        for (const t of confirmLines) {
          const cleaned = t.replace(/\*\*/g, '').trim()
          if (cleaned && cleaned.length > 2 && cleaned.length < 60) {
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
          const inner = s.replace(/^\d+\.\s*\*\*/, '').replace(/\*\*.*/, '').trim()
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
