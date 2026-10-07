import { tourSteps } from './tourSteps'

const TOOLTIP_WIDTH  = 280
const TOOLTIP_HEIGHT = 200
const GAP = 14

export default function TourTooltip({ step, total, spotRect, onNext, onPrev, onGoTo, onEnd }) {
  const s = tourSteps[step]
  const { top: sTop, left: sLeft, width: sW, height: sH } = spotRect

  const vw = window.innerWidth
  const vh = window.innerHeight

  let top, left
  switch (s.place) {
    case 'below':
      top  = sTop + sH + GAP
      left = sLeft + sW / 2 - TOOLTIP_WIDTH / 2
      break
    case 'above':
      top  = sTop - TOOLTIP_HEIGHT - GAP
      left = sLeft + sW / 2 - TOOLTIP_WIDTH / 2
      break
    case 'left':
      top  = sTop + sH / 2 - TOOLTIP_HEIGHT / 2
      left = sLeft - TOOLTIP_WIDTH - GAP
      break
    case 'right':
    default:
      top  = sTop + sH / 2 - TOOLTIP_HEIGHT / 2
      left = sLeft + sW + GAP
      break
  }

  left = Math.max(12, Math.min(left, vw - TOOLTIP_WIDTH - 12))
  top  = Math.max(12, Math.min(top,  vh - TOOLTIP_HEIGHT - 12))

  const isFirst = step === 0
  const isLast  = step === total - 1

  const arrowBase = {
    position: 'absolute',
    width: '10px',
    height: '10px',
    background: 'var(--s2)',
    transform: 'rotate(45deg)',
  }

  const arrowStyles = {
    top:    { top: '-6px',    left: 'calc(50% - 5px)', borderTop: '1px solid var(--glass)', borderLeft: '1px solid var(--glass)' },
    bottom: { bottom: '-6px', left: 'calc(50% - 5px)', borderBottom: '1px solid var(--glass)', borderRight: '1px solid var(--glass)' },
    left:   { left: '-6px',   top: 'calc(50% - 5px)',  borderBottom: '1px solid var(--glass)', borderLeft: '1px solid var(--glass)' },
    right:  { right: '-6px',  top: 'calc(50% - 5px)',  borderTop: '1px solid var(--glass)', borderRight: '1px solid var(--glass)' },
  }

  return (
    <div style={{
      position: 'fixed',
      top,
      left,
      width: TOOLTIP_WIDTH,
      background: 'var(--s2)',
      border: '1px solid var(--glass)',
      borderRadius: '18px',
      padding: '20px 22px',
      pointerEvents: 'auto',
      zIndex: 1001,
      transition: 'top 0.3s cubic-bezier(.4,0,.2,1), left 0.3s cubic-bezier(.4,0,.2,1)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
    }}>
      {/* Arrow */}
      <div style={{ ...arrowBase, ...arrowStyles[s.arrow] }} />

      {/* Step label */}
      <div style={{
        fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.9px', color: 'var(--rose-soft)', marginBottom: '6px',
      }}>
        {step + 1} / {total} — {s.label}
      </div>

      {/* Title */}
      <div style={{
        fontSize: '16px', fontWeight: 800, color: 'var(--t1)',
        marginBottom: '7px', lineHeight: 1.25,
      }}>
        {s.title}
      </div>

      {/* Body */}
      <div style={{
        fontSize: '12px', color: 'var(--t2)', lineHeight: 1.65, marginBottom: '16px',
      }}>
        {s.body}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Pip dots */}
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              onClick={() => onGoTo(i)}
              style={{
                width: i === step ? '14px' : '5px',
                height: '5px',
                borderRadius: '50px',
                background: i === step ? 'var(--rose)' : 'var(--glass)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '5px' }}>
          <button onClick={onEnd} style={{
            padding: '6px 11px', borderRadius: '8px',
            border: '1px solid var(--glass)', background: 'transparent',
            fontSize: '11px', fontWeight: 700, color: 'var(--t3)', cursor: 'pointer',
          }}>
            Skip
          </button>
          {!isFirst && (
            <button onClick={onPrev} style={{
              padding: '6px 11px', borderRadius: '8px',
              border: '1px solid var(--glass)', background: 'transparent',
              fontSize: '11px', fontWeight: 700, color: 'var(--t2)', cursor: 'pointer',
            }}>
              ←
            </button>
          )}
          <button onClick={onNext} style={{
            padding: '6px 14px', borderRadius: '8px',
            border: 'none',
            background: isLast ? 'var(--rose)' : 'var(--t1)',
            color: isLast ? '#fff' : 'var(--bg)',
            fontSize: '11px', fontWeight: 800, cursor: 'pointer',
          }}>
            {isLast ? "Let's go!" : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
