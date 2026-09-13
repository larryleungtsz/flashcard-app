import type {
  Aspect,
  AspectStatus,
  AspectType,
  Deck,
  ImportedDeckPayload,
  Word,
  WordStage,
} from '../types'
import { defaultWordSchedule } from './wordSchedule'
import raw from '../data/zeppintopia.json'

interface ZeppAspectJson {
  code: string
  type: string
  status: string
  prompt: string
  answer: string
  media_url?: string
  review_count?: number
}

interface ZeppWordJson {
  lemma: string
  meaning?: string
  language?: string
  stage?: number
  needs_script?: boolean
  aspects: ZeppAspectJson[]
}

interface ZeppJson {
  deck: { name: string; language?: string } | string
  words: ZeppWordJson[]
}

/** Phrases that belong on Aspect.front (prompt), never on Word.lemma. */
const CORRUPT_SUBSTRINGS = [
  'from general image',
  'general image',
  'shadowing',
  'shadowinf',
  'mnemonic image',
  'example sentences',
  'youglish',
  'loci description',
  'loci decription',
  'object relation',
  'meaning2mnemonic',
  '0.25',
  '0.5 word',
  '0.50 word',
  'meaning object',
]

/** Trailing aspect-label patterns (prompt suffixes glued onto a lemma). */
const CORRUPT_TRAILING: RegExp[] = [
  /\bstory\s*$/i,
  /\btone(?:\s*[\d.]+)?\s*$/i,
  /\bshadow(?:ing|inf)?(?:\s*[\d.]+)?\s*$/i,
  /\bworf\s*$/i,
  /\bpalace(?:\s*image|_img)?\s*$/i,
  /\bloci(?:\s+de(?:s|a)cription|\s+description|_text)?\s*$/i,
  /\bobject\s*rel(?:ation)?\s*$/i,
  /\bseq_mnem\s*$/i,
  /\bseq_practice\s*$/i,
  /\bmnem_img\s*$/i,
  /\bmnem[_\s]?story\s*$/i,
  /\b(?:men?monic|mnemonic)\s*(?:inage|image)?\s*$/i,
  /\byouglish(?:\s*[\d.]+)?\s*$/i,
  /\bexample\s+sentences?\s*$/i,
  /\bai\s*sents?\s*$/i,
  /\bmeaning2mnemonic\??\s*$/i,
  /\b(?:0\.5|0\.50|0\.25)\s+(?:word\s+)?shadow(?:ing|inf)?\s*$/i,
]

/**
 * True when `lemma` looks like a SmartCards prompt (aspect suffix glued on)
 * rather than a clean headword.
 */
export function isCorruptLemma(lemma: string): boolean {
  const s = (lemma ?? '').trim()
  if (!s) return false
  const lower = s.toLowerCase()
  if (CORRUPT_SUBSTRINGS.some((p) => lower.includes(p))) return true
  if (CORRUPT_TRAILING.some((re) => re.test(s))) return true
  // Prompt-like: long string with Latin aspect text + whitespace
  if (s.length > 40 && /[a-z]{4,}/i.test(s) && /\s/.test(s)) return true
  return false
}

function newId(): string {
  return crypto.randomUUID()
}

function asStage(n: number | undefined): WordStage {
  if (n === 1 || n === 2 || n === 3) return n
  return 0
}

function asType(t: string, code: string): AspectType {
  if (t === 'core' || code === 'core_l1_image' || code === 'core_l1_speak' || code.startsWith('core')) {
    return 'core'
  }
  if (t === 'motor') return 'motor'
  if (t === 'scaffold') return 'scaffold'
  if (
    code.startsWith('shadow_') ||
    code.startsWith('tone') ||
    code === 'youglish' ||
    code === 'ai_sents' ||
    code.startsWith('motor_')
  ) {
    return 'motor'
  }
  if (code.startsWith('core')) return 'core'
  return 'scaffold'
}

function asStatus(s: string): AspectStatus {
  if (s === 'audit_only' || s === 'graduated') return s
  return 'live'
}

function resolveDeckMeta(deck: ZeppJson['deck']): { name: string; language?: string } {
  if (typeof deck === 'string') {
    return { name: deck.trim() || 'zeppintopia ordering' }
  }
  return {
    name: deck?.name?.trim() || 'zeppintopia ordering',
    language: deck?.language?.trim() || undefined,
  }
}

/**
 * Build one Deck + Words + Aspects from the bundled Zeppintopia JSON.
 * Each words[] object = one Word (lemma only); each words[].aspects[] = one Aspect.
 * prompt → Aspect.front; answer → Aspect.back; media_url → Aspect.mediaUrl.
 * One due date per Word (dueAt=null → due now). Aspects have no due dates.
 */
export function loadZeppintopiaSample(existingDecks: Deck[] = []): ImportedDeckPayload {
  const data = raw as ZeppJson
  const { name: deckName, language: deckLanguage } = resolveDeckMeta(data.deck)
  const existing = existingDecks.find(
    (d) => d.name.toLowerCase() === deckName.toLowerCase(),
  )
  const deckId = existing?.id ?? newId()
  const now = new Date().toISOString()

  const deck: Deck = {
    id: deckId,
    name: deckName,
    lastStudied: existing?.lastStudied ?? null,
    createdAt: existing?.createdAt ?? now,
  }

  const words: Word[] = []
  const aspects: Aspect[] = []

  for (const w of data.words ?? []) {
    const lemma = (w.lemma ?? '').trim()
    if (!lemma || isCorruptLemma(lemma)) {
      console.warn('[zeppintopia] skipping corrupt/empty lemma:', w.lemma)
      continue
    }

    const wordId = newId()
    const stage = asStage(w.stage)
    const word: Word = {
      id: wordId,
      lemma,
      language: w.language?.trim() || deckLanguage || 'ja',
      needsScript: Boolean(w.needs_script),
      deckId,
      createdAt: now,
      ...defaultWordSchedule(),
      stage,
      dueAt: null,
    }
    words.push(word)

    for (const a of w.aspects ?? []) {
      const code = a.code
      aspects.push({
        id: newId(),
        wordId,
        code,
        type: asType(a.type, code),
        status: asStatus(a.status),
        // prompt stays on Aspect only — never copied to Word.lemma
        front: a.prompt ?? '',
        back: a.answer ?? '',
        mediaUrl: a.media_url?.trim() ? a.media_url.trim() : undefined,
        easyStreak: 0,
        lastReviewedAt: null,
      })
    }
  }

  console.info(
    `[zeppintopia] sample → ${words.length} words, ${aspects.length} aspects (deck “${deckName}”)`,
  )
  if (words.length !== 10) {
    console.warn(`[zeppintopia] expected exactly 10 words, got ${words.length}`)
  }

  return { deck, words, aspects }
}

/** Dry-run stats for the bundled sample (no IDs / store writes). */
export function zeppintopiaStats(): {
  deckName: string
  wordCount: number
  aspectCount: number
  lemmas: string[]
} {
  const data = raw as ZeppJson
  const { name } = resolveDeckMeta(data.deck)
  const lemmas = (data.words ?? [])
    .map((w) => (w.lemma ?? '').trim())
    .filter((l) => l && !isCorruptLemma(l))
  return {
    deckName: name,
    wordCount: lemmas.length,
    aspectCount: (data.words ?? []).reduce((n, w) => n + (w.aspects?.length ?? 0), 0),
    lemmas,
  }
}
