/**
 * API Route: Analyze Patient History
 * POST /api/patients/[id]/analyze - Trigger AI analysis of patient history
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzePatientHistory } from '@/lib/openrouter/client'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()

  try {
    const { id } = await params
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch patient history
    const { data: patient, error: patientError } = await supabase
      .from('patient_histories')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (patientError || !patient) {
      return NextResponse.json(
        { error: 'Patient history not found' },
        { status: 404 }
      )
    }

    // Check if analysis already exists
    const { data: existingAnalysis } = await supabase
      .from('analyses')
      .select('id')
      .eq('patient_history_id', id)
      .single()

    if (existingAnalysis) {
      return NextResponse.json(
        { error: 'Analysis already exists for this patient history' },
        { status: 400 }
      )
    }

    // Update patient status to analyzing
    await supabase
      .from('patient_histories')
      .update({ status: 'analyzing' })
      .eq('id', id)

    try {
      // Call OpenRouter API for analysis
      const analysisResponse = await analyzePatientHistory(patient.history_text)

      const processingTime = Date.now() - startTime

      // Build structured report text from analysis sections
      const reportSections: string[] = []

      reportSections.push(`## Clinical Summary\n\n${analysisResponse.summary}`)

      if (analysisResponse.gaps_in_history) {
        const gaps = analysisResponse.gaps_in_history
        let gapText = '## Gaps in History\n\n'
        if (gaps.missing_information?.length) {
          gapText += '**Missing Information:**\n' + gaps.missing_information.map(g => `- ${g}`).join('\n') + '\n\n'
        }
        if (gaps.follow_up_questions?.length) {
          gapText += '**Follow-up Questions:**\n' + gaps.follow_up_questions.map((q, i) => `${i + 1}. ${q}`).join('\n') + '\n\n'
        }
        if (gaps.physical_exam_checklist?.length) {
          gapText += '**Physical Exam Checklist:**\n' + gaps.physical_exam_checklist.map(p => `- [ ] ${p}`).join('\n')
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
        reportSections.push('## Impression(s)\n\n' + analysisResponse.impressions.map((imp, i) => `${i + 1}. ${imp}`).join('\n'))
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

      // Create analysis record
      const { data: analysis, error: analysisError } = await supabase
        .from('analyses')
        .insert({
          patient_history_id: id,
          user_id: user.id,
          todo_list_json: analysisResponse.todo_items,
          raw_analysis_text: fullReportText,
          model_used: 'anthropic/claude-sonnet-4',
          processing_time_ms: processingTime,
          total_items: analysisResponse.todo_items.length,
          completed_items: 0,
          summary: analysisResponse.summary,
          risk_level: analysisResponse.risk_level
        })
        .select()
        .single()

      if (analysisError) {
        console.error('Error creating analysis:', analysisError)
        throw new Error('Failed to save analysis results')
      }

      // Create individual todo items
      const todoItems = analysisResponse.todo_items.map((item, index) => ({
        analysis_id: analysis.id,
        title: item.title,
        description: item.description || null,
        priority: item.priority,
        category: item.category,
        is_completed: false,
        order_index: item.order || index
      }))

      const { error: todoError } = await supabase
        .from('todo_items')
        .insert(todoItems)

      if (todoError) {
        console.error('Error creating todo items:', todoError)
        // Analysis is already created, so we'll continue
      }

      // Update patient status to completed
      await supabase
        .from('patient_histories')
        .update({ status: 'completed' })
        .eq('id', id)

      return NextResponse.json({
        success: true,
        analysis: {
          ...analysis,
          todo_items: todoItems
        }
      })

    } catch (aiError: any) {
      // Update patient status to error
      await supabase
        .from('patient_histories')
        .update({ status: 'error' })
        .eq('id', id)

      throw aiError
    }

  } catch (error: any) {
    console.error('Error in POST /api/patients/[id]/analyze:', error)
    return NextResponse.json(
      {
        error: 'Failed to analyze patient history',
        message: error.message
      },
      { status: 500 }
    )
  }
}
