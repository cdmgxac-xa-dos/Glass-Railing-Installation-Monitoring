import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Send } from 'lucide-react'
import type { LocationComment } from '../types'
import { addComment, getCommentsForLocation } from '../services/commentService'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'

export default function NotesPage() {
  const { locationId = '' } = useParams()
  const { user } = useAuth()
  const [notes, setNotes] = useState<LocationComment[]>([])
  const [draft, setDraft] = useState('')

  useEffect(() => {
    getCommentsForLocation(locationId).then(setNotes)
  }, [locationId])

  async function addNote() {
    if (!draft.trim()) return
    const comment = await addComment(locationId, user?.name ?? 'Field User', draft.trim())
    setNotes((prev) => [comment, ...prev])
    setDraft('')
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F8FC]">
      <PageHeader title="Notes & Comments" subtitle={locationId} />

      <div className="flex-1 space-y-3 px-4 py-5">
        {notes.length === 0 && <p className="py-10 text-center text-sm text-xa-slate">No notes yet for this location.</p>}
        {notes.map((note) => (
          <div key={note.id} className="rounded-2xl border border-xa-line bg-white p-3 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-xa-navy">{note.author}</p>
              <p className="text-[11px] text-slate-400">{new Date(note.createdAt).toLocaleString()}</p>
            </div>
            <p className="mt-1 text-sm text-slate-700">{note.text}</p>
          </div>
        ))}
      </div>

      <div className="sticky bottom-16 flex items-center gap-2 border-t border-xa-line bg-white px-4 py-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addNote()}
          placeholder="Add a note…"
          className="flex-1 rounded-full border border-xa-line px-4 py-2.5 text-sm outline-none focus:border-xa-blue"
        />
        <button
          onClick={addNote}
          aria-label="Send note"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-xa-navy text-white active:scale-90"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
