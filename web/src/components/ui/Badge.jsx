export default function Badge({ children, variant = 'gray', size = 'sm' }) {
  const variants = {
    gray: 'bg-gray-100 text-gray-700',
    rose: 'bg-primary-100 text-primary-700',
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
  }
  const sizes = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  }
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    scheduled: { variant: 'blue', label: 'Scheduled' },
    in_progress: { variant: 'yellow', label: 'In Progress' },
    completed: { variant: 'green', label: 'Completed' },
    cancelled: { variant: 'red', label: 'Cancelled' },
    going: { variant: 'green', label: 'Going' },
    maybe: { variant: 'yellow', label: 'Maybe' },
    not_going: { variant: 'red', label: "Can't Go" },
    owner: { variant: 'rose', label: 'Owner' },
    admin: { variant: 'blue', label: 'Admin' },
    member: { variant: 'gray', label: 'Member' },
    round_robin: { variant: 'blue', label: 'Round Robin' },
    random: { variant: 'purple', label: 'Random' },
    none: { variant: 'gray', label: 'Manual' },
  }
  const { variant, label } = map[status] || { variant: 'gray', label: status }
  return <Badge variant={variant}>{label}</Badge>
}
