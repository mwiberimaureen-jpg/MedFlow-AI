import DashboardShell from '@/components/DashboardShell'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TERMS_VERSION } from '@/lib/legal/terms'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('terms_version, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (userRow?.terms_version !== TERMS_VERSION) {
    redirect('/terms')
  }

  return (
    <DashboardShell userEmail={user.email || ''} displayName={userRow?.full_name || undefined}>
      {children}
    </DashboardShell>
  )
}
