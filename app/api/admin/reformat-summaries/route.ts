/**
 * POST /api/admin/reformat-summaries
 * Rewrites the `summary` field on every analysis the user owns,
 * using the new short-factual format (no impressions or management plans).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const REFORMAT_PROMPT = `You are reformatting an existing clinical summary into a shorter, factual handover format.

NEW FORMAT RULES — follow exactly:
1. "[Name], [age]-year-old [sex], [parity if OB/GYN], doing day [N] of admission."
2. Chief complaint and relevant background from the history.
3. Key examination findings (general appearance, vitals, significant exam findings).
4. Investigations sent and any available results — state factually, do not interpret.
5. Treatments and procedures already given — name every drug with dose/route/frequency.
6. Any pending plans explicitly stated in the history (e.g. "planning CT head").

STRICT RULES:
- Do NOT include impressions, working diagnoses, differentials, or management recommendations.
- Do NOT add any information not present in the history or old summary.
- One concise paragraph for most cases. Two only if genuinely complex.
- Name specific drugs with dose/route/frequency. Never say "antibiotics" or "IV fluids".

Return ONLY valid JSON with no markdown fences:
{"summary": "the reformatted summary"}`

async function reformatSummary(
  historyText: string,
  oldSummary: string,
  apiKey: string
): Promise<string> {
  const userContent =
    `PATIENT HISTORY:\n${historyText}\n\n` +
    `OLD SUMMARY:\n${oldSummary}\n\n` +
    `Rewrite the summary following the new format rules.`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'MedFlow AI',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4-5-20251001',
      messages: [
        { role: 'system', content: REFORMAT_PROMPT },
        { role: 'user', content: userContent },
      ],
      max_tokens: 600,
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenRouter ${response.status}: ${errText.slice(0, 200)}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content?.replace(/```json\n?|\n?```/g, '').trim()
  if (!content) throw new Error('Empty response from AI')
  const parsed = JSON.parse(content)
  if (!parsed.summary) throw new Error('No summary field in AI response')
  return parsed.summary
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenRouter API key not configured' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit ?? 50, 100)

    const admin = getSupabaseServerClient()

    // Filter directly on analyses.user_id — no join needed for auth
    const { data: analyses, error: fetchError } = await admin
      .from('analyses')
      .select('id, summary, patient_history_id')
      .eq('user_id', user.id)
      .not('summary', 'is', null)
      .neq('summary', '')
      .limit(limit)

    if (fetchError) {
      return NextResponse.json({ error: `Fetch error: ${fetchError.message}` }, { status: 500 })
    }

    if (!analyses || analyses.length === 0) {
      return NextResponse.json({ updated: 0, message: 'No analyses found.' })
    }

    let updated = 0
    const errors: string[] = []

    for (const analysis of analyses) {
      if (!analysis.summary || !analysis.patient_history_id) {
        errors.push(`${analysis.id}: missing summary or patient_history_id`)
        continue
      }

      // Fetch history text for this analysis
      const { data: patient, error: patientError } = await admin
        .from('patient_histories')
        .select('history_text')
        .eq('id', analysis.patient_history_id)
        .single()

      if (patientError || !patient?.history_text) {
        errors.push(`${analysis.id}: could not fetch history — ${patientError?.message || 'no history_text'}`)
        continue
      }

      try {
        const newSummary = await reformatSummary(patient.history_text, analysis.summary, apiKey)

        const { error: updateError } = await admin
          .from('analyses')
          .update({ summary: newSummary })
          .eq('id', analysis.id)

        if (updateError) throw new Error(updateError.message)
        updated++
      } catch (err: any) {
        errors.push(`${analysis.id}: ${err.message}`)
      }
    }

    const failed = analyses.length - updated
    return NextResponse.json({
      updated,
      failed,
      total: analyses.length,
      message: `Reformatted ${updated} of ${analyses.length} summaries.${failed > 0 ? ` ${failed} failed.` : ''}`,
      ...(errors.length > 0 && { errors: errors.slice(0, 5) }),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
