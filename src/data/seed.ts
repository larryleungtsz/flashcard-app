import type { Aspect, Deck, Word } from '../types'
import { createWordFromLegacyPair } from '../lib/wordTemplate'

function id(): string {
  return crypto.randomUUID()
}

const capitalsId = id()
const spanishId = id()

const capitalPairs: [string, string][] = [
  ['France', 'Paris'],
  ['Japan', 'Tokyo'],
  ['Brazil', 'Brasília'],
  ['Australia', 'Canberra'],
  ['Egypt', 'Cairo'],
  ['Canada', 'Ottawa'],
  ['India', 'New Delhi'],
  ['Kenya', 'Nairobi'],
  ['South Korea', 'Seoul'],
  ['Argentina', 'Buenos Aires'],
]

const spanishPairs: [string, string][] = [
  ['Hola', 'Hello'],
  ['Adiós', 'Goodbye'],
  ['Por favor', 'Please'],
  ['Gracias', 'Thank you'],
  ['Sí', 'Yes'],
  ['No', 'No'],
  ['Agua', 'Water'],
  ['Amigo / Amiga', 'Friend'],
  ['¿Cómo estás?', 'How are you?'],
  ['Buenos días', 'Good morning'],
]

function buildSeed(): { decks: Deck[]; words: Word[]; aspects: Aspect[] } {
  const decks: Deck[] = [
    {
      id: capitalsId,
      name: 'World Capitals',
      createdAt: new Date().toISOString(),
      lastStudied: null,
    },
    {
      id: spanishId,
      name: 'Spanish Basics',
      createdAt: new Date().toISOString(),
      lastStudied: null,
    },
  ]

  const words: Word[] = []
  const aspects: Aspect[] = []

  for (const [country, capital] of capitalPairs) {
    // lemma = country (target to recall capital as meaning on core)
    const { word, aspects: asps } = createWordFromLegacyPair(
      capitalsId,
      country,
      capital,
    )
    words.push(word)
    aspects.push(...asps)
  }

  for (const [lemma, meaning] of spanishPairs) {
    const { word, aspects: asps } = createWordFromLegacyPair(
      spanishId,
      lemma,
      meaning,
      { language: 'es' },
    )
    words.push(word)
    aspects.push(...asps)
  }

  return { decks, words, aspects }
}

export const SEED = buildSeed()
