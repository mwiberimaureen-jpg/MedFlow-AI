import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim().toUpperCase()
  if (!code || code.length !== 4) {
    return NextResponse.json({ valid: false })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ valid: false })

  // Code must exist and must not be the current user's own code
  const { data } = await supabase
    .from('users')
    .select('id')
    .eq('referral_code', code)
    .neq('id', user.id)
    .maybeSingle()

  return NextResponse.json({ valid: !!data })
}
