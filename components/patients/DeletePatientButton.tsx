'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DeletePatientButtonProps {
  patientId: string
  patientName: string
  variant?: 'icon' | 'button'
  onDeleted?: () => void
}

export function DeletePatientButton({ patientId, patientName, variant = 'button', onDeleted }: DeletePatientButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/patients/${patientId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      if (onDeleted) {
        onDeleted()
      } else {
        router.push('/dashboard/patients')
        router.refresh()
      }
    } catch {
      alert('Failed to delete patient. Please try again.')
    } finally {
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      {variant === 'icon' ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowConfirm(true) }}
          className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1"
          title="Delete patient"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
        >
          Delete
        </button>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowConfirm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-4xl mb-3">🗑️</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Patient?</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                <strong>{patientName}</strong> will be moved to trash. You can restore it within 7 days.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? 'Deleting...' : 'Move to Trash'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
