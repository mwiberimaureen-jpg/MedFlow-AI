/**
 * Utilities for extracting ward round presentation data from patient histories and analyses.
 */

export function calculateDayOfAdmission(createdAt: string): number {
  const admission = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - admission.getTime()
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1)
}

export function extractChiefComplaint(historyText: string): string {
  // Try common patterns for chief complaint
  const patterns = [
    /(?:chief\s+complaint|presenting\s+complaint|reason\s+for\s+admission|complains?\s+of)[:\s]+(.+?)(?:\n|\.(?:\s|$))/i,
    /(?:presents?\s+with|admitted\s+(?:with|for|due\s+to))[:\s]+(.+?)(?:\n|\.(?:\s|$))/i,
    /(?:c\/o)[:\s]+(.+?)(?:\n|\.(?:\s|$))/i,
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

  const conditionPatterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\b(?:known|diagnosed)\s+(?:case\s+of\s+)?diabet(?:ic|es)/i, label: 'Known Diabetic' },
    { pattern: /\b(?:known|diagnosed)\s+(?:case\s+of\s+)?hypertens(?:ive|ion)/i, label: 'Known Hypertensive' },
    { pattern: /\bhypertens(?:ive|ion)\b/i, label: 'Hypertensive' },
    { pattern: /\bdiabet(?:ic|es)\b/i, label: 'Diabetic' },
    { pattern: /\basthma(?:tic)?\b/i, label: 'Asthmatic' },
    { pattern: /\bhiv\s*(?:positive|\+)/i, label: 'HIV+' },
    { pattern: /\bepilepsy|epileptic\b/i, label: 'Epileptic' },
    { pattern: /\bsickle\s+cell/i, label: 'Sickle Cell Disease' },
    { pattern: /\bckd|chronic\s+kidney/i, label: 'CKD' },
    { pattern: /\bheart\s+failure|cardiac\s+failure/i, label: 'Heart Failure' },
    { pattern: /\btb|tuberculosis/i, label: 'TB' },
    { pattern: /\brheumatic\s+heart/i, label: 'RHD' },
    { pattern: /\brenal\s+(?:disease|failure|insufficiency)/i, label: 'Renal Disease' },
    { pattern: /\bliver\s+(?:disease|cirrhosis|failure)/i, label: 'Liver Disease' },
    { pattern: /\bpeptic\s+ulcer/i, label: 'PUD' },
  ]

  const seen = new Set<string>()
  for (const { pattern, label } of conditionPatterns) {
    if (pattern.test(historyText) && !seen.has(label)) {
      // Prefer "Known X" over bare "X"
      if (label.startsWith('Known ')) {
        seen.add(label.replace('Known ', ''))
      }
      if (!seen.has(label)) {
        conditions.push(label)
        seen.add(label)
      }
    }
  }

  return conditions
}

/**
 * Extract OB/GYN-specific data from history text.
 */
export function extractObgynData(historyText: string, gender?: string): {
  lmp: string | null
  edd: string | null
  gestationalAge: string | null
  gravida: string | null
  parity: string | null
  obstetricFormula: string | null
} {
  const result = {
    lmp: null as string | null,
    edd: null as string | null,
    gestationalAge: null as string | null,
    gravida: null as string | null,
    parity: null as string | null,
    obstetricFormula: null as string | null,
  }

  // Only extract for female patients
  if (gender && gender.toLowerCase() !== 'female') return result

  // LMP
  const lmpMatch = historyText.match(/\b(?:lmp|last\s+menstrual\s+period|l\.m\.p)[:\s]+([^\n.;]+)/i)
  if (lmpMatch?.[1]) result.lmp = lmpMatch[1].trim()

  // EDD
  const eddMatch = historyText.match(/\b(?:edd|expected\s+(?:date|delivery)|estimated\s+(?:date|delivery))[:\s]+([^\n.;]+)/i)
  if (eddMatch?.[1]) result.edd = eddMatch[1].trim()

  // Gestational age (GBD / GBS / weeks of gestation / weeks gestation)
  // Handles: "GBD: 12w 4d", "GBS: 12w 5d", "32 weeks gestation", "28+3 weeks"
  const gaPatterns = [
    /\b(?:gbd|gbs)[:\s]+([^\n.;]+)/i,
    /\b(\d+)\s*(?:weeks?|wks?|w)\s*(?:\+?\s*\d+\s*(?:days?|d))?\s*(?:gestation(?:al)?|amenorrhea|by\s+dates?|by\s+scan|by\s+uss?)/i,
    /\b(?:gestational\s+age|ga|gestation)[:\s]+([^\n.;]+)/i,
    /\b(?:at|of)\s+(\d+\s*(?:weeks?|wks?|w)(?:\s*\+?\s*\d+\s*(?:days?|d))?)\s*(?:gestation|amenorrhea)/i,
  ]
  for (const pattern of gaPatterns) {
    const match = historyText.match(pattern)
    if (match?.[1]) {
      result.gestationalAge = match[1].trim()
      break
    }
  }

  // Obstetric formula: G4P3+1, G2P1+0, gravida 3 para 2, primigravida, etc.
  const formulaPatterns = [
    /\b(G\d+\s*P\d+\s*\+?\s*\d*)/i,
    /\b(gravida\s+\d+\s*(?:,?\s*para\s+\d+(?:\s*\+\s*\d+)?))/i,
    /\b(para\s+\d+\s*\+\s*\d+)/i,
    /\b(primigravida|multigravida|grand\s*multigravida)/i,
  ]
  for (const pattern of formulaPatterns) {
    const match = historyText.match(pattern)
    if (match?.[1]) {
      result.obstetricFormula = match[1].trim()
      break
    }
  }

  // Gravida standalone
  const gravidaMatch = historyText.match(/\b(?:gravida|G)\s*(\d+)/i)
  if (gravidaMatch?.[1]) result.gravida = gravidaMatch[1]

  // Parity standalone
  const parityMatch = historyText.match(/\b(?:para|P)\s*(\d+\s*\+?\s*\d*)/i)
  if (parityMatch?.[1]) result.parity = parityMatch[1].trim()

  return result
}

export function extractChiefComplaintWithDuration(historyText: string): string {
  // Try patterns that capture complaint + duration together
  const durationPatterns = [
    /(?:chief\s+complaint|presenting\s+complaint|complains?\s+of)[:\s]+([\s\S]+?)(?:\n{2}|\n(?=[A-Z]))/i,
    /(?:presents?\s+with|admitted\s+(?:with|for|due\s+to))[:\s]+([\s\S]+?)(?:\n{2}|\n(?=[A-Z]))/i,
    /(?:c\/o)[:\s]+([\s\S]+?)(?:\n{2}|\n(?=[A-Z]))/i,
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

/**
 * Extract a brief HPI summary from the history text.
 * Captures key clinical narrative without the full text.
 * Falls back to the first meaningful sentences of the entire history if no HPI header is found.
 */
export function extractHpiSummary(historyText: string): string {
  // Try to find the HPI section by header
  const hpiPatterns = [
    /(?:history\s+of\s+present(?:ing)?\s+illness|hpi|history\s+of\s+illness)[:\s]+([\s\S]+?)(?=\n\s*(?:past\s+medical|review\s+of\s+systems|ros|social\s+history|family\s+history|medications|allergies|physical\s+exam|on\s+examination|$))/i,
    /(?:presenting\s+history|clinical\s+history)[:\s]+([\s\S]+?)(?=\n\s*(?:past\s+medical|review\s+of\s+systems|ros|social\s+history|medications|physical\s+exam|$))/i,
  ]

  for (const pattern of hpiPatterns) {
    const match = historyText.match(pattern)
    if (match?.[1]) {
      const text = match[1].trim()
      const sentences = text.split(/\.(?:\s|$)/).filter(s => s.trim().length > 5)
      const summary = sentences.slice(0, 3).join('. ').trim()
      return summary ? summary + '.' : ''
    }
  }

  // Fallback: use the first 3 meaningful sentences of the entire history as a narrative summary.
  // Skip the chief complaint line (already shown separately) and any very short lines.
  const lines = historyText.split(/\n/).filter(l => l.trim().length > 15)
  // Skip the first line if it's likely the chief complaint
  const startIdx = lines.length > 1 ? 1 : 0
  const narrative = lines.slice(startIdx, startIdx + 5).join(' ')
  const sentences = narrative.split(/\.(?:\s|$)/).filter(s => s.trim().length > 10)
  const summary = sentences.slice(0, 3).join('. ').trim()
  return summary ? summary + '.' : ''
}

/**
 * Extract test results / investigations mentioned in the history text.
 * Looks for lab values, imaging results, and other test findings.
 */
export function extractTestsFromHistory(historyText: string): string {
  // Try structured section first
  const sectionPatterns = [
    /(?:investigation|lab(?:oratory)?\s+(?:results?|findings?)|results|tests?\s+(?:done|results?)|workup)[:\s]+([\s\S]+?)(?=\n\s*(?:impression|management|plan|treatment|assessment|diagnosis|medication|$))/i,
  ]

  for (const pattern of sectionPatterns) {
    const match = historyText.match(pattern)
    if (match?.[1]) {
      const text = match[1].trim()
      if (text.length > 10) return text.split('\n').slice(0, 8).join('\n').trim()
    }
  }

  // Fallback: scan for inline lab values (HB, WBC, platelets, creatinine, etc.)
  const labFindings: string[] = []
  const labPatterns = [
    /\b(?:hb|h[ae]moglobin)[:\s]*(\d+\.?\d*)\s*(?:g\/d?l)?/i,
    /\b(?:wbc|white\s+(?:blood\s+)?cell(?:s)?)[:\s]*(\d+\.?\d*)\s*(?:×?\s*10[³3])?/i,
    /\b(?:platelets?|plt)[:\s]*(\d+\.?\d*)/i,
    /\b(?:creatinine|cr)[:\s]*(\d+\.?\d*)/i,
    /\b(?:rbs|random\s+blood\s+sugar|blood\s+sugar|glucose)[:\s]*(\d+\.?\d*)/i,
    /\b(?:bp|blood\s+pressure)[:\s]*(\d+\s*\/\s*\d+)/i,
    /\b(?:temp(?:erature)?)[:\s]*(\d+\.?\d*)\s*°?[CcFf]?/i,
    /\b(?:pulse|hr|heart\s+rate)[:\s]*(\d+)/i,
    /\b(?:rr|respiratory\s+rate)[:\s]*(\d+)/i,
    /\b(?:spo2|oxygen\s+sat(?:uration)?|o2\s+sat)[:\s]*(\d+)%?/i,
    /\b(?:urinalysis|urine)[:\s]+([^\n]+)/i,
    /\b(?:chest\s+x-?ray|cxr)[:\s]+([^\n]+)/i,
    /\b(?:ultrasound|uss?|u\/s)[:\s]+([^\n]+)/i,
  ]

  for (const pattern of labPatterns) {
    const match = historyText.match(pattern)
    if (match) {
      labFindings.push(match[0].trim())
    }
  }

  return labFindings.length > 0 ? labFindings.join(', ') : ''
}

/**
 * Extract current medications / management from the history text.
 */
export function extractManagementFromHistory(historyText: string): string {
  // Try structured section
  const sectionPatterns = [
    /(?:current\s+management|management|treatment|plan|medications?\s+(?:given|started|commenced)|drugs?\s+(?:given|started)|currently\s+on|started\s+on|on\s+treatment)[:\s]+([\s\S]+?)(?=\n\s*(?:investigation|results|impression|diagnosis|review|ros|physical|complication|follow|$))/i,
  ]

  for (const pattern of sectionPatterns) {
    const match = historyText.match(pattern)
    if (match?.[1]) {
      const text = match[1].trim()
      if (text.length > 5) return text.split('\n').slice(0, 8).join('\n').trim()
    }
  }

  // Fallback: scan for drug names with dosing patterns
  const drugPattern = /\b(?:IV|IM|PO|SC|oral|intravenous)\s+\w+\s+\d+\s*(?:mg|g|ml|units?|iu)\s*(?:BD|TDS|QID|OD|QDS|stat|daily|once|twice|thrice)?/gi
  const drugs = historyText.match(drugPattern)
  if (drugs && drugs.length > 0) {
    return drugs.slice(0, 6).join(', ')
  }

  return ''
}

/**
 * Extract positive findings from Review of Systems in the history text.
 */
export function extractRosPositives(historyText: string): string[] {
  const positives: string[] = []

  // Try to find the ROS section
  const rosMatch = historyText.match(
    /(?:review\s+of\s+systems|ros|systemic\s+review)[:\s]+([\s\S]+?)(?=\n\s*(?:past\s+medical|social\s+history|family\s+history|medications|allergies|physical\s+exam|on\s+examination|impression|plan|$))/i
  )

  if (rosMatch?.[1]) {
    const rosText = rosMatch[1].trim()
    // Look for positive findings — lines that don't start with "no", "denies", "negative"
    const lines = rosText.split(/[\n,;]/).map(l => l.trim()).filter(l => l.length > 3)
    for (const line of lines) {
      const lower = line.toLowerCase()
      // Skip negative findings
      if (/^(no\b|denies|negative|nil|none|unremarkable|normal|nausea\s*-\s*no)/i.test(lower)) continue
      // Skip system headings alone
      if (/^(cardiovascular|respiratory|gastrointestinal|neurological|musculoskeletal|genitourinary|constitutional|general)[:\s]*$/i.test(lower)) continue
      // Include positive findings
      if (lower.includes('yes') || lower.includes('positive') || lower.includes('present') ||
          !lower.startsWith('no ') && !lower.startsWith('denies ') && line.length > 5) {
        // Clean up the line
        const cleaned = line.replace(/^[•\-\*]\s*/, '').replace(/:\s*yes$/i, '').trim()
        if (cleaned.length > 3 && !cleaned.toLowerCase().startsWith('no ')) {
          positives.push(cleaned)
        }
      }
    }
  }

  return positives.slice(0, 5) // Cap at 5 most relevant
}

/**
 * Extract symptoms that arose post-admission from user_feedback / progress notes.
 */
export function extractPostAdmissionSymptoms(allAnalyses: Array<{
  analysis_version: string | null
  user_feedback?: string | null
}>): string {
  // Get the most recent day's progress notes (user_feedback)
  const dayAnalyses = allAnalyses
    .filter(a => a.analysis_version?.startsWith('day_') && a.user_feedback)
    .sort((a, b) => {
      const dayA = parseInt(a.analysis_version?.replace('day_', '') || '0')
      const dayB = parseInt(b.analysis_version?.replace('day_', '') || '0')
      return dayB - dayA
    })

  if (dayAnalyses.length === 0) return ''

  // Return the latest day's progress notes (these contain today's symptoms)
  const latest = dayAnalyses[0]
  if (!latest.user_feedback) return ''

  // Take first 2-3 sentences as a summary of new symptoms
  const sentences = latest.user_feedback.split(/\.(?:\s|$)/).filter(s => s.trim().length > 5)
  const summary = sentences.slice(0, 3).join('. ').trim()
  return summary ? summary + '.' : ''
}

/**
 * Extract the full HPI narrative (beyond just the chief complaint line).
 */
export function extractHpiDetails(historyText: string): string {
  const patterns = [
    /(?:history\s+of\s+present(?:ing)?\s+illness|hpi|presenting\s+history|clinical\s+history)[:\s]+([\s\S]+?)(?=\n\s*(?:past\s+med|review\s+of\s+sys|ros|social\s+hist|family\s+hist|medications|allergies|physical\s+exam|on\s+examination|vital\s+signs?|$))/i,
  ]
  for (const pattern of patterns) {
    const match = historyText.match(pattern)
    if (match?.[1]) {
      const text = match[1].trim()
      if (text.length > 20) {
        const sentences = text.split(/\.(?:\s|$)/).filter(s => s.trim().length > 5)
        const result = sentences.slice(0, 5).join('. ').trim()
        return result ? result + '.' : text.slice(0, 500)
      }
    }
  }
  // Fallback: first few sentences of history (skip the CC line)
  const lines = historyText.split('\n').filter(l => l.trim().length > 15)
  const startIdx = lines.length > 1 ? 1 : 0
  const narrative = lines.slice(startIdx, startIdx + 6).join(' ')
  const sentences = narrative.split(/\.(?:\s|$)/).filter(s => s.trim().length > 10)
  const result = sentences.slice(0, 4).join('. ').trim()
  return result ? result + '.' : ''
}

/**
 * Extract past medical/surgical history and chronic illness management.
 */
export function extractPMHFromHistory(historyText: string): string {
  const sectionPatterns = [
    /(?:past\s+(?:medical|surgical|med(?:ical)?\/surgical)\s+history|pmh|psh|pmhx|background\s+(?:medical\s+)?history)[:\s]+([\s\S]+?)(?=\n\s*(?:social\s*history|family\s*history|medications|allergies|review\s*of\s*systems|ros|physical\s*exam|on\s*examination|investigation|current\s*management|management|plan|$))/i,
  ]
  for (const pattern of sectionPatterns) {
    const match = historyText.match(pattern)
    const text = match?.[1]?.trim() ?? ''
    if (text.length > 5) {
      return text.split('\n').map(l => l.trim()).filter(l => l.length > 3).slice(0, 6).join('\n')
    }
  }
  const conditions = extractKnownConditions(historyText)
  return conditions.length > 0 ? conditions.join(', ') : ''
}

/**
 * Extract vital signs from history text.
 */
export function extractVitalsFromHistory(historyText: string): string {
  const sectionMatch = historyText.match(
    /(?:vital\s*signs?|vitals?)[:\s]+([\s\S]+?)(?=\n\s*(?:physical\s*exam|on\s*examination|investigation|management|impression|review|ros|$))/i
  )
  if (sectionMatch?.[1]) {
    const text = sectionMatch[1].trim()
    if (text.length > 5) {
      return text.split('\n').map(l => l.trim()).filter(l => l.length > 2).slice(0, 6).join('  ')
    }
  }
  // Inline extraction
  const vitals: string[] = []
  const bp = historyText.match(/\b(?:bp|blood\s*pressure)[:\s]*(\d+\/\d+)/i)
  const hr = historyText.match(/\b(?:hr|heart\s*rate|pulse)[:\s]*(\d+)/i)
  const temp = historyText.match(/\b(?:temp(?:erature)?)[:\s]*(\d+\.?\d*)\s*°?[cCfF]?/i)
  const rr = historyText.match(/\b(?:rr|resp(?:iratory)?\s*rate)[:\s]*(\d+)/i)
  const spo2 = historyText.match(/\b(?:spo2|o2\s*sat(?:uration)?)[:\s]*(\d+)%?/i)
  const rbs = historyText.match(/\b(?:rbs|random\s*blood\s*sugar)[:\s]*(\d+\.?\d*)/i)
  if (bp) vitals.push(`BP ${bp[1]}`)
  if (hr) vitals.push(`HR ${hr[1]}bpm`)
  if (temp) vitals.push(`Temp ${temp[1]}°C`)
  if (rr) vitals.push(`RR ${rr[1]}`)
  if (spo2) vitals.push(`SpO2 ${spo2[1]}%`)
  if (rbs) vitals.push(`RBS ${rbs[1]}`)
  return vitals.join('  ')
}

/**
 * Extract weight from history (for paediatric patients).
 */
export function extractWeightFromHistory(historyText: string): string | null {
  const match = historyText.match(/(?:weight|wt)[:\s]*(\d+\.?\d*)\s*kg/i)
  return match ? `${match[1]}kg` : null
}

/**
 * Extract physical examination findings from history text.
 */
export function extractPhysicalExamFromHistory(historyText: string): string {
  const patterns = [
    /(?:physical\s+exam(?:ination)?|on\s+examination|examination\s+findings?|clinical\s+findings?)[:\s]+([\s\S]+?)(?=\n\s*(?:investigation|lab(?:oratory)?|results?|impression|diagnosis|management|plan|assessment|$))/i,
    /(?:general\s+(?:appearance|condition|exam))[:\s]+([\s\S]+?)(?=\n\s*(?:investigation|lab|impression|management|plan|$))/i,
  ]
  for (const pattern of patterns) {
    const match = historyText.match(pattern)
    if (match?.[1]) {
      const lines = match[1].trim().split('\n').map(l => l.trim()).filter(l => l.length > 3)
      return lines.slice(0, 5).join(' | ').replace(/\s{2,}/g, ' ').trim()
    }
  }
  return ''
}

/**
 * Extract patient name from free-text history as a fallback when the DB field is empty.
 */
export function extractPatientNameFromHistory(historyText: string): string {
  const patterns = [
    /(?:patient(?:'s)?\s*(?:name)?|name)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
    /^([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20})?)\s+is\s+(?:a\s+)?\d+/m,
    /([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20})?),?\s+(?:a\s+)?\d+[-\s]year/,
  ]
  for (const pattern of patterns) {
    const match = historyText.match(pattern)
    if (match?.[1]) {
      const name = match[1].trim()
      if (name.length > 1 && name.length < 40) return name
    }
  }
  return ''
}

/**
 * Extract patient age from free-text history as a fallback when the DB field is empty.
 */
export function extractPatientAgeFromHistory(historyText: string): number | null {
  const patterns = [
    /(\d+)[- ]year[- ]old/i,
    /age[:\s]+(\d+)/i,
    /(\d+)\s*(?:years?|yrs?)\s*(?:old|of\s+age)/i,
  ]
  for (const pattern of patterns) {
    const match = historyText.match(pattern)
    if (match?.[1]) {
      const age = parseInt(match[1], 10)
      if (age >= 0 && age <= 120) return age
    }
  }
  return null
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

/**
 * Extract a section from the raw analysis text.
 * Handles both markdown format (## Section) and JSON format.
 */
export function extractSectionFromAnalysis(rawAnalysisText: string, sectionKey: string): string {
  // Try JSON parse first (analyses stored as JSON, e.g. discharge)
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

    if (sectionKey === 'confirmatory_tests') {
      const tests = parsed.confirmatory_tests || parsed.follow_up_tests || parsed.recommended_tests || []
      if (Array.isArray(tests) && tests.length > 0) {
        return tests.map((t: any) => {
          if (typeof t === 'string') return t
          return [t.test, t.name, t.test_name].find(Boolean) || ''
        }).filter(Boolean).join('\n')
      }
    }

    return ''
  } catch {
    // Not JSON — parse as markdown
  }

  // Markdown format: ## Section Name
  const sectionHeaders: Record<string, RegExp> = {
    management_plan: /^##\s*Management\s+Plan/im,
    impressions: /^##\s*Impression/im,
    test_interpretation: /^##\s*Test\s+Interpretation/im,
    summary: /^##\s*Clinical\s+Summary/im,
    complications: /^##\s*(?:Possible\s+)?Complications/im,
    differential: /^##\s*Differential\s+Diagnos/im,
    confirmatory_tests: /^##\s*Confirmatory\s+Tests?/im,
  }

  const headerPattern = sectionHeaders[sectionKey]
  if (!headerPattern) return ''

  const match = rawAnalysisText.match(headerPattern)
  if (match) {
    const startIdx = match.index! + match[0].length
    // Find the next ## heading or end of text
    const nextSection = rawAnalysisText.slice(startIdx).match(/\n##\s/)
    const endIdx = nextSection ? startIdx + nextSection.index! : rawAnalysisText.length

    const sectionContent = rawAnalysisText.slice(startIdx, endIdx).trim()

    // Clean up markdown formatting for display
    return sectionContent
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold markers
      .replace(/^[-•]\s*/gm, '• ')         // Normalize bullet points
      .trim()
  }

  // Plain text fallback for older analyses without ## headers
  const plainTextPatterns: Record<string, RegExp> = {
    management_plan: /(?:management\s+plan|plan|treatment|management)[:\s]+([\s\S]+?)(?=\n\s*(?:impression|differential|complication|test|investigation|follow|$))/i,
    impressions: /(?:impression|diagnosis|assessment|clinical\s+impression)[:\s]+([\s\S]+?)(?=\n\s*(?:management|plan|treatment|differential|test|investigation|$))/i,
    test_interpretation: /(?:test\s+interpretation|investigation|lab(?:oratory)?\s+(?:results?|findings?)|results)[:\s]+([\s\S]+?)(?=\n\s*(?:impression|management|plan|differential|complication|$))/i,
  }

  const plainPattern = plainTextPatterns[sectionKey]
  if (plainPattern) {
    const plainMatch = rawAnalysisText.match(plainPattern)
    if (plainMatch?.[1]) {
      return plainMatch[1].trim()
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/^[-•]\s*/gm, '• ')
        .trim()
    }
  }

  return ''
}
