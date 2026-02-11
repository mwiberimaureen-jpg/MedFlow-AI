import { AnalysisResponse } from '@/lib/types/patient'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

interface OpenRouterConfig {
  apiKey: string
  model?: string
}

const SYSTEM_PROMPT = `You are a senior clinical analyst generating a structured medical analysis report. Analyze the patient history and return ONLY a valid JSON response with the structure below.

CRITICAL RULES FOR TEST INTERPRETATION:
- For any test where specific parameters are reported, ASSUME the full panel was done and ONLY the reported parameters are deranged. All unreported parameters are normal. NEVER ask for a "comprehensive" or "full" test when some parameters have already been provided.
- Interpret each deranged parameter individually and explain its clinical significance.

The JSON structure:

{
  "risk_level": "low" | "medium" | "high",
  "gaps_in_history": {
    "missing_information": ["List specific missing elements: e.g. drug allergies, social history, family history, duration of symptoms, etc."],
    "follow_up_questions": ["Specific questions to ask the patient to fill the gaps"],
    "physical_exam_checklist": ["Specific physical exam findings to look for, relevant to the presentation"]
  },
  "test_interpretation": [
    {
      "number": 1,
      "test_name": "Name of the test",
      "deranged_parameters": ["List the specific abnormal values reported"],
      "normal_parameters_assumed": "State that unreported parameters are assumed normal",
      "interpretation": "Clinical significance of the deranged values in context of the patient"
    }
  ],
  "impressions": ["Primary impression(s) based on the history and available results"],
  "differential_diagnoses": [
    {
      "diagnosis": "Diagnosis name",
      "supporting_evidence": "Evidence from the history supporting this",
      "against_evidence": "Evidence against or missing evidence"
    }
  ],
  "confirmatory_tests": [
    {
      "test": "Test name",
      "rationale": "What it will confirm or rule out"
    }
  ],
  "management_plan": {
    "current_plan_analysis": "Analysis of whatever management has been described in the history (medications, interventions, etc.). If none described, state 'No current management plan documented.'",
    "recommended_plan": [
      {
        "step": "Management step",
        "rationale": "Why this is indicated, reference AMBOSS/standard guidelines where relevant"
      }
    ],
    "adjustments_based_on_status": "If the patient is described as improving or deteriorating, explain how the plan should be adjusted accordingly"
  },
  "complications": [
    {
      "complication": "Possible complication",
      "prevention_plan": "Steps to prevent or monitor for this complication"
    }
  ],
  "summary": "A concise clinical summary tying everything together (2-3 paragraphs)",
  "todo_items": [
    {
      "title": "Brief action item title",
      "description": "What to do",
      "priority": "low" | "medium" | "high" | "urgent",
      "category": "diagnostic" | "treatment" | "follow-up" | "referral" | "monitoring" | "lifestyle"
    }
  ]
}

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

    return parsed as AnalysisResponse
  } catch (error) {
    console.error('Failed to parse AI response:', content)
    throw new Error('Failed to parse AI analysis response')
  }
}
