import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { currentStreak, longestStreak, lastSparkDate } = await request.json()

    const { error } = await supabase
      .from('profiles')
      .update({
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_spark_date: lastSparkDate,
      })
      .eq('id', user.id)

    if (error) {
      // Column may not exist yet — fail silently so UI still works
      console.warn('Streak sync skipped (migration pending?):', error.message)
      return NextResponse.json({ ok: true, synced: false })
    }

    return NextResponse.json({ ok: true, synced: true })
  } catch (err: any) {
    console.error('Streak sync error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('current_streak, longest_streak, last_spark_date')
      .eq('id', user.id)
      .single()

    if (error) {
      // Column may not exist yet — return nulls so client falls back to localStorage
      return NextResponse.json({ currentStreak: null, longestStreak: null, lastSparkDate: null })
    }

    return NextResponse.json({
      currentStreak: data?.current_streak ?? null,
      longestStreak: data?.longest_streak ?? null,
      lastSparkDate: data?.last_spark_date ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({ currentStreak: null, longestStreak: null, lastSparkDate: null })
  }
}
