import { useEffect, useState, type FormEvent } from 'react'
import type { Deck, Word } from '../types'
import { formatNextReview } from '../lib/formatDue'
import { isWordDue } from '../lib/wordSchedule'
import { EmptyState } from './EmptyState'

interface DeckEditorProps {
  deck: Deck
  words: Word[]
  onBack: () => void
  onCreateWord: (
    lemma: string,
    opts: { language?: string; partOfSpeech?: string; needsScript?: boolean },
  ) => string
  onDeleteWord: (wordId: string) => void
  onOpenWord: (wordId: string) => void
  onStudy: () => void
  onRename: (name: string) => void
}

export function DeckEditor({
  deck,
  words,
  onBack,
  onCreateWord,
  onDeleteWord,
  onOpenWord,
  onStudy,
  onRename,
}: DeckEditorProps) {
  const [lemma, setLemma] = useState('')
  const [language, setLanguage] = useState('')
  const [partOfSpeech, setPartOfSpeech] = useState('')
  const [needsScript, setNeedsScript] = useState(false)
  const [deckName, setDeckName] = useState(deck.name)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setDeckName(deck.name)
  }, [deck.name])

  function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!lemma.trim()) return
    const id = onCreateWord(lemma, {
      language: language || undefined,
      partOfSpeech: partOfSpeech || undefined,
      needsScript,
    })
    setLemma('')
    setLanguage('')
    setPartOfSpeech('')
    setNeedsScript(false)
    onOpenWord(id)
  }

  function handleRenameBlur() {
    if (deckName.trim() && deckName.trim() !== deck.name) {
      onRename(deckName)
    } else {
      setDeckName(deck.name)
    }
  }

  const q = search.trim().toLowerCase()
  const filtered = words.filter((w) => {
    if (!q) return true
    return (
      w.lemma.toLowerCase().includes(q) ||
      (w.language ?? '').toLowerCase().includes(q) ||
      (w.partOfSpeech ?? '').toLowerCase().includes(q)
    )
  })

  const dueCount = words.filter((w) => isWordDue(w)).length

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Decks
        </button>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={words.length === 0}
            onClick={onStudy}
          >
            Study due
          </button>
        </div>
      </div>

      <label className="sr-only" htmlFor="deck-title">
        Deck name
      </label>
      <input
        id="deck-title"
        value={deckName}
        onChange={(e) => setDeckName(e.target.value)}
        onBlur={handleRenameBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="mb-2 w-full border-0 bg-transparent text-3xl font-bold tracking-tight text-slate-900 outline-none focus:ring-0 dark:text-white"
      />
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        {dueCount} due · {words.length} word{words.length === 1 ? '' : 's'}
      </p>

      <form
        onSubmit={handleCreate}
        className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80"
      >
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Create word
        </h2>
        <p className="mb-3 text-xs text-slate-400">
          Spawns 1 Word + 12 Aspects (handwriting only if Needs script). Tags are search-only.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="word-lemma" className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
              Lemma (target word)
            </label>
            <input
              id="word-lemma"
              value={lemma}
              onChange={(e) => setLemma(e.target.value)}
              className="input w-full"
              placeholder="e.g. 食べる / agua"
              required
            />
          </div>
          <div>
            <label htmlFor="word-lang" className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
              Language (search tag)
            </label>
            <input
              id="word-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="input w-full"
              placeholder="optional"
            />
          </div>
          <div>
            <label htmlFor="word-pos" className="mb-1 block text-sm text-slate-600 dark:text-slate-300">
              Part of speech (search tag)
            </label>
            <input
              id="word-pos"
              value={partOfSpeech}
              onChange={(e) => setPartOfSpeech(e.target.value)}
              className="input w-full"
              placeholder="optional"
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="needs-script"
              type="checkbox"
              checked={needsScript}
              onChange={(e) => setNeedsScript(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="needs-script" className="text-sm text-slate-600 dark:text-slate-300">
              Needs script (add handwriting aspect)
            </label>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="submit" className="btn-primary" disabled={!lemma.trim()}>
            Create word
          </button>
        </div>
      </form>

      {words.length > 0 && (
        <div className="mb-4">
          <label className="sr-only" htmlFor="word-search">
            Search words
          </label>
          <input
            id="word-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-full"
            placeholder="Search by lemma, language, or POS…"
          />
        </div>
      )}

      {words.length === 0 ? (
        <EmptyState
          title="No words in this deck"
          description="Create a word above to spawn the aspect template and start studying."
          icon={
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" description="Try a different search." />
      ) : (
        <ul className="space-y-2" role="list">
          {filtered.map((word) => {
            const review = formatNextReview(word.dueAt)
            return (
              <li
                key={word.id}
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/80"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onOpenWord(word.id)}
                  >
                    <p className="truncate font-medium text-slate-900 dark:text-white">
                      {word.lemma}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Stage {word.stage}
                      {word.language ? ` · ${word.language}` : ''}
                      {word.partOfSpeech ? ` · ${word.partOfSpeech}` : ''}
                      {' · '}
                      <span
                        className={
                          review.kind === 'due' || review.kind === 'overdue'
                            ? 'font-medium text-amber-700 dark:text-amber-300'
                            : ''
                        }
                      >
                        {review.label}
                      </span>
                    </p>
                  </button>
                  <div className="flex gap-2 sm:shrink-0">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => onOpenWord(word.id)}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => {
                        if (window.confirm(`Delete word “${word.lemma}” and its aspects?`)) {
                          onDeleteWord(word.id)
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
