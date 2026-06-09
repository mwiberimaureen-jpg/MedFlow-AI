'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from './Sidebar'
import ThemeToggle from './ThemeToggle'
import TrialBadge from './TrialBadge'
import { ReviewTrigger } from './ReviewTrigger'

interface DashboardShellProps {
  userEmail: string
  displayName?: string
  avatarUrl?: string
  children: React.ReactNode
}

export default function DashboardShell({ userEmail, displayName, avatarUrl: initialAvatarUrl, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Seeded from the server layout, which reads avatar_url with the admin client —
  // a client-side query here would be subject to RLS + auth.uid(), and a stale/
  // refreshing JWT on first load can make that silently return zero rows (the
  // exact "stale JWT -> RLS returns null" trap the layout already guards against
  // for terms_version). Don't replace this with a client-side fetch.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl || null)

  // Open sidebar by default on desktop, closed on mobile
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setSidebarOpen(mq.matches)
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Keep the top-bar avatar in sync with uploads on the Settings page. The event
  // carries the new URL directly (no DB round-trip), so it can't hit the RLS/JWT
  // trap above — the layout persists across client-side navigation, so without
  // this the avatar would only ever update after a hard reload.
  useEffect(() => {
    function onAvatarUpdated(e: Event) {
      const url = (e as CustomEvent).detail?.avatarUrl
      if (url) setAvatarUrl(url)
    }
    window.addEventListener('medflow:avatar-updated', onAvatarUpdated)
    return () => window.removeEventListener('medflow:avatar-updated', onAvatarUpdated)
  }, [])

  // dark_mode preference — isolated try/catch so a missing column doesn't break anything
  useEffect(() => {
    const supabase = createClient()
    async function loadDarkMode() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      try {
        const { data: prefs } = await supabase
          .from('users')
          .select('dark_mode')
          .eq('id', user.id)
          .maybeSingle()
        if (typeof prefs?.dark_mode === 'boolean') {
          document.documentElement.classList.toggle('dark', prefs.dark_mode)
          localStorage.setItem('theme', prefs.dark_mode ? 'dark' : 'light')
        }
      } catch { /* dark_mode column may not exist yet — localStorage fallback still applies */ }
    }
    loadDarkMode()
  }, [])

  function handleThemeToggle(isDark: boolean) {
    fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dark_mode: isDark }),
    }).catch(() => {})
  }

  return (
    <div className="flex h-dvh bg-gray-50 dark:bg-gray-900">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(prev => !prev)} />

      {/* Main content — shifts right when sidebar is open on desktop */}
      <main className={`flex-1 overflow-auto transition-[margin] duration-200 ease-in-out ${sidebarOpen ? 'md:ml-64' : 'md:ml-0'}`}>
        {/* Top bar with hamburger */}
        <div className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 md:px-8 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-sm select-none">
                {(displayName || userEmail || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Welcome back,</p>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{displayName || userEmail}</h2>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <TrialBadge />
            <ThemeToggle onToggle={handleThemeToggle} />
          </div>
        </div>

        {/* Page content */}
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>

      <ReviewTrigger userEmail={userEmail} userName={displayName} />
    </div>
  )
}
