/**
 * POST /api/admin/reformat-round-notes
 * Regenerates ward round notes for all admission analyses that are missing one,
 * using the agreed WARD_ROUND_NOTE_PROMPT format.
 * Day-N analyses are skipped — their user_feedback is the clinician's own progress notes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseServerClient } from '@/lib/supabase/server'
import { generateWardRoundNote } from '@/lib/openrouter/client'

export const dynamic = 'force-dynamic'

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
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
    // When force=true, regenerate even analyses that already have a round note
    const force = body.force === true

    const admin = getSupabaseServerClient()

    // Fetch all admission analyses for this user, joined with history_text
    const query = admin
      .from('analyses')
      .select('id, user_feedback, patient_history_id, patient_histories!inner(history_text)')
      .eq('user_id', user.id)
      .eq('analysis_version', 'admission')
      .limit(limit)

    const { data: analyses, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!analyses || analyses.length === 0) {
      return NextResponse.json({ updated: 0, message: 'No admission analyses found.' })
    }

    // Only process those missing a round note (unless force=true)
    const toProcess = force
      ? analyses
      : analyses.filter(a => !a.user_feedback?.trim())

    if (toProcess.length === 0) {
      return NextResponse.json({
        updated: 0,
        skipped: analyses.length,
        message: `All ${analyses.length} patients already have round notes. Use force=true to regenerate.`,
      })
    }

    let updated = 0
    let skipped = analyses.length - toProcess.length
    const errors: string[] = []

    for (const analysis of toProcess) {
      try {
        const historyText = (analysis.patient_histories as any)?.history_text
        if (!historyText?.trim()) {
          errors.push(`${analysis.id}: no history_text`)
          continue
        }

        const note = await generateWardRoundNote(historyText)

        const { error: updateError } = await admin
          .from('analyses')
          .update({ user_feedback: note })
          .eq('id', analysis.id)

        if (updateError) throw new Error(updateError.message)
        updated++
      } catch (err: any) {
        errors.push(`${analysis.id}: ${err.message}`)
      }

      // Pause between AI calls to avoid rate limiting
      await sleep(600)
    }

    const failed = toProcess.length - updated
    return NextResponse.json({
      updated,
      skipped,
      failed,
      total: analyses.length,
      message: `Generated round notes for ${updated} of ${toProcess.length} patients.${skipped > 0 ? ` ${skipped} already had notes (skipped).` : ''}${failed > 0 ? ` ${failed} failed.` : ''}`,
      ...(errors.length > 0 && { errors: errors.slice(0, 10) }),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
