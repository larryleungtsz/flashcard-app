import { useMemo, useState } from 'react'
import type { Aspect, Deck, Word } from '../types'
import { isDueAt } from '../lib/wordSchedule'
import { dueSortKey, formatNextReview } from '../lib/formatDue'
import { EmptyState } from './EmptyState'

interface ScheduleDashboardProps {
  decks: Deck[]
  words: Word[]
  aspects: Aspect[]
  onBack: () => void
  onOpenWord: (wordId: string) => void
}

type StatusFilter = 'all' | 'due' | 'upcoming'

interface ScheduleRow {
  key: string
  deckId: string
  deckName: string
  wordId: string
  lemma: string
  stage: number
  dueAt: string | null
  aspectCount: number
}

export function ScheduleDashboard({
  decks,
  words,
  aspects,
  onBack,
  onOpenWord,
}: ScheduleDashboardProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [deckFilter, setDeckFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const now = useMemo(() => new Date(), [])

  const rows = useMemo(() => {
    const list: ScheduleRow[] = []
    for (const word of words) {
      const deck = decks.find((d) => d.id === word.deckId)
      list.push({
        key: word.id,
        deckId: word.deckId,
        deckName: deck?.name ?? 'Unknown',
        wordId: word.id,
        lemma: word.lemma,
        stage: word.stage,
        dueAt: word.dueAt,
        aspectCount: aspects.filter((a) => a.wordId === word.id).length,
      })
    }
    list.sort((a, b) => dueSortKey(a.dueAt) - dueSortKey(b.dueAt))
    return list
  }, [decks, words, aspects])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (deckFilter !== 'all' && row.deckId !== deckFilter) return false
      const due = isDueAt(row.dueAt, now)
      if (statusFilter === 'due') return due
      if (statusFilter === 'upcoming') return !due
      return true
    })
  }, [rows, deckFilter, statusFilter, now])

  const dueCount = rows.filter((r) => isDueAt(r.dueAt, now)).length
  const upcomingCount = rows.length - dueCount

  const chips: { id: StatusFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: rows.length },
    { id: 'due', label: 'Due now', count: dueCount },
    { id: 'upcoming', label: 'Upcoming', count: upcomingCount },
  ]

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Decks
        </button>
      </div>

      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Schedule
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Next review for each Word (aspects have no separate due dates).
        </p>
      </header>

      {rows.length > 0 && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
            {chips.map((chip) => {
              const active = statusFilter === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setStatusFilter(chip.id)}
                  className={
                    active
                      ? 'inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm'
                      : 'inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }
                  aria-pressed={active}
                >
                  {chip.label}
                  <span
                    className={
                      active
                        ? 'rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] tabular-nums'
                        : 'rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                    }
                  >
                    {chip.count}
                  </span>
                </button>
              )
            })}
          </div>

          {decks.length > 1 && (
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="sr-only sm:not-sr-only">Deck</span>
              <select
                className="input py-1.5"
                value={deckFilter}
                onChange={(e) => setDeckFilter(e.target.value)}
                aria-label="Filter by deck"
              >
                <option value="all">All decks</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="No words yet"
          description="Add words to a deck and their next review times will show up here."
          action={
            <button type="button" className="btn-primary" onClick={onBack}>
              Back to decks
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          description="Try a different status or deck filter."
        />
      ) : (
        <ul className="space-y-2" role="list">
          {filtered.map((row) => {
            const review = formatNextReview(row.dueAt, now)
            const open = expanded === row.wordId
            const wordAspects = aspects.filter((a) => a.wordId === row.wordId)
            return (
              <li
                key={row.key}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/80"
              >
                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onOpenWord(row.wordId)}
                  >
                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                      {row.deckName}
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {row.lemma}
                    </p>
                    <p className="text-xs text-slate-500">
                      Stage {row.stage} · {row.aspectCount} aspects
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    {review.kind === 'due' || review.kind === 'overdue' ? (
                      <span
                        className={
                          review.kind === 'overdue'
                            ? 'inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                        }
                      >
                        {review.label}
                      </span>
                    ) : (
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                          {review.label}
                        </p>
                        {review.absolute && (
                          <p className="text-xs text-slate-500">{review.absolute}</p>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() =>
                        setExpanded(open ? null : row.wordId)
                      }
                    >
                      {open ? 'Hide' : 'Aspects'}
                    </button>
                  </div>
                </div>
                {open && (
                  <ul className="border-t border-slate-100 px-4 py-2 dark:border-slate-700">
                    {wordAspects.map((a) => (
                      <li
                        key={a.id}
                        className="flex justify-between gap-2 py-1.5 text-xs text-slate-600 dark:text-slate-300"
                      >
                        <span>
                          {a.code} · {a.type} · {a.status}
                        </span>
                        <span className="text-slate-400">no dueAt</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
