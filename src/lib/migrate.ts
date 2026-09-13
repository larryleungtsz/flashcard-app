import type { Aspect, Deck, LegacyCard, LegacyDeck, Word } from '../types'
import { defaultWordSchedule } from './wordSchedule'

export const STORAGE_DECKS = 'flashcard-app:decks'
export const STORAGE_WORDS = 'flashcard-app:words'
export const STORAGE_ASPECTS = 'flashcard-app:aspects'
export const STORAGE_MIGRATED = 'flashcard-app:migrated-v2'
export const STORAGE_SEEDED = 'flashcard-app:seeded'

function newId(): string {
  return crypto.randomUUID()
}

/** Normalize front text for grouping: trim + lower; "word — gloss" → left side. */
export function extractLemma(front: string): string {
  const trimmed = front.trim()
  const sep = trimmed.match(/\s+[—–\-]\s+/)
  if (sep && sep.index !== undefined && sep.index > 0) {
    return trimmed.slice(0, sep.index).trim()
  }
  return trimmed
}

function lemmaKey(front: string): string {
  return extractLemma(front).toLowerCase()
}

function aspectFromLegacyCard(
  wordId: string,
  card: LegacyCard,
  index: number,
  total: number,
): Aspect {
  const isCore = total === 1 || index === 0
  return {
    id: card.id || newId(),
    wordId,
    type: isCore ? 'core' : 'scaffold',
    code: isCore ? 'core' : `legacy_${index}`,
    status: 'live',
    front: card.front,
    back: card.back,
    easyStreak: 0,
    lastReviewedAt: null,
  }
}

function wordFromCards(
  deckId: string,
  lemma: string,
  cards: LegacyCard[],
): { word: Word; aspects: Aspect[] } {
  const primary = cards[0]
  const wordId = newId()
  const schedule = defaultWordSchedule()

  // Use primary card's SRS as Word starting schedule
  if (primary) {
    if (typeof primary.interval === 'number') schedule.intervalDays = primary.interval
    if (typeof primary.repetition === 'number') schedule.repetition = primary.repetition
    if (typeof primary.ease === 'number') schedule.ease = primary.ease
    if (primary.dueAt !== undefined) schedule.dueAt = primary.dueAt
    schedule.stage = schedule.repetition > 0 ? 1 : 0
  }

  const word: Word = {
    id: wordId,
    lemma,
    deckId,
    createdAt: new Date().toISOString(),
    ...schedule,
  }

  const aspects = cards.map((c, i) =>
    aspectFromLegacyCard(wordId, c, i, cards.length),
  )
  return { word, aspects }
}

/**
 * Migrate old Deck{cards[]} with per-card SRS → Words + Aspects.
 * Group cards that share the same lemma key within a deck.
 * If grouping is unclear: one Word per card.
 */
export function migrateLegacyDecks(legacy: LegacyDeck[]): {
  decks: Deck[]
  words: Word[]
  aspects: Aspect[]
} {
  const decks: Deck[] = []
  const words: Word[] = []
  const aspects: Aspect[] = []

  for (const d of legacy) {
    decks.push({
      id: d.id,
      name: d.name,
      createdAt: d.createdAt,
      lastStudied: d.lastStudied,
    })

    const cards = d.cards ?? []
    if (cards.length === 0) continue

    // Group by normalized lemma within deck
    const groups = new Map<string, LegacyCard[]>()
    for (const c of cards) {
      const key = lemmaKey(c.front || '')
      // Empty front → unique key so we don't invent merges
      const groupKey = key || `__solo_${c.id}`
      const list = groups.get(groupKey) ?? []
      list.push(c)
      groups.set(groupKey, list)
    }

    for (const [, group] of groups) {
      const lemma =
        extractLemma(group[0].front || '') || group[0].front || 'Untitled'
      const { word, aspects: asps } = wordFromCards(d.id, lemma, group)
      words.push(word)
      aspects.push(...asps)
    }
  }

  return { decks, words, aspects }
}

export function hasMigrated(): boolean {
  try {
    return localStorage.getItem(STORAGE_MIGRATED) === '1'
  } catch {
    return false
  }
}

export function markMigrated(): void {
  localStorage.setItem(STORAGE_MIGRATED, '1')
}

/** True if stored decks still embed cards[] (pre-v2). */
export function looksLikeLegacyDecks(raw: unknown): boolean {
  if (!Array.isArray(raw) || raw.length === 0) return false
  return raw.some(
    (d) =>
      d &&
      typeof d === 'object' &&
      Array.isArray((d as LegacyDeck).cards) &&
      ((d as LegacyDeck).cards?.length ?? 0) > 0,
  )
}
