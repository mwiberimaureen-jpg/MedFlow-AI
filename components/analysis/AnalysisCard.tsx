'use client'

/**
 * AnalysisCard Component
 * Main container for displaying analysis results
 * Manages state and coordinates all child components
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AnalysisCardProps, TodoItem } from '@/lib/types/analysis';
import { parseAnalysisText } from '@/lib/utils/parse-analysis';
import { exportAnalysisPdf, generatePdfFilename } from '@/lib/utils/export-pdf';
import AnalysisActions from './AnalysisActions';
import ProgressBar from './ProgressBar';
import AnalysisMeta from './AnalysisMeta';
import TodoListDisplay from './TodoListDisplay';

export default function AnalysisCard({
  analysis,
  todoItems: initialTodoItems,
  patientHistory,
}: AnalysisCardProps) {
  const router = useRouter();
  const [items, setItems] = useState<TodoItem[]>(initialTodoItems);

  // Parse analysis text into sections
  const sections = useMemo(
    () => parseAnalysisText(analysis.raw_analysis_text),
    [analysis.raw_analysis_text]
  );

  // Calculate completed count
  const completedCount = useMemo(
    () => items.filter((item) => item.is_checked).length,
    [items]
  );

  // Handle checkbox toggle with optimistic update
  const handleToggle = async (todoId: string, isChecked: boolean) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === todoId
          ? { ...item, is_checked: isChecked, checked_at: isChecked ? new Date().toISOString() : null }
          : item
      )
    );

    try {
      const res = await fetch(`/api/analyses/${analysis.id}/todos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todo_item_id: todoId, is_checked: isChecked }),
      });

      if (!res.ok) {
        throw new Error('Failed to update checkbox');
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update checkbox');
      }
    } catch (error) {
      console.error('Error updating checkbox:', error);
      // Revert on error
      setItems(initialTodoItems);
      alert('Failed to update checkbox. Please try again.');
    }
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Handle PDF export
  const handleExportPdf = async () => {
    try {
      const filename = generatePdfFilename(
        patientHistory.patient_name,
        analysis.created_at
      );
      await exportAnalysisPdf('analysis-printable', { filename });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    }
  };

  // Handle regenerate analysis
  const handleRegenerate = async () => {
    try {
      const res = await fetch(`/api/analyses/${analysis.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to regenerate analysis');
      }

      // Redirect to new analysis
      if (data.new_analysis_id) {
        router.push(`/dashboard/analysis/${data.new_analysis_id}`);
      }
    } catch (error: any) {
      console.error('Error regenerating analysis:', error);
      alert(error.message || 'Failed to regenerate analysis. Please try again.');
    }
  };

  return (
    <div id="analysis-printable" className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 print:mb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 print:text-2xl">
              Patient Analysis
            </h1>
            {patientHistory.patient_name && (
              <p className="text-lg text-gray-600 mt-1">
                {patientHistory.patient_name}
                {patientHistory.patient_identifier && (
                  <span className="text-gray-400 ml-2">
                    ({patientHistory.patient_identifier})
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Actions (hidden in print) */}
      <AnalysisActions
        analysisId={analysis.id}
        onPrint={handlePrint}
        onExportPdf={handleExportPdf}
        onRegenerate={handleRegenerate}
      />

      {/* Progress Bar */}
      <ProgressBar
        completed={completedCount}
        total={analysis.total_items || items.length}
      />

      {/* Metadata */}
      <AnalysisMeta analysis={analysis} />

      {/* Analysis Sections */}
      {sections.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Analysis Report</h2>
          <div className="space-y-6">
            {sections.map((section) => (
              <div key={section.order} className="print:break-inside-avoid">
                <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
                  <span className="w-1 h-5 bg-blue-600 rounded mr-3" />
                  {section.title}
                </h3>
                <div
                  className="text-gray-700 whitespace-pre-wrap ml-4 leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: section.content.replace(/\n/g, '<br />'),
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Todo List */}
      <TodoListDisplay todoItems={items} onToggle={handleToggle} />
    </div>
  );
}
