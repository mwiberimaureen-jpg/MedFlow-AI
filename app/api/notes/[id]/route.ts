import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent } from '@/lib/audit/logger'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updates: Record<string, any> = {}
    if (body.rotation !== undefined) updates.rotation = body.rotation || null
    if (body.title !== undefined) updates.title = body.title
    if (body.content !== undefined) updates.content = body.content

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: note, error } = await supabase
      .from('clinical_notes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating note:', error)
      return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
    }

    logAuditEvent({ userId: user.id, action: 'note.update', resourceType: 'note', resourceId: id, request })

    return NextResponse.json({ note })
  } catch (error: any) {
    console.error('Notes PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('clinical_notes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting note:', error)
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
    }

    logAuditEvent({ userId: user.id, action: 'note.delete', resourceType: 'note', resourceId: id, request })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Notes DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
