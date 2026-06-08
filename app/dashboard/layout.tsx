import DashboardShell from '@/components/DashboardShell'
import { createClient, getSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TERMS_VERSION } from '@/lib/legal/terms'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // User identity check — must use the user's own client so the JWT is verified
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Row fetch uses the admin client so a stale/expired user JWT never causes
  // RLS to silently return null and wrongly redirect to /terms.
  const admin = getSupabaseServerClient()
  const { data: userRow } = await admin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  // Only enforce the terms gate when the column actually exists in the DB
  // (guard against a not-yet-run migration locking everyone out).
  const termsColumnPresent = userRow !== null && 'terms_version' in userRow
  if (termsColumnPresent && (userRow as any).terms_version !== TERMS_VERSION) {
    redirect('/terms')
  }

  return (
    <DashboardShell
      userEmail={user.email || ''}
      displayName={(userRow as any)?.full_name || undefined}
      avatarUrl={(userRow as any)?.avatar_url || undefined}
    >
      {children}
    </DashboardShell>
  )
}
