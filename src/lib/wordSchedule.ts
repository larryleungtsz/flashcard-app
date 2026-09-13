import type { Word } from '../types'

const MIN_EASE = 1.3
const AGAIN_MS = 10 * 60 * 1000

export type WordScheduleFields = Pick<
  Word,
  'intervalDays' | 'repetition' | 'ease' | 'dueAt' | 'stage'
>

export function defaultWordSchedule(): Pick<
  Word,
  'stage' | 'dueAt' | 'intervalDays' | 'ease' | 'repetition' | 'reviewCount' | 'lastReviewedAt'
> {
  return {
    stage: 0,
    dueAt: null,
    intervalDays: 0,
    ease: 2.5,
    repetition: 0,
    reviewCount: 0,
    lastReviewedAt: null,
  }
}

export function isDueAt(dueAt: string | null, now: Date = new Date()): boolean {
  if (dueAt == null) return true
  return new Date(dueAt).getTime() <= now.getTime()
}

export function isWordDue(word: Word, now: Date = new Date()): boolean {
  return isDueAt(word.dueAt, now)
}

export function countDueWords(words: Word[], now: Date = new Date()): number {
  return words.filter((w) => isWordDue(w, now)).length
}

export function nextWordDueAt(words: Word[], now: Date = new Date()): string | null {
  let soonest: number | null = null
  for (const w of words) {
    if (w.dueAt == null) continue
    const t = new Date(w.dueAt).getTime()
    if (t > now.getTime() && (soonest === null || t < soonest)) {
      soonest = t
    }
  }
  return soonest === null ? null : new Date(soonest).toISOString()
}

/** Fail: stage back to 1, due in ~10 minutes, reset repetition. */
export function scheduleWordFail(word: Word, now: Date = new Date()): WordScheduleFields {
  return {
    intervalDays: 0,
    repetition: 0,
    ease: Math.max(MIN_EASE, word.ease - 0.2),
    dueAt: new Date(now.getTime() + AGAIN_MS).toISOString(),
    stage: 1,
  }
}

/**
 * Easy: SM-2-ish intervals; bump stage toward 3 after successful reviews.
 * stage 0→1 on first Easy; then stage+1 when repetition thresholds met (cap 3).
 */
export function scheduleWordEasy(word: Word, now: Date = new Date()): WordScheduleFields {
  let intervalDays: number
  let repetition: number

  if (word.repetition === 0) {
    intervalDays = 1
    repetition = 1
  } else if (word.repetition === 1) {
    intervalDays = 3
    repetition = 2
  } else {
    intervalDays = Math.max(1, Math.round(word.intervalDays * word.ease))
    repetition = word.repetition + 1
  }

  const ease = word.ease + 0.1
  const dueAt = new Date(
    now.getTime() + intervalDays * 24 * 60 * 60 * 1000,
  ).toISOString()

  let stage = word.stage
  if (word.stage === 0) {
    stage = 1
  } else if (repetition >= 2 && word.stage < 2) {
    stage = 2
  } else if (repetition >= 4 && word.stage < 3) {
    stage = 3
  } else if (word.stage < 3 && repetition >= word.stage + 1) {
    stage = Math.min(3, (word.stage + 1) as Word['stage']) as Word['stage']
  }

  return { intervalDays, repetition, ease, dueAt, stage }
}
