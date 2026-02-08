'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Patients', href: '/dashboard/patients', icon: '👥' },
  { name: 'Analysis', href: '/dashboard/analysis', icon: '🔬' },
  { name: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-blue-900 to-blue-800 text-white">
      {/* Logo */}
      <div className="p-6 border-b border-blue-700">
        <h1 className="text-2xl font-bold">MedFlow AI</h1>
        <p className="text-blue-200 text-sm mt-1">Patient Analysis</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-700 text-white'
                  : 'text-blue-100 hover:bg-blue-700/50'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-blue-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-blue-100 hover:bg-blue-700/50 transition-colors"
        >
          <span className="text-xl">🚪</span>
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  )
}
