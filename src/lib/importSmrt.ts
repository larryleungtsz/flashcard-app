import JSZip from 'jszip'
import type {
  Aspect,
  AspectStatus,
  AspectType,
  Deck,
  ImportedDeckPayload,
  Word,
} from '../types'
import { defaultWordSchedule } from './wordSchedule'

function newId(): string {
  return crypto.randomUUID()
}

/** Ordered most-specific-first so "0.5 word shadowing" wins over plain shadow. */
const SUFFIX_RULES: { re: RegExp; code: string }[] = [
  { re: /\s*(?:0\.5|0\.50)\s+(?:word\s+)?shadow(?:ing|inf)?\s*$/i, code: 'shadow_05' },
  { re: /\s*shadow(?:ing|inf)?\s*(?:0\.5|0\.50)\s*$/i, code: 'shadow_05' },
  { re: /\s*(?:0\.25)\s+(?:word\s+)?shadow(?:ing|inf)?\s*$/i, code: 'shadow_025' },
  { re: /\s*shadow(?:ing|inf)?\s*0\.25\s*$/i, code: 'shadow_025' },
  { re: /\s*(?:word\s+)?shadow(?:ing|inf)?\s*$/i, code: 'shadow_025' },
  { re: /\s*worf\s*$/i, code: 'shadow_025' },
  { re: /\s*tone\s*(?:0\.5|0\.50)\s*$/i, code: 'tone_05' },
  { re: /\s*tone\s*(?:1\.0|1)\s*$/i, code: 'tone_10' },
  { re: /\s*tone\s*$/i, code: 'tone_05' },
  { re: /\s*youglish(?:\s*0\.5)?\s*$/i, code: 'youglish' },
  { re: /\s*example\s+sentences?\s*$/i, code: 'ai_sents' },
  { re: /\s*ai\s*sents?\s*$/i, code: 'ai_sents' },
  { re: /\s*palace(?:\s*image|_img)?\s*$/i, code: 'palace_img' },
  { re: /\s*loci(?:\s+de(?:s|a)cription|\s+description|_text)?\s*$/i, code: 'loci_text' },
  { re: /\s*(?:men?monic|mnemonic)\s*(?:inage|image)?\s*$/i, code: 'mnem_img' },
  { re: /\s*mnem_img\s*$/i, code: 'mnem_img' },
  { re: /\s*mnem[_\s]?story\s*$/i, code: 'mnem_story' },
  { re: /\s*story\s*$/i, code: 'mnem_story' },
  { re: /\s*(?:meaning\s+)?object\s*rel(?:ation)?\s*$/i, code: 'object_rel' },
  { re: /\s*object_rel\s*$/i, code: 'object_rel' },
  { re: /\s*meaning2mnemonic\??\s*$/i, code: 'core_l1_image' },
  { re: /\s*(?:\(?\s*)?(?:core|l1)(?:\s*image)?\)?\s*$/i, code: 'core_l1_image' },
  { re: /\s*seq_mnem\s*$/i, code: 'seq_mnem' },
  { re: /\s*seq_practice\s*$/i, code: 'seq_practice' },
]

export function parseLemmaAndAspectCode(c1t: string): { lemma: string; code: string } {
  const raw = (c1t ?? '').trim()
  if (!raw) return { lemma: '', code: 'unknown' }

  for (const { re, code } of SUFFIX_RULES) {
    if (re.test(raw)) {
      const lemma = raw.replace(re, '').trim()
      return { lemma: lemma || raw, code }
    }
  }
  return { lemma: raw, code: 'unknown' }
}

export function inferAspectType(code: string): AspectType {
  if (code === 'core_l1_image' || code.startsWith('core')) return 'core'
  if (
    code.startsWith('shadow_') ||
    code.startsWith('tone') ||
    code === 'youglish' ||
    code === 'ai_sents' ||
    code.startsWith('motor_')
  ) {
    return 'motor'
  }
  if (
    code === 'palace_img' ||
    code === 'mnem_img' ||
    code === 'mnem_story' ||
    code === 'loci_text' ||
    code === 'object_rel' ||
    code === 'palace_recall' ||
    code === 'mnemonic_image' ||
    code === 'seq_mnem' ||
    code === 'seq_practice'
  ) {
    return 'scaffold'
  }
  return 'scaffold'
}

interface SmrtCard {
  c1t?: string
  c2t?: string
  ccm?: string
  [k: string]: unknown
}

interface SmrtDeck {
  n?: string
  name?: string
  dc?: SmrtCard[]
  [k: string]: unknown
}

function collectCards(root: unknown): { cards: SmrtCard[]; deckName: string } {
  let deckName = 'Imported .smrt'
  const cards: SmrtCard[] = []

  const visit = (node: unknown, depth: number) => {
    if (node == null || depth > 8) return
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1)
      return
    }
    if (typeof node !== 'object') return
    const obj = node as Record<string, unknown>

    // SmartCards+ top: { d: [ { n, dc: [...] } ] }
    if (Array.isArray(obj.d)) {
      for (const deck of obj.d as SmrtDeck[]) {
        if (typeof deck?.n === 'string' && deck.n.trim()) deckName = deck.n.trim()
        else if (typeof deck?.name === 'string' && deck.name.trim()) deckName = deck.name.trim()
        if (Array.isArray(deck?.dc)) {
          for (const c of deck.dc) cards.push(c)
        } else {
          visit(deck, depth + 1)
        }
      }
      return
    }

    if (Array.isArray(obj.dc)) {
      if (typeof obj.n === 'string' && obj.n.trim()) deckName = obj.n.trim()
      for (const c of obj.dc as SmrtCard[]) cards.push(c)
      return
    }

    // Card-like leaf
    if (typeof obj.c1t === 'string') {
      cards.push(obj as SmrtCard)
      return
    }

    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') visit(v, depth + 1)
    }
  }

  visit(root, 0)
  return { cards, deckName }
}

/**
 * Parse a .smrt file (zip containing Export/decks.json) into Word+Aspect payload.
 * Cards sharing the same lemma group into one Word; each card → one Aspect.
 */
export async function importSmrtFile(
  file: File | ArrayBuffer | Uint8Array,
  opts?: { deckName?: string },
): Promise<ImportedDeckPayload> {
  const zip = await JSZip.loadAsync(file)

  let jsonText: string | null = null
  const preferred = zip.file('Export/decks.json') ?? zip.file('export/decks.json')
  if (preferred) {
    jsonText = await preferred.async('string')
  } else {
    const names = Object.keys(zip.files).filter(
      (n) => !zip.files[n].dir && /decks\.json$/i.test(n),
    )
    if (names[0]) jsonText = await zip.file(names[0])!.async('string')
  }

  if (!jsonText) {
    throw new Error('No Export/decks.json found inside .smrt zip')
  }

  const root = JSON.parse(jsonText) as unknown
  const { cards, deckName: parsedName } = collectCards(root)
  const deckName = opts?.deckName?.trim() || parsedName || 'Imported .smrt'

  const now = new Date().toISOString()
  const deck: Deck = {
    id: newId(),
    name: deckName,
    lastStudied: null,
    createdAt: now,
  }

  // Group by lemma
  const groups = new Map<string, { lemma: string; cards: SmrtCard[] }>()
  for (const card of cards) {
    const c1t = String(card.c1t ?? '')
    const { lemma } = parseLemmaAndAspectCode(c1t)
    const key = lemma.toLowerCase() || c1t.toLowerCase() || newId()
    const g = groups.get(key)
    if (g) g.cards.push(card)
    else groups.set(key, { lemma: lemma || c1t || '?', cards: [card] })
  }

  const words: Word[] = []
  const aspects: Aspect[] = []

  for (const { lemma, cards: groupCards } of groups.values()) {
    const wordId = newId()
    const word: Word = {
      id: wordId,
      lemma,
      language: 'ja',
      deckId: deck.id,
      createdAt: now,
      ...defaultWordSchedule(),
      dueAt: null,
    }
    words.push(word)

    for (const card of groupCards) {
      const c1t = String(card.c1t ?? '')
      const { code } = parseLemmaAndAspectCode(c1t)
      const media = typeof card.ccm === 'string' ? card.ccm.trim() : ''
      const answer = typeof card.c2t === 'string' ? card.c2t : ''
      const type = inferAspectType(code)
      const status: AspectStatus = 'live'
      aspects.push({
        id: newId(),
        wordId,
        code,
        type,
        status,
        front: c1t,
        back: answer,
        mediaUrl: media || undefined,
        easyStreak: 0,
        lastReviewedAt: null,
      })
    }
  }

  return { deck, words, aspects }
}
