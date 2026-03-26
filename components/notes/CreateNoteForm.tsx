'use client'

import { useState } from 'react'
import { DEFAULT_ROTATIONS } from '@/lib/constants/rotations'

interface CreateNoteFormProps {
  onCreated: () => void
  onCancel: () => void
  customRotations?: string[]
  defaultRotation?: string | null
}

export function CreateNoteForm({ onCreated, onCancel, customRotations = [], defaultRotation = null }: CreateNoteFormProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [rotation, setRotation] = useState<string>(defaultRotation || '')
  const [customRotation, setCustomRotation] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allRotations = [...new Set([...DEFAULT_ROTATIONS, ...customRotations])].sort()

  const handleRotationChange = (value: string) => {
    if (value === '__custom__') {
      setShowCustom(true)
      setRotation('')
    } else {
      setShowCustom(false)
      setCustomRotation('')
      setRotation(value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    const finalRotation = showCustom ? customRotation.trim() : rotation
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          source: 'manual',
          rotation: finalRotation || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      setTitle('')
      setContent('')
      setRotation('')
      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-blue-200 dark:border-blue-800">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">New Note</h3>

      {/* Rotation dropdown */}
      <div className="mb-2">
        <select
          value={showCustom ? '__custom__' : rotation}
          onChange={e => handleRotationChange(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">No rotation</option>
          {allRotations.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
          <option value="__custom__">+ Add new rotation...</option>
        </select>
      </div>

      {showCustom && (
        <input
          type="text"
          value={customRotation}
          onChange={e => setCustomRotation(e.target.value)}
          placeholder="Enter rotation name..."
          autoFocus
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
        />
      )}

      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Note title..."
        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
      />

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Write your clinical note..."
        rows={4}
        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
      />

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}

      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !title.trim() || !content.trim()}
          className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {saving ? 'Saving...' : 'Save Note'}
        </button>
      </div>
    </form>
  )
}
