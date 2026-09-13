import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Aspect, Deck, ImportedDeckPayload, Word } from '../types'
import { SEED } from '../data/seed'
import {
  STORAGE_ASPECTS,
  STORAGE_DECKS,
  STORAGE_SEEDED,
  STORAGE_WORDS,
  hasMigrated,
  looksLikeLegacyDecks,
  markMigrated,
  migrateLegacyDecks,
} from '../lib/migrate'
import { createWordWithAspects } from '../lib/wordTemplate'
import { gradeWordReview, uiToGrade, type AspectAnswer } from '../lib/wordGrading'
import { countDueWords, isWordDue } from '../lib/wordSchedule'
import { sampleAspects } from '../lib/sampler'
import { isCorruptLemma } from '../lib/loadZeppintopia'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

function loadInitial(): { decks: Deck[]; words: Word[]; aspects: Aspect[] } {
  // Already on v2
  if (hasMigrated()) {
    const decks = readJson<Deck[]>(STORAGE_DECKS) ?? []
    const words = readJson<Word[]>(STORAGE_WORDS) ?? []
    const aspects = readJson<Aspect[]>(STORAGE_ASPECTS) ?? []
    return { decks, words, aspects }
  }

  // Migrate legacy decks-with-cards once
  const rawDecks = readJson<unknown[]>(STORAGE_DECKS)
  if (rawDecks && looksLikeLegacyDecks(rawDecks)) {
    const migrated = migrateLegacyDecks(rawDecks as Parameters<typeof migrateLegacyDecks>[0])
    writeJson(STORAGE_DECKS, migrated.decks)
    writeJson(STORAGE_WORDS, migrated.words)
    writeJson(STORAGE_ASPECTS, migrated.aspects)
    markMigrated()
    return migrated
  }

  // Fresh install / empty: seed Words+Aspects
  if (!localStorage.getItem(STORAGE_SEEDED)) {
    localStorage.setItem(STORAGE_SEEDED, '1')
    writeJson(STORAGE_DECKS, SEED.decks)
    writeJson(STORAGE_WORDS, SEED.words)
    writeJson(STORAGE_ASPECTS, SEED.aspects)
    markMigrated()
    return { decks: SEED.decks, words: SEED.words, aspects: SEED.aspects }
  }

  // Seeded flag but no migration (empty decks metadata): treat as empty v2
  const decks = (rawDecks as Deck[] | null) ?? []
  // Strip any leftover cards field
  const cleanDecks: Deck[] = decks.map((d) => ({
    id: d.id,
    name: d.name,
    createdAt: d.createdAt,
    lastStudied: d.lastStudied ?? null,
  }))
  writeJson(STORAGE_DECKS, cleanDecks)
  writeJson(STORAGE_WORDS, [])
  writeJson(STORAGE_ASPECTS, [])
  markMigrated()
  return { decks: cleanDecks, words: [], aspects: [] }
}

export function useStore() {
  const initial = useMemo(() => loadInitial(), [])
  const [decks, setDecks] = useState<Deck[]>(initial.decks)
  const [words, setWords] = useState<Word[]>(initial.words)
  const [aspects, setAspects] = useState<Aspect[]>(initial.aspects)
  const wordsRef = useRef(words)
  const aspectsRef = useRef(aspects)
  wordsRef.current = words
  aspectsRef.current = aspects

  useEffect(() => {
    writeJson(STORAGE_DECKS, decks)
  }, [decks])

  useEffect(() => {
    writeJson(STORAGE_WORDS, words)
  }, [words])

  useEffect(() => {
    writeJson(STORAGE_ASPECTS, aspects)
  }, [aspects])

  const createDeck = useCallback((name: string) => {
    const deck: Deck = {
      id: crypto.randomUUID(),
      name: name.trim() || 'Untitled Deck',
      lastStudied: null,
      createdAt: new Date().toISOString(),
    }
    setDecks((prev) => [deck, ...prev])
    return deck.id
  }, [])

  const renameDeck = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setDecks((prev) =>
      prev.map((d) => (d.id === id ? { ...d, name: trimmed } : d)),
    )
  }, [])

  const deleteDeck = useCallback((id: string) => {
    setDecks((prev) => prev.filter((d) => d.id !== id))
    setWords((prev) => {
      const removed = new Set(prev.filter((w) => w.deckId === id).map((w) => w.id))
      setAspects((as) => as.filter((a) => !removed.has(a.wordId)))
      return prev.filter((w) => w.deckId !== id)
    })
  }, [])

  const createWord = useCallback(
    (
      deckId: string,
      lemma: string,
      opts?: { language?: string; partOfSpeech?: string; needsScript?: boolean },
    ) => {
      const { word, aspects: asps } = createWordWithAspects({
        lemma,
        deckId,
        language: opts?.language,
        partOfSpeech: opts?.partOfSpeech,
        needsScript: opts?.needsScript,
      })
      setWords((prev) => [...prev, word])
      setAspects((prev) => [...prev, ...asps])
      return word.id
    },
    [],
  )

  const updateWordMeta = useCallback(
    (
      wordId: string,
      patch: Partial<
        Pick<Word, 'lemma' | 'language' | 'partOfSpeech' | 'needsScript'>
      >,
    ) => {
      setWords((prev) =>
        prev.map((w) => (w.id === wordId ? { ...w, ...patch } : w)),
      )
    },
    [],
  )

  const deleteWord = useCallback((wordId: string) => {
    setWords((prev) => prev.filter((w) => w.id !== wordId))
    setAspects((prev) => prev.filter((a) => a.wordId !== wordId))
  }, [])

  const updateAspect = useCallback(
    (aspectId: string, front: string, back: string) => {
      setAspects((prev) =>
        prev.map((a) =>
          a.id === aspectId
            ? { ...a, front: front.trim(), back: back.trim() }
            : a,
        ),
      )
    },
    [],
  )

  const markStudied = useCallback((deckId: string) => {
    setDecks((prev) =>
      prev.map((d) =>
        d.id === deckId ? { ...d, lastStudied: new Date().toISOString() } : d,
      ),
    )
  }, [])

  /**
   * After all sampled aspects for a Word are answered, grade the Word once.
   * UI Again→Fail, Good→Easy.
   */
  const completeWordReview = useCallback(
    (
      wordId: string,
      sampledAspectIds: string[],
      uiAnswers: { aspectId: string; result: 'again' | 'good' }[],
    ) => {
      const word = wordsRef.current.find((w) => w.id === wordId)
      if (!word) return

      const prevAspects = aspectsRef.current
      const sampled = prevAspects.filter((a) => sampledAspectIds.includes(a.id))
      const answers: AspectAnswer[] = uiAnswers.map((a) => ({
        aspectId: a.aspectId,
        grade: uiToGrade(a.result),
      }))

      const result = gradeWordReview(word, prevAspects, sampled, answers)
      wordsRef.current = wordsRef.current.map((w) =>
        w.id === wordId ? result.word : w,
      )
      aspectsRef.current = result.aspects
      setWords(wordsRef.current)
      setAspects(result.aspects)
      return result
    },
    [],
  )


  /**
   * Insert an imported deck. If a deck with the same id or name exists,
   * replace that deck's words/aspects (keep deck id / createdAt / lastStudied).
   */
  const applyImportedDeck = useCallback((payload: ImportedDeckPayload) => {
    const nameKey = payload.deck.name.trim().toLowerCase()
    const decksSnap = decks
    const existing =
      decksSnap.find((d) => d.id === payload.deck.id) ??
      decksSnap.find((d) => d.name.trim().toLowerCase() === nameKey)
    const finalDeckId = existing?.id ?? payload.deck.id

    const nextDeck: Deck = existing
      ? {
          id: existing.id,
          name: payload.deck.name,
          createdAt: existing.createdAt,
          lastStudied: existing.lastStudied,
        }
      : { ...payload.deck, id: finalDeckId }

    // Drop any prompt-as-lemma leftovers (this deck or orphaned elsewhere)
    const corruptIds = new Set(
      wordsRef.current.filter((w) => isCorruptLemma(w.lemma)).map((w) => w.id),
    )
    const oldWordIds = new Set(
      wordsRef.current.filter((w) => w.deckId === finalDeckId).map((w) => w.id),
    )
    const removedIds = new Set<string>([...oldWordIds, ...corruptIds])

    const finalWords = payload.words
      .filter((w) => !isCorruptLemma(w.lemma))
      .map((w) => ({ ...w, deckId: finalDeckId }))
    const finalWordIds = new Set(finalWords.map((w) => w.id))
    const finalAspects = payload.aspects.filter((a) => finalWordIds.has(a.wordId))

    setDecks((prev) => {
      if (existing) {
        return prev.map((d) => (d.id === existing.id ? nextDeck : d))
      }
      return [nextDeck, ...prev]
    })

    const nextWords = [
      ...wordsRef.current.filter(
        (w) => w.deckId !== finalDeckId && !corruptIds.has(w.id),
      ),
      ...finalWords,
    ]
    const nextAspects = [
      ...aspectsRef.current.filter((a) => !removedIds.has(a.wordId)),
      ...finalAspects,
    ]
    wordsRef.current = nextWords
    aspectsRef.current = nextAspects
    setWords(nextWords)
    setAspects(nextAspects)

    const deckWordCount = finalWords.length
    if (nameKey === 'zeppintopia ordering' && deckWordCount !== 10) {
      console.warn(
        `[zeppintopia] after apply: expected 10 words, got ${deckWordCount}`,
      )
    } else {
      console.info(
        `[import] deck “${payload.deck.name}” → ${deckWordCount} words, ${finalAspects.length} aspects` +
          (corruptIds.size ? ` (purged ${corruptIds.size} corrupt lemmas)` : ''),
      )
    }

    return finalDeckId
  }, [decks])

  const getDeck = useCallback(
    (id: string) => decks.find((d) => d.id === id),
    [decks],
  )

  const getWord = useCallback(
    (id: string) => words.find((w) => w.id === id),
    [words],
  )

  const wordsForDeck = useCallback(
    (deckId: string) => words.filter((w) => w.deckId === deckId),
    [words],
  )

  const aspectsForWord = useCallback(
    (wordId: string) => aspects.filter((a) => a.wordId === wordId),
    [aspects],
  )

  const dueWordsForDeck = useCallback(
    (deckId: string, now: Date = new Date()) =>
      words.filter((w) => w.deckId === deckId && isWordDue(w, now)),
    [words],
  )

  const dueCountForDeck = useCallback(
    (deckId: string, now: Date = new Date()) =>
      countDueWords(
        words.filter((w) => w.deckId === deckId),
        now,
      ),
    [words],
  )

  return {
    decks,
    words,
    aspects,
    createDeck,
    renameDeck,
    deleteDeck,
    createWord,
    updateWordMeta,
    deleteWord,
    updateAspect,
    markStudied,
    completeWordReview,
    getDeck,
    getWord,
    wordsForDeck,
    aspectsForWord,
    dueWordsForDeck,
    dueCountForDeck,
    applyImportedDeck,
    sampleAspectsForWord: (word: Word) =>
      sampleAspects(word, aspects.filter((a) => a.wordId === word.id)),
  }
}

// Keep old hook name as alias for any lingering imports
export { useStore as useDecks }
