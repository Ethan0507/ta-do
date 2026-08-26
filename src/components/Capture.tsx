import { useState, type FormEvent } from 'react'
import type { EntryType } from '../types'

interface CaptureProps {
  onCapture: (type: EntryType, content: string, dueDate: string | null) => Promise<void>
}

export function Capture({ onCapture }: CaptureProps) {
  const [content, setContent] = useState('')
  const [type, setType] = useState<EntryType>('thought')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    await onCapture(type, content.trim(), type === 'task' && dueDate ? dueDate : null)
    setContent('')
    setDueDate('')
    setType('thought')
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-lg bg-white p-4 shadow">
      <input
        type="text"
        placeholder="What's on your mind?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        autoFocus
      />
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {(['thought', 'goal', 'task'] as EntryType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded px-3 py-1 text-xs font-medium capitalize ${
                type === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {type === 'task' && (
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          />
        )}
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="ml-auto rounded bg-slate-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </form>
  )
}
