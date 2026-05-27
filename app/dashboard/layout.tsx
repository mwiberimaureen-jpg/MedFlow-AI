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
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  // Only enforce the terms gate if the column exists in the DB.
  // If terms_acceptance_migration.sql has not been run yet, the field
  // will be absent from the row entirely — we skip the check rather
  // than locking every user out permanently.
  const termsColumnPresent = userRow !== null && 'terms_version' in userRow
  if (termsColumnPresent && (userRow as any).terms_version !== TERMS_VERSION) {
    redirect('/terms')
  }

  return (
    <DashboardShell userEmail={user.email || ''} displayName={(userRow as any)?.full_name || undefined}>
      {children}
    </DashboardShell>
  )
}
