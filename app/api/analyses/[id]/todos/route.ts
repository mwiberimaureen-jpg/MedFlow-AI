/**
 * API Route: Toggle Todo Checkbox
 * PATCH /api/analyses/[id]/todos
 *
 * Updates the checked state of a todo item
 *
 * SECURITY: This route MUST verify ownership before calling update_todo_checkbox()
 * The database function is SECURITY DEFINER and doesn't check user_id internally
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ToggleTodoRequest, ToggleTodoResponse } from '@/lib/types/analysis';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: analysisId } = await params;
    const body: ToggleTodoRequest = await request.json();
    const { todo_item_id, is_checked } = body;

    // Validate required fields
    if (!todo_item_id || typeof is_checked !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: todo_item_id and is_checked are required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // CRITICAL SECURITY CHECK: Verify the todo item belongs to this analysis and user
    // The update_todo_checkbox() RPC is SECURITY DEFINER and doesn't check ownership
    const { data: todoItem, error: todoError } = await supabase
      .from('todo_items')
      .select('id, analysis_id, user_id')
      .eq('id', todo_item_id)
      .eq('analysis_id', analysisId)
      .single();

    if (todoError || !todoItem) {
      return NextResponse.json(
        { success: false, error: 'Todo item not found' },
        { status: 404 }
      );
    }

    if (todoItem.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Todo item does not belong to user' },
        { status: 403 }
      );
    }

    // Call the RPC function to update checkbox
    // This also recalculates completed_items count on the analysis
    const { data, error: rpcError } = await supabase.rpc('update_todo_checkbox', {
      p_todo_item_id: todo_item_id,
      p_is_checked: is_checked,
    });

    if (rpcError) {
      console.error('Error calling update_todo_checkbox:', rpcError);
      return NextResponse.json(
        { success: false, error: 'Failed to update checkbox' },
        { status: 500 }
      );
    }

    if (data === false) {
      return NextResponse.json(
        { success: false, error: 'Todo item not found in database' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true } as ToggleTodoResponse);

  } catch (error: any) {
    console.error('Error updating todo checkbox:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update checkbox',
        message: error.message
      } as ToggleTodoResponse,
      { status: 500 }
    );
  }
}
