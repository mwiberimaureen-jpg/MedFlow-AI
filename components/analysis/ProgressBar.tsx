'use client'

/**
 * ProgressBar Component
 * Displays completion progress with color gradient
 */

import { ProgressBarProps } from '@/lib/types/analysis';

export default function ProgressBar({ completed, total }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Color based on completion percentage
  const getColor = (): string => {
    if (percentage < 33) return 'bg-red-600';
    if (percentage < 66) return 'bg-yellow-500';
    return 'bg-green-600';
  };

  const getTextColor = (): string => {
    if (percentage < 33) return 'text-red-600';
    if (percentage < 66) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">Progress</h3>
        <span className={`text-sm font-semibold ${getTextColor()}`}>
          {completed} of {total} completed ({percentage}%)
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-500 ease-out rounded-full`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
