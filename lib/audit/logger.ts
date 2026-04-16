/**
 * HIPAA Audit Logger
 *
 * Logs all access and modifications to PHI for compliance with
 * 45 CFR 164.312(b) — Audit controls.
 *
 * Uses the service role client to bypass RLS (audit logs are
 * append-only, users cannot tamper with them).
 */

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export type AuditAction =
  | 'patient.create'
  | 'patient.view'
  | 'patient.delete'
  | 'patient.restore'
  | 'patient.update'
  | 'patient.permanent_delete'
  | 'analysis.create'
  | 'analysis.view'
  | 'analysis.regenerate'
  | 'discharge.create'
  | 'daily_note.create'
  | 'note.create'
  | 'note.update'
  | 'note.delete'
  | 'todo.update'
  | 'consent.granted'
  | 'payment.checkout'
  | 'payment.webhook'

interface AuditEntry {
  userId: string
  action: AuditAction
  resourceType: string
  resourceId?: string
  metadata?: Record<string, any>
  request?: NextRequest
}

/**
 * Log an audit event. Fire-and-forget — never blocks the request.
 */
export function logAuditEvent(entry: AuditEntry): void {
  const supabase = getSupabaseServerClient()

  const ip = entry.request?.headers.get('x-forwarded-for')
    || entry.request?.headers.get('x-real-ip')
    || null
  const userAgent = entry.request?.headers.get('user-agent') || null

  supabase
    .from('audit_logs')
    .insert({
      user_id: entry.userId,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId || null,
      metadata: entry.metadata || {},
      ip_address: ip,
      user_agent: userAgent,
    })
    .then(({ error }) => {
      if (error) {
        console.error('[AUDIT] Failed to write audit log:', error.message)
      }
    })
}
