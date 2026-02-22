/**
 * API Route: Add Daily Progress Note & Generate Day Analysis
 * POST /api/patients/[id]/daily-note
 *
 * Body: { progress_notes: string, day_number: number }
 * Creates an analysis with analysis_version: 'day_N' for the given patient.
 * Stores progress notes in the user_feedback field.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeDailyProgress } from '@/lib/openrouter/client'

export const dynamic = 'force-dynamic'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const startTime = Date.now()

    try {
        const { id } = await params
        const supabase = await createClient()

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { progress_notes, day_number } = body as { progress_notes: string; day_number: number }

        if (!progress_notes || typeof progress_notes !== 'string' || progress_notes.trim().length < 10) {
            return NextResponse.json(
                { error: 'Progress notes must be at least 10 characters' },
                { status: 400 }
            )
        }

        if (!day_number || typeof day_number !== 'number' || day_number < 1) {
            return NextResponse.json({ error: 'Invalid day_number' }, { status: 400 })
        }

        // Fetch the patient history
        const { data: patient, error: patientError } = await supabase
            .from('patient_histories')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .single()

        if (patientError || !patient) {
            return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
        }

        // Fetch all existing analyses ordered chronologically
        const { data: existingAnalyses } = await supabase
            .from('analyses')
            .select('id, analysis_version, summary, created_at')
            .eq('patient_history_id', id)
            .order('created_at', { ascending: true })

        const versionKey = `day_${day_number}`

        // Prevent duplicate day analyses
        const dupCheck = existingAnalyses?.find(a => a.analysis_version === versionKey)
        if (dupCheck) {
            return NextResponse.json(
                { error: `Day ${day_number} analysis already exists` },
                { status: 400 }
            )
        }

        // Build summaries of previous analyses for AI context
        const previousSummaries = (existingAnalyses || []).map(a => ({
            version: a.analysis_version || 'unknown',
            summary: a.summary || ''
        }))

        // Call OpenRouter AI for daily progress analysis
        const analysisResponse = await analyzeDailyProgress(
            patient.history_text,
            previousSummaries,
            progress_notes.trim(),
            day_number
        )

        const processingTime = Date.now() - startTime

        // Build report text sections
        const reportSections: string[] = []

        reportSections.push(`## Clinical Summary\n\n${analysisResponse.summary}`)

        if (analysisResponse.gaps_in_history) {
            const gaps = analysisResponse.gaps_in_history
            let gapText = '## Gaps in History / Outstanding Questions\n\n'
            if (gaps.missing_information?.length) {
                gapText += '**Missing Information:**\n' + gaps.missing_information.map((g: string) => `- ${g}`).join('\n') + '\n\n'
            }
            if (gaps.follow_up_questions?.length) {
                gapText += '**Follow-up Questions:**\n' + gaps.follow_up_questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n') + '\n\n'
            }
            if (gaps.physical_exam_checklist?.length) {
                gapText += '**Physical Exam Checklist:**\n' + gaps.physical_exam_checklist.map((p: string) => `- [ ] ${p}`).join('\n')
            }
            reportSections.push(gapText)
        }

        if (analysisResponse.test_interpretation?.length) {
            let testText = '## Test Interpretation\n\n'
            for (const t of analysisResponse.test_interpretation) {
                testText += `**${t.number}. ${t.test_name}**\n`
                testText += `Deranged: ${t.deranged_parameters.join(', ')}\n`
                testText += `${t.normal_parameters_assumed}\n`
                testText += `Interpretation: ${t.interpretation}\n\n`
            }
            reportSections.push(testText)
        }

        if (analysisResponse.impressions?.length) {
            reportSections.push('## Impression(s)\n\n' + analysisResponse.impressions.map((imp: string, i: number) => `${i + 1}. ${imp}`).join('\n'))
        }

        if (analysisResponse.differential_diagnoses?.length) {
            let ddxText = '## Differential Diagnoses\n\n'
            for (const d of analysisResponse.differential_diagnoses) {
                ddxText += `**${d.diagnosis}**\n`
                ddxText += `- For: ${d.supporting_evidence}\n`
                ddxText += `- Against: ${d.against_evidence}\n\n`
            }
            reportSections.push(ddxText)
        }

        if (analysisResponse.confirmatory_tests?.length) {
            let confText = '## Confirmatory Tests\n\n'
            for (const c of analysisResponse.confirmatory_tests) {
                confText += `- **${c.test}**: ${c.rationale}\n`
            }
            reportSections.push(confText)
        }

        if (analysisResponse.management_plan) {
            const mp = analysisResponse.management_plan
            let planText = '## Management Plan\n\n'
            planText += `**Current Plan Analysis:** ${mp.current_plan_analysis}\n\n`
            if (mp.recommended_plan?.length) {
                planText += '**Recommended Plan:**\n'
                for (const [i, step] of mp.recommended_plan.entries()) {
                    planText += `${i + 1}. **${step.step}** — ${step.rationale}\n`
                }
                planText += '\n'
            }
            if (mp.adjustments_based_on_status) {
                planText += `**Adjustments Based on Patient Status:** ${mp.adjustments_based_on_status}`
            }
            reportSections.push(planText)
        }

        if (analysisResponse.complications?.length) {
            let compText = '## Possible Complications & Prevention\n\n'
            for (const c of analysisResponse.complications) {
                compText += `**${c.complication}**\n`
                compText += `Prevention: ${c.prevention_plan}\n\n`
            }
            reportSections.push(compText)
        }

        const fullReportText = reportSections.join('\n\n')

        // Save analysis with day version + progress notes in user_feedback
        const { data: analysis, error: analysisError } = await supabase
            .from('analyses')
            .insert({
                patient_history_id: id,
                user_id: user.id,
                todo_list_json: analysisResponse.todo_items,
                raw_analysis_text: fullReportText,
                model_used: 'anthropic/claude-sonnet-4',
                analysis_version: versionKey,
                processing_time_ms: processingTime,
                total_items: analysisResponse.todo_items.length,
                completed_items: 0,
                summary: analysisResponse.summary,
                risk_level: analysisResponse.risk_level,
                user_feedback: progress_notes.trim() // store progress notes here
            })
            .select()
            .single()

        if (analysisError) {
            console.error('Error creating daily analysis:', analysisError)
            return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 })
        }

        // Create individual todo items
        const todoItems = analysisResponse.todo_items.map((item: any, index: number) => ({
            analysis_id: analysis.id,
            user_id: user.id,
            title: item.title,
            description: item.description || null,
            priority: item.priority,
            category: item.category,
            is_completed: false,
            order_index: item.order || index
        }))

        if (todoItems.length > 0) {
            const { error: todoError } = await supabase.from('todo_items').insert(todoItems)
            if (todoError) {
                console.error('Error creating todo items:', todoError)
            }
        }

        return NextResponse.json({
            success: true,
            analysis: { ...analysis, todo_items: todoItems }
        })

    } catch (error: any) {
        console.error('Error in POST /api/patients/[id]/daily-note:', error)
        return NextResponse.json(
            { error: 'Failed to generate daily analysis', message: error.message },
            { status: 500 }
        )
    }
}
