import { useRef, useState, type FormEvent } from 'react'
import type { Deck, Word } from '../types'
import { countDueWords } from '../lib/wordSchedule'
import { EmptyState } from './EmptyState'

interface HomeProps {
  decks: Deck[]
  words: Word[]
  onCreate: (name: string) => string
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onOpenEditor: (id: string) => void
  onStudy: (id: string) => void
  onOpenDashboard: () => void
  onLoadZeppintopia: () => void
  onImportSmrt: (file: File) => Promise<void>
}

function formatLastStudied(iso: string | null): string {
  if (!iso) return 'Never studied'
  const d = new Date(iso)
  return `Last studied ${d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`
}

export function Home({
  decks,
  words,
  onCreate,
  onRename,
  onDelete,
  onOpenEditor,
  onStudy,
  onOpenDashboard,
  onLoadZeppintopia,
  onImportSmrt,
}: HomeProps) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function submitCreate(e: FormEvent) {
    e.preventDefault()
    const id = onCreate(newName)
    setNewName('')
    setCreating(false)
    onOpenEditor(id)
  }

  function startRename(deck: Deck) {
    setEditingId(deck.id)
    setEditName(deck.name)
  }

  function submitRename(e: FormEvent) {
    e.preventDefault()
    if (editingId) {
      onRename(editingId, editName)
      setEditingId(null)
    }
  }

  function confirmDelete(deck: Deck) {
    const n = words.filter((w) => w.deckId === deck.id).length
    if (
      window.confirm(
        `Delete “${deck.name}” and its ${n} word${n === 1 ? '' : 's'}?`,
      )
    ) {
      onDelete(deck.id)
    }
  }

  async function handleSmrtFile(file: File | undefined) {
    if (!file) return
    setImportError(null)
    setImporting(true)
    try {
      await onImportSmrt(file)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Flashcards
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Words are scheduled; aspects are review surfaces — no per-card SRS.
          </p>
        </div>
        {!creating && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onOpenDashboard} className="btn-secondary">
              Schedule
            </button>
            <button type="button" onClick={() => setCreating(true)} className="btn-primary">
              New deck
            </button>
          </div>
        )}
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/40">
        <button type="button" className="btn-secondary" onClick={onLoadZeppintopia}>
          Load Zeppintopia sample
        </button>
        <label className="btn-ghost cursor-pointer">
          {importing ? 'Importing…' : 'Import .smrt'}
          <input
            ref={fileRef}
            type="file"
            accept=".smrt,application/zip"
            className="sr-only"
            disabled={importing}
            onChange={(e) => void handleSmrtFile(e.target.files?.[0])}
          />
        </label>
        {importError && (
          <p className="w-full text-sm text-rose-600 dark:text-rose-400">{importError}</p>
        )}
      </div>

      {creating && (
        <form
          onSubmit={submitCreate}
          className="mb-6 flex flex-col gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 sm:flex-row sm:items-center dark:border-indigo-800 dark:bg-indigo-950/40"
        >
          <label className="sr-only" htmlFor="new-deck-name">
            Deck name
          </label>
          <input
            id="new-deck-name"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Deck name"
            className="input flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setCreating(false)
                setNewName('')
              }
            }}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              Create
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setCreating(false)
                setNewName('')
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {decks.length === 0 ? (
        <EmptyState
          title="No decks yet"
          description="Create your first deck to start adding words and studying — or load the Zeppintopia sample."
          icon={
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                Create a deck
              </button>
              <button type="button" className="btn-secondary" onClick={onLoadZeppintopia}>
                Load Zeppintopia sample
              </button>
            </div>
          }
        />
      ) : (
        <ul className="space-y-3" role="list">
          {decks.map((deck) => {
            const deckWords = words.filter((w) => w.deckId === deck.id)
            const due = countDueWords(deckWords)
            return (
              <li
                key={deck.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/80 dark:hover:border-slate-600"
              >
                {editingId === deck.id ? (
                  <form onSubmit={submitRename} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input flex-1"
                      aria-label="Rename deck"
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="btn-primary">
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-white">
                        {deck.name}
                      </h2>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                        {due} due · {deckWords.length} word
                        {deckWords.length === 1 ? '' : 's'} ·{' '}
                        {formatLastStudied(deck.lastStudied)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={deckWords.length === 0}
                        onClick={() => onStudy(deck.id)}
                      >
                        Study
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => onOpenEditor(deck.id)}
                      >
                        Words
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => startRename(deck)}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => confirmDelete(deck)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
