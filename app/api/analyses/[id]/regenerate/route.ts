/**
 * API Route: Regenerate Analysis
 * POST /api/analyses/[id]/regenerate
 *
 * Re-runs AI analysis for an existing analysis record.
 * Updates the analysis in-place with fresh AI-generated content.
 * Handles both admission and daily analyses.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzePatientHistoryFanOut, analyzeDailyProgress } from '@/lib/openrouter/client'

export const dynamic = 'force-dynamic'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const startTime = Date.now()

    try {
        const { id: analysisId } = await params
        const supabase = await createClient()

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }

        // Fetch the existing analysis
        const { data: existingAnalysis, error: analysisError } = await supabase
            .from('analyses')
            .select('id, patient_history_id, user_id, analysis_version, user_feedback')
            .eq('id', analysisId)
            .single()

        if (analysisError || !existingAnalysis) {
            return NextResponse.json({ success: false, error: 'Analysis not found' }, { status: 404 })
        }

        if (existingAnalysis.user_id !== user.id) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
        }

        // Fetch patient history
        const { data: patient, error: patientError } = await supabase
            .from('patient_histories')
            .select('*')
            .eq('id', existingAnalysis.patient_history_id)
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .single()

        if (patientError || !patient) {
            return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 })
        }

        const version = existingAnalysis.analysis_version || 'admission'
        let analysisResponse

        if (version === 'admission') {
            // Re-run admission analysis (fan-out: parallel clinical + management agents, then synthesis + QA)
            analysisResponse = await analyzePatientHistoryFanOut(patient.history_text)
        } else if (version.startsWith('day_')) {
            // Re-run daily analysis — need previous summaries
            const dayNumber = parseInt(version.replace('day_', ''), 10)

            const { data: allAnalyses } = await supabase
                .from('analyses')
                .select('id, analysis_version, summary, raw_analysis_text, user_feedback, created_at')
                .eq('patient_history_id', existingAnalysis.patient_history_id)
                .neq('id', analysisId) // exclude this one
                .order('created_at', { ascending: true })

            const previousSummaries = (allAnalyses || [])
                .filter(a => {
                    // Only include analyses that came BEFORE this day
                    if (a.analysis_version === 'admission') return true
                    if (a.analysis_version?.startsWith('day_')) {
                        const d = parseInt(a.analysis_version.replace('day_', ''), 10)
                        return d < dayNumber
                    }
                    return false
                })
                .map(a => ({
                    version: a.analysis_version || 'unknown',
                    summary: a.summary || '',
                    rawText: a.raw_analysis_text || '',
                    userNotes: a.user_feedback || ''
                }))

            const progressNotes = existingAnalysis.user_feedback || ''

            analysisResponse = await analyzeDailyProgress(
                patient.history_text,
                previousSummaries,
                progressNotes,
                dayNumber
            )
        } else {
            return NextResponse.json(
                { success: false, error: 'Cannot regenerate discharge analyses' },
                { status: 400 }
            )
        }

        const processingTime = Date.now() - startTime

        // Build report text (same logic as analyze/daily-note routes)
        const reportSections: string[] = []

        reportSections.push(`## Clinical Summary\n\n${analysisResponse.summary}`)

        if (analysisResponse.gaps_in_history) {
            const gaps = analysisResponse.gaps_in_history
            let gapText = '## Gaps in History / Outstanding Questions\n\n'
            if (gaps.follow_up_questions?.length) {
                gapText += '**Follow-up Questions:**\n' + gaps.follow_up_questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n') + '\n\n'
            }
            if (gaps.physical_exam_checklist?.length) {
                gapText += '**Physical Exam Checklist:**\n' + gaps.physical_exam_checklist.map((p: string) => `- [ ] ${p}`).join('\n')
            }
            reportSections.push(gapText)
        }

        {
            let testText = '## Test Interpretation\n\n'
            if (analysisResponse.test_interpretation?.length) {
                for (const t of analysisResponse.test_interpretation) {
                    testText += `**${t.number}. ${t.test_name}**\n`
                    testText += `Deranged: ${t.deranged_parameters.join(', ')}\n`
                    testText += `Interpretation: ${t.interpretation}\n\n`
                }
            } else {
                testText += 'No test results to interpret at this stage.\n'
            }
            reportSections.push(testText)
        }

        {
            let impText = '## Impression(s)\n\n'
            if (analysisResponse.impressions?.length) {
                impText += analysisResponse.impressions.map((imp: string, i: number) => `${i + 1}. ${imp}`).join('\n')
            } else {
                impText += 'Clinical impression pending further assessment.\n'
            }
            reportSections.push(impText)
        }

        {
            let ddxText = '## Differential Diagnoses\n\n'
            if (analysisResponse.differential_diagnoses?.length) {
                for (const d of analysisResponse.differential_diagnoses) {
                    ddxText += `**${d.diagnosis}**\n`
                    ddxText += `- For: ${d.supporting_evidence}\n`
                    ddxText += `- Against: ${d.against_evidence}\n\n`
                }
            } else {
                ddxText += 'Differential diagnoses pending further workup.\n'
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

        {
            let compText = '## Possible Complications & Prevention\n\n'
            if (analysisResponse.complications?.length) {
                for (const c of analysisResponse.complications) {
                    compText += `**${c.complication}**\n`
                    compText += `Prevention: ${c.prevention_plan}\n\n`
                }
            } else {
                compText += 'No complications identified at this stage. Will be reassessed on subsequent days.\n'
            }
            reportSections.push(compText)
        }

        const fullReportText = reportSections.join('\n\n')

        // Delete old todo items for this analysis
        await supabase.from('todo_items').delete().eq('analysis_id', analysisId)

        // Update analysis record in-place
        const { data: updatedAnalysis, error: updateError } = await supabase
            .from('analyses')
            .update({
                todo_list_json: analysisResponse.todo_items,
                raw_analysis_text: fullReportText,
                model_used: 'anthropic/claude-sonnet-4',
                processing_time_ms: processingTime,
                total_items: analysisResponse.todo_items.length,
                completed_items: 0,
                summary: analysisResponse.summary,
                risk_level: analysisResponse.risk_level,
            })
            .eq('id', analysisId)
            .select()
            .single()

        if (updateError) {
            console.error('Error updating analysis:', updateError)
            return NextResponse.json({ success: false, error: 'Failed to save regenerated analysis' }, { status: 500 })
        }

        // Create new todo items
        const todoItems = analysisResponse.todo_items.map((item: any, index: number) => ({
            analysis_id: analysisId,
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
            analysis: { ...updatedAnalysis, todo_items: todoItems }
        })

    } catch (error: any) {
        console.error('Error regenerating analysis:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to regenerate analysis', message: error.message },
            { status: 500 }
        )
    }
}
