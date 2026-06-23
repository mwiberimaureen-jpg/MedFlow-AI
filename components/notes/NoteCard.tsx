'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { DEFAULT_ROTATIONS } from '@/lib/constants/rotations'
import { createClient } from '@/lib/supabase/client'
import type { ClinicalNote } from '@/lib/types/clinical-note'

const SOURCE_LABELS: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'danger' | 'default' }> = {
  manual: { label: '✏️ Manual', variant: 'default' },
  senior_asks: { label: '🩺 The Senior Asks', variant: 'info' },
  quick_teach: { label: '⚡ Quick Teach', variant: 'warning' },
  know_your_drugs: { label: '💊 Know Your Drugs', variant: 'success' },
  clinical_twist: { label: '🔬 Clinical Twist', variant: 'danger' },
  pdf: { label: '📄 PDF Protocol', variant: 'default' },
}

const TYPE_COLORS: Record<string, string> = {
  classification: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  mnemonic: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  pathophysiology: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  criteria: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

const TYPE_LABELS: Record<string, string> = {
  classification: 'Classification',
  mnemonic: 'Mnemonic',
  pathophysiology: 'Pathophysiology',
  criteria: 'Criteria',
}

function SeniorAsksNoteView({ data }: { data: any }) {
  return (
    <div className="space-y-3 mt-3">
      {data.context && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">{data.context}</p>
      )}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-l-4 border-blue-500">
        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">The Senior Asks</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{data.question}</p>
      </div>
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
        <p className="text-sm text-gray-800 dark:text-gray-200">{data.answer}</p>
      </div>
      <div className="bg-amber-50 dark:bg-amber-900/15 rounded-lg p-3 border border-amber-200 dark:border-amber-800/50">
        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">Teaching Point</p>
        <p className="text-sm text-gray-700 dark:text-gray-300">{data.teaching_point}</p>
      </div>
      <div className="bg-green-50 dark:bg-green-900/15 rounded-lg p-3 border border-green-200 dark:border-green-800/50">
        <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">Clinical Pearl</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 italic">{data.clinical_pearl}</p>
      </div>
    </div>
  )
}

function QuickTeachNoteView({ data }: { data: any }) {
  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-400 italic">{data.intro}</p>
        {data.teach_type && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${TYPE_COLORS[data.teach_type] || TYPE_COLORS.classification}`}>
            {TYPE_LABELS[data.teach_type] || data.teach_type}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {(data.cards || []).map((card: any, i: number) => (
          <div key={card.id || i} className="rounded-lg border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{card.title}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{card.content}</p>
          </div>
        ))}
      </div>
      <div className="bg-green-50 dark:bg-green-900/15 rounded-lg p-3 border border-green-200 dark:border-green-800/50">
        <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">Key Takeaway</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 italic">{data.summary_pearl}</p>
      </div>
    </div>
  )
}

function KnowYourDrugsNoteView({ data }: { data: any }) {
  return (
    <div className="space-y-3 mt-3">
      {data.context && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">{data.context}</p>
      )}
      <div className="space-y-2">
        {(data.drugs || []).map((drug: any, i: number) => (
          <div key={i} className="rounded-lg border-2 border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-900/10 p-3">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">{drug.name}</p>
            <div className="space-y-1.5 text-sm">
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">Mechanism: </span>
                <span className="text-gray-800 dark:text-gray-200">{drug.mechanism}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600 dark:text-gray-400">When to use: </span>
                <span className="text-gray-800 dark:text-gray-200">{drug.when_to_use}</span>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/15 rounded p-2 border border-amber-200 dark:border-amber-800/50">
                <span className="font-medium text-amber-700 dark:text-amber-400">Key point: </span>
                <span className="text-gray-800 dark:text-gray-200">{drug.key_point}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-green-50 dark:bg-green-900/15 rounded-lg p-3 border border-green-200 dark:border-green-800/50">
        <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">Clinical Pearl</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 italic">{data.clinical_pearl}</p>
      </div>
    </div>
  )
}

function ClinicalTwistNoteView({ data }: { data: any }) {
  return (
    <div className="space-y-3 mt-3">
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Current Scenario</p>
        <p className="text-sm text-gray-800 dark:text-gray-200">{data.scenario}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          <span className="font-medium">Current plan:</span> {data.original_plan}
        </p>
      </div>
      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 border-l-4 border-orange-500">
        <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1">The Twist</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{data.twist}</p>
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/15 rounded-lg p-4 border border-blue-200 dark:border-blue-800/50">
        <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-1">Revised Plan</p>
        <p className="text-sm text-gray-800 dark:text-gray-200">{data.revised_plan}</p>
      </div>
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
        <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Reasoning</p>
        <p className="text-sm text-gray-700 dark:text-gray-300">{data.reasoning}</p>
      </div>
      <div className="bg-green-50 dark:bg-green-900/15 rounded-lg p-3 border border-green-200 dark:border-green-800/50">
        <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wide mb-1">Clinical Pearl</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 italic">{data.clinical_pearl}</p>
      </div>
    </div>
  )
}

function parseOldTextFormat(content: string, source: string): any | null {
  const sections = content.split('\n\n')
  const get = (prefix: string) => sections.find(s => s.startsWith(prefix))?.slice(prefix.length).trim()

  if (source === 'senior_asks') {
    const question = get('Q: ')
    const answer = get('A: ')
    if (!question || !answer) return null
    return {
      _sparkFormat: 'senior_asks',
      question,
      answer,
      teaching_point: get('Teaching Point: ') || '',
      clinical_pearl: get('Clinical Pearl: ') || '',
    }
  }

  if (source === 'clinical_twist') {
    const scenario = get('Scenario: ')
    if (!scenario) return null
    return {
      _sparkFormat: 'clinical_twist',
      scenario,
      original_plan: get('Original Plan: ') || '',
      twist: get('Twist: ') || '',
      revised_plan: get('Revised Plan: ') || '',
      reasoning: get('Reasoning: ') || '',
      clinical_pearl: get('Clinical Pearl: ') || '',
    }
  }

  if (source === 'know_your_drugs') {
    const pearlSection = get('Clinical Pearl: ')
    const contextEnd = content.indexOf('\n\n')
    const context = contextEnd > -1 ? content.slice(0, contextEnd) : ''
    const drugsRaw = content.slice(contextEnd + 2, pearlSection ? content.lastIndexOf('\n\nClinical Pearl: ') : undefined)
    const drugBlocks = drugsRaw.split('\n\n').filter(Boolean)
    const drugs = drugBlocks.map(block => {
      const lines = block.split('\n')
      const name = lines[0]?.trim()
      const mech = lines.find(l => l.trim().startsWith('Mechanism: '))?.replace(/^\s*Mechanism: /, '') || ''
      const when = lines.find(l => l.trim().startsWith('When to use: '))?.replace(/^\s*When to use: /, '') || ''
      const key = lines.find(l => l.trim().startsWith('Key point: '))?.replace(/^\s*Key point: /, '') || ''
      return { name, mechanism: mech, when_to_use: when, key_point: key }
    }).filter(d => d.name)
    if (!drugs.length) return null
    return { _sparkFormat: 'know_your_drugs', context, drugs, clinical_pearl: pearlSection || '' }
  }

  if (source === 'quick_teach') {
    const pearlSection = get('Key Takeaway: ')
    const bodyEnd = pearlSection ? content.lastIndexOf('\n\nKey Takeaway: ') : content.length
    const [intro, ...rest] = content.slice(0, bodyEnd).split('\n\n')
    const cards = rest.map((block, i) => {
      const colonIdx = block.indexOf(': ')
      if (colonIdx === -1) return { id: String(i), title: block, content: '' }
      return { id: String(i), title: block.slice(0, colonIdx), content: block.slice(colonIdx + 2) }
    }).filter(c => c.title)
    if (!cards.length) return null
    return { _sparkFormat: 'quick_teach', intro, cards, summary_pearl: pearlSection || '' }
  }

  return null
}

function SparkNoteContent({ content, source }: { content: string; source: string }) {
  let parsed: any = null
  try { parsed = JSON.parse(content) } catch { /* plain text */ }

  if (!parsed?._sparkFormat) {
    parsed = parseOldTextFormat(content, source)
  }

  if (!parsed?._sparkFormat) {
    return <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-2">{content}</p>
  }

  switch (parsed._sparkFormat) {
    case 'senior_asks': return <SeniorAsksNoteView data={parsed} />
    case 'quick_teach': return <QuickTeachNoteView data={parsed} />
    case 'know_your_drugs': return <KnowYourDrugsNoteView data={parsed} />
    case 'clinical_twist': return <ClinicalTwistNoteView data={parsed} />
    default: return <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mt-2">{content}</p>
  }
}

interface NoteCardProps {
  note: ClinicalNote
  onDelete: (id: string) => void
  onRotationChange: (id: string, rotation: string | null) => void
  customRotations?: string[]
}

function PdfNoteContent({ pdfUrl }: { pdfUrl: string }) {
  const [opening, setOpening] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleView() {
    setOpening(true)
    setErr(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from('clinical-pdfs')
        .createSignedUrl(pdfUrl, 3600)
      if (error || !data?.signedUrl) throw new Error('Could not open PDF')
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (e: any) {
      setErr(e.message || 'Failed to open PDF')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 flex-1 min-w-0">
        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-xs text-blue-700 dark:text-blue-300 truncate">
          {pdfUrl.split('/').pop()?.replace(/^\d+-/, '') || 'protocol.pdf'}
        </span>
      </div>
      <button
        type="button"
        onClick={handleView}
        disabled={opening}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        {opening ? 'Opening…' : 'View PDF'}
      </button>
      {err && <p className="text-xs text-red-500 mt-1">{err}</p>}
    </div>
  )
}

export function NoteCard({ note, onDelete, onRotationChange, customRotations = [] }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)

  const sourceInfo = SOURCE_LABELS[note.source] || SOURCE_LABELS.manual
  const date = new Date(note.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  const isSparkNote = note.source !== 'manual'

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
  const needsTruncation = !isSparkNote && note.content.length > previewLength
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

      {/* Content */}
      {note.source === 'pdf' ? (
        note.pdf_url ? <PdfNoteContent pdfUrl={note.pdf_url} /> : null
      ) : isSparkNote ? (
        <div className="mt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {expanded ? 'Hide details' : 'Show details'}
          </button>
          {expanded && <SparkNoteContent content={note.content} source={note.source} />}
        </div>
      ) : (
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
      )}
    </div>
  )
}
