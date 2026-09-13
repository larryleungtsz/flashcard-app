# Flashcard App (Word + Aspect)

A browser-based flashcard app built with Vite, React, TypeScript, and Tailwind CSS. **Words** are the scheduling unit; **Aspects** are review surfaces (no independent SRS intervals). Decks are folders/collections only. Data lives in `localStorage`.

## Domain model

| Entity | Role |
| ------ | ---- |
| **Word** | Scheduling unit (`dueAt`, `intervalDays`, `ease`, `stage`, `reviewCount`) |
| **Aspect** | Review surface (`front`/`back`, `type`, `code`, `status`) — **no** `dueAt` / interval |
| **Deck** | Folder metadata (`id`, `name`, `createdAt`, `lastStudied`) |

Optional `language` / `partOfSpeech` on Word are **search tags only** — they do not control scheduling or decks.

### Create-word template (12 aspects + optional handwriting)

Creating a word spawns **core** + motors/scaffolds. Statuses:

- **live:** core, motor_produce, motor_recognize, loci_text, mnem_story, object_rel, shadow_025 (+ handwriting if `needsScript`)
- **audit_only:** tone, youglish, ai_sentences, palace_recall, mnemonic_image

### Stage sampling (`src/lib/sampler.ts`)

Study queues **due Words**. For each Word, sample Aspects by stage:

| Stage | Sample |
| ----- | ------ |
| 0 | All live aspects |
| 1 | 5: core + ≥1 motor + palace/mnemonic + fill by least-recent live |
| 2 | 3: core + weakest motor + rotate palace/mnemonic |
| 3 | 2: core + one motor |

Every **6th** word review is an **audit**: core + tone + youglish + ai_sentences + palace_recall + mnemonic_image.

### Grading (`src/lib/wordGrading.ts`)

UI **Again** → Fail, **Good** → Easy. After all sampled aspects:

1. Word grade from **core** first; else worst **motor**
2. Scaffold Easy does **not** advance the Word; scaffold Fail does **not** reset it
3. SM-2-ish schedule on the Word; Fail → stage 1, due in ~10 minutes
4. Graduation: loci/mnem/object/handwriting after 2 Easy in a row; shadow_025 after 3 Easy if core stable

## Migration

On first load after upgrade, old `Deck.cards[]` with per-card SRS migrate once (`flashcard-app:migrated-v2`):

- Group cards with the same normalized lemma within a deck into one Word
- Unclear grouping → one Word per card
- Card SRS fields move onto the Word; Aspects get no intervals

Storage keys: `flashcard-app:decks`, `flashcard-app:words`, `flashcard-app:aspects`.

## Quick start

```bash
cd flashcard-app
npm install
npm run dev
```

Open **http://localhost:5173**. Optional notify server:

```bash
node notify-server.mjs
```

Listens on **8787**; remaining counts are **due Words** per deck.

## Study keyboard shortcuts

| Key | Action |
| --- | ------ |
| Space | Flip aspect |
| 1 or A | Again (Fail) |
| 2 or G | Good (Easy) |
| Escape | Exit |

Chip during review: `{lemma} · {aspect code} · {i}/{n} this round`.

## Project structure

```
src/
  components/   Home, DeckEditor, WordPage, StudyMode, FlashCard, ScheduleDashboard
  data/         Seed Words+Aspects (World Capitals, Spanish Basics)
  hooks/        useStore (decks + words + aspects)
  lib/          sampler, wordGrading, wordTemplate, wordSchedule, migrate
  types/        Word, Aspect, Deck, View
```

## Tech

- Vite + React 19 + TypeScript
- Tailwind CSS v4
- Client-side only (`localStorage`)
