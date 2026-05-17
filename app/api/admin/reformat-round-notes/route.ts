/**
 * POST /api/admin/reformat-round-notes
 * Rewrites user_feedback (submitted round notes) on daily analyses to include:
 * 1. The short factual clinical summary at the top
 * 2. The AI recommended plan + adjustments in the PLAN section
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function extractManagementPlan(rawText: string): string {
  if (!rawText) return ''

  const mgmtMatch = rawText.match(/## Management Plan\s*([\s\S]*?)(?=\n## |$)/i)
  if (!mgmtMatch) return ''

  const mgmtContent = mgmtMatch[1]

  const parts: string[] = []

  // Extract recommended plan steps
  const recMatch = mgmtContent.match(/\*\*Recommended Plan:\*\*\s*([\s\S]*?)(?:\*\*Adjustments|$)/i)
  if (recMatch?.[1]?.trim()) {
    const steps = recMatch[1].trim()
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map((l, i) => `${i + 1}. ${l.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1').trim()}`)
    if (steps.length) parts.push(`Recommended Plan:\n${steps.join('\n')}`)
  }

  // Extract adjustments
  const adjMatch = mgmtContent.match(/\*\*Adjustments Based on Patient Status:\*\*\s*([\s\S]*?)$/i)
  if (adjMatch?.[1]?.trim()) {
    const adj = adjMatch[1].trim().replace(/\*\*(.*?)\*\*/g, '$1')
    if (adj && adj.toLowerCase() !== 'n/a' && adj.length > 5) parts.push(`Adjustments Based on Patient Status: ${adj}`)
  }

  return parts.join('\n\n')
}

function rebuildNotes(existingNotes: string, clinicalSummary: string, aiPlan: string): string {
  if (!existingNotes && !clinicalSummary && !aiPlan) return ''

  const lines = existingNotes.split('\n')
  const knownHeaders = ['Review of Systems:', 'Vital Signs:', 'Physical Examination:', 'Investigations:', 'PLAN:']

  // Split existing notes into blocks by known headers
  const blocks: { header: string | null; content: string }[] = []
  let currentHeader: string | null = null
  let currentLines: string[] = []

  for (const line of lines) {
    const isHeader = knownHeaders.some(h => line.trim().startsWith(h))
    if (isHeader) {
      if (currentLines.length > 0) {
        blocks.push({ header: currentHeader, content: currentLines.join('\n').trim() })
      }
      currentHeader = line.trim()
      currentLines = []
    } else {
      currentLines.push(line)
    }
  }
  if (currentLines.length > 0) {
    blocks.push({ header: currentHeader, content: currentLines.join('\n').trim() })
  }

  // Build new notes
  const result: string[] = []

  // Opening: AI clinical summary (or existing opening paragraph)
  if (clinicalSummary) {
    result.push(clinicalSummary)
  } else {
    const opening = blocks.find(b => b.header === null)
    if (opening?.content) result.push(opening.content)
  }

  // Middle sections in order
  const sectionOrder = ['Review of Systems:', 'Vital Signs:', 'Physical Examination:', 'Investigations:']
  for (const header of sectionOrder) {
    const block = blocks.find(b => b.header === header)
    if (block?.content) result.push(`${header}\n${block.content}`)
  }

  // PLAN: AI plan first, then any existing user plan content
  const userPlanBlock = blocks.find(b => b.header === 'PLAN:')
  const planParts: string[] = []
  if (aiPlan) planParts.push(aiPlan)
  if (userPlanBlock?.content) {
    // Avoid duplicating AI plan if it was already there
    const userPlanText = userPlanBlock.content
    const alreadyHasAiPlan = aiPlan && userPlanText.includes(aiPlan.slice(0, 40))
    if (!alreadyHasAiPlan) planParts.push(userPlanText)
  }
  if (planParts.length > 0) result.push(`PLAN:\n${planParts.join('\n\n')}`)

  return result.join('\n\n').trim()
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit ?? 100, 200)

    const admin = getSupabaseServerClient()

    // Fetch daily analyses (not admission) that have submitted round notes
    const { data: analyses, error: fetchError } = await admin
      .from('analyses')
      .select('id, summary, raw_analysis_text, user_feedback')
      .eq('user_id', user.id)
      .neq('analysis_version', 'admission')
      .not('user_feedback', 'is', null)
      .neq('user_feedback', '')
      .limit(limit)

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!analyses || analyses.length === 0) {
      return NextResponse.json({ updated: 0, message: 'No submitted round notes found.' })
    }

    let updated = 0
    const errors: string[] = []

    for (const analysis of analyses) {
      try {
        const aiPlan = extractManagementPlan(analysis.raw_analysis_text || '')
        const newNotes = rebuildNotes(
          analysis.user_feedback || '',
          analysis.summary || '',
          aiPlan
        )

        if (!newNotes || newNotes === (analysis.user_feedback || '').trim()) {
          updated++ // already correct format, count as done
          continue
        }

        const { error: updateError } = await admin
          .from('analyses')
          .update({ user_feedback: newNotes })
          .eq('id', analysis.id)

        if (updateError) throw new Error(updateError.message)
        updated++
      } catch (err: any) {
        errors.push(`${analysis.id}: ${err.message}`)
      }

      await sleep(50) // small pause
    }

    const failed = analyses.length - updated
    return NextResponse.json({
      updated,
      failed,
      total: analyses.length,
      message: `Reformatted ${updated} of ${analyses.length} round notes.${failed > 0 ? ` ${failed} failed.` : ''}`,
      ...(errors.length > 0 && { errors: errors.slice(0, 5) }),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
