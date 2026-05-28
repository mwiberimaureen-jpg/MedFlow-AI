import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { full_name, phone_number, avatar_url } = body

    const admin = getSupabaseServerClient()

    if (phone_number !== undefined) {
      const { error } = await admin.from('users').update({ phone_number: phone_number || null }).eq('id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (full_name !== undefined) {
      const { error } = await admin.from('users').update({ full_name: full_name || null }).eq('id', user.id)
      if (error) {
        return NextResponse.json({
          success: true,
          warning: `Display Name not saved — run the SQL migration in Supabase first. (${error.message})`,
        })
      }
    }

    if (avatar_url !== undefined) {
      const { error } = await admin.from('users').update({ avatar_url }).eq('id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
