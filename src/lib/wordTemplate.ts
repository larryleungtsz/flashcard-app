import type { Aspect, AspectCode, AspectStatus, AspectType, Word } from '../types'
import { defaultWordSchedule } from './wordSchedule'

export interface CreateWordInput {
  lemma: string
  deckId: string
  language?: string
  partOfSpeech?: string
  needsScript?: boolean
}

interface AspectSpec {
  code: AspectCode
  type: AspectType
  status: AspectStatus
  front: (lemma: string) => string
  back: (lemma: string) => string
}

/** Base 12 aspects (handwriting added only when needsScript). */
const BASE_SPECS: AspectSpec[] = [
  {
    code: 'core',
    type: 'core',
    status: 'live',
    front: (l) => `What is the word for: meaning of “${l}”? (L1 cue)`,
    back: (l) => `${l} (speak it)`,
  },
  {
    code: 'motor_produce',
    type: 'motor',
    status: 'live',
    front: (l) => `Produce / speak: cue for “${l}”`,
    back: (l) => l,
  },
  {
    code: 'motor_recognize',
    type: 'motor',
    status: 'live',
    front: (l) => `Hear/see “${l}” → meaning?`,
    back: (l) => `Meaning of ${l}`,
  },
  {
    code: 'loci_text',
    type: 'scaffold',
    status: 'live',
    front: (l) => `Loci text for “${l}”`,
    back: (l) => `Palace / loci note for ${l}`,
  },
  {
    code: 'mnem_story',
    type: 'scaffold',
    status: 'live',
    front: (l) => `Mnemonic story for “${l}”`,
    back: (l) => `Story linking to ${l}`,
  },
  {
    code: 'object_rel',
    type: 'scaffold',
    status: 'live',
    front: (l) => `Object relation for “${l}”`,
    back: (l) => `Object / relation cue for ${l}`,
  },
  {
    code: 'shadow_025',
    type: 'scaffold',
    status: 'live',
    front: (l) => `Shadow / 0.25s for “${l}”`,
    back: (l) => l,
  },
  {
    code: 'tone',
    type: 'motor',
    status: 'audit_only',
    front: (l) => `Tone practice: “${l}”`,
    back: (l) => `Tone for ${l}`,
  },
  {
    code: 'youglish',
    type: 'scaffold',
    status: 'audit_only',
    front: (l) => `YouGlish / natural examples: “${l}”`,
    back: (l) => `Natural usage of ${l}`,
  },
  {
    code: 'ai_sentences',
    type: 'scaffold',
    status: 'audit_only',
    front: (l) => `AI sentences with “${l}”`,
    back: (l) => `Example sentences for ${l}`,
  },
  {
    code: 'palace_recall',
    type: 'scaffold',
    status: 'audit_only',
    front: (l) => `Palace recall: “${l}”`,
    back: (l) => `Recall locus for ${l}`,
  },
  {
    code: 'mnemonic_image',
    type: 'scaffold',
    status: 'audit_only',
    front: (l) => `Mnemonic image: “${l}”`,
    back: (l) => `Image for ${l}`,
  },
]

const HANDWRITING_SPEC: AspectSpec = {
  code: 'handwriting',
  type: 'scaffold',
  status: 'live',
  front: (l) => `Write “${l}” by hand`,
  back: (l) => l,
}

function newId(): string {
  return crypto.randomUUID()
}

function makeAspect(wordId: string, lemma: string, spec: AspectSpec): Aspect {
  return {
    id: newId(),
    wordId,
    type: spec.type,
    code: spec.code,
    status: spec.status,
    front: spec.front(lemma),
    back: spec.back(lemma),
    easyStreak: 0,
    lastReviewedAt: null,
  }
}

/**
 * Create one Word + base 12 Aspects ( + handwriting if needsScript ).
 * Front/back are editable placeholders that include the lemma.
 */
export function createWordWithAspects(input: CreateWordInput): {
  word: Word
  aspects: Aspect[]
} {
  const lemma = input.lemma.trim()
  const wordId = newId()
  const now = new Date().toISOString()

  const word: Word = {
    id: wordId,
    lemma,
    language: input.language?.trim() || undefined,
    partOfSpeech: input.partOfSpeech?.trim() || undefined,
    needsScript: Boolean(input.needsScript),
    deckId: input.deckId,
    createdAt: now,
    ...defaultWordSchedule(),
  }

  const specs = [...BASE_SPECS]
  if (input.needsScript) {
    specs.splice(7, 0, HANDWRITING_SPEC) // after shadow_025
  }

  const aspects = specs.map((s) => makeAspect(wordId, lemma, s))
  return { word, aspects }
}

/** Seed helper: lemma from old front, meaning on core back from old back. */
export function createWordFromLegacyPair(
  deckId: string,
  lemma: string,
  meaning: string,
  opts?: { language?: string; needsScript?: boolean },
): { word: Word; aspects: Aspect[] } {
  const { word, aspects } = createWordWithAspects({
    lemma,
    deckId,
    language: opts?.language,
    needsScript: opts?.needsScript,
  })
  const core = aspects.find((a) => a.code === 'core')
  if (core) {
    core.front = meaning || core.front
    core.back = lemma
  }
  const recognize = aspects.find((a) => a.code === 'motor_recognize')
  if (recognize) {
    recognize.front = lemma
    recognize.back = meaning || recognize.back
  }
  const produce = aspects.find((a) => a.code === 'motor_produce')
  if (produce) {
    produce.front = meaning || produce.front
    produce.back = lemma
  }
  return { word, aspects }
}
