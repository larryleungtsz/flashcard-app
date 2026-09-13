import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Aspect, Deck, Word } from '../types'
import { notifyReview } from '../lib/notifyReview'
import {
  countDueWords,
  isWordDue,
  nextWordDueAt,
} from '../lib/wordSchedule'
import { sampleAspects, isAuditReview } from '../lib/sampler'
import { FlashCard } from './FlashCard'

interface StudyModeProps {
  deck: Deck
  words: Word[]
  aspects: Aspect[]
  allDecks: Deck[]
  allWords: Word[]
  onBack: () => void
  onComplete: () => void
  onFinishWord: (
    wordId: string,
    sampledAspectIds: string[],
    answers: { aspectId: string; result: 'again' | 'good' }[],
  ) => void
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function formatNextDue(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function StudyMode({
  deck,
  words,
  aspects,
  allDecks,
  allWords,
  onBack,
  onComplete,
  onFinishWord,
}: StudyModeProps) {
  const sessionStart = useMemo(() => new Date(), [])
  const [wordQueue, setWordQueue] = useState<Word[]>(() =>
    shuffle(words.filter((w) => isWordDue(w, new Date()))),
  )
  const [wordIndex, setWordIndex] = useState(0)
  const [sampled, setSampled] = useState<Aspect[]>([])
  const [aspectIndex, setAspectIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [answers, setAnswers] = useState<
    { aspectId: string; result: 'again' | 'good' }[]
  >([])
  const [known, setKnown] = useState(0)
  const [learning, setLearning] = useState(0)
  const [done, setDone] = useState(false)
  const completedRef = useRef(false)
  const wordOverrides = useRef<Map<string, Word>>(new Map())

  const totalWords = wordQueue.length
  const currentWord = wordQueue[wordIndex]
  const currentAspect = sampled[aspectIndex]
  const isAudit = currentWord ? isAuditReview(currentWord) : false

  // When word changes, sample aspects
  useEffect(() => {
    if (!currentWord || done) return
    const asps = sampleAspects(
      currentWord,
      aspects.filter((a) => a.wordId === currentWord.id),
    )
    setSampled(asps)
    setAspectIndex(0)
    setFlipped(false)
    setAnswers([])
  }, [currentWord?.id, done]) // eslint-disable-line react-hooks/exhaustive-deps

  const flip = useCallback(() => setFlipped((f) => !f), [])

  const restart = useCallback(() => {
    const now = new Date()
    const source = allWords
      .filter((w) => w.deckId === deck.id)
      .map((w) => wordOverrides.current.get(w.id) ?? w)
    setWordQueue(shuffle(source.filter((w) => isWordDue(w, now))))
    setWordIndex(0)
    setSampled([])
    setAspectIndex(0)
    setFlipped(false)
    setAnswers([])
    setKnown(0)
    setLearning(0)
    setDone(false)
    completedRef.current = false
    wordOverrides.current = new Map()
  }, [deck.id, allWords])

  const notifyRemaining = useCallback(
    (updatedWord: Word | null, now: Date) => {
      const decks = allDecks
        .map((d) => {
          const deckWords = allWords
            .filter((w) => w.deckId === d.id)
            .map((w) => {
              if (updatedWord && w.id === updatedWord.id) return updatedWord
              return wordOverrides.current.get(w.id) ?? w
            })
          return { name: d.name, remaining: countDueWords(deckWords, now) }
        })
        .filter((d) => d.remaining > 0)

      void notifyReview({
        kind: 'remaining',
        decks,
        at: now.toISOString(),
      })
    },
    [allDecks, allWords],
  )

  const rateAspect = useCallback(
    (result: 'again' | 'good') => {
      if (!currentWord || !currentAspect) return

      const nextAnswers = [
        ...answers,
        { aspectId: currentAspect.id, result },
      ]
      setAnswers(nextAnswers)

      if (result === 'good') setKnown((k) => k + 1)
      else setLearning((l) => l + 1)

      const moreAspects = aspectIndex + 1 < sampled.length
      if (moreAspects) {
        setAspectIndex((i) => i + 1)
        setFlipped(false)
        return
      }

      // All aspects answered → grade Word once
      onFinishWord(
        currentWord.id,
        sampled.map((a) => a.id),
        nextAnswers,
      )

      // Optimistic override for remaining notify — core-first heuristic
      const now = new Date()
      const coreAns = nextAnswers.find((a) => {
        const asp = sampled.find((s) => s.id === a.aspectId)
        return asp?.type === 'core' || asp?.code === 'core' || (asp?.code?.startsWith('core') ?? false)
      })
      const wordFail =
        (coreAns?.result === 'again') ||
        (!coreAns &&
          nextAnswers.some((a) => {
            const asp = sampled.find((s) => s.id === a.aspectId)
            return asp?.type === 'motor' && a.result === 'again'
          }))
      const scheduled: Word = {
        ...currentWord,
        reviewCount: currentWord.reviewCount + 1,
        lastReviewedAt: now.toISOString(),
        stage: wordFail ? 1 : currentWord.stage,
        dueAt: wordFail
          ? new Date(now.getTime() + 10 * 60 * 1000).toISOString()
          : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      }
      wordOverrides.current.set(currentWord.id, scheduled)
      notifyRemaining(scheduled, now)

      const finishing = wordIndex + 1 >= totalWords
      if (finishing) {
        setDone(true)
        if (!completedRef.current) {
          completedRef.current = true
          onComplete()
        }
      } else {
        setWordIndex((i) => i + 1)
        setFlipped(false)
      }
    },
    [
      currentWord,
      currentAspect,
      answers,
      aspectIndex,
      sampled,
      onFinishWord,
      wordIndex,
      totalWords,
      onComplete,
      notifyRemaining,
    ],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || totalWords === 0) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        flip()
      } else if (flipped && (e.key === '1' || e.key.toLowerCase() === 'a')) {
        e.preventDefault()
        rateAspect('again')
      } else if (flipped && (e.key === '2' || e.key.toLowerCase() === 'g')) {
        e.preventDefault()
        rateAspect('good')
      } else if (e.key === 'Escape') {
        onBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flip, flipped, rateAspect, done, onBack, totalWords])

  if (totalWords === 0) {
    const next = nextWordDueAt(words, sessionStart)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-600 dark:text-slate-300">
          No words due — come back later
        </p>
        {next && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Next due {formatNextDue(next)}
          </p>
        )}
        <button type="button" className="btn-primary mt-4" onClick={onBack}>
          Back to decks
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Session complete</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{deck.name}</p>
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-emerald-50 p-4 dark:bg-emerald-950/40">
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{known}</p>
            <p className="text-sm text-emerald-600/80 dark:text-emerald-500">Good / Easy</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-950/40">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{learning}</p>
            <p className="text-sm text-amber-600/80 dark:text-amber-500">Again / Fail</p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn-primary" onClick={restart}>
            Study again
          </button>
          <button type="button" className="btn-secondary" onClick={onBack}>
            Back to decks
          </button>
        </div>
      </div>
    )
  }

  if (!currentAspect || !currentWord) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-slate-600 dark:text-slate-300">Loading aspects…</p>
      </div>
    )
  }

  const chipLabel = `${currentWord.lemma} · ${currentAspect.code} · ${aspectIndex + 1}/${sampled.length} this round`

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <button type="button" className="btn-ghost" onClick={onBack}>
          ← Exit
        </button>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-white">{deck.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
            Word {wordIndex + 1} of {totalWords}
            {isAudit ? ' · Audit' : ` · Stage ${currentWord.stage}`}
          </p>
        </div>
        <div className="w-16" aria-hidden />
      </div>

      <div className="mb-4 flex justify-center">
        <span className="inline-flex max-w-full items-center truncate rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200">
          {chipLabel}
        </span>
      </div>

      <div
        className="mb-6 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar"
        aria-valuenow={wordIndex + 1}
        aria-valuemin={1}
        aria-valuemax={totalWords}
        aria-label="Study progress"
      >
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${((wordIndex + 1) / totalWords) * 100}%` }}
        />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        <FlashCard
          front={currentAspect.front}
          back={currentAspect.back}
          mediaUrl={currentAspect.mediaUrl}
          flipped={flipped}
          onFlip={flip}
        />

        <div
          className={`mt-8 flex w-full max-w-lg gap-3 transition-opacity ${
            flipped ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-hidden={!flipped}
        >
          <button
            type="button"
            className="btn-again flex-1"
            onClick={() => rateAspect('again')}
            disabled={!flipped}
            tabIndex={flipped ? 0 : -1}
          >
            Again
            <span className="ml-1 hidden text-xs opacity-70 sm:inline">(1 / A)</span>
          </button>
          <button
            type="button"
            className="btn-good flex-1"
            onClick={() => rateAspect('good')}
            disabled={!flipped}
            tabIndex={flipped ? 0 : -1}
          >
            Good
            <span className="ml-1 hidden text-xs opacity-70 sm:inline">(2 / G)</span>
          </button>
        </div>
      </div>
    </div>
  )
}
