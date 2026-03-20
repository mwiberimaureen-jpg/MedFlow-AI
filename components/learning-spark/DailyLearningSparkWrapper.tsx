'use client'

import dynamic from 'next/dynamic'
import { Component, type ReactNode } from 'react'

// Dynamic import with ssr: false to avoid server-side rendering issues
const DailyLearningSpark = dynamic(
  () => import('./DailyLearningSpark').then(mod => ({ default: mod.DailyLearningSpark })),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
        </div>
        <div className="space-y-3">
          <div className="h-16 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
          <div className="h-10 bg-gray-100 dark:bg-gray-700/50 rounded-lg" />
        </div>
      </div>
    ),
  }
)

// Error boundary to catch any rendering errors
class SparkErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Daily Learning Spark
          </h3>
          <p className="text-sm text-red-500 dark:text-red-400 text-center py-4">
            Component error: {this.state.error}
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

export function DailyLearningSparkWrapper() {
  return (
    <SparkErrorBoundary>
      <DailyLearningSpark />
    </SparkErrorBoundary>
  )
}
