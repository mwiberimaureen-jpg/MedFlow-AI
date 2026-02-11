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
    const draft = JSON.parse(raw)

    // Don't restore drafts older than 24 hours
    if (draft.savedAt) {
      const savedTime = new Date(draft.savedAt).getTime()
      const now = Date.now()
      if (now - savedTime > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(DRAFT_KEY)
        return null
      }
    }

    return draft
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
