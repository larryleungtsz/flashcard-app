import type { Aspect, Word, WordStage } from '../types'

const AUDIT_CODE_PREF = [
  'core',
  'tone',
  'youglish',
  'ai_sentences',
  'ai_sents',
  'palace_recall',
  'mnemonic_image',
] as const

const PALACE_MNEM_CODES = new Set([
  'loci_text',
  'mnem_story',
  'object_rel',
  'palace_img',
  'mnem_img',
  'mnemonic_image',
  'palace_recall',
])

function byLeastRecent(a: Aspect, b: Aspect): number {
  const ta = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0
  const tb = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0
  return ta - tb
}

function live(aspects: Aspect[]): Aspect[] {
  return aspects.filter((a) => a.status === 'live')
}

function notGraduated(aspects: Aspect[]): Aspect[] {
  return aspects.filter((a) => a.status !== 'graduated')
}

/** Core: type === 'core' OR code starts with 'core'. */
export function isCoreAspect(a: Aspect): boolean {
  return a.type === 'core' || a.code === 'core' || a.code.startsWith('core')
}

/** Palace / mnemonic scaffold codes. */
export function isPalaceMnemAspect(a: Aspect): boolean {
  return PALACE_MNEM_CODES.has(a.code)
}

/**
 * Motor: type motor OR shadow_*, tone_*, youglish, ai_sents / ai_sentences, motor_*.
 */
export function isMotorAspect(a: Aspect): boolean {
  if (a.type === 'motor') return true
  const c = a.code
  if (c.startsWith('motor_')) return true
  if (c.startsWith('shadow_')) return true
  if (c.startsWith('tone')) return true
  if (c === 'youglish') return true
  if (c === 'ai_sents' || c === 'ai_sentences') return true
  return false
}

function motors(aspects: Aspect[]): Aspect[] {
  return aspects.filter(isMotorAspect)
}

/**
 * Every 6th word review is an audit:
 * when reviewCount % 6 === 5 (before increment), i.e. (reviewCount+1) % 6 === 0.
 */
export function isAuditReview(word: Word): boolean {
  return (word.reviewCount + 1) % 6 === 0
}

/**
 * Sample Aspects for a Word review by stage (or audit set).
 * Queue is Words; Aspects have no dueAt.
 */
export function sampleAspects(word: Word, aspects: Aspect[]): Aspect[] {
  const forWord = aspects.filter((a) => a.wordId === word.id)
  if (isAuditReview(word)) {
    return sampleAudit(forWord)
  }
  return sampleByStage(word.stage, forWord, word)
}

function sampleAudit(aspects: Aspect[]): Aspect[] {
  const out: Aspect[] = []
  const used = new Set<string>()
  const add = (a: Aspect | undefined) => {
    if (!a || a.status === 'graduated' || used.has(a.id)) return
    used.add(a.id)
    out.push(a)
  }

  // Prefer a core aspect (any core_* / type core)
  add(aspects.find(isCoreAspect))

  for (const pref of AUDIT_CODE_PREF) {
    if (pref === 'core') continue
    add(aspects.find((a) => a.code === pref || a.code.startsWith(pref)))
  }

  // Fallbacks for palace/mnem audit aliases
  add(aspects.find((a) => a.code === 'palace_img'))
  add(aspects.find((a) => a.code === 'mnem_img'))

  return out
}

function sampleByStage(stage: WordStage, aspects: Aspect[], word: Word): Aspect[] {
  const eligibleLive = live(aspects)

  if (stage === 0) {
    return eligibleLive.length > 0 ? eligibleLive : notGraduated(aspects).slice(0, 1)
  }

  if (stage === 1) {
    return sampleStage1(eligibleLive, aspects)
  }

  if (stage === 2) {
    return sampleStage2(eligibleLive, aspects, word)
  }

  // stage 3
  return sampleStage3(eligibleLive, aspects)
}

function pickCore(liveAspects: Aspect[], all: Aspect[]): Aspect | undefined {
  return (
    liveAspects.find(isCoreAspect) ??
    all.find(isCoreAspect)
  )
}

function sampleStage1(liveAspects: Aspect[], all: Aspect[]): Aspect[] {
  const picked: Aspect[] = []
  const used = new Set<string>()

  const add = (a: Aspect | undefined) => {
    if (!a || used.has(a.id)) return
    used.add(a.id)
    picked.push(a)
  }

  add(pickCore(liveAspects, all))

  const liveMotors = motors(liveAspects).sort(byLeastRecent)
  add(liveMotors[0])

  const livePalace = liveAspects
    .filter(isPalaceMnemAspect)
    .sort(byLeastRecent)
  if (livePalace[0]) {
    add(livePalace[0])
  } else {
    const auditPalace = all
      .filter((a) => a.status !== 'graduated' && isPalaceMnemAspect(a))
      .sort(byLeastRecent)
    add(auditPalace[0])
  }

  // Fill to 5 with least-recently-reviewed live aspects
  const remaining = liveAspects.filter((a) => !used.has(a.id)).sort(byLeastRecent)
  for (const a of remaining) {
    if (picked.length >= 5) break
    add(a)
  }

  return picked.slice(0, 5)
}

/** Rotate palace/mnemonic codes across reviews using reviewCount. */
function sampleStage2(liveAspects: Aspect[], all: Aspect[], word: Word): Aspect[] {
  const picked: Aspect[] = []
  const used = new Set<string>()
  const add = (a: Aspect | undefined) => {
    if (!a || used.has(a.id)) return
    used.add(a.id)
    picked.push(a)
  }

  add(pickCore(liveAspects, all))

  const liveMotors = motors(liveAspects).sort(byLeastRecent)
  add(liveMotors[0])

  const rotatePool = [
    ...liveAspects.filter(isPalaceMnemAspect),
    ...all.filter((a) => a.status !== 'graduated' && isPalaceMnemAspect(a)),
  ]
  const seen = new Set<string>()
  const rotateUnique = rotatePool.filter((a) => {
    if (seen.has(a.id) || used.has(a.id)) return false
    seen.add(a.id)
    return true
  })
  if (rotateUnique.length > 0) {
    const idx = word.reviewCount % rotateUnique.length
    add(rotateUnique[idx])
  }

  return picked.slice(0, 3)
}

function sampleStage3(liveAspects: Aspect[], all: Aspect[]): Aspect[] {
  const picked: Aspect[] = []
  const used = new Set<string>()
  const add = (a: Aspect | undefined) => {
    if (!a || used.has(a.id)) return
    used.add(a.id)
    picked.push(a)
  }

  add(pickCore(liveAspects, all))
  const liveMotors = motors(liveAspects).sort(byLeastRecent)
  add(liveMotors[0])
  return picked.slice(0, 2)
}
