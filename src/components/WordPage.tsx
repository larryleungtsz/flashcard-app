import { useState, type FormEvent } from 'react'
import type { Aspect, Word } from '../types'
import { formatNextReview } from '../lib/formatDue'

interface WordPageProps {
  word: Word
  aspects: Aspect[]
  deckName?: string
  onBack: () => void
  onUpdateMeta: (
    patch: Partial<Pick<Word, 'lemma' | 'language' | 'partOfSpeech' | 'needsScript'>>,
  ) => void
  onUpdateAspect: (aspectId: string, front: string, back: string) => void
  onDelete: () => void
}

export function WordPage({
  word,
  aspects,
  deckName,
  onBack,
  onUpdateMeta,
  onUpdateAspect,
  onDelete,
}: WordPageProps) {
  const [lemma, setLemma] = useState(word.lemma)
  const [language, setLanguage] = useState(word.language ?? '')
  const [pos, setPos] = useState(word.partOfSpeech ?? '')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')

  const review = formatNextReview(word.dueAt)
  const sorted = [...aspects].sort((a, b) => a.code.localeCompare(b.code))

  function saveMeta(e: FormEvent) {
    e.preventDefault()
    if (!lemma.trim()) return
    onUpdateMeta({
      lemma: lemma.trim(),
      language: language.trim() || undefined,
      partOfSpeech: pos.trim() || undefined,
    })
  }

  function startEdit(a: Aspect) {
    setEditingId(a.id)
    setEditFront(a.front)
    setEditBack(a.back)
  }

  function saveAspect(e: FormEvent) {
    e.preventDefault()
    if (!editingId) return
    onUpdateAspect(editingId, editFront, editBack)
    setEditingId(null)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← {deckName ?? 'Back'}
        </button>
        <button
          type="button"
          className="btn-danger ml-auto"
          onClick={() => {
            if (window.confirm(`Delete word “${word.lemma}”?`)) onDelete()
          }}
        >
          Delete word
        </button>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        {word.lemma}
      </h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Stage {word.stage} · interval {word.intervalDays}d · ease {word.ease.toFixed(2)} ·
        reviews {word.reviewCount}
        {' · '}
        {review.kind === 'upcoming' ? `Next due ${review.label}` : review.label}
        {review.absolute ? ` (${review.absolute})` : ''}
      </p>

      <form
        onSubmit={saveMeta}
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80"
      >
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Word details
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300" htmlFor="wp-lemma">
              Lemma
            </label>
            <input
              id="wp-lemma"
              className="input w-full"
              value={lemma}
              onChange={(e) => setLemma(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300" htmlFor="wp-lang">
              Language (search only)
            </label>
            <input
              id="wp-lang"
              className="input w-full"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600 dark:text-slate-300" htmlFor="wp-pos">
              Part of speech (search only)
            </label>
            <input
              id="wp-pos"
              className="input w-full"
              value={pos}
              onChange={(e) => setPos(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="submit" className="btn-primary">
            Save details
          </button>
        </div>
      </form>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Aspects ({sorted.length})
      </h2>
      <p className="mb-4 text-xs text-slate-400">
        Aspects have no independent SRS. Status: live / audit_only / graduated.
      </p>

      <ul className="space-y-2" role="list">
        {sorted.map((a) => (
          <li
            key={a.id}
            className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/80"
          >
            {editingId === a.id ? (
              <form onSubmit={saveAspect} className="grid gap-3">
                <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                  {a.code} · {a.type} · {a.status}
                </div>
                <input
                  className="input"
                  value={editFront}
                  onChange={(e) => setEditFront(e.target.value)}
                  aria-label="Front"
                />
                <input
                  className="input"
                  value={editBack}
                  onChange={(e) => setEditBack(e.target.value)}
                  aria-label="Back"
                />
                <div className="flex gap-2 justify-end">
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                    {a.code} · {a.type} · {a.status}
                    {a.easyStreak > 0 ? ` · easy×${a.easyStreak}` : ''}
                  </p>
                  <p className="mt-1 truncate font-medium text-slate-900 dark:text-white">
                    {a.front}
                  </p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                    {a.back}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Last reviewed{' '}
                    {a.lastReviewedAt
                      ? new Date(a.lastReviewedAt).toLocaleString()
                      : 'never'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost shrink-0"
                  onClick={() => startEdit(a)}
                >
                  Edit
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
