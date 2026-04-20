import { useReleaseBanner } from '../../hooks/useReleaseBanner'

export default function ReleaseBanner() {
  const { release, visible, expanded, setExpanded, dismiss } = useReleaseBanner()

  if (!visible || !release) return null

  const preview = release.items?.slice(0, 2).map(i => i.text).join(' · ')

  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(244,63,94,0.10), rgba(251,113,133,0.06))',
      borderBottom: '1px solid var(--rose-border)',
      padding: expanded ? '10px 18px 12px' : '7px 18px',
      transition: 'padding 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <span style={{ flexShrink: 0 }}>🎉</span>
        <span style={{ fontWeight: 700, color: 'var(--rose-soft)', fontSize: '13px', flexShrink: 0 }}>
          What's New · v{release.version}
        </span>
        {!expanded && (
          <span style={{
            fontSize: '12px', color: 'var(--t3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {preview}
          </span>
        )}
        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto', flexShrink: 0, alignItems: 'center' }}>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: 700, color: 'var(--rose-soft)',
              padding: '3px 8px', borderRadius: '6px',
            }}
          >
            {expanded ? '∧ Less' : '∨ Details'}
          </button>
          <button
            onClick={dismiss}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '18px', color: 'var(--t4)', lineHeight: 1,
              padding: '0 6px', borderRadius: '6px',
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>

      {expanded && release.items?.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {release.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--t2)', paddingLeft: '26px' }}>
              <span>{item.emoji}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
