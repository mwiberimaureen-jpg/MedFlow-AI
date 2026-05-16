'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DEFAULT_ROTATIONS } from '@/lib/constants/rotations'

interface UploadPdfFormProps {
  onUploaded: () => void
  onCancel: () => void
  customRotations?: string[]
  defaultRotation?: string | null
}

const MAX_MB = 20

export function UploadPdfForm({ onUploaded, onCancel, customRotations = [], defaultRotation }: UploadPdfFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [rotation, setRotation] = useState(defaultRotation || '')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allRotations = [...new Set([...DEFAULT_ROTATIONS, ...customRotations])].sort()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] || null
    if (selected && selected.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${MAX_MB} MB.`)
      setFile(null)
      return
    }
    setError(null)
    setFile(selected)
  }

  async function handleUpload() {
    if (!file) { setError('Please select a PDF file.'); return }
    setUploading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Upload to Supabase Storage under the user's folder
      const storagePath = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error: uploadError } = await supabase.storage
        .from('clinical-pdfs')
        .upload(storagePath, file, { contentType: 'application/pdf', upsert: false })

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      // Save note record pointing to the storage path
      const noteTitle = title.trim() || file.name.replace(/\.pdf$/i, '')
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteTitle,
          content: '',
          source: 'pdf',
          pdf_url: storagePath,
          rotation: rotation || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save note')
      }

      onUploaded()
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-2 border-dashed border-blue-300 dark:border-blue-700">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Upload PDF Protocol / Guideline</h3>
      </div>

      <div className="space-y-3">
        {/* File input */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            PDF File <span className="text-gray-400 font-normal">(max {MAX_MB} MB)</span>
          </label>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="block w-full text-xs text-gray-700 dark:text-gray-300
              file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0
              file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400
              dark:hover:file:bg-blue-900/50 cursor-pointer"
          />
          {file && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {file.name} &middot; {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Title <span className="text-gray-400 font-normal">(optional — defaults to filename)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={file ? file.name.replace(/\.pdf$/i, '') : 'e.g. Sepsis Management Protocol'}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Rotation */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Rotation</label>
          <select
            value={rotation}
            onChange={e => setRotation(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">No rotation</option>
            {allRotations.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !file}
            className="flex-1 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {uploading ? 'Uploading…' : 'Upload PDF'}
          </button>
        </div>
      </div>
    </div>
  )
}
