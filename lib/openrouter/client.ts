import { AnalysisResponse } from '@/lib/types/patient'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

interface OpenRouterConfig {
  apiKey: string
  model?: string
}

const SYSTEM_PROMPT = `You are a Clinician Archetype. Analyze patient history to reach a diagnosis or differential diagnosis.

ROLE AND OUTPUT:
- Provide a SINGLE, COMPREHENSIVE to-do list formatted as a checklist. Do not split into multiple responses.
- Always include follow-up questions.
- Components: Physical exam, Impression, Differential Diagnoses.
- Outputs: Relevant tests (rule in/out), Interpretation of results, Follow-up tests (e.g. imaging), Management Plan WITH SPECIFIC DRUG PRESCRIPTIONS, Possible Complications + Prevention Plan.

SPECIALTY KNOWLEDGE: Impeccable history taking, Pharmacology (drug interactions, dosing by weight/renal function), Internal Medicine, General Surgery, Paediatrics, OB/GYN.

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
    "missing_information": ["List specific missing elements"],
    "follow_up_questions": ["Specific questions to ask the patient"],
    "physical_exam_checklist": ["Specific physical exam findings to look for, with REASON for each based on history"]
  },
  "test_interpretation": [
    {
      "number": 1,
      "test_name": "Name of the test",
      "deranged_parameters": ["List the specific abnormal values reported"],
      "normal_parameters_assumed": "State that all other parameters in this panel are assumed normal",
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
        "rationale": "Why this is indicated, based on AMBOSS guidelines"
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
  "summary": "A concise clinical summary (2-3 paragraphs)",
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

export async function analyzePatientHistory(
  historyText: string,
  config?: OpenRouterConfig
): Promise<AnalysisResponse> {
  const apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    throw new Error('OpenRouter API key is required')
  }

  const response = await fetch(OPENROUTER_API_URL, {
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
          content: historyText
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

    return sanitized as AnalysisResponse
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
  previousSummaries: Array<{ version: string; summary: string }>,
  progressNotes: string,
  dayNumber: number,
  config?: OpenRouterConfig
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
    ? '\n\n--- PREVIOUS ANALYSES SUMMARY ---\n' +
    previousSummaries.map(s => {
      const label = s.version === 'admission' ? 'Admission Analysis' :
        s.version.startsWith('day_') ? `Day ${s.version.replace('day_', '')} Analysis` : s.version
      return `${label}: ${s.summary}`
    }).join('\n\n') +
    '\n--- END PREVIOUS ANALYSES SUMMARY ---'
    : ''

  const userMessage =
    `=== ORIGINAL ADMISSION HISTORY ===\n${admissionHistoryText}\n=== END ADMISSION HISTORY ===${previousContext}\n\n` +
    `=== ${dayLabel.toUpperCase()} OF ADMISSION PROGRESS NOTES ===\n${progressNotes}\n=== END PROGRESS NOTES ===\n\n` +
    `You are generating the ${dayLabel} of Admission clinical analysis.\n` +
    `Focus on:\n` +
    `1. Changes from the previous day (improving/deteriorating/stable)\n` +
    `2. Interpreting any NEW test results mentioned in today's notes (apply the same no-repeat-tests rule)\n` +
    `3. Adjusting the management plan based on the patient's trajectory\n` +
    `4. New complications arising or previously flagged complications that have resolved\n` +
    `5. Updated to-do list for today's tasks — do NOT re-list tasks already completed in previous days\n\n` +
    `Apply ALL the same clinical rules from your system instructions (AMBOSS-only, no hallucination, no forbidden phrases, specific drug dosing, etc.)`

  const response = await fetch(OPENROUTER_API_URL, {
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

    if (!parsed.summary || !parsed.risk_level || !Array.isArray(parsed.todo_items)) {
      throw new Error('Invalid response structure from AI')
    }

    return sanitizeAnalysis(parsed) as AnalysisResponse
  } catch (error) {
    console.error('Failed to parse AI daily response:', content)
    throw new Error('Failed to parse AI daily analysis response')
  }
}
