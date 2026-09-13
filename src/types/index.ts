export type WordStage = 0 | 1 | 2 | 3

export type AspectType = 'core' | 'motor' | 'scaffold'

export type AspectStatus = 'live' | 'audit_only' | 'graduated'

/** Stable aspect codes from the create-word template. */
export type AspectCode =
  | 'core'
  | 'motor_produce'
  | 'motor_recognize'
  | 'loci_text'
  | 'mnem_story'
  | 'object_rel'
  | 'shadow_025'
  | 'handwriting'
  | 'tone'
  | 'youglish'
  | 'ai_sentences'
  | 'palace_recall'
  | 'mnemonic_image'
  | string

/** Scheduling unit — Cards no longer have independent SRS. */
export interface Word {
  id: string
  lemma: string
  language?: string
  partOfSpeech?: string
  needsScript?: boolean
  stage: WordStage
  dueAt: string | null
  intervalDays: number
  ease: number
  repetition: number
  reviewCount: number
  deckId: string
  createdAt: string
  lastReviewedAt: string | null
}

/** Review surface; keeps Card UI fields. No interval/dueAt/ease. */
export interface Aspect {
  id: string
  wordId: string
  type: AspectType
  code: AspectCode
  status: AspectStatus
  front: string
  back: string
  /** Optional media URL shown on the flipped back (image / YouTube / link). */
  mediaUrl?: string
  easyStreak: number
  lastReviewedAt: string | null
}

/** Deck is a folder/collection only — no embedded cards. */
export interface Deck {
  id: string
  name: string
  lastStudied: string | null
  createdAt: string
}

export type AspectGrade = 'fail' | 'easy'

export type View =
  | { type: 'home' }
  | { type: 'editor'; deckId: string }
  | { type: 'study'; deckId: string }
  | { type: 'dashboard' }
  | { type: 'word'; wordId: string; deckId?: string }

/** Legacy card shape (migration only). */
export interface LegacyCard {
  id: string
  front: string
  back: string
  interval?: number
  repetition?: number
  ease?: number
  dueAt?: string | null
}

export interface LegacyDeck {
  id: string
  name: string
  cards?: LegacyCard[]
  lastStudied: string | null
  createdAt: string
}

/** Payload produced by sample loaders / .smrt import. */
export interface ImportedDeckPayload {
  deck: Deck
  words: Word[]
  aspects: Aspect[]
}
