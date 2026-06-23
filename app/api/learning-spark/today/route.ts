import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateLearningSpark } from '@/lib/openrouter/client'
import type { SparkFormat, SparkContent } from '@/lib/types/learning-spark'

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

// Normalize a topic for fuzzy duplicate detection: lowercase, drop
// parentheticals and severity/stage qualifiers so "Acute Pancreatitis" and
// "pancreatitis (severe, with necrosis)" are recognized as the same topic
// even though the model renamed/restaged it.
function normalizeTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(acute|chronic|severe|moderate|mild|early|late|with|without|secondary|due|to|complicated|by|stage|grade)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// The "do not repeat this week's topics" instruction is prompt-level only —
// claude-haiku-4.5 doesn't reliably honor it (same model that ignores
// "return ONLY JSON" — see generateLearningSpark). This is the deterministic
// backstop: reject a chosen topic that fuzzy-matches the hard-avoid list and
// force a retry, rather than trusting the model's compliance.
function isRepeatTopic(topic: string, avoidList: string[]): boolean {
  const norm = normalizeTopic(topic)
  if (!norm) return false
  return avoidList.some(t => {
    const other = normalizeTopic(t)
    if (!other) return false
    return norm === other || norm.includes(other) || other.includes(norm)
  })
}

// Monday-start ISO date (YYYY-MM-DD) for the week containing `date`.
function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sun .. 6 = Sat
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

// Conditions/diagnoses worth teaching on, shared by history and analysis extraction.
const CONDITION_PATTERN = /\b(hypertension|diabetes|malaria|pneumonia|anaemia|anemia|sepsis|tuberculosis|TB|HIV|cardiac failure|heart failure|renal failure|AKI|CKD|hepatitis|cirrhosis|jaundice|meningitis|stroke|seizure|epilepsy|eclampsia|pre-?eclampsia|placenta praevia|ectopic pregnancy|appendicitis|bowel obstruction|pancreatitis|peptic ulcer|GI bleed|DVT|pulmonary embolism|PE|asthma|COPD|sickle cell|typhoid|dengue|cellulitis|osteomyelitis|pyelonephritis|UTI|cholecystitis|GERD|IBD|Crohn|colitis|atrial fibrillation|AF|ACS|MI|STEMI|NSTEMI|chest pain|SOB|dyspnea|dyspnoea|syncope|hyponatraemia|hyponatremia|hypokalemia|hypokalaemia|hyperkalemia|hyperkalaemia|hyperglycaemia|hyperglycemia|DKA|hypoglycaemia|hypoglycemia|thrombocytopenia|leucocytosis|leukocytosis|leukaemia|leukemia|lymphoma|breast cancer|cervical cancer|prostate cancer|ovarian cyst|fibroids|preterm|postpartum haemorrhage|PPH|neonatal sepsis|birth asphyxia|HIE|hypoxic.?ischaemic|malnutrition|dehydration|diarrhoea|diarrhea|vomiting|abdominal pain|cholangitis|peritonitis|meconium aspiration|respiratory distress|ARDS|pneumothorax|pleural effusion|ascites|osteomyelitis|fracture|trauma|burns|shock|hypotension|bradycardia|tachycardia|arrhythmia|coagulopathy|DIC|metabolic acidosis|metabolic alkalosis|respiratory acidosis|lactic acidosis|hyperlactataemia|BGA|ABG|blood gas|CPAP|oxygen therapy|mechanical ventilation|intubation|transfusion|dialysis|appendicitis|cholecystitis|hernia|obstruction|perforation|peritonitis|wound infection|post-?operative|pre-?operative|anaesthesia)\b/gi

// Lab parameters/tests that make good teaching topics.
const LAB_PATTERN = /\b(haemoglobin|hemoglobin|WBC|white.?cell|platelet|creatinine|urea|electrolytes|sodium|potassium|chloride|bicarbonate|pH|pCO2|pO2|lactate|bilirubin|ALT|AST|albumin|INR|PT|PTT|fibrinogen|troponin|BNP|CRP|ESR|procalcitonin|glucose|HbA1c|TSH|T3|T4|cortisol|blood culture|urine culture|CSF|ECG|chest.?X.?ray|ultrasound|CT.?scan|MRI)\b/gi

// "Peculiar" physical exam findings that drive a spot diagnosis — good source
// material for clinical-reasoning learning sparks.
const EXAM_FINDINGS_PATTERN = /\b(tracheal deviation|Murphy'?s sign|Kernig'?s sign|Brudzinski'?s sign|McBurney'?s point|Cullen'?s sign|Grey Turner'?s sign|Chvostek'?s sign|Trousseau'?s sign|Homans'?s? sign|rebound tenderness|guarding|rigidity|tracheal tug|clubbing|cyanosis|lymphadenopathy|hepatosplenomegaly|hepatomegaly|splenomegaly|ascites|pedal oedema|pedal edema|petechiae|purpura|pallor|tachypnoea|tachypnea|stridor|wheeze|crepitations|crackles|reduced air entry|hyper-?resonant|dull(?:ness)? to percussion|Kussmaul breathing|pulsus paradoxus|raised JVP|murmur|gallop rhythm|S3 gallop|cardiac thrill|precordial heave|hypotonia|hypertonia|hyperreflexia|hyporeflexia|clonus|Babinski|nuchal rigidity|photophobia|bulging fontanelle|sunken fontanelle|sunken eyes|skin turgor|capillary refill|Battle'?s sign|raccoon eyes|CSF otorrhoea|CSF rhinorrhoea)\b/gi

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

    // Fetch last 60 days of sparks and split into "this week" (hard avoid)
    // vs "earlier weeks" (soft avoid — can revisit on a different week).
    const weekStart = getWeekStart(new Date())
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    // These four queries are independent — run them in parallel instead of
    // one-by-one to cut round-trip latency before generation even starts.
    const [
      { data: recentSparks },
      { data: allHistories },
      { data: todayAnalyses },
      { data: recentAnalysesRaw },
    ] = await Promise.all([
      supabase
        .from('daily_learning_sparks')
        .select('content, source_conditions, spark_date')
        .eq('user_id', user.id)
        .gte('spark_date', sixtyDaysAgo.toISOString().split('T')[0])
        .order('spark_date', { ascending: false }),
      // Patient histories WITH rotation from metadata — covers ALL patient
      // files, not just the most recent few.
      supabase
        .from('patient_histories')
        .select('history_text, metadata')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .limit(200),
      supabase
        .from('analyses')
        .select('raw_analysis_text, summary')
        .eq('user_id', user.id)
        .gte('created_at', startOfDay.toISOString()),
      supabase
        .from('analyses')
        .select('raw_analysis_text, summary, patient_history_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500),
    ])

    const thisWeekTopics: string[] = []
    const earlierTopics: string[] = []
    for (const s of recentSparks || []) {
      const c = s.content as any
      const topics = [c?.topic, c?.question, c?.drug_focus, ...(s.source_conditions || [])].filter(Boolean)
      if (s.spark_date >= weekStart) {
        thisWeekTopics.push(...topics)
      } else {
        earlierTopics.push(...topics)
      }
    }

    // Keep only the most recent analysis per patient. Without this, a patient
    // admitted for many days dominates the conditions list with day-by-day
    // variants of the same diagnosis (e.g. 10 days of HIE impressions), while
    // patients with fewer analyses barely show up.
    const latestPerPatient = new Map<string, { raw_analysis_text: string; summary: string }>()
    for (const a of recentAnalysesRaw || []) {
      if (!latestPerPatient.has(a.patient_history_id)) {
        latestPerPatient.set(a.patient_history_id, a)
      }
    }

    const analysisConditions = extractConditions([
      ...(todayAnalyses || []),
      ...latestPerPatient.values(),
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

    // Cap how many items go into the prompt. The pool itself is drawn from
    // ALL patients (no restriction there) — but sending hundreds of items
    // bloats the prompt enough to push generation past a minute. A random
    // 60-item sample (shuffled above) still rotates through the full pool
    // across days/refreshes while keeping latency low.
    const promptConditions = allConditions.slice(0, 60)

    return await generateAndStoreWithConditions(supabase, user.id, today, promptConditions, formatOverride, thisWeekTopics, earlierTopics)
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
  thisWeekTopics?: string[],
  earlierTopics?: string[]
) {
  if (conditions.length === 0) {
    return NextResponse.json({ spark: null, message: 'No conditions found in patient records' })
  }

  const format = formatOverride || getDailyFormat(new Date())

  try {
    // Hard-avoid list sent to the model, growing with each rejected pick so
    // a retry can't choose the same repeat twice.
    const hardAvoid = [...(thisWeekTopics || [])]
    let content!: SparkContent
    const maxAttempts = 3
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      content = await generateLearningSpark(format, conditions, undefined, hardAvoid, earlierTopics)
      const chosenTopic = (content as any)?.topic?.trim() || ''
      if (attempt === maxAttempts || !isRepeatTopic(chosenTopic, thisWeekTopics || [])) break
      console.warn(`Learning spark picked a repeat topic ("${chosenTopic}") on attempt ${attempt}, retrying with it explicitly excluded`)
      hardAvoid.push(chosenTopic)
    }

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

  for (const h of histories) {
    const rotation: string = h.metadata?.rotation || ''
    const prefix = rotation ? `[${rotation}] ` : ''
    const text = (h.history_text || '').slice(0, 3000)

    const matches = text.match(CONDITION_PATTERN)
    if (matches) {
      matches.forEach(m => conditions.add(`${prefix}${m.trim()}`))
    }

    const labMatches = text.match(LAB_PATTERN)
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

    // Mine the faithful clinical summary for documented conditions and
    // "peculiar" physical exam findings that drive a spot diagnosis —
    // these are written by the user, not generated, so they're great
    // teaching material that the section-based extraction below misses.
    const summaryText = analysis.summary || ''
    if (summaryText) {
      const summaryConditions = summaryText.match(CONDITION_PATTERN)
      if (summaryConditions) {
        summaryConditions.forEach(m => conditions.add(m.trim()))
      }
      const examFindings = summaryText.match(EXAM_FINDINGS_PATTERN)
      if (examFindings) {
        examFindings.forEach(m => conditions.add(`${m.trim()} (exam finding)`))
      }
    }

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
