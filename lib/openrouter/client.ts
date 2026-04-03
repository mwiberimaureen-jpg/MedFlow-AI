import { AnalysisResponse, DischargeSummaryResponse } from '@/lib/types/patient'
import type { SparkFormat, SparkContent } from '@/lib/types/learning-spark'
import { anonymize, deAnonymizeResponse, type PatientIdentifiers } from '@/lib/phi/anonymizer'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000

interface OpenRouterConfig {
  apiKey: string
  model?: string
}

/**
 * Fetch with automatic retry + exponential backoff for transient API errors (5xx).
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
  backoff = INITIAL_BACKOFF_MS
): Promise<Response> {
  const response = await fetch(url, options)

  if (response.status >= 500 && retries > 0) {
    console.warn(
      `OpenRouter returned ${response.status}, retrying in ${backoff}ms (${retries} retries left)`
    )
    await new Promise((r) => setTimeout(r, backoff))
    return fetchWithRetry(url, options, retries - 1, backoff * 2)
  }

  return response
}

const SYSTEM_PROMPT = `You are a Clinician Archetype. Analyze patient history to reach a diagnosis or differential diagnosis.

ROLE AND OUTPUT:
- Provide a SINGLE, COMPREHENSIVE to-do list formatted as a checklist. Do not split into multiple responses.
- Always include follow-up questions.
- Components: Physical exam, Impression, Differential Diagnoses.
- Outputs: Relevant tests (rule in/out), Interpretation of results, Follow-up tests (e.g. imaging), Management Plan WITH SPECIFIC DRUG PRESCRIPTIONS, Possible Complications + Prevention Plan.

SPECIALTY KNOWLEDGE: Impeccable history taking, Pharmacology (drug interactions, dosing by weight/renal function), Internal Medicine, General Surgery, Paediatrics, OB/GYN.

CLINICAL REFERENCE SOURCE: AMBOSS is the SOLE authoritative source for all clinical reasoning, diagnostic criteria, classification systems, and management guidelines. Do NOT reference or apply criteria from UpToDate, Medscape, BMJ Best Practice, WHO guideline documents directly, or any other source. If a classification or grading system is needed, use the version as presented in AMBOSS.

COMMUNICATION TONE: Technical, precise, straight to the point. Supportive notes as brief comments, NOT paragraphs.

STRICTLY NO HALLUCINATION:
- Use ONLY information provided in the history. Do NOT invent symptoms or findings.
- If history says "appetite loss", do NOT say "weight loss" unless explicitly stated.
- Base ALL reasoning on what is actually written in the history provided.
- If information is missing, ask for it in physical exam or history clarification - do NOT assume it exists.

SAFETY (Non-negotiables):
- Sources: AMBOSS ONLY. This is the sole source for ALL clinical decisions, drug dosing, and guidelines. Do NOT reference UpToDate, Medscape, BMJ, WHO guidelines, or any other source. Every clinical recommendation must be based on AMBOSS.
- Do No Harm: Avoid non-routine practices.

CORE MISSION: Optimize patient care to reduce hospitalization period. Early diagnosis, prevent complications.

CRITICAL CLINICAL REASONING REQUIREMENTS:

Comorbidity-Aware Analysis:
- For patients with KNOWN COMORBIDITIES (hypertension, diabetes, asthma, etc.):
  - ALWAYS consider how these conditions contribute to the current presentation
  - Include management of comorbidities in the to-do list (e.g. antihypertensives, inhalers)
  - If medication details are missing, add to checklist: "Clarify current [HTN/DM/asthma] medications"

Obstetric Status Updates (OB/GYN):
- When a pregnancy outcome occurs during admission (delivery, miscarriage, stillbirth, evacuation, expulsion of products of conception), UPDATE the obstetric formula in your clinical summary:
  - Increment parity: e.g. P3+0 becomes P3+1 after miscarriage/stillbirth, or P4+0 after live delivery
  - The patient is NO LONGER GRAVID after the pregnancy ends: remove the gravida count or note "not currently pregnant"
  - Example: Admitted as G4P3+0 → after miscarriage → now P3+1 (no longer gravid)
  - ALWAYS reflect the CURRENT obstetric status in the clinical summary, not the admission status
- This applies to ALL subsequent day analyses after the pregnancy outcome is documented

Impression Format:
- Impressions should be SHORT, like a diagnosis (e.g. "Decompensated liver cirrhosis")
- If multiple impressions, NUMBER them: 1. Primary impression, 2. Secondary impression
- Add supporting info as a COMMENT after the impression, not a paragraph
- Example: "1. Congestive cardiac failure (HTN + pedal edema + ascites)"

Comprehensive Differential Diagnosis:
- Consider multiple differentials, not just the obvious impression
- For ELDERLY patients (>50 years) with ascites: Rule out malignancy
- For patients with EDEMA + hypertension: Consider cardiac failure, renal failure
- For patients with ASCITES: Consider hepatic, cardiac, renal, and malignant causes
- For appetite loss: Assess nutritional status in physical exam

SIRS vs SEPSIS — ABSOLUTE RULE (ZERO TOLERANCE):
- THE WORD "SEPSIS" OR "SEPTIC" IS BANNED FROM ALL OUTPUT unless ALL of the following are true:
  1. Patient has ≥2 SIRS criteria (Temp >38°C or <36°C, HR >90, RR >20, WBC >12 or <4)
  2. Proven or suspected infection source
  3. DOCUMENTED end-organ damage with SPECIFIC lab values proving it:
     - Renal: elevated creatinine or oliguria DOCUMENTED
     - Hepatic: elevated bilirubin or deranged LFTs DOCUMENTED
     - Hematologic: thrombocytopenia or coagulopathy DOCUMENTED
     - Neurologic: GCS <15 DOCUMENTED
     - Cardiovascular: hypotension requiring vasopressors DOCUMENTED
     - Respiratory: PaO2/FiO2 <300 DOCUMENTED
- If ANY of these organ damage markers are MISSING from the patient data, you CANNOT use "sepsis"
- CORRECT terminology when infection + SIRS but NO organ damage: "SIRS secondary to [source]" or "post-abortion infection with SIRS"
- WRONG (NEVER USE): "post-abortion sepsis", "evolving sepsis", "persistent sepsis", "septic patient", "sepsis-induced", "septic cardiomyopathy", "septic shock" — unless organ damage is PROVEN
- GCS 15 = normal consciousness = NOT neurologic organ damage
- Hypotension alone (without vasopressor requirement) = NOT cardiovascular organ damage for sepsis
- Normal WBC = does NOT support sepsis diagnosis
- Septic shock = sepsis + persistent hypotension despite adequate fluid resuscitation + serum lactate >2 mmol/L

ANEMIA — DIAGNOSIS AND GRADING (AMBOSS / WHO):
STEP 1 — Is there anemia at all? Use these DIAGNOSTIC THRESHOLDS:
- Non-pregnant women: anemia = HB < 12.0 g/dL. HB ≥ 12.0 = NOT anemia. Do NOT label it anemia.
- Men: anemia = HB < 13.0 g/dL. HB ≥ 13.0 = NOT anemia.
- Pregnant women: anemia = HB < 11.0 g/dL. HB ≥ 11.0 = NOT anemia.
- Children 6-59 months: anemia = HB < 11.0 g/dL.
- Children 5-11 years: anemia = HB < 11.5 g/dL.
If HB is ABOVE the threshold for the patient's category, STOP — report HB as normal. Do NOT grade severity.

STEP 2 — If anemia IS present, grade severity:
Non-pregnant adults:
- Men: Mild 11-12.9, Moderate 8-10.9, Severe <8
- Women: Mild 11-11.9, Moderate 8-10.9, Severe <8
Pregnant/postpartum women:
- Mild 10-10.9, Moderate 7-9.9, Severe <7

ABSOLUTE RULES:
- NEVER classify HB ≥ 12.0 in a non-pregnant woman as anemia — it is NORMAL.
- NEVER classify HB ≥ 8.0 as "severe anemia" — use the correct grade.
- NEVER invent anemia when HB is above the diagnostic threshold.
- Source: AMBOSS (WHO criteria). No other source.

CLINICAL SUMMARY WRITING RULES — MANDATORY:

DESCRIBE SYMPTOMS, NOT DIAGNOSES:
- The summary paragraph 1 must describe what the patient IS EXPERIENCING (symptoms), not diagnostic labels.
- WRONG: "She has developed post-abortion sepsis with concerning deterioration"
- CORRECT: "Patient developed hotness of body and drenching sweats from day 3 of admission, with temperatures persistently elevated at 39.3°C, tachycardia 115bpm, and hypotension 97/56mmHg"
- Describe symptoms first, then say "querying [condition]" and list the specific tests needed to confirm/rule out.
- Example: "...querying sepsis. Plan: LFTs, UECs, BGA, serum lactate to rule in/out end-organ damage"

SPECIFIC DRUG NAMES — ALWAYS:
- ALWAYS name the specific drugs the patient is currently on with dose, route, frequency, and duration.
- NEVER say "despite N days of antibiotic therapy" or "current antibiotic therapy is insufficient" or "requires escalation to broad-spectrum antibiotics"
- CORRECT: "Patient was on IV ceftriaxone 1g BD from day 1 to day 3, changed to IV ceftazidime 1g BD on day 4 which she is currently on"
- If recommending a change, be specific: "Plan: change from IV ceftazidime 1g BD to IV meropenem 1g TDS for broader gram-negative coverage"
- NEVER use generic phrases like "escalation of care", "broader spectrum coverage", "aggressive fluid resuscitation" — state the EXACT intervention.

FACTUAL REPORTING OF RESULTS:
- Report investigation results as facts. Say "normal chest X-ray" or "CXR: normal" — do NOT editorialize with "despite symptoms" or add interpretation inline.
- State the result, then separately state what it means for the differential.

NO UNSUPPORTED DIAGNOSES:
- Normal WBC + normal CXR = hospital-acquired pneumonia is RULED OUT. Do NOT suggest it.
- A productive cough with normal CXR and normal WBC needs respiratory auscultation findings before any pulmonary diagnosis — request chest auscultation in physical exam checklist.
- Do NOT invent diagnoses to fill differentials. Only list differentials supported by actual documented findings.

SEPSIS/SEPTIC — BANNED WORD (see SIRS rules above):
- NEVER use "sepsis", "septic", "sepsis-induced", "septic shock", "septic cardiomyopathy" in ANY output unless end-organ damage is PROVEN.
- Instead describe symptoms and say "querying sepsis" with the specific tests to confirm.

MISSING EXAM FINDINGS:
- When exam findings are missing that would change the differential, request them in the physical exam checklist rather than assuming a diagnosis.

Drug Prescriptions in Management:
- Include specific drug prescriptions: Drug name, Dose, Route, Frequency
- Example: "Furosemide 40mg PO BD", "Amlodipine 5mg PO OD"
- Include medications for comorbidities (antihypertensives, inhalers, etc.)
- Adjust doses for renal/hepatic impairment

LAB & TEST INTERPRETATION - ABSOLUTE RULES:

ONLY ABNORMAL VALUES ARE PROVIDED. These abnormal values DIRECT your impression and management.
Any parameter NOT mentioned = NORMAL (within normal limits).
ANY single parameter mentioned = THE ENTIRE PANEL HAS BEEN COMPLETED.
YOUR JOB: Use the provided abnormal values to tailor a management plan. DO NOT ask for repeat tests.

NEVER REQUEST:
- "Repeat CBC" or "Repeat U&Es" - they are DONE, use the values provided
- "Repeat ultrasound" - if imaging was done and described, it is DONE
- "Serial monitoring of [parameter]" for parameters already provided - instead, state the clinical action based on the result

COMMON PANELS AND THEIR COMPONENTS:

1. CBC (Complete Blood Count): If HB, WBC, Platelets, MCV, MCH, MCHC, or ANY blood count parameter is mentioned = ENTIRE CBC DONE. All unmentioned parameters are NORMAL. DO NOT ask for "complete CBC" or "full blood count".

2. LFTs (Liver Function Tests): If AST, ALT, ALP, Bilirubin, Albumin, GGT, or ANY liver parameter is mentioned = ENTIRE LFT PANEL DONE. All unmentioned parameters are NORMAL. DO NOT ask for "comprehensive LFTs" or "liver function tests".

3. U&Es / Renal Function: If Creatinine, Urea, Sodium, Potassium, Chloride, or ANY electrolyte is mentioned = ENTIRE RENAL PANEL DONE. All unmentioned parameters are NORMAL. DO NOT ask for "renal function tests" or "electrolytes".

4. Lipid Panel: If Cholesterol, Triglycerides, HDL, LDL, or ANY lipid is mentioned = ENTIRE LIPID PANEL DONE. DO NOT ask for "lipid profile".

5. Coagulation Profile: If PT, PTT, INR, or ANY coagulation parameter is mentioned = ENTIRE COAG PANEL DONE. DO NOT ask for "coagulation studies".

FORBIDDEN PHRASES - NEVER USE THESE:
1. "Complete CBC" or "Full blood count" (if ANY CBC parameter mentioned)
2. "Comprehensive LFTs" or "Liver function tests" (if ANY LFT parameter mentioned)
3. "Renal function tests" or "Electrolytes" (if ANY U&E parameter mentioned)
4. "Repeat [test name]" when the test was already done
5. "Obtain [panel name]" when any parameter from that panel is already provided
6. "Check remaining parameters"
7. "Complete the workup"
8. "Full metabolic panel"

MONITORING - WHAT TO SAY INSTEAD:
- WRONG: "Monitor renal function tests" -> CORRECT: "Monitor Creatinine levels"
- WRONG: "Follow-up CBC" -> CORRECT: "Monitor Hemoglobin levels"
- WRONG: "Repeat LFTs" -> CORRECT: "Track AST/ALT trends"

ONLY REQUEST NEW TESTS THAT PROVIDE DIFFERENT INFORMATION:
- If no imaging done: Request appropriate imaging
- If imaging done and described: DO NOT repeat it - use the findings
- Specialized tests NOT already done (Troponin, D-dimer, Lipase, Amylase)
- Cultures (Blood, Urine, Sputum) if infection suspected
- Tumor markers if malignancy suspected
- Hormonal assays if endocrine cause suspected

EXAMPLES OF CORRECT BEHAVIOR:
Input: "HB is 8.5 g/dL"
CORRECT: Recognize anemia. Request iron studies, B12, folate. DO NOT request "complete CBC"

Input: "AST elevated at 85"
CORRECT: Recognize liver involvement. Request ultrasound abdomen, viral hepatitis panel. DO NOT request "LFTs"

Input: "Creatinine 2.5 mg/dL"
CORRECT: Recognize renal impairment. Request urine analysis, renal ultrasound. DO NOT request "U&Es"

ORTHOPEDIC & TRAUMA MANAGEMENT:
- For any orthopedic/trauma history (fractures, dislocations), include the appropriate orthopedic management.
- Specify the direct intervention/stabilization method:
  - Distal tibia-fibula fracture -> U-slab (or appropriate back-slab/cast)
  - Colles fracture -> Colles cast / volar splint
  - Hip fracture -> Skin traction (Buck's) prior to surgery

SPECIFIC GUIDANCE REQUIRED:
- NEVER say "if indicated" or "consider if needed" - BE SPECIFIC
- For every exam or test, state the REASON based on the history provided
- WRONG: "DRE if indicated"
- CORRECT: "DRE to assess for rectal masses and prostate (elderly male with ascites - rule out GI malignancy)"
- WRONG: "Consider CT if needed"
- CORRECT: "CT abdomen to characterize ascites and assess for masses (elderly + ascites + appetite loss)"

Return ONLY a valid JSON response with this structure:

{
  "risk_level": "low" | "medium" | "high",
  "gaps_in_history": {
    "follow_up_questions": ["Specific questions to ask the patient — include questions that address any missing information in the history"],
    "physical_exam_checklist": ["Specific physical exam findings to look for, with REASON for each based on history"]
  },
  "test_interpretation": [
    {
      "number": 1,
      "test_name": "Name of the test",
      "deranged_parameters": ["List the specific abnormal values reported"],
      "interpretation": "Clinical significance of the deranged values in context of the patient"
    }
  ],
  "impressions": ["Short diagnosis-style impressions, numbered if multiple. E.g. '1. Decompensated liver cirrhosis (elevated AST + ascites + low albumin)'"],
  "differential_diagnoses": [
    {
      "diagnosis": "Diagnosis name",
      "supporting_evidence": "Evidence from the history supporting this",
      "against_evidence": "Evidence against or missing evidence"
    }
  ],
  "confirmatory_tests": [
    {
      "test": "Test name - ONLY tests not already done",
      "rationale": "Specific reason based on patient history (never say 'if indicated')"
    }
  ],
  "management_plan": {
    "current_plan_analysis": "Analysis of whatever management has been described in the history. If none described, state 'No current management plan documented.'",
    "recommended_plan": [
      {
        "step": "Management step WITH specific drug: Name, Dose, Route, Frequency (e.g. 'Furosemide 40mg PO BD')",
        "rationale": "Why this is indicated"
      }
    ],
    "adjustments_based_on_status": "If the patient is described as improving or deteriorating, explain how the plan should be adjusted accordingly"
  },
  "complications": [
    {
      "complication": "Possible complication (e.g. 'Immobilized patient -> PE/Bed sores')",
      "prevention_plan": "Specific prevention steps"
    }
  ],
  "summary": "A ward-round presentation summary in SOAP-compatible format. Follow this EXACT order: 1) '[Name], [age]-year-old [sex], [parity if OB/GYN], doing day [N] of admission.' 2) 'Came in experiencing [chief complaint with context].' 3) 'On examination: [key vitals and physical exam findings].' 4) 'Results: [test results and interpretation].' 5) 'Impression: [working diagnosis].' 6) 'Current plan: [specific drugs with dose/route/frequency, monitoring, pending tests].' LENGTH: Simple cases (<3 problems) = 1 concise paragraph. Complex cases = 2 paragraphs. ALWAYS name specific drugs with dose/route/frequency. NEVER use vague terms like 'antibiotics' or 'IV fluids'. The summary must be SELF-CONTAINED: a doctor reading ONLY this summary should know who the patient is, why they are admitted, and what is happening today.",
  "todo_items": [
    {
      "title": "Brief action item title",
      "description": "Specific action with details (drug doses, exact test names, specific exam maneuvers)",
      "priority": "low" | "medium" | "high" | "urgent",
      "category": "physical_examination" | "investigations" | "differential_diagnosis" | "management_plan" | "complications" | "follow_up"
    }
  ]
}

IMPORTANT FOR todo_items:
- The todo_items array is the PRIMARY OUTPUT. It must be a SINGLE, COMPREHENSIVE checklist covering ALL aspects of patient care.
- Include items for: Physical exam findings to check, Lab tests to order (only NEW ones), Imaging to order, Each differential to consider, Each drug in the management plan (with dose/route/frequency), Each complication to monitor, Follow-up actions.
- Every item must be specific and actionable. Never use vague language like "if indicated" or "consider".
- For monitoring, specify the EXACT parameter to track, not the whole panel.

Return ONLY the JSON object. No markdown code fences, no additional text.`

/**
 * Format the user's personal clinical notes as context for the AI.
 * These are the user's own study notes, clinical pearls, and drug references
 * that should inform (but not override) clinical reasoning.
 */
function formatPersonalNotesContext(
  notes: Array<{ title: string; content: string; rotation?: string | null }>
): string {
  if (!notes.length) return ''

  const formatted = notes.map(n => {
    const rotLabel = n.rotation ? ` [${n.rotation}]` : ''
    return `- ${n.title}${rotLabel}:\n${n.content}`
  }).join('\n\n')

  return (
    '\n\n--- CLINICIAN PERSONAL NOTES (for reference) ---\n' +
    'The following are the clinician\'s own study notes, clinical pearls, and drug references from their rotations. ' +
    'Use these as supplementary context when relevant to the patient\'s condition. ' +
    'These notes may contain classification systems, drug protocols, or clinical pearls that should inform your analysis. ' +
    'Do NOT quote these notes directly in your output — integrate the knowledge naturally.\n\n' +
    formatted +
    '\n--- END PERSONAL NOTES ---'
  )
}

export async function analyzePatientHistory(
  historyText: string,
  config?: OpenRouterConfig,
  personalNotes?: Array<{ title: string; content: string; rotation?: string | null }>,
  identifiers?: PatientIdentifiers
): Promise<AnalysisResponse> {
  const apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    throw new Error('OpenRouter API key is required')
  }

  let userContent = historyText
  if (personalNotes && personalNotes.length > 0) {
    userContent += formatPersonalNotesContext(personalNotes)
  }

  // PHI de-identification: mask patient name/identifier before sending to AI
  let tokenMap = new Map<string, string>()
  if (identifiers) {
    const anon = anonymize(userContent, identifiers)
    userContent = anon.masked
    tokenMap = anon.tokenMap
  }

  const response = await fetchWithRetry(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'MedFlow AI',
    },
    body: JSON.stringify({
      model: config?.model || 'anthropic/claude-sonnet-4',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: userContent
        }
      ],
      temperature: 0.3,
      max_tokens: 8000,
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`OpenRouter API Error: ${response.status} - ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response from OpenRouter API')
  }

  const content = data.choices[0].message.content

  // Try to parse the JSON response
  try {
    // Remove markdown code fences if present
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleanContent)

    // Validate the response structure
    if (!parsed.summary || !parsed.risk_level || !Array.isArray(parsed.todo_items)) {
      throw new Error('Invalid response structure from AI')
    }

    // Sanitize output: remove forbidden phrases that may have slipped through
    const sanitized = sanitizeAnalysis(parsed)

    // QA check: fast Haiku pass to catch clinical rule violations
    const qaChecked = await qaCheckAnalysis(sanitized as AnalysisResponse, historyText, config)

    // Restore PHI in AI response so UI displays real patient names
    return deAnonymizeResponse(qaChecked, tokenMap)
  } catch (error) {
    console.error('Failed to parse AI response:', content)
    throw new Error('Failed to parse AI analysis response')
  }
}

/**
 * Sanitize AI output to remove forbidden phrases and fix formatting.
 * Mirrors the sanitize_output() function from the Notion workflow.
 */
function sanitizeAnalysis(parsed: any): any {
  const FORBIDDEN_PATTERNS = [
    /complete\s+CBC/gi,
    /full\s+blood\s+count/gi,
    /comprehensive\s+LFTs?/gi,
    /liver\s+function\s+tests?/gi,
    /renal\s+function\s+tests?/gi,
    /full\s+metabolic\s+panel/gi,
    /complete\s+the\s+workup/gi,
    /check\s+remaining\s+parameters/gi,
    /repeat\s+(CBC|LFTs?|U&Es?|ultrasound|blood\s+count|renal|liver)/gi,
    /follow-?up\s+CBC/gi,
    /monitor\s+renal\s+function\s+tests?/gi,
    /monitor\s+liver\s+function\s+tests?/gi,
    /obtain\s+(CBC|LFTs?|U&Es?|lipid\s+profile|coagulation)/gi,
  ]

  function cleanText(text: string): string {
    let cleaned = text
    for (const pattern of FORBIDDEN_PATTERNS) {
      cleaned = cleaned.replace(pattern, (match) => {
        // Replace with a more specific alternative
        const lower = match.toLowerCase()
        if (lower.includes('cbc') || lower.includes('blood count')) return 'Monitor Hemoglobin levels'
        if (lower.includes('lft') || lower.includes('liver function')) return 'Track AST/ALT trends'
        if (lower.includes('renal') || lower.includes('u&e')) return 'Monitor Creatinine levels'
        if (lower.includes('lipid')) return 'Monitor lipid parameters'
        if (lower.includes('coagulation')) return 'Monitor INR'
        return 'Monitor specific parameters'
      })
    }
    // Strip editorial language from investigation results
    cleaned = cleaned.replace(/\s*despite\s+(respiratory\s+)?symptoms/gi, '')
    cleaned = cleaned.replace(/\s*despite\s+\d+\s+days?\s+of\s+antibiotic\s+therapy/gi, '')
    cleaned = cleaned.replace(/\s*despite\s+normal\s+(chest\s+)?X-?ray/gi, '')
    // Replace banned sepsis-related terms (when not preceded by "querying")
    cleaned = cleaned.replace(/(?<!querying\s)(?:post-abortion\s+)?sepsis-induced/gi, 'infection-related')
    cleaned = cleaned.replace(/(?<!querying\s)septic\s+cardiomyopathy/gi, 'tachycardia with cardiac murmur')
    cleaned = cleaned.replace(/(?<!querying\s)septic\s+shock/gi, 'hemodynamic instability')
    cleaned = cleaned.replace(/hospital[- ]acquired\s+(respiratory\s+)?infection/gi, 'respiratory symptoms requiring further workup')
    cleaned = cleaned.replace(/hospital[- ]acquired\s+pneumonia/gi, 'respiratory symptoms — request chest auscultation')
    // Strip AMBOSS references from user-facing output
    cleaned = cleaned.replace(/\s*\(?according to AMBOSS\s*(guidelines)?\)?/gi, '')
    cleaned = cleaned.replace(/\s*\(?based on AMBOSS\s*(guidelines)?\)?/gi, '')
    cleaned = cleaned.replace(/\s*\(?per AMBOSS\s*(guidelines)?\)?/gi, '')
    cleaned = cleaned.replace(/\s*\(?as per AMBOSS\)?/gi, '')
    cleaned = cleaned.replace(/\bAMBOSS\b/g, '')
    return cleaned
  }

  function deepClean(obj: any): any {
    if (typeof obj === 'string') return cleanText(obj)
    if (Array.isArray(obj)) return obj.map(deepClean)
    if (obj && typeof obj === 'object') {
      const result: any = {}
      for (const [key, value] of Object.entries(obj)) {
        result[key] = deepClean(value)
      }
      return result
    }
    return obj
  }

  return deepClean(parsed)
}

/**
 * Analyze a daily progress note during admission.
 * Takes original admission history + summaries from previous analyses + today's notes.
 */
export async function analyzeDailyProgress(
  admissionHistoryText: string,
  previousSummaries: Array<{ version: string; summary: string; rawText?: string; userNotes?: string }>,
  progressNotes: string,
  dayNumber: number,
  config?: OpenRouterConfig,
  personalNotes?: Array<{ title: string; content: string; rotation?: string | null }>,
  identifiers?: PatientIdentifiers
): Promise<AnalysisResponse> {
  const apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    throw new Error('OpenRouter API key is required')
  }

  const ordinals: Record<number, string> = {
    1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five',
    6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten'
  }
  const dayLabel = ordinals[dayNumber] ? `Day ${ordinals[dayNumber]}` : `Day ${dayNumber}`

  const previousContext = previousSummaries.length > 0
    ? '\n\n--- PREVIOUS ANALYSES ---\n' +
    previousSummaries.map((s, i) => {
      const label = s.version === 'admission' ? 'Admission Analysis' :
        s.version.startsWith('day_') ? `Day ${s.version.replace('day_', '')} Analysis` : s.version
      // Include full raw text for the most recent analysis (has latest test results & interpretations)
      // and for admission analysis (has initial test results). Use summary for middle analyses to save tokens.
      const isRecent = i === previousSummaries.length - 1
      const isAdmission = s.version === 'admission'
      const parts: string[] = []
      // Include user's submitted progress notes so AI sees what was actually reported each day
      if (s.userNotes) {
        parts.push(`${label} — USER SUBMITTED PROGRESS NOTES:\n${s.userNotes}`)
      }
      if ((isRecent || isAdmission) && s.rawText) {
        parts.push(`${label} — AI ANALYSIS (FULL):\n${s.rawText}`)
      } else {
        parts.push(`${label} — AI ANALYSIS (Summary): ${s.summary}`)
      }
      return parts.join('\n\n')
    }).join('\n\n') +
    '\n--- END PREVIOUS ANALYSES ---'
    : ''

  const notesContext = personalNotes && personalNotes.length > 0
    ? formatPersonalNotesContext(personalNotes)
    : ''

  const userMessage =
    `=== ORIGINAL ADMISSION HISTORY ===\n${admissionHistoryText}\n=== END ADMISSION HISTORY ===${previousContext}\n\n` +
    `=== ${dayLabel.toUpperCase()} OF ADMISSION PROGRESS NOTES ===\n${progressNotes}\n=== END PROGRESS NOTES ===${notesContext}\n\n` +
    `You are generating the ${dayLabel} of Admission clinical analysis.\n` +
    `Focus on:\n` +
    `1. Changes from the previous day (improving/deteriorating/stable)\n` +
    `2. ALWAYS interpret ALL test results present in the progress notes AND any test results from the initial admission history that have not been interpreted in previous analyses. The test_interpretation array must NEVER be empty if there are any test results anywhere in the history or progress notes. Apply the same no-repeat-tests rule for ordering new tests.\n` +
    `3. Adjusting the management plan based on the patient's trajectory\n` +
    `4. New complications arising or previously flagged complications that have resolved\n` +
    `5. Updated to-do list for today's tasks — do NOT re-list tasks already completed in previous days\n` +
    `6. If a pregnancy outcome occurred (delivery, miscarriage, stillbirth), UPDATE the obstetric formula in the clinical summary — e.g. G4P3+0 admitted → after miscarriage → now P3+1 (no longer gravid)\n\n` +
    `CRITICAL REQUIREMENTS — these sections must NEVER be empty:\n` +
    `- test_interpretation: Interpret ALL test results from progress notes AND admission history. Never empty if any test results exist.\n` +
    `- complications: ALWAYS list possible complications and prevention plans based on the patient's current condition, medications, and procedures. Never empty.\n` +
    `- impressions: ALWAYS provide current clinical impressions.\n` +
    `- differential_diagnoses: ALWAYS provide differentials.\n` +
    `- management_plan: Account for ALL medications and treatments mentioned in previous progress notes. If a drug was reported in a previous day (e.g. ceftriaxone), acknowledge it and build on it — do NOT say the antibiotic choice is unspecified.\n\n` +
    `SUMMARY WRITING STYLE — MANDATORY:\n` +
    `Describe SYMPTOMS first, then state what you are querying and what tests confirm/rule out.\n` +
    `WRONG: "She has developed post-abortion sepsis"\n` +
    `CORRECT: "Patient developed hotness of body and drenching sweats from day 3, with temperatures of 39.3°C — querying sepsis, plan: LFTs, UECs, serum lactate to rule in/out end-organ damage"\n` +
    `WRONG: "requires escalation to broad-spectrum antibiotics"\n` +
    `CORRECT: "Patient was on IV ceftriaxone 1g BD day 1-3, changed to IV ceftazidime 1g BD on day 4. Plan: change to IV meropenem 1g TDS"\n\n` +
    `Apply ALL the same clinical rules from your system instructions (AMBOSS-only, no hallucination, no forbidden phrases, specific drug dosing, etc.)`

  // PHI de-identification: mask patient name/identifier before sending to AI
  let maskedMessage = userMessage
  let tokenMap = new Map<string, string>()
  if (identifiers) {
    const anon = anonymize(userMessage, identifiers)
    maskedMessage = anon.masked
    tokenMap = anon.tokenMap
  }

  const response = await fetchWithRetry(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'MedFlow AI',
    },
    body: JSON.stringify({
      model: config?.model || 'anthropic/claude-sonnet-4',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: maskedMessage }
      ],
      temperature: 0.3,
      max_tokens: 8000,
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`OpenRouter API Error: ${response.status} - ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response from OpenRouter API')
  }

  const content = data.choices[0].message.content

  try {
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleanContent)

    if (!parsed.summary || !parsed.risk_level || !Array.isArray(parsed.todo_items)) {
      throw new Error('Invalid response structure from AI')
    }

    const sanitized = sanitizeAnalysis(parsed) as AnalysisResponse
    const qaChecked = await qaCheckAnalysis(sanitized, admissionHistoryText + '\n' + progressNotes, config)
    // Restore PHI in AI response so UI displays real patient names
    return deAnonymizeResponse(qaChecked, tokenMap)
  } catch (error) {
    console.error('Failed to parse AI daily response:', content)
    throw new Error('Failed to parse AI daily analysis response')
  }
}

const DISCHARGE_PROMPT = `You are generating a comprehensive discharge summary for a patient.
Based on the admission history and all clinical analyses during the hospital stay, produce a structured discharge summary.

Return ONLY a valid JSON response with this structure:

{
  "discharge_diagnosis": "Final diagnosis at discharge",
  "admission_diagnosis": "Original admission diagnosis",
  "hospital_course": "Summary of hospital course (2-3 paragraphs)",
  "procedures_performed": ["List of procedures performed during admission"],
  "discharge_medications": [
    { "drug": "Drug name", "dose": "Dose", "route": "Route", "frequency": "Frequency", "duration": "Duration or instructions" }
  ],
  "follow_up": [
    { "specialty": "Department/Specialty", "when": "Timeframe (e.g. 2 weeks)", "reason": "Purpose of follow-up" }
  ],
  "tests_pending": ["Tests or results to follow up on post-discharge"],
  "patient_instructions": ["Key instructions for the patient post-discharge"],
  "condition_at_discharge": "stable/improved/deteriorated/unchanged",
  "summary": "2-3 paragraph discharge summary suitable for clinical documentation"
}

Return ONLY the JSON object. No markdown code fences, no additional text.`

/**
 * Generate a discharge summary using AI.
 * Takes admission history and all analysis summaries from the hospital stay.
 */
export async function generateDischargeSummary(
  admissionHistoryText: string,
  analysisSummaries: Array<{ version: string; summary: string; rawText?: string }>,
  config?: OpenRouterConfig,
  identifiers?: PatientIdentifiers
): Promise<DischargeSummaryResponse> {
  const apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    throw new Error('OpenRouter API key is required')
  }

  const analysisContext = analysisSummaries.map(s => {
    const label = s.version === 'admission' ? 'Admission Analysis' :
      s.version.startsWith('day_') ? `Day ${s.version.replace('day_', '')} Analysis` : s.version
    return `${label}:\n${s.summary}`
  }).join('\n\n')

  let userMessage =
    `=== ADMISSION HISTORY ===\n${admissionHistoryText}\n=== END ADMISSION HISTORY ===\n\n` +
    `=== CLINICAL ANALYSES DURING STAY ===\n${analysisContext}\n=== END ANALYSES ===\n\n` +
    `Generate a comprehensive discharge summary based on the above admission history and clinical analyses.`

  // PHI de-identification: mask patient name/identifier before sending to AI
  let tokenMap = new Map<string, string>()
  if (identifiers) {
    const anon = anonymize(userMessage, identifiers)
    userMessage = anon.masked
    tokenMap = anon.tokenMap
  }

  const response = await fetchWithRetry(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'MedFlow AI',
    },
    body: JSON.stringify({
      model: config?.model || 'anthropic/claude-sonnet-4',
      messages: [
        { role: 'system', content: DISCHARGE_PROMPT },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 8000,
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`OpenRouter API Error: ${response.status} - ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response from OpenRouter API')
  }

  const content = data.choices[0].message.content

  try {
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleanContent)

    if (!parsed.summary || !parsed.discharge_diagnosis) {
      throw new Error('Invalid discharge summary structure from AI')
    }

    // Restore PHI in AI response so UI displays real patient names
    return deAnonymizeResponse(parsed as DischargeSummaryResponse, tokenMap)
  } catch (error) {
    console.error('Failed to parse AI discharge response:', content)
    throw new Error('Failed to parse AI discharge summary response')
  }
}

// === Fan-Out/Fan-In Analysis ===

const CLINICAL_ASSESSMENT_PROMPT = `You are a Clinical Assessment Specialist. Analyze the patient history and provide ONLY the clinical assessment components.

REFERENCE SOURCE: AMBOSS ONLY. No UpToDate, Medscape, BMJ, or WHO guidelines.

STRICTLY NO HALLUCINATION — use ONLY information in the history provided. Do NOT invent symptoms or findings.

${SYSTEM_PROMPT.slice(SYSTEM_PROMPT.indexOf('SIRS vs SEPSIS'), SYSTEM_PROMPT.indexOf('Drug Prescriptions in Management'))}

${SYSTEM_PROMPT.slice(SYSTEM_PROMPT.indexOf('LAB & TEST INTERPRETATION'), SYSTEM_PROMPT.indexOf('ORTHOPEDIC'))}

Return ONLY valid JSON:
{
  "test_interpretation": [
    { "number": 1, "test_name": "Name", "deranged_parameters": ["values"], "interpretation": "Clinical significance" }
  ],
  "impressions": ["Short diagnosis-style, numbered if multiple"],
  "differential_diagnoses": [
    { "diagnosis": "Name", "supporting_evidence": "Evidence for", "against_evidence": "Evidence against" }
  ],
  "gaps_in_history": {
    "follow_up_questions": ["Specific questions"],
    "physical_exam_checklist": ["Specific exams with REASON"]
  },
  "complications": [
    { "complication": "Possible complication", "prevention_plan": "Prevention steps" }
  ]
}

Return ONLY the JSON object. No markdown code fences.`

const MANAGEMENT_PLANNING_PROMPT = `You are a Management Planning Specialist. Analyze the patient history and provide ONLY the management plan components.

REFERENCE SOURCE: AMBOSS ONLY.

STRICTLY NO HALLUCINATION — use ONLY information in the history provided.

${SYSTEM_PROMPT.slice(SYSTEM_PROMPT.indexOf('Comorbidity-Aware Analysis'), SYSTEM_PROMPT.indexOf('Impression Format'))}

Drug Prescriptions in Management:
- Include specific drug prescriptions: Drug name, Dose, Route, Frequency
- Example: "Furosemide 40mg PO BD", "Amlodipine 5mg PO OD"
- Include medications for comorbidities
- Adjust doses for renal/hepatic impairment

NEVER say "if indicated" or "consider if needed" — BE SPECIFIC.

Return ONLY valid JSON:
{
  "risk_level": "low" | "medium" | "high",
  "management_plan": {
    "current_plan_analysis": "Analysis of current management",
    "recommended_plan": [
      { "step": "Drug name, Dose, Route, Frequency", "rationale": "Why indicated" }
    ],
    "adjustments_based_on_status": "How plan should adjust"
  },
  "confirmatory_tests": [
    { "test": "Test name — ONLY new tests not already done", "rationale": "Specific reason" }
  ],
  "todo_items": [
    {
      "title": "Brief action",
      "description": "Specific details with drug doses",
      "priority": "low" | "medium" | "high" | "urgent",
      "category": "physical_examination" | "investigations" | "differential_diagnosis" | "management_plan" | "complications" | "follow_up"
    }
  ]
}

Return ONLY the JSON object. No markdown code fences.`

const SYNTHESIS_PROMPT = `You are a Clinical Synthesis Specialist. You receive two partial analyses of the same patient and must produce a unified ward-round summary in SOAP-compatible format.

CLINICAL SUMMARY WRITING RULES — MANDATORY:
${SYSTEM_PROMPT.slice(SYSTEM_PROMPT.indexOf('DESCRIBE SYMPTOMS, NOT DIAGNOSES'), SYSTEM_PROMPT.indexOf('MISSING EXAM FINDINGS'))}

Given:
- The original patient history
- Clinical assessment (impressions, differentials, test interpretation, complications)
- Management plan (risk level, management plan, confirmatory tests, todo items)

Write a ward-round presentation summary following this EXACT order:
1. "[Name], [age]-year-old [sex], [parity if OB/GYN], doing day [N] of admission."
2. "Came in experiencing [chief complaint with brief context]."
3. "On examination: [key findings from vitals and physical exam]."
4. "Results: [test results and interpretation]."
5. "Impression: [working diagnosis/differential]."
6. "Current plan: [specific drugs with dose/route/frequency, monitoring, pending tests]."

LENGTH RULES:
- Simple cases (<3 active problems): Keep to 1 concise paragraph covering all 6 points.
- Complex cases (3+ active problems or significant changes): Use 2 paragraphs. Paragraph 1 = points 1-4. Paragraph 2 = points 5-6 with detailed reasoning.

DRUG SPECIFICITY: ALWAYS name every drug with dose/route/frequency. NEVER say "antibiotics", "escalation of care", or "IV fluids". Say "IV ceftriaxone 1g BD", "Normal saline 1L over 8 hours".

Return ONLY valid JSON:
{
  "summary": "The ward-round summary following the structure above"
}

Return ONLY the JSON object. No markdown code fences.`

/**
 * QA Agent — fast Haiku check to catch clinical rule violations.
 * Runs AFTER the main analysis, before saving to DB.
 */
const QA_PROMPT = `You are a Clinical QA Reviewer. Check the following AI-generated clinical analysis for violations of these ABSOLUTE rules:

ANEMIA RULES:
- Non-pregnant women: anemia = HB < 12.0. HB >= 12.0 is NORMAL, NOT anemia.
- Men: anemia = HB < 13.0. HB >= 13.0 is NORMAL.
- Pregnant women: anemia = HB < 11.0. HB >= 11.0 is NORMAL.
- Severity: Women: Mild 11-11.9, Moderate 8-10.9, Severe <8. Pregnant: Mild 10-10.9, Moderate 7-9.9, Severe <7.
- NEVER call HB >= 8 "severe anemia". NEVER call HB above threshold "anemia".

SEPSIS RULES:
- "Sepsis" is BANNED unless ALL of: >=2 SIRS criteria + infection + DOCUMENTED end-organ damage (elevated creatinine, elevated bilirubin, thrombocytopenia, GCS <15, hypotension needing vasopressors, PaO2/FiO2 <300).
- Without documented organ damage, use "SIRS secondary to [source]" or "querying sepsis."
- NEVER: "post-abortion sepsis", "evolving sepsis", "septic patient", "sepsis-induced", "septic cardiomyopathy", "septic shock" — unless organ damage PROVEN.

DRUG SPECIFICITY:
- NEVER use vague phrases: "antibiotic therapy", "escalation of care", "broad-spectrum antibiotics", "aggressive fluid resuscitation"
- ALWAYS name specific drugs with dose/route/frequency

FORBIDDEN PHRASES:
- "Complete CBC", "Full blood count", "Comprehensive LFTs", "Renal function tests", "Repeat [panel]"
- "despite symptoms", "despite antibiotic therapy", "if indicated", "consider if needed"

INVESTIGATION RULES:
- If ANY parameter from a panel is mentioned, the ENTIRE panel is done. Don't request the panel again.
- Only request NEW tests that provide DIFFERENT information.

NO HALLUCINATION:
- Only use information provided. Don't invent symptoms or findings.
- Normal WBC + normal CXR rules out hospital-acquired pneumonia.

Review the analysis below and return ONLY valid JSON:
{
  "violations_found": true/false,
  "corrections": [
    {
      "field": "path to the field (e.g. 'summary', 'impressions[0]', 'management_plan.recommended_plan[2].step')",
      "original": "the problematic text",
      "corrected": "the fixed text",
      "rule_violated": "brief description of the rule"
    }
  ]
}

If no violations, return: { "violations_found": false, "corrections": [] }
Return ONLY the JSON object. No markdown code fences.`

/**
 * Run a fast QA check on the analysis output using Haiku.
 * Returns the corrected analysis, or the original if QA passes / fails.
 */
async function qaCheckAnalysis(
  analysis: AnalysisResponse,
  historyText: string,
  config?: OpenRouterConfig
): Promise<AnalysisResponse> {
  const apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY
  if (!apiKey) return analysis

  try {
    const analysisJson = JSON.stringify(analysis, null, 2)
    const userMessage = `PATIENT HISTORY:\n${historyText.slice(0, 2000)}\n\nAI ANALYSIS OUTPUT:\n${analysisJson}`

    const response = await fetchWithRetry(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'MedFlow AI - QA',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-haiku',
        messages: [
          { role: 'system', content: QA_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      })
    })

    if (!response.ok) {
      console.warn('QA check failed with status', response.status, '— using original analysis')
      return analysis
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) return analysis

    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()
    const qaResult = JSON.parse(cleanContent)

    if (!qaResult.violations_found || !qaResult.corrections?.length) {
      console.log('QA check passed — no violations found')
      return analysis
    }

    console.log(`QA check found ${qaResult.corrections.length} violation(s), applying corrections`)

    // Apply corrections to the analysis
    let correctedAnalysis = JSON.parse(JSON.stringify(analysis)) // deep clone

    for (const correction of qaResult.corrections) {
      try {
        applyCorrection(correctedAnalysis, correction)
      } catch (e) {
        console.warn('Failed to apply QA correction:', correction.field, e)
      }
    }

    return correctedAnalysis as AnalysisResponse
  } catch (error) {
    console.warn('QA check error — using original analysis:', error)
    return analysis
  }
}

/**
 * Apply a single QA correction to the analysis object.
 * Handles simple paths like 'summary' and array paths like 'impressions[0]'.
 */
function applyCorrection(obj: any, correction: { field: string; original: string; corrected: string }) {
  const { field, original, corrected } = correction

  // Simple string replacement across the whole object if field path is complex
  const jsonStr = JSON.stringify(obj)
  if (jsonStr.includes(original)) {
    const fixed = jsonStr.replace(original, corrected)
    const parsed = JSON.parse(fixed)
    Object.assign(obj, parsed)
    return
  }

  // Try navigating the field path
  const parts = field.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/)
    if (arrayMatch) {
      current = current[arrayMatch[1]][parseInt(arrayMatch[2])]
    } else {
      current = current[part]
    }
    if (!current) return
  }

  const lastPart = parts[parts.length - 1]
  const lastArrayMatch = lastPart.match(/^(.+)\[(\d+)\]$/)
  if (lastArrayMatch) {
    const arr = current[lastArrayMatch[1]]
    const idx = parseInt(lastArrayMatch[2])
    if (typeof arr[idx] === 'string') {
      arr[idx] = corrected
    }
  } else if (typeof current[lastPart] === 'string') {
    current[lastPart] = corrected
  }
}

/**
 * Fan-Out/Fan-In analysis: runs clinical assessment and management planning
 * in parallel, then synthesizes into a unified result with QA check.
 */
export async function analyzePatientHistoryFanOut(
  historyText: string,
  config?: OpenRouterConfig,
  personalNotes?: Array<{ title: string; content: string; rotation?: string | null }>,
  identifiers?: PatientIdentifiers
): Promise<AnalysisResponse> {
  const apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OpenRouter API key is required')

  let userContent = historyText
  if (personalNotes && personalNotes.length > 0) {
    userContent += formatPersonalNotesContext(personalNotes)
  }

  // PHI de-identification: mask patient name/identifier before sending to AI
  let tokenMap = new Map<string, string>()
  if (identifiers) {
    const anon = anonymize(userContent, identifiers)
    userContent = anon.masked
    tokenMap = anon.tokenMap
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'MedFlow AI',
  }

  // Fan-Out: run clinical assessment and management planning in parallel
  const [clinicalResult, managementResult] = await Promise.all([
    fetchWithRetry(OPENROUTER_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config?.model || 'anthropic/claude-sonnet-4',
        messages: [
          { role: 'system', content: CLINICAL_ASSESSMENT_PROMPT },
          { role: 'user', content: userContent }
        ],
        temperature: 0.3,
        max_tokens: 5000,
      })
    }),
    fetchWithRetry(OPENROUTER_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config?.model || 'anthropic/claude-sonnet-4',
        messages: [
          { role: 'system', content: MANAGEMENT_PLANNING_PROMPT },
          { role: 'user', content: userContent }
        ],
        temperature: 0.3,
        max_tokens: 5000,
      })
    })
  ])

  if (!clinicalResult.ok || !managementResult.ok) {
    // Fallback to single-call analysis
    console.warn('Fan-out sub-agent failed, falling back to single-call analysis')
    return analyzePatientHistory(historyText, config, personalNotes, identifiers)
  }

  const [clinicalData, managementData] = await Promise.all([
    clinicalResult.json(),
    managementResult.json()
  ])

  let clinical: any, management: any
  try {
    const clinicalContent = clinicalData.choices[0].message.content.replace(/```json\n?|\n?```/g, '').trim()
    clinical = JSON.parse(clinicalContent)
  } catch {
    console.warn('Failed to parse clinical assessment, falling back to single-call')
    return analyzePatientHistory(historyText, config, personalNotes, identifiers)
  }

  try {
    const managementContent = managementData.choices[0].message.content.replace(/```json\n?|\n?```/g, '').trim()
    management = JSON.parse(managementContent)
  } catch {
    console.warn('Failed to parse management plan, falling back to single-call')
    return analyzePatientHistory(historyText, config, personalNotes, identifiers)
  }

  // Synthesis: generate the ward-round summary using both outputs
  // Anonymize the historyText again for synthesis (userContent was already anonymized above,
  // but synthesisInput re-uses raw historyText)
  let maskedHistoryForSynthesis = historyText
  if (identifiers) {
    maskedHistoryForSynthesis = anonymize(historyText, identifiers).masked
  }
  const synthesisInput = `PATIENT HISTORY:\n${maskedHistoryForSynthesis}\n\nCLINICAL ASSESSMENT:\n${JSON.stringify(clinical, null, 2)}\n\nMANAGEMENT PLAN:\n${JSON.stringify(management, null, 2)}`

  const synthesisResult = await fetchWithRetry(OPENROUTER_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config?.model || 'anthropic/claude-sonnet-4',
      messages: [
        { role: 'system', content: SYNTHESIS_PROMPT },
        { role: 'user', content: synthesisInput }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })
  })

  let summary = ''
  if (synthesisResult.ok) {
    const synthesisData = await synthesisResult.json()
    try {
      const synthContent = synthesisData.choices[0].message.content.replace(/```json\n?|\n?```/g, '').trim()
      const synthParsed = JSON.parse(synthContent)
      summary = synthParsed.summary || ''
    } catch {
      summary = ''
    }
  }

  // Merge all results into the final AnalysisResponse
  const merged: any = {
    risk_level: management.risk_level || 'medium',
    gaps_in_history: clinical.gaps_in_history || { follow_up_questions: [], physical_exam_checklist: [] },
    test_interpretation: clinical.test_interpretation || [],
    impressions: clinical.impressions || [],
    differential_diagnoses: clinical.differential_diagnoses || [],
    confirmatory_tests: management.confirmatory_tests || [],
    management_plan: management.management_plan || { current_plan_analysis: '', recommended_plan: [], adjustments_based_on_status: '' },
    complications: clinical.complications || [],
    summary: summary || 'Summary generation failed — please review the individual sections.',
    todo_items: management.todo_items || [],
  }

  // Sanitize then QA check
  const sanitized = sanitizeAnalysis(merged)
  const qaChecked = await qaCheckAnalysis(sanitized as AnalysisResponse, historyText, config)

  // Restore PHI in AI response so UI displays real patient names
  return deAnonymizeResponse(qaChecked, tokenMap)
}

// === Senior Peer Review ===

const SPARK_PROMPTS: Record<SparkFormat, string> = {
  senior_asks: `You are a PGY-3 senior resident doing an informal bedside teaching moment with an intern. Tone: collegial, not condescending. Like a friend who happens to know more.

INPUT: Medical conditions from the intern's patients.
OUTPUT: ONE pointed clinical reasoning question a senior would ask on rounds — focused on the "why" behind management decisions, pathophysiology that guides the plan, or gray areas where reasonable doctors disagree.

Return ONLY valid JSON:
{
  "question": "The question the senior asks — direct, specific, clinically relevant",
  "context": "Brief patient setup (1 sentence): 'Your patient with X is on Y...'",
  "answer": "Clear, concise answer (3-4 sentences max). Teach the reasoning, not just the fact.",
  "teaching_point": "The deeper concept this question tests — why it matters for the intern's clinical growth",
  "clinical_pearl": "One memorable takeaway they can use tomorrow on rounds",
  "topic": "Condition name"
}

Rules:
- Ask questions that test REASONING, not recall. "Why enoxaparin over heparin here?" not "What is the MOA of enoxaparin?"
- The answer should explain the clinical logic, not just state facts
- Include specific drugs with doses where relevant
- Reference AMBOSS-level knowledge only
- This should feel like a 30-second corridor conversation, not a lecture
- Return ONLY the JSON object, no markdown fences`,

  quick_teach: `You are a PGY-3 senior resident giving a quick bedside teaching moment to an intern about a condition they're managing. Tone: friendly, efficient, practical.

INPUT: Medical conditions from the intern's patients.
OUTPUT: A focused teaching moment — a classification, mnemonic, set of diagnostic criteria, or pathophysiology summary directly relevant to their patient's condition.

Return ONLY valid JSON:
{
  "topic": "Condition name",
  "intro": "One sentence connecting this to the patient: 'Since you have a patient with X, let's quickly review...'",
  "teach_type": "classification" | "mnemonic" | "pathophysiology" | "criteria",
  "cards": [
    { "id": "1", "title": "Card title (e.g. 'Class I' or 'S - Stasis')", "content": "2-3 sentence explanation. Practical, not textbook." },
    { "id": "2", "title": "Title", "content": "Explanation" },
    { "id": "3", "title": "Title", "content": "Explanation" },
    { "id": "4", "title": "Title", "content": "Explanation" }
  ],
  "summary_pearl": "One sentence that ties it all together — the clinical takeaway"
}

Rules:
- 3-5 cards maximum. Each card is ONE concept, tappable to reveal
- Examples: NYHA classification for HF, Virchow's triad for DVT, CURB-65 for pneumonia, Wells score for PE
- For mnemonics: each letter/component gets its own card
- For classifications: each class/stage gets its own card
- Content must be concise and ward-applicable — not a textbook paragraph
- Reference AMBOSS only
- Return ONLY the JSON object, no markdown fences`,

  know_your_drugs: `You are a PGY-3 senior resident doing a quick pharmacology teaching moment with an intern about drugs relevant to their patient. Tone: practical, ward-focused. "Here's what you actually need to know."

INPUT: Medical conditions from the intern's patients.
OUTPUT: A focused drug comparison or pharmacology review relevant to the condition — which drugs to use, when to switch, when to stop, key dosing pearls.

Return ONLY valid JSON:
{
  "topic": "Condition/drug class name",
  "context": "One sentence: 'Your patient with X is on Y. Let's talk about the options...'",
  "drugs": [
    { "name": "Drug name (with dose/route if relevant)", "mechanism": "One sentence MOA — keep it simple", "when_to_use": "Specific clinical scenario when this is the right choice", "key_point": "The ONE thing the intern must remember about this drug" },
    { "name": "Drug 2", "mechanism": "MOA", "when_to_use": "When to use", "key_point": "Key point" },
    { "name": "Drug 3", "mechanism": "MOA", "when_to_use": "When to use", "key_point": "Key point" }
  ],
  "clinical_pearl": "The practical pearl: when to switch, when to stop, the common mistake interns make with these drugs"
}

Rules:
- 2-4 drugs maximum. Compare drugs within the SAME clinical context
- Examples: anticoagulants for DVT (enoxaparin vs rivaroxaban vs warfarin), antibiotics for UTI, antihypertensives in pregnancy
- Include specific doses and routes where practical
- "when_to_use" should describe the specific clinical scenario, not just the indication
- "key_point" should be the thing that prevents a prescribing error
- Reference AMBOSS only
- Return ONLY the JSON object, no markdown fences`,

  clinical_twist: `You are a PGY-3 senior resident challenging an intern with a "what if" scenario based on their patient. Tone: Socratic, collegial. "Good plan. But what changes if..."

INPUT: Medical conditions from the intern's patients.
OUTPUT: A scenario where ONE variable changes and the entire management plan pivots. Forces the intern to think about how single data points change clinical decisions.

Return ONLY valid JSON:
{
  "topic": "Condition name",
  "scenario": "Brief current scenario (1-2 sentences): 'Your patient with X is stable on Y plan...'",
  "twist": "The variable that changes (1 sentence): 'What if their potassium comes back at 2.8?' or 'What if they develop oliguria?'",
  "original_plan": "Brief summary of the current/expected management (1-2 sentences)",
  "revised_plan": "How management changes with the twist — specific drugs, doses, monitoring (2-3 sentences)",
  "reasoning": "Why this change matters — the pathophysiology or clinical logic behind the pivot (2-3 sentences)",
  "clinical_pearl": "The takeaway: a rule or principle that applies broadly"
}

Rules:
- The twist should be ONE realistic variable change: a lab result, a new symptom, a comorbidity, an allergy
- The management pivot must be specific — name drugs, doses, and monitoring changes
- Reasoning should connect the pathophysiology to the management change
- This should feel like a real ward scenario, not a textbook question
- Common twists: electrolyte changes, renal/hepatic impairment, pregnancy, drug allergies, treatment failure at 72h
- Reference AMBOSS only
- Return ONLY the JSON object, no markdown fences`,
}

/**
 * Generate a Senior Peer Review discussion based on conditions seen today.
 */
export async function generateLearningSpark(
  format: SparkFormat,
  conditions: string[],
  config?: OpenRouterConfig
): Promise<SparkContent> {
  const apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    throw new Error('OpenRouter API key is required')
  }

  const userMessage = `Medical conditions from the intern's patients: ${conditions.join(', ')}\n\nPick the most clinically interesting condition and generate a focused teaching moment about it. Think about what a senior resident would want to discuss with an intern managing this patient.`

  const response = await fetchWithRetry(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'MedFlow AI - Senior Peer Review',
    },
    body: JSON.stringify({
      model: config?.model || 'anthropic/claude-3.5-haiku',
      messages: [
        { role: 'system', content: SPARK_PROMPTS[format] },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    if (response.status === 402) {
      throw new Error('Insufficient OpenRouter credits. Add credits at openrouter.ai/settings/credits')
    }
    throw new Error(`OpenRouter API Error: ${response.status} - ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response from OpenRouter API')
  }

  const content = data.choices[0].message.content
  const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(cleanContent) as SparkContent
}
