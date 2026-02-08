/**
 * Analysis Detail Page
 * Server component that fetches and displays a single analysis
 */

import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AnalysisCard from '@/components/analysis/AnalysisCard';
import type { Analysis, TodoItem, PatientHistory } from '@/lib/types/analysis';

interface AnalysisPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { id } = await params;

  // Initialize Supabase client
  const supabase = await createClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch analysis (RLS ensures user owns it)
  const { data: analysis, error: analysisError } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (analysisError || !analysis) {
    console.error('Analysis not found:', analysisError);
    notFound();
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

  if (patientHistoryRes.error || !patientHistoryRes.data) {
    console.error('Error fetching patient history:', patientHistoryRes.error);
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <AnalysisCard
        analysis={analysis as Analysis}
        todoItems={(todoItemsRes.data || []) as TodoItem[]}
        patientHistory={patientHistoryRes.data as PatientHistory}
      />
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: AnalysisPageProps) {
  const { id } = await params;
  return {
    title: 'Patient Analysis | MedFlow AI',
    description: `View detailed patient analysis ${id}`,
  };
}
