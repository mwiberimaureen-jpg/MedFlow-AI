import { NotesList } from '@/components/notes/NotesList'

export default function NotesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Clinical Notes</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm md:text-base">Your saved clinical pearls and personal notes</p>
      </div>

      <NotesList />
    </div>
  )
}
