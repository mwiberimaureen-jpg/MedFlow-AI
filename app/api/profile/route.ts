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
    const { full_name, phone_number } = body

    const admin = getSupabaseServerClient()

    // Update phone_number first (column definitely exists)
    if (phone_number !== undefined) {
      const { error: phoneError } = await admin
        .from('users')
        .update({ phone_number: phone_number || null })
        .eq('id', user.id)

      if (phoneError) {
        return NextResponse.json({ error: phoneError.message }, { status: 500 })
      }
    }

    // Update full_name separately — may fail if column hasn't been migrated yet
    if (full_name !== undefined) {
      const { error: nameError } = await admin
        .from('users')
        .update({ full_name: full_name || null })
        .eq('id', user.id)

      if (nameError) {
        return NextResponse.json({
          success: true,
          warning: `Display Name not saved — run the SQL migration in Supabase first. (${nameError.message})`,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
