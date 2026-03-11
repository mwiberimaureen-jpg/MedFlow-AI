/**
 * Utilities for extracting ward round presentation data from patient histories and analyses.
 */

export function calculateDayOfAdmission(createdAt: string): number {
  const admission = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - admission.getTime()
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
}

export function extractChiefComplaint(historyText: string): string {
  // Try common patterns for chief complaint
  const patterns = [
    /(?:chief\s+complaint|presenting\s+complaint|reason\s+for\s+admission|complains?\s+of)[:\s]+(.+?)(?:\n|\.(?:\s|$))/i,
    /(?:presents?\s+with|admitted\s+(?:with|for|due\s+to))[:\s]+(.+?)(?:\n|\.(?:\s|$))/i,
  ]

  for (const pattern of patterns) {
    const match = historyText.match(pattern)
    if (match?.[1]) {
      return match[1].trim()
    }
  }

  // Fallback: first sentence of the history
  const firstSentence = historyText.split(/[.\n]/).filter(s => s.trim().length > 10)[0]
  return firstSentence?.trim() || 'Not documented'
}

export function extractKnownConditions(historyText: string): string[] {
  const conditions: string[] = []
  const text = historyText.toLowerCase()

  const conditionPatterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\b(?:known|diagnosed)\s+(?:case\s+of\s+)?diabet(?:ic|es)/i, label: 'Diabetic' },
    { pattern: /\b(?:known|diagnosed)\s+(?:case\s+of\s+)?hypertens(?:ive|ion)/i, label: 'Hypertensive' },
    { pattern: /\bhypertens(?:ive|ion)\b/i, label: 'Hypertensive' },
    { pattern: /\bdiabet(?:ic|es)\b/i, label: 'Diabetic' },
    { pattern: /\basthma(?:tic)?\b/i, label: 'Asthmatic' },
    { pattern: /\bhiv\s*(?:positive|\+)/i, label: 'HIV+' },
    { pattern: /\bepilepsy|epileptic\b/i, label: 'Epileptic' },
    { pattern: /\bsickle\s+cell/i, label: 'Sickle Cell Disease' },
    { pattern: /\bckd|chronic\s+kidney/i, label: 'CKD' },
    { pattern: /\bheart\s+failure|cardiac\s+failure/i, label: 'Heart Failure' },
    { pattern: /\btb|tuberculosis/i, label: 'TB' },
  ]

  const seen = new Set<string>()
  for (const { pattern, label } of conditionPatterns) {
    if (pattern.test(historyText) && !seen.has(label)) {
      conditions.push(label)
      seen.add(label)
    }
  }

  // Extract LMP if present
  const lmpMatch = historyText.match(/\b(?:lmp|last\s+menstrual\s+period)[:\s]+(.+?)(?:\n|\.(?:\s|$))/i)
  if (lmpMatch?.[1]) {
    conditions.push(`LMP: ${lmpMatch[1].trim()}`)
  }

  // Extract medications mentioned
  const medPatterns = [
    /(?:on|taking|currently\s+on|medications?)[:\s]+(.+?)(?:\n|\.(?:\s|$))/i,
  ]
  for (const pattern of medPatterns) {
    const match = historyText.match(pattern)
    if (match?.[1] && match[1].trim().length < 200) {
      conditions.push(`Meds: ${match[1].trim()}`)
      break
    }
  }

  return conditions
}

export function extractChiefComplaintWithDuration(historyText: string): string {
  // Try patterns that capture complaint + duration together
  const durationPatterns = [
    /(?:chief\s+complaint|presenting\s+complaint|complains?\s+of)[:\s]+([\s\S]+?)(?:\n{2}|\n(?=[A-Z]))/i,
    /(?:presents?\s+with|admitted\s+(?:with|for|due\s+to))[:\s]+([\s\S]+?)(?:\n{2}|\n(?=[A-Z]))/i,
  ]

  for (const pattern of durationPatterns) {
    const match = historyText.match(pattern)
    if (match?.[1]) {
      // Take up to the first period-ending sentence that mentions duration, or first 2 sentences
      const text = match[1].trim()
      const sentences = text.split(/\.(?:\s|$)/).filter(s => s.trim().length > 3)
      const result = sentences.slice(0, 2).join('. ').trim()
      return result ? result + '.' : result
    }
  }

  return extractChiefComplaint(historyText)
}

export function buildCourseSummary(analyses: Array<{
  analysis_version: string | null
  summary: string
  user_feedback?: string | null
  created_at: string
}>): string {
  if (analyses.length === 0) return ''

  // Sort chronologically
  const sorted = [...analyses]
    .filter(a => a.analysis_version !== 'discharge')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const parts: string[] = []

  for (const a of sorted) {
    const label = a.analysis_version === 'admission' ? 'Admission'
      : a.analysis_version?.startsWith('day_') ? `Day ${a.analysis_version.replace('day_', '')}`
      : 'Update'

    // Use user_feedback (progress notes) if available, otherwise use summary
    if (a.user_feedback) {
      parts.push(`${label}: ${a.user_feedback.split('\n')[0].trim()}`)
    } else if (a.summary) {
      parts.push(`${label}: ${a.summary.split('.').slice(0, 2).join('.').trim()}.`)
    }
  }

  return parts.join('\n')
}

export function extractSectionFromAnalysis(rawAnalysisText: string, sectionKey: string): string {
  try {
    const parsed = JSON.parse(rawAnalysisText)

    if (sectionKey === 'management_plan' && parsed.management_plan) {
      const plan = parsed.management_plan
      if (plan.recommended_plan && Array.isArray(plan.recommended_plan)) {
        return plan.recommended_plan.map((s: any) => `• ${s.step}`).join('\n')
      }
      return plan.current_plan_analysis || ''
    }

    if (sectionKey === 'summary') return parsed.summary || ''
    if (sectionKey === 'impressions') {
      return Array.isArray(parsed.impressions) ? parsed.impressions.join('; ') : ''
    }

    if (sectionKey === 'test_interpretation' && parsed.test_interpretation) {
      return parsed.test_interpretation.map((t: any) =>
        `${t.test_name}: ${t.interpretation}`
      ).join('\n')
    }

    return ''
  } catch {
    return ''
  }
}
