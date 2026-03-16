import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import HeroPlaceholder from './HeroPlaceholder'

/**
 * Controlled photo carousel.
 * Renders a single photo at `idx`. Caller manages idx + navigation callbacks.
 * Arrows and dots are rendered by DetailPage directly over the hero overlay.
 */
export function PhotoCarouselImage({ photos, idx, height = 260, type }) {
  if (!photos?.length) {
    return <HeroPlaceholder type={type} height={height} />
  }

  const src = photos[idx]?.url || photos[idx]
  return (
    <img
      key={src}
      src={src}
      alt=""
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center',
        display: 'block',
      }}
    />
  )
}

/** Arrow button used in hero overlay */
export function CarouselArrow({ direction, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        [direction === 'left' ? 'left' : 'right']: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        background: 'rgba(0,0,0,0.45)',
        border: 'none',
        borderRadius: '50%',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        zIndex: 3,
        backdropFilter: 'blur(4px)',
      }}
    >
      {direction === 'left'
        ? <ChevronLeftIcon style={{ width: '16px', height: '16px', color: '#fff' }} />
        : <ChevronRightIcon style={{ width: '16px', height: '16px', color: '#fff' }} />}
    </button>
  )
}

/** Dot row for carousel — rendered bottom-right of hero */
export function CarouselDots({ count, activeIdx, onSelect }) {
  if (count <= 1) return null
  return (
    <div
      style={{
        position: 'absolute',
        bottom: '14px',
        right: '16px',
        display: 'flex',
        gap: '5px',
        zIndex: 3,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: i === activeIdx ? '#fff' : 'rgba(255,255,255,0.38)',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        />
      ))}
    </div>
  )
}
