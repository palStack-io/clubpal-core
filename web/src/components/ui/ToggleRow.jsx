/**
 * ToggleRow — a tap-to-toggle row with label + description.
 * Props:
 *   value       : boolean — current on/off state
 *   onChange    : () => void — called on click
 *   label       : string
 *   description : string
 *   activeColor : CSS color string, default 'var(--rose-soft)'
 */
export default function ToggleRow({ value, onChange, label, description, activeColor = 'var(--rose-soft)' }) {
  const sectionStyle = {
    background: 'var(--s3)',
    border: '1px solid var(--glass)',
    borderRadius: '14px',
    padding: '18px',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    cursor: 'pointer',
  }

  return (
    <div style={sectionStyle} onClick={onChange}>
      {/* Track */}
      <div style={{
        width: '40px', height: '22px', borderRadius: '11px',
        background: value ? 'var(--rose)' : 'var(--glass)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: '2px',
          left: value ? '20px' : '2px',
          width: '18px', height: '18px', borderRadius: '9px',
          background: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }} />
      </div>
      {/* Text */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: value ? activeColor : 'var(--t2)' }}>
          {label}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '2px' }}>
          {description}
        </div>
      </div>
    </div>
  )
}
