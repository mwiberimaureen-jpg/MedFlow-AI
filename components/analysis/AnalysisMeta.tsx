'use client'

/**
 * AnalysisMeta Component
 * Displays analysis metadata: model, processing time, date, and rating
 */

import { AnalysisMetaProps } from '@/lib/types/analysis';

export default function AnalysisMeta({ analysis }: AnalysisMetaProps) {
  const formatProcessingTime = (ms: number | null): string => {
    if (!ms) return 'N/A';
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Analysis Details</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Model used */}
        <div>
          <dt className="text-xs text-gray-500 mb-1">AI Model</dt>
          <dd className="text-sm font-medium text-gray-900">
            {analysis.model_used || 'Unknown'}
          </dd>
        </div>

        {/* Processing time */}
        <div>
          <dt className="text-xs text-gray-500 mb-1">Processing Time</dt>
          <dd className="text-sm font-medium text-gray-900">
            {formatProcessingTime(analysis.processing_time_ms)}
          </dd>
        </div>

        {/* Created date */}
        <div>
          <dt className="text-xs text-gray-500 mb-1">Generated</dt>
          <dd className="text-sm font-medium text-gray-900">
            {formatDate(analysis.created_at)}
          </dd>
        </div>

        {/* Rating */}
        <div>
          <dt className="text-xs text-gray-500 mb-1">Your Rating</dt>
          <dd className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`text-lg ${
                  analysis.user_rating && star <= analysis.user_rating
                    ? 'text-yellow-400'
                    : 'text-gray-300'
                }`}
              >
                ★
              </span>
            ))}
            {!analysis.user_rating && (
              <span className="text-xs text-gray-500 ml-1">Not rated</span>
            )}
          </dd>
        </div>
      </div>

      {/* Version info */}
      {analysis.analysis_version && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <dt className="text-xs text-gray-500 mb-1">Analysis Version</dt>
          <dd className="text-sm text-gray-700">{analysis.analysis_version}</dd>
        </div>
      )}
    </div>
  );
}
