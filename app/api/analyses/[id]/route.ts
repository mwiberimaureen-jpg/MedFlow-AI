/**
 * API Route: Get Single Analysis
 * GET /api/analyses/[id]
 *
 * Returns analysis with todo items and patient history
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Initialize Supabase client
    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch analysis (RLS ensures user owns it)
    const { data: analysis, error: analysisError } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', id)
      .single();

    if (analysisError || !analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    // Fetch todo items and patient history in parallel
    const [todoItemsRes, patientHistoryRes] = await Promise.all([
      supabase
        .from('todo_items')
        .select('*')
        .eq('analysis_id', id)
        .order('item_order'),
      supabase
        .from('patient_histories')
        .select('*')
        .eq('id', analysis.patient_history_id)
        .single(),
    ]);

    if (todoItemsRes.error) {
      console.error('Error fetching todo items:', todoItemsRes.error);
    }

    if (patientHistoryRes.error) {
      console.error('Error fetching patient history:', patientHistoryRes.error);
    }

    // Return combined data
    return NextResponse.json({
      success: true,
      analysis,
      todoItems: todoItemsRes.data || [],
      patientHistory: patientHistoryRes.data || null,
    });

  } catch (error: any) {
    console.error('Error fetching analysis:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch analysis',
        message: error.message
      },
      { status: 500 }
    );
  }
}
