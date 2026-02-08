'use client'

/**
 * AnalysisActions Component
 * Action buttons: Print, Export PDF, and Regenerate Analysis
 */

import { useState } from 'react';
import { AnalysisActionsProps } from '@/lib/types/analysis';

export default function AnalysisActions({
  analysisId,
  onPrint,
  onExportPdf,
  onRegenerate,
}: AnalysisActionsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await onExportPdf();
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRegenerate = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to regenerate this analysis? This will create a new analysis and you will be redirected to it.'
    );

    if (!confirmed) return;

    setIsRegenerating(true);
    try {
      await onRegenerate();
    } catch (error) {
      console.error('Regeneration failed:', error);
      alert('Failed to regenerate analysis. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="analysis-actions flex flex-wrap gap-3 mb-6">
      {/* Print button */}
      <button
        onClick={onPrint}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
          />
        </svg>
        Print
      </button>

      {/* Export PDF button */}
      <button
        onClick={handleExportPdf}
        disabled={isExporting}
        className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg
          className={`w-4 h-4 mr-2 ${isExporting ? 'animate-spin' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isExporting ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          )}
        </svg>
        {isExporting ? 'Exporting...' : 'Export PDF'}
      </button>

      {/* Regenerate button */}
      <button
        onClick={handleRegenerate}
        disabled={isRegenerating}
        className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <svg
          className={`w-4 h-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        {isRegenerating ? 'Regenerating...' : 'Regenerate Analysis'}
      </button>
    </div>
  );
}
