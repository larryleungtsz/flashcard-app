export type RemainingDeck = { name: string; remaining: number }
export type ReviewNotification = {
  kind: 'remaining'
  decks: RemainingDeck[]
  at: string
}

const NOTIFY_URL = import.meta.env.VITE_REVIEW_WEBHOOK_URL || 'http://127.0.0.1:8787/review'

export async function notifyReview(payload: ReviewNotification): Promise<void> {
  try {
    await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'cors',
      keepalive: true,
    })
  } catch {
    // never block study UX
  }
}
