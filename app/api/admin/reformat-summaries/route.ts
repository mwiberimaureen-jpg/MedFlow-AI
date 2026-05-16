/**
 * POST /api/admin/reformat-summaries
 * Rewrites the `summary` field on every analysis the user owns,
 * using the new short-factual format (no impressions or management plans).
 * Processes up to `limit` analyses per call (default 50).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
// Allow up to 5 minutes for large accounts
export const maxDuration = 300

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

  if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`)

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content?.replace(/```json\n?|\n?```/g, '').trim()
  const parsed = JSON.parse(content)
  if (!parsed.summary) throw new Error('No summary in response')
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

    // Fetch all analyses for this user via the service role (bypasses RLS for the join)
    const admin = getSupabaseServerClient()
    const { data: analyses, error: fetchError } = await admin
      .from('analyses')
      .select(`
        id,
        summary,
        patient_histories!inner ( history_text, user_id )
      `)
      .eq('patient_histories.user_id', user.id)
      .not('summary', 'is', null)
      .neq('summary', '')
      .limit(limit)

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!analyses || analyses.length === 0) {
      return NextResponse.json({ updated: 0, message: 'No analyses found.' })
    }

    let updated = 0
    let failed = 0

    for (const analysis of analyses) {
      const historyText = (analysis.patient_histories as any)?.history_text
      if (!historyText || !analysis.summary) { failed++; continue }

      try {
        const newSummary = await reformatSummary(historyText, analysis.summary, apiKey)

        await admin
          .from('analyses')
          .update({ summary: newSummary })
          .eq('id', analysis.id)

        updated++
      } catch {
        failed++
      }
    }

    return NextResponse.json({
      updated,
      failed,
      total: analyses.length,
      message: `Reformatted ${updated} of ${analyses.length} summaries.${failed > 0 ? ` ${failed} failed.` : ''}`,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
