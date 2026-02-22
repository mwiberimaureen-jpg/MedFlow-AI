'use client'

import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'

interface DashboardShellProps {
  userEmail: string
  children: React.ReactNode
}

export default function DashboardShell({ userEmail, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Open sidebar by default on desktop, closed on mobile
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setSidebarOpen(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(prev => !prev)} />

      {/* Main content — shifts right when sidebar is open on desktop */}
      <main className={`flex-1 overflow-auto transition-[margin] duration-200 ease-in-out ${sidebarOpen ? 'md:ml-64' : 'md:ml-0'}`}>
        {/* Top bar with hamburger */}
        <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 px-4 py-3 md:px-8 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <p className="text-sm text-gray-600">Welcome back,</p>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{userEmail}</h2>
          </div>
        </div>

        {/* Page content */}
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
