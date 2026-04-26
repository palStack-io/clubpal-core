const VARIANT_STYLES = {
  gray:   { background: 'var(--s3)',                      color: 'var(--t2)' },
  rose:   { background: 'var(--rose-glow)',               color: 'var(--rose-soft)' },
  green:  { background: 'rgba(16,185,129,0.12)',          color: 'var(--green)' },
  yellow: { background: 'rgba(245,158,11,0.12)',          color: 'var(--amber)' },
  red:    { background: 'rgba(239,68,68,0.12)',           color: '#f87171' },
  blue:   { background: 'rgba(99,102,241,0.12)',          color: 'var(--blue)' },
  purple: { background: 'rgba(168,85,247,0.12)',          color: 'var(--purple)' },
}

const SIZE_CLASSES = {
  xs: 'px-1.5 py-0.5 text-xs',
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

export default function Badge({ children, variant = 'gray', size = 'sm' }) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${SIZE_CLASSES[size]}`}
      style={VARIANT_STYLES[variant] ?? VARIANT_STYLES.gray}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    scheduled:   { variant: 'blue',   label: 'Scheduled' },
    in_progress: { variant: 'yellow', label: 'In Progress' },
    completed:   { variant: 'green',  label: 'Completed' },
    cancelled:   { variant: 'red',    label: 'Cancelled' },
    going:       { variant: 'green',  label: 'Going' },
    maybe:       { variant: 'yellow', label: 'Maybe' },
    not_going:   { variant: 'red',    label: "Can't Go" },
    owner:       { variant: 'rose',   label: 'Owner' },
    admin:       { variant: 'blue',   label: 'Admin' },
    member:      { variant: 'gray',   label: 'Member' },
    round_robin: { variant: 'blue',   label: 'Round Robin' },
    random:      { variant: 'purple', label: 'Random' },
    none:        { variant: 'gray',   label: 'Manual' },
  }
  const { variant, label } = map[status] ?? { variant: 'gray', label: status }
  return <Badge variant={variant}>{label}</Badge>
}
