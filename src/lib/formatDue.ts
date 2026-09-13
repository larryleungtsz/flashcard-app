export type NextReviewKind = 'due' | 'overdue' | 'upcoming'

export interface NextReviewDisplay {
  kind: NextReviewKind
  /** Primary label, e.g. "Due now", "Overdue", "in 10 minutes" */
  label: string
  /** Absolute local time for upcoming reviews; null for due/overdue */
  absolute: string | null
}

const OVERDUE_THRESHOLD_MS = 60 * 1000

function formatRelativeFuture(ms: number): string {
  const sec = Math.round(ms / 1000)
  if (sec < 60) return 'in less than a minute'
  const min = Math.round(sec / 60)
  if (min < 60) return `in ${min} minute${min === 1 ? '' : 's'}`
  const hours = Math.round(min / 60)
  if (hours < 48) return `in ${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.round(hours / 24)
  if (days < 14) return `in ${days} day${days === 1 ? '' : 's'}`
  const weeks = Math.round(days / 7)
  if (weeks < 8) return `in ${weeks} week${weeks === 1 ? '' : 's'}`
  const months = Math.round(days / 30)
  return `in ${months} month${months === 1 ? '' : 's'}`
}

function formatAbsolute(date: Date): string {
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Human-readable next-review label for a card's dueAt. */
export function formatNextReview(
  dueAt: string | null,
  now: Date = new Date(),
): NextReviewDisplay {
  const nowMs = now.getTime()

  if (dueAt == null) {
    return { kind: 'due', label: 'Due now', absolute: null }
  }

  const dueMs = new Date(dueAt).getTime()
  if (dueMs <= nowMs) {
    if (nowMs - dueMs > OVERDUE_THRESHOLD_MS) {
      return { kind: 'overdue', label: 'Overdue', absolute: null }
    }
    return { kind: 'due', label: 'Due now', absolute: null }
  }

  return {
    kind: 'upcoming',
    label: formatRelativeFuture(dueMs - nowMs),
    absolute: formatAbsolute(new Date(dueAt)),
  }
}

/** Sort key: sooner reviews first; null dueAt sorts as earliest (due now). */
export function dueSortKey(dueAt: string | null): number {
  if (dueAt == null) return Number.NEGATIVE_INFINITY
  return new Date(dueAt).getTime()
}
