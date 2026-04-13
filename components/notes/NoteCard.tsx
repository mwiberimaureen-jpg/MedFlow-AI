'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { DEFAULT_ROTATIONS } from '@/lib/constants/rotations'
import type { ClinicalNote } from '@/lib/types/clinical-note'

const SOURCE_LABELS: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'danger' | 'default' }> = {
  manual: { label: '✏️ Manual', variant: 'default' },
  senior_asks: { label: '🩺 The Senior Asks', variant: 'info' },
  quick_teach: { label: '⚡ Quick Teach', variant: 'warning' },
  know_your_drugs: { label: '💊 Know Your Drugs', variant: 'success' },
  clinical_twist: { label: '🔬 Clinical Twist', variant: 'danger' },
}

interface NoteCardProps {
  note: ClinicalNote
  onDelete: (id: string) => void
  onRotationChange: (id: string, rotation: string | null) => void
  customRotations?: string[]
}

export function NoteCard({ note, onDelete, onRotationChange, customRotations = [] }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)

  const sourceInfo = SOURCE_LABELS[note.source] || SOURCE_LABELS.manual
  const date = new Date(note.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const handleDelete = async () => {
    if (!confirm('Delete this note?')) return
    setDeleting(true)
    onDelete(note.id)
  }

  const handleMove = (rotation: string | null) => {
    onRotationChange(note.id, rotation)
    setShowMoveMenu(false)
  }

  const allRotations = [...new Set([...DEFAULT_ROTATIONS, ...customRotations])].sort()

  const previewLength = 150
  const needsTruncation = note.content.length > previewLength
  const displayContent = expanded ? note.content : note.content.slice(0, previewLength) + (needsTruncation ? '...' : '')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{note.title}</h3>
            <Badge variant={sourceInfo.variant}>{sourceInfo.label}</Badge>
            {note.rotation && (
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                {note.rotation}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">{date}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Move to rotation button */}
          <div className="relative">
            <button
              onClick={() => setShowMoveMenu(!showMoveMenu)}
              className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-1"
              title="Move to rotation"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>
            {showMoveMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMoveMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => handleMove(null)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 ${
                      !note.rotation ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    No rotation
                  </button>
                  {allRotations.map(r => (
                    <button
                      key={r}
                      onClick={() => handleMove(r)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-600 ${
                        note.rotation === r ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Delete button */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
            title="Delete note"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-2">
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{displayContent}</p>
        {needsTruncation && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  )
}
