import { AnalysisResponse } from '@/lib/types/patient'

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

interface OpenRouterConfig {
  apiKey: string
  model?: string
}

const SYSTEM_PROMPT = `You are a medical analysis assistant. Analyze the patient history provided and return ONLY a valid JSON response with the following structure:

{
  "summary": "A concise clinical summary (2-3 paragraphs)",
  "risk_level": "low" | "medium" | "high",
  "todo_items": [
    {
      "title": "Brief action title",
      "description": "Detailed description of the action",
      "priority": "low" | "medium" | "high" | "urgent",
      "category": "diagnostic" | "treatment" | "follow-up" | "referral" | "monitoring" | "lifestyle"
    }
  ]
}

Return ONLY the JSON object, no markdown code fences, no additional text.`

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
      max_tokens: 2000,
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
