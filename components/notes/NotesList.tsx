'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { NoteCard } from './NoteCard'
import { CreateNoteForm } from './CreateNoteForm'
import { UploadPdfForm } from './UploadPdfForm'
import type { ClinicalNote } from '@/lib/types/clinical-note'

type FilterType = 'all' | 'manual' | 'starred' | 'pdf'

const STARRED_SOURCES = ['senior_asks', 'quick_teach', 'know_your_drugs', 'clinical_twist']

const FOLDER_COLORS = [
  { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-700', icon: 'text-blue-500 dark:text-blue-400', text: 'text-blue-800 dark:text-blue-200', count: 'text-blue-500 dark:text-blue-400' },
  { bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-700', icon: 'text-violet-500 dark:text-violet-400', text: 'text-violet-800 dark:text-violet-200', count: 'text-violet-500 dark:text-violet-400' },
  { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700', icon: 'text-emerald-500 dark:text-emerald-400', text: 'text-emerald-800 dark:text-emerald-200', count: 'text-emerald-500 dark:text-emerald-400' },
  { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-700', icon: 'text-amber-500 dark:text-amber-400', text: 'text-amber-800 dark:text-amber-200', count: 'text-amber-500 dark:text-amber-400' },
  { bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-700', icon: 'text-rose-500 dark:text-rose-400', text: 'text-rose-800 dark:text-rose-200', count: 'text-rose-500 dark:text-rose-400' },
  { bg: 'bg-teal-50 dark:bg-teal-900/20', border: 'border-teal-200 dark:border-teal-700', icon: 'text-teal-500 dark:text-teal-400', text: 'text-teal-800 dark:text-teal-200', count: 'text-teal-500 dark:text-teal-400' },
  { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-700', icon: 'text-orange-500 dark:text-orange-400', text: 'text-orange-800 dark:text-orange-200', count: 'text-orange-500 dark:text-orange-400' },
  { bg: 'bg-sky-50 dark:bg-sky-900/20', border: 'border-sky-200 dark:border-sky-700', icon: 'text-sky-500 dark:text-sky-400', text: 'text-sky-800 dark:text-sky-200', count: 'text-sky-500 dark:text-sky-400' },
]

export function NotesList() {
  const [notes, setNotes] = useState<ClinicalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openFolder, setOpenFolder] = useState<string | null>(null) // null = folder grid view
  const [filter, setFilter] = useState<FilterType>('all')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showUploadPdf, setShowUploadPdf] = useState(false)

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

  useEffect(() => { fetchNotes() }, [fetchNotes])

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch (err: any) {
      alert('Failed to delete note: ' + err.message)
    }
  }

  const handleRotationChange = async (noteId: string, rotation: string | null) => {
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotation }),
      })
      if (!res.ok) throw new Error('Failed to move note')
      const data = await res.json()
      setNotes(prev => prev.map(n => n.id === noteId ? data.note : n))
    } catch (err: any) {
      alert('Failed to move note: ' + err.message)
    }
  }

  const customRotations = useMemo(() => {
    const { DEFAULT_ROTATIONS } = require('@/lib/constants/rotations')
    const all = new Set<string>()
    notes.forEach(n => { if (n.rotation) all.add(n.rotation) })
    return [...all].filter(r => !DEFAULT_ROTATIONS.includes(r)).sort()
  }, [notes])

  // Build folder list from actual rotations in notes
  const folders = useMemo(() => {
    const counts: Record<string, number> = {}
    let uncategorized = 0
    notes.forEach(n => {
      if (n.rotation) counts[n.rotation] = (counts[n.rotation] || 0) + 1
      else uncategorized++
    })
    const result = Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }))
    if (uncategorized > 0) result.push({ name: '__uncategorized__', count: uncategorized })
    return result
  }, [notes])

  // Notes inside the open folder, filtered by source type
  const folderNotes = useMemo(() => {
    if (openFolder === null) return []
    return notes.filter(n => {
      const inFolder = openFolder === '__uncategorized__' ? !n.rotation : n.rotation === openFolder
      if (!inFolder) return false
      if (filter === 'manual') return n.source === 'manual'
      if (filter === 'starred') return STARRED_SOURCES.includes(n.source)
      if (filter === 'pdf') return n.source === 'pdf'
      return true
    })
  }, [notes, openFolder, filter])

  const folderLabel = openFolder === '__uncategorized__' ? 'Uncategorized' : openFolder

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-3 w-16 bg-gray-100 dark:bg-gray-700/50 rounded" />
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

  // ── FOLDER GRID VIEW ──────────────────────────────────────────────────────
  if (openFolder === null) {
    return (
      <div className="space-y-4">
        {/* Actions */}
        <div className="flex justify-end gap-2">
          {!showCreateForm && !showUploadPdf && (
            <>
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Note
              </button>
              <button
                onClick={() => setShowUploadPdf(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Upload PDF
              </button>
            </>
          )}
        </div>

        {showCreateForm && (
          <CreateNoteForm
            onCreated={() => { setShowCreateForm(false); fetchNotes() }}
            onCancel={() => setShowCreateForm(false)}
            customRotations={customRotations}
          />
        )}

        {showUploadPdf && (
          <UploadPdfForm
            onUploaded={() => { setShowUploadPdf(false); fetchNotes() }}
            onCancel={() => setShowUploadPdf(false)}
            customRotations={customRotations}
          />
        )}

        {folders.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
            <div className="text-4xl mb-3">📁</div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No notes yet.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Create a note or star content from Senior Peer Review to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {folders.map(({ name, count }, i) => {
              const color = FOLDER_COLORS[i % FOLDER_COLORS.length]
              const label = name === '__uncategorized__' ? 'Uncategorized' : name
              return (
                <button
                  key={name}
                  onClick={() => { setOpenFolder(name); setFilter('all') }}
                  className={`${color.bg} ${color.border} border-2 rounded-xl p-5 text-left hover:shadow-md hover:scale-[1.02] transition-all group`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <svg className={`w-8 h-8 ${color.icon}`} fill="currentColor" viewBox="0 0 24 24">
                      <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" />
                    </svg>
                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <p className={`text-sm font-bold ${color.text} leading-snug`}>{label}</p>
                  <p className={`text-xs mt-1 ${color.count}`}>{count} {count === 1 ? 'note' : 'notes'}</p>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── INSIDE A FOLDER ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header: back + folder name + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setOpenFolder(null); setShowCreateForm(false); setShowUploadPdf(false) }}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Folders
          </button>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">{folderLabel}</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">({notes.filter(n => openFolder === '__uncategorized__' ? !n.rotation : n.rotation === openFolder).length})</span>
        </div>

        {!showCreateForm && !showUploadPdf && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Note
            </button>
            <button
              onClick={() => setShowUploadPdf(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Upload PDF
            </button>
          </div>
        )}
      </div>

      {/* Source filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {([
          ['all', 'All'],
          ['manual', 'Manual'],
          ['starred', 'Starred'],
          ['pdf', '📄 PDFs'],
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

      {showCreateForm && (
        <CreateNoteForm
          onCreated={() => { setShowCreateForm(false); fetchNotes() }}
          onCancel={() => setShowCreateForm(false)}
          customRotations={customRotations}
          defaultRotation={openFolder !== '__uncategorized__' ? openFolder : null}
        />
      )}

      {showUploadPdf && (
        <UploadPdfForm
          onUploaded={() => { setShowUploadPdf(false); fetchNotes() }}
          onCancel={() => setShowUploadPdf(false)}
          customRotations={customRotations}
          defaultRotation={openFolder !== '__uncategorized__' ? openFolder : null}
        />
      )}

      {folderNotes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filter === 'all' ? 'No notes in this rotation yet.' : `No ${filter} notes in this rotation.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {folderNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onDelete={handleDelete}
              onRotationChange={handleRotationChange}
              customRotations={customRotations}
            />
          ))}
        </div>
      )}
    </div>
  )
}
