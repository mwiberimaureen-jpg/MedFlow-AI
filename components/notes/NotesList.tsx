'use client'

import { useEffect, useState, useCallback } from 'react'
import { NoteCard } from './NoteCard'
import { CreateNoteForm } from './CreateNoteForm'
import type { ClinicalNote } from '@/lib/types/clinical-note'

type FilterType = 'all' | 'manual' | 'starred'

const STARRED_SOURCES = ['senior_asks', 'quick_teach', 'know_your_drugs', 'clinical_twist']

export function NotesList() {
  const [notes, setNotes] = useState<ClinicalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [showCreateForm, setShowCreateForm] = useState(false)

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/notes')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch')
      setNotes(data.notes || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch (err: any) {
      alert('Failed to delete note: ' + err.message)
    }
  }

  const handleCreated = () => {
    setShowCreateForm(false)
    fetchNotes()
  }

  const filteredNotes = notes.filter(note => {
    if (filter === 'manual') return note.source === 'manual'
    if (filter === 'starred') return STARRED_SOURCES.includes(note.source)
    return true
  })

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 animate-pulse">
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-3 w-full bg-gray-100 dark:bg-gray-700/50 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
        <p className="text-sm text-red-500">Failed to load notes: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: filters + new note button */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1">
          {([
            ['all', 'All'],
            ['manual', 'Manual'],
            ['starred', 'Starred'],
          ] as [FilterType, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                filter === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Note
          </button>
        )}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <CreateNoteForm onCreated={handleCreated} onCancel={() => setShowCreateForm(false)} />
      )}

      {/* Notes list */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filter === 'all'
              ? 'No notes yet. Create one or star content from Senior Peer Review!'
              : filter === 'manual'
              ? 'No manual notes yet. Click "New Note" to create one.'
              : 'No starred notes yet. Star content from the Senior Peer Review to save it here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotes.map(note => (
            <NoteCard key={note.id} note={note} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
