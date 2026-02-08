const DRAFT_KEY = 'medflow_patient_draft'

export function saveDraft(data: any): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...data,
      savedAt: new Date().toISOString()
    }))
  } catch (error) {
    console.error('Failed to save draft:', error)
  }
}

export function loadDraft(): any | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (error) {
    console.error('Failed to load draft:', error)
    return null
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch (error) {
    console.error('Failed to clear draft:', error)
  }
}
