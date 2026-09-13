import type { Aspect, AspectGrade, Word } from '../types'
import { scheduleWordEasy, scheduleWordFail } from './wordSchedule'

export type AspectAnswer = { aspectId: string; grade: AspectGrade }

export interface GradeResult {
  word: Word
  aspects: Aspect[]
  /** Fail | Easy used for Word schedule (core-first). */
  wordGrade: AspectGrade
}

const GRADUATE_2 = new Set(['loci_text', 'mnem_story', 'object_rel', 'handwriting'])
const GRADUATE_3_SHADOW = 'shadow_025'

/**
 * Map UI Again → Fail, Good → Easy.
 */
export function uiToGrade(result: 'again' | 'good'): AspectGrade {
  return result === 'again' ? 'fail' : 'easy'
}

/**
 * Grade Word from core result first; if no core in session, worst motor
 * (Fail worse than Easy). Scaffold Easy does not advance the Word.
 * Scaffold Fail does not reset the Word.
 */
export function resolveWordGrade(
  answers: AspectAnswer[],
  sampled: Aspect[],
): AspectGrade {
  const byId = new Map(sampled.map((a) => [a.id, a]))
  const gradeOf = (id: string) => answers.find((a) => a.aspectId === id)?.grade

  const core = sampled.find(
    (a) => a.type === 'core' || a.code === 'core' || a.code.startsWith('core'),
  )
  if (core) {
    const g = gradeOf(core.id)
    if (g) return g
  }

  const motorAnswers = answers.filter((ans) => {
    const a = byId.get(ans.aspectId)
    return a?.type === 'motor'
  })
  if (motorAnswers.some((a) => a.grade === 'fail')) return 'fail'
  if (motorAnswers.length > 0) return 'easy'

  // Fallback: any Fail among answers wins; else Easy
  if (answers.some((a) => a.grade === 'fail')) return 'fail'
  return 'easy'
}

function applyGraduation(
  aspect: Aspect,
  grade: AspectGrade,
  word: Word,
): Aspect {
  const now = new Date().toISOString()
  let easyStreak = grade === 'easy' ? aspect.easyStreak + 1 : 0
  let status = aspect.status

  if (grade === 'easy') {
    if (GRADUATE_2.has(aspect.code) && easyStreak >= 2 && status === 'live') {
      status = 'graduated'
    }
    if (
      aspect.code === GRADUATE_3_SHADOW &&
      easyStreak >= 3 &&
      status === 'live' &&
      (word.stage >= 2 || word.ease >= 2.7 || word.repetition >= 2)
    ) {
      status = 'graduated'
    }
  }

  return {
    ...aspect,
    easyStreak,
    status,
    lastReviewedAt: now,
  }
}

/**
 * After all sampled aspects answered: update Word schedule once + aspect
 * streaks/graduation. Increments reviewCount by 1.
 */
export function gradeWordReview(
  word: Word,
  allAspects: Aspect[],
  sampled: Aspect[],
  answers: AspectAnswer[],
  now: Date = new Date(),
): GradeResult {
  const wordGrade = resolveWordGrade(answers, sampled)
  const schedule =
    wordGrade === 'fail' ? scheduleWordFail(word, now) : scheduleWordEasy(word, now)

  const answerMap = new Map(answers.map((a) => [a.aspectId, a.grade]))
  const sampledIds = new Set(sampled.map((a) => a.id))

  const updatedAspects = allAspects.map((a) => {
    if (!sampledIds.has(a.id)) return a
    const g = answerMap.get(a.id)
    if (!g) return { ...a, lastReviewedAt: now.toISOString() }
    return applyGraduation(a, g, { ...word, ...schedule })
  })

  const updatedWord: Word = {
    ...word,
    ...schedule,
    reviewCount: word.reviewCount + 1,
    lastReviewedAt: now.toISOString(),
  }

  return { word: updatedWord, aspects: updatedAspects, wordGrade }
}
