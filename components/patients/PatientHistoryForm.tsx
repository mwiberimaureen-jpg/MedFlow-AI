'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CharacterCounter } from './CharacterCounter'
import { saveDraft, loadDraft, clearDraft } from '@/lib/utils/draft'

const MAX_HISTORY_LENGTH = 10000
const MIN_HISTORY_LENGTH = 50

export function PatientHistoryForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const [formData, setFormData] = useState({
    patient_name: '',
    patient_age: '',
    patient_gender: '',
    patient_identifier: '',
    history_text: ''
  })

  // Load draft on mount
  useEffect(() => {
    const draft = loadDraft()
    if (draft && draft.patient_name) {
      setFormData({
        patient_name: draft.patient_name || '',
        patient_age: draft.patient_age || '',
        patient_gender: draft.patient_gender || '',
        patient_identifier: draft.patient_identifier || '',
        history_text: draft.history_text || ''
      })
      if (draft.savedAt) {
        setLastSaved(new Date(draft.savedAt))
      }
    }
  }, [])

  // Auto-save draft every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (formData.patient_name || formData.history_text) {
        saveDraft(formData)
        setLastSaved(new Date())
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [formData])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validateForm = useCallback(() => {
    if (!formData.patient_name.trim()) {
      setError('Patient name is required')
      return false
    }

    if (!formData.history_text.trim()) {
      setError('Patient history is required')
      return false
    }

    const historyLength = formData.history_text.trim().length
    if (historyLength < MIN_HISTORY_LENGTH) {
      setError(`Patient history must be at least ${MIN_HISTORY_LENGTH} characters`)
      return false
    }

    if (historyLength > MAX_HISTORY_LENGTH) {
      setError(`Patient history must not exceed ${MAX_HISTORY_LENGTH} characters`)
      return false
    }

    return true
  }, [formData])

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    setError(null)

    // Only validate for submitted status, allow drafts with less validation
    if (status === 'submitted' && !validateForm()) {
      return
    }

    setLoading(true)

    // Clear draft immediately when submitting (not drafting)
    if (status === 'submitted') {
      clearDraft()
    }

    try {
      // Step 1: Create the patient record with 'analyzing' status
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patient_name: formData.patient_name.trim(),
          patient_age: formData.patient_age ? parseInt(formData.patient_age) : undefined,
          patient_gender: formData.patient_gender || undefined,
          patient_identifier: formData.patient_identifier.trim() || undefined,
          history_text: formData.history_text.trim(),
          status: status === 'submitted' ? 'analyzing' : 'draft'
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save patient history')
      }

      // Clear draft on successful save
      clearDraft()

      // Step 2: If submitted, run the AI analysis synchronously (await it)
      if (status === 'submitted') {
        setAnalyzing(true)

        const analyzeResponse = await fetch(`/api/patients/${data.patient.id}/analyze`, {
          method: 'POST',
        })

        if (!analyzeResponse.ok) {
          const analyzeData = await analyzeResponse.json().catch(() => ({}))
          throw new Error(analyzeData.error || 'Analysis failed — please try again from the patient page')
        }
      }

      // Step 3: Redirect to patient detail page (analysis is ready)
      router.push(`/dashboard/patients/${data.patient.id}`)

    } catch (err: any) {
      setError(err.message || 'An error occurred while saving')
    } finally {
      setLoading(false)
      setAnalyzing(false)
    }
  }

  const handleSaveDraft = () => handleSubmit('draft')
  const handleSubmitForm = () => handleSubmit('submitted')

  return (
    <Card>
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Patient Name *"
            id="patient_name"
            name="patient_name"
            type="text"
            value={formData.patient_name}
            onChange={handleChange}
            placeholder="John Doe"
            required
          />

          <Input
            label="Patient Identifier (Optional)"
            id="patient_identifier"
            name="patient_identifier"
            type="text"
            value={formData.patient_identifier}
            onChange={handleChange}
            placeholder="e.g., Hospital Number, MRN"
          />

          <Input
            label="Age (Optional)"
            id="patient_age"
            name="patient_age"
            type="number"
            value={formData.patient_age}
            onChange={handleChange}
            placeholder="25"
            min="0"
            max="150"
          />

          <div>
            <label htmlFor="patient_gender" className="block text-sm font-medium text-gray-700 mb-2">
              Gender (Optional)
            </label>
            <select
              id="patient_gender"
              name="patient_gender"
              value={formData.patient_gender}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div>
          <Textarea
            label="Patient History *"
            id="history_text"
            name="history_text"
            value={formData.history_text}
            onChange={handleChange}
            placeholder="Enter detailed patient history including chief complaint, history of present illness, past medical history, medications, allergies, social history, family history, review of systems, and any other relevant information..."
            rows={15}
            required
          />
          <div className="mt-2">
            <CharacterCounter
              current={formData.history_text.length}
              max={MAX_HISTORY_LENGTH}
              min={MIN_HISTORY_LENGTH}
            />
          </div>
        </div>

        {lastSaved && (
          <div className="text-sm text-gray-500">
            Last auto-saved: {lastSaved.toLocaleTimeString()}
          </div>
        )}

        <div className="flex gap-4">
          <Button
            variant="secondary"
            onClick={handleSaveDraft}
            disabled={loading || !formData.patient_name || !formData.history_text}
          >
            Save Draft
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmitForm}
            loading={loading || analyzing}
            disabled={loading || analyzing}
          >
            {analyzing ? 'Analyzing... (30–60s)' : loading ? 'Saving...' : 'Submit & Analyze'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
