interface FlashCardProps {
  front: string
  back: string
  mediaUrl?: string
  flipped: boolean
  onFlip: () => void
}

const IMAGE_EXT_RE = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?|#|$)/i

function isImageUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (IMAGE_EXT_RE.test(u.pathname)) return true
    if (IMAGE_EXT_RE.test(url)) return true
    // Common image CDNs / query hints
    if (/[?&]format=(jpg|jpeg|png|webp|gif)/i.test(url)) return true
    return false
  } catch {
    return IMAGE_EXT_RE.test(url)
  }
}

function youtubeEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id ? `https://www.youtube.com/embed/${id}${u.search}` : null
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts[0] === 'embed' && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`
      if (parts[0] === 'shorts' && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`
    }
  } catch {
    /* ignore */
  }
  return null
}

function BackMedia({ mediaUrl, back }: { mediaUrl?: string; back: string }) {
  if (!mediaUrl?.trim()) {
    return (
      <p className="mt-4 text-2xl font-semibold text-slate-900 sm:text-3xl dark:text-white">
        {back || '—'}
      </p>
    )
  }

  const url = mediaUrl.trim()
  const yt = youtubeEmbedSrc(url)

  if (isImageUrl(url)) {
    return (
      <div className="mt-4 flex w-full flex-col items-center gap-3">
        <img
          src={url}
          alt={back || 'Aspect media'}
          className="max-h-56 w-auto max-w-full rounded-xl object-contain shadow-sm"
          onClick={(e) => e.stopPropagation()}
        />
        {back ? (
          <p className="text-lg font-medium text-slate-800 dark:text-slate-100">{back}</p>
        ) : null}
      </div>
    )
  }

  if (yt) {
    return (
      <div className="mt-4 flex w-full flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-sm">
          <iframe
            title="YouTube media"
            src={yt}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          Open media
        </a>
        {back ? (
          <p className="text-lg font-medium text-slate-800 dark:text-slate-100">{back}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mt-4 flex w-full flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary text-base"
        onClick={(e) => e.stopPropagation()}
      >
        Open media
      </a>
      {back ? (
        <p className="text-lg font-medium text-slate-800 dark:text-slate-100">{back}</p>
      ) : (
        <p className="break-all text-xs text-slate-400">{url}</p>
      )}
    </div>
  )
}

export function FlashCard({ front, back, mediaUrl, flipped, onFlip }: FlashCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="flashcard-scene group w-full max-w-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-900"
      onClick={onFlip}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onFlip()
        }
      }}
      aria-label={
        flipped
          ? `Back${mediaUrl ? ' with media' : ''}: ${back || 'media'}. Click to flip.`
          : `Front: ${front}. Click to flip.`
      }
      aria-pressed={flipped}
    >
      <div className={`flashcard-inner ${flipped ? 'is-flipped' : ''}`}>
        <div className="flashcard-face flashcard-front">
          <span className="text-xs font-medium uppercase tracking-wider text-indigo-500">
            Front
          </span>
          <p className="mt-4 text-2xl font-semibold text-slate-900 sm:text-3xl dark:text-white">
            {front}
          </p>
          <span className="mt-8 text-xs text-slate-400 group-hover:text-slate-500 dark:text-slate-500">
            Click or press Space to flip
          </span>
        </div>
        <div className="flashcard-face flashcard-back">
          <span className="text-xs font-medium uppercase tracking-wider text-emerald-500">
            Back
          </span>
          <BackMedia mediaUrl={mediaUrl} back={back} />
          <span className="mt-8 text-xs text-slate-400 group-hover:text-slate-500 dark:text-slate-500">
            Click or press Space to flip
          </span>
        </div>
      </div>
    </div>
  )
}
