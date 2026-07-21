import { useState, useEffect, useRef, useCallback } from 'react'
import HeroSlide from './HeroSlide'

const AUTO_MS = 6000

function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
}

export default function HeroCarousel({ slides = [], userId, onRsvp, id }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef(null)

  const count = slides.length
  const safeIndex = count ? Math.min(index, count - 1) : 0

  const go = useCallback((next) => {
    setIndex(i => (count ? (next + count) % count : 0))
  }, [count])

  // Auto-advance — skip when reduced-motion, single slide, hovered, or on an invite slide
  useEffect(() => {
    if (count <= 1 || paused || prefersReducedMotion()) return
    if (slides[safeIndex]?.kind === 'invite') return
    const t = setTimeout(() => go(safeIndex + 1), AUTO_MS)
    return () => clearTimeout(t)
  }, [count, paused, safeIndex, slides, go])

  if (!count) return null

  function onTouchStart(e) { touchX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 40) go(safeIndex + (dx < 0 ? 1 : -1))
    touchX.current = null
  }

  return (
    <section
      id={id}
      className="cp-hero"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="cp-hero-viewport" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="cp-hero-track" style={{ transform: `translateX(-${safeIndex * 100}%)` }}>
          {slides.map((slide, i) => (
            <HeroSlide key={slide.key || i} slide={slide} userId={userId} onRsvp={onRsvp} />
          ))}
        </div>
      </div>

      {count > 1 && (
        <>
          <button className="cp-hero-arrow prev" aria-label="Previous" onClick={() => go(safeIndex - 1)}>‹</button>
          <button className="cp-hero-arrow next" aria-label="Next" onClick={() => go(safeIndex + 1)}>›</button>
          <div className="cp-hero-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                className={`cp-hero-dot${i === safeIndex ? ' on' : ''}`}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
