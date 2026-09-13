import { useState } from 'react'
import type { View } from './types'
import { useStore } from './hooks/useStore'
import { Home } from './components/Home'
import { DeckEditor } from './components/DeckEditor'
import { StudyMode } from './components/StudyMode'
import { ScheduleDashboard } from './components/ScheduleDashboard'
import { WordPage } from './components/WordPage'
import { loadZeppintopiaSample } from './lib/loadZeppintopia'
import { importSmrtFile } from './lib/importSmrt'

export default function App() {
  const store = useStore()
  const [view, setView] = useState<View>({ type: 'home' })

  function handleLoadZeppintopia() {
    const payload = loadZeppintopiaSample(store.decks)
    console.assert(
      payload.words.length === 10,
      `[zeppintopia] expected 10 words, got ${payload.words.length}`,
    )
    const id = store.applyImportedDeck(payload)
    setView({ type: 'editor', deckId: id })
  }

  async function handleImportSmrt(file: File) {
    const base = file.name.replace(/\.smrt$/i, '').trim()
    const payload = await importSmrtFile(file, {
      deckName: base || undefined,
    })
    const id = store.applyImportedDeck(payload)
    setView({ type: 'editor', deckId: id })
  }

  if (view.type === 'editor') {
    const deck = store.getDeck(view.deckId)
    if (!deck) {
      return (
        <div className="app-shell">
          <div className="mx-auto max-w-lg px-4 py-16 text-center">
            <p className="text-slate-600 dark:text-slate-300">Deck not found.</p>
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={() => setView({ type: 'home' })}
            >
              Back home
            </button>
          </div>
        </div>
      )
    }
    const words = store.wordsForDeck(deck.id)
    return (
      <div className="app-shell">
        <DeckEditor
          deck={deck}
          words={words}
          onBack={() => setView({ type: 'home' })}
          onCreateWord={(lemma, opts) => store.createWord(deck.id, lemma, opts)}
          onDeleteWord={store.deleteWord}
          onOpenWord={(wordId) =>
            setView({ type: 'word', wordId, deckId: deck.id })
          }
          onStudy={() => setView({ type: 'study', deckId: deck.id })}
          onRename={(name) => store.renameDeck(deck.id, name)}
        />
      </div>
    )
  }

  if (view.type === 'word') {
    const word = store.getWord(view.wordId)
    if (!word) {
      return (
        <div className="app-shell">
          <div className="mx-auto max-w-lg px-4 py-16 text-center">
            <p className="text-slate-600 dark:text-slate-300">Word not found.</p>
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={() => setView({ type: 'home' })}
            >
              Back home
            </button>
          </div>
        </div>
      )
    }
    const deck = store.getDeck(word.deckId)
    const aspects = store.aspectsForWord(word.id)
    return (
      <div className="app-shell">
        <WordPage
          word={word}
          aspects={aspects}
          deckName={deck?.name}
          onBack={() =>
            setView(
              view.deckId || word.deckId
                ? { type: 'editor', deckId: view.deckId ?? word.deckId }
                : { type: 'home' },
            )
          }
          onUpdateMeta={(patch) => store.updateWordMeta(word.id, patch)}
          onUpdateAspect={store.updateAspect}
          onDelete={() => {
            store.deleteWord(word.id)
            setView({ type: 'editor', deckId: word.deckId })
          }}
        />
      </div>
    )
  }

  if (view.type === 'study') {
    const deck = store.getDeck(view.deckId)
    if (!deck) {
      return (
        <div className="app-shell">
          <div className="mx-auto max-w-lg px-4 py-16 text-center">
            <p className="text-slate-600 dark:text-slate-300">Deck not found.</p>
            <button
              type="button"
              className="btn-primary mt-4"
              onClick={() => setView({ type: 'home' })}
            >
              Back home
            </button>
          </div>
        </div>
      )
    }
    const words = store.wordsForDeck(deck.id)
    return (
      <div className="app-shell">
        <StudyMode
          deck={deck}
          words={words}
          aspects={store.aspects}
          allDecks={store.decks}
          allWords={store.words}
          onBack={() => setView({ type: 'home' })}
          onComplete={() => store.markStudied(deck.id)}
          onFinishWord={(wordId, sampledIds, answers) =>
            store.completeWordReview(wordId, sampledIds, answers)
          }
        />
      </div>
    )
  }

  if (view.type === 'dashboard') {
    return (
      <div className="app-shell">
        <ScheduleDashboard
          decks={store.decks}
          words={store.words}
          aspects={store.aspects}
          onBack={() => setView({ type: 'home' })}
          onOpenWord={(wordId) => setView({ type: 'word', wordId })}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Home
        decks={store.decks}
        words={store.words}
        onCreate={store.createDeck}
        onRename={store.renameDeck}
        onDelete={store.deleteDeck}
        onOpenEditor={(id) => setView({ type: 'editor', deckId: id })}
        onStudy={(id) => setView({ type: 'study', deckId: id })}
        onOpenDashboard={() => setView({ type: 'dashboard' })}
        onLoadZeppintopia={handleLoadZeppintopia}
        onImportSmrt={handleImportSmrt}
      />
    </div>
  )
}
