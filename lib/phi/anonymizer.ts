/**
 * PHI De-identification Layer
 *
 * Strips patient-identifying information before sending text to external AI APIs.
 * Restores original values in AI responses so the UI displays real names.
 */

export interface PatientIdentifiers {
  patientName: string
  patientIdentifier?: string | null
}

interface AnonymizeResult {
  masked: string
  tokenMap: Map<string, string>
}

/**
 * Build a list of name fragments to mask.
 * For "Jane Wanjiku Muthoni" → ["Jane Wanjiku Muthoni", "Jane", "Wanjiku", "Muthoni"]
 * Sorted longest-first so full name is replaced before fragments.
 */
function buildNameFragments(fullName: string): string[] {
  const trimmed = fullName.trim()
  if (!trimmed) return []

  const parts = trimmed.split(/\s+/).filter(p => p.length >= 2)
  // Full name first, then individual parts (longest first)
  const fragments = [trimmed, ...parts.sort((a, b) => b.length - a.length)]
  // Deduplicate
  return [...new Set(fragments)]
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Replace all case-insensitive occurrences of a token in text.
 */
function replaceAll(text: string, search: string, replacement: string): string {
  if (!search || search.length < 2) return text
  const escaped = escapeRegExp(search)
  // Word-boundary aware for short tokens (≤3 chars) to avoid false positives
  const pattern = search.length <= 3
    ? new RegExp(`\\b${escaped}\\b`, 'gi')
    : new RegExp(escaped, 'gi')
  return text.replace(pattern, replacement)
}

/**
 * Anonymize patient-identifying information in text before sending to AI.
 *
 * Replaces:
 * - Patient name (full + fragments) → "Patient A"
 * - Patient identifier → "[ID-REDACTED]"
 *
 * Does NOT mask: age, gender, drug names, vitals, lab values, dates.
 */
export function anonymize(text: string, identifiers: PatientIdentifiers): AnonymizeResult {
  const tokenMap = new Map<string, string>()
  let masked = text

  // Mask patient name
  const nameFragments = buildNameFragments(identifiers.patientName)
  for (const fragment of nameFragments) {
    const token = fragment === identifiers.patientName.trim() ? 'Patient A' : 'Patient A'
    tokenMap.set(fragment, token)
    masked = replaceAll(masked, fragment, token)
  }

  // Mask patient identifier (hospital number, MRN, etc.)
  if (identifiers.patientIdentifier) {
    const id = identifiers.patientIdentifier.trim()
    if (id) {
      tokenMap.set(id, '[ID-REDACTED]')
      masked = replaceAll(masked, id, '[ID-REDACTED]')
    }
  }

  return { masked, tokenMap }
}

/**
 * Restore original patient-identifying information in AI-generated text.
 * Called after receiving the AI response, before saving to DB / showing to user.
 */
export function deAnonymize(text: string, tokenMap: Map<string, string>): string {
  let restored = text

  for (const [original, token] of tokenMap) {
    // Only restore the full name replacement (avoid double-restoring fragments)
    restored = replaceAll(restored, token, original)
  }

  return restored
}

/**
 * Deep de-anonymize an AnalysisResponse object.
 * Walks all string values in the object and restores PHI tokens.
 */
export function deAnonymizeResponse<T>(obj: T, tokenMap: Map<string, string>): T {
  if (tokenMap.size === 0) return obj

  const json = JSON.stringify(obj)
  let restored = json

  for (const [original, token] of tokenMap) {
    // In JSON strings, we need to handle escaped characters
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    restored = restored.replace(new RegExp(escapedToken, 'g'), original)
  }

  try {
    return JSON.parse(restored) as T
  } catch {
    // If JSON parsing fails, return original object
    return obj
  }
}
