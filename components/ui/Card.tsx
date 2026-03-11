import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  header?: {
    title: string
    subtitle?: string
    action?: React.ReactNode
  }
}

export function Card({ children, className = '', header }: CardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      {header && (
        <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{header.title}</h3>
              {header.subtitle && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{header.subtitle}</p>
              )}
            </div>
            {header.action && <div>{header.action}</div>}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}
