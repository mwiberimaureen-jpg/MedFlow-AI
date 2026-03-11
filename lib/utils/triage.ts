export type TriageLevel = 'urgent' | 'emergent' | 'stable'

export function getTriageFromRiskLevel(riskLevel: string | null | undefined): TriageLevel | null {
  if (!riskLevel) return null
  const map: Record<string, TriageLevel> = {
    high: 'urgent',
    medium: 'emergent',
    low: 'stable'
  }
  return map[riskLevel] || null
}

export function getTriageBadgeVariant(triage: TriageLevel): 'danger' | 'warning' | 'success' {
  const map: Record<TriageLevel, 'danger' | 'warning' | 'success'> = {
    urgent: 'danger',
    emergent: 'warning',
    stable: 'success'
  }
  return map[triage]
}

export function getTriageLabel(triage: TriageLevel): string {
  const map: Record<TriageLevel, string> = {
    urgent: 'Urgent',
    emergent: 'Emergent',
    stable: 'Stable'
  }
  return map[triage]
}
