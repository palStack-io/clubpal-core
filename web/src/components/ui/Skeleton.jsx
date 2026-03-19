/**
 * Skeleton — shimmer loading placeholder
 *
 * Variants:
 *   rect   — rectangular block (default)
 *   circle — circular avatar placeholder
 *   text   — single text line
 *
 * Usage:
 *   <Skeleton width={120} height={16} />
 *   <Skeleton variant="circle" size={40} />
 *   <Skeleton variant="text" lines={3} />
 */

export default function Skeleton({
  variant = 'rect',
  width,
  height,
  size,
  lines = 1,
  rounded,
  className = '',
  style: styleProp = {},
}) {
  const base = {
    background: 'var(--s3)',
    borderRadius: rounded ?? 'var(--r-sm)',
    overflow: 'hidden',
    position: 'relative',
  }

  if (variant === 'circle') {
    const s = size || 40
    return (
      <div
        className={`cp-skeleton ${className}`}
        style={{
          ...base,
          width: s,
          height: s,
          borderRadius: '50%',
          ...styleProp,
        }}
      />
    )
  }

  if (variant === 'text') {
    return (
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: '8px', ...styleProp }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="cp-skeleton"
            style={{
              ...base,
              height: height || 14,
              width: i === lines - 1 && lines > 1 ? '75%' : (width || '100%'),
            }}
          />
        ))}
      </div>
    )
  }

  // rect
  return (
    <div
      className={`cp-skeleton ${className}`}
      style={{
        ...base,
        width: width || '100%',
        height: height || 20,
        ...styleProp,
      }}
    />
  )
}

/**
 * Pre-composed skeleton for a card with header + body lines
 */
export function CardSkeleton({ lines = 3 }) {
  return (
    <div className="cp-card" style={{ padding: '18px' }}>
      <Skeleton width="45%" height={16} style={{ marginBottom: '14px' }} />
      <Skeleton variant="text" lines={lines} />
    </div>
  )
}

/**
 * Pre-composed skeleton for a stat card
 */
export function StatCardSkeleton() {
  return (
    <div className="cp-stat-card">
      <Skeleton width={80} height={12} style={{ marginBottom: '10px' }} />
      <Skeleton width={48} height={24} style={{ marginBottom: '8px' }} />
      <Skeleton width={60} height={10} />
    </div>
  )
}

/**
 * Pre-composed skeleton for list items
 */
export function ListItemSkeleton({ count = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Skeleton variant="circle" size={36} />
          <div style={{ flex: 1 }}>
            <Skeleton width="60%" height={14} style={{ marginBottom: '6px' }} />
            <Skeleton width="40%" height={10} />
          </div>
        </div>
      ))}
    </div>
  )
}
