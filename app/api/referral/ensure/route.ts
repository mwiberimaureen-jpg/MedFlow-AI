import { NextResponse } from 'next/server'
import { createClient, getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function generateUniqueCode(admin: ReturnType<typeof getSupabaseServerClient>): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(1000 + Math.random() * 9000))
    const { data } = await admin.from('users').select('id').eq('referral_code', code).maybeSingle()
    if (!data) return code
  }
  return String(Date.now()).slice(-4)
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseServerClient()
  const { data: userRow } = await admin.from('users').select('referral_code').eq('id', user.id).single()

  if (userRow?.referral_code) {
    return NextResponse.json({ referral_code: userRow.referral_code })
  }

  const code = await generateUniqueCode(admin)
  await admin.from('users').update({ referral_code: code }).eq('id', user.id)
  return NextResponse.json({ referral_code: code })
}
