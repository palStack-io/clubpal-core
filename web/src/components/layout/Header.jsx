import { BellIcon } from '@heroicons/react/24/outline'

export default function Header({ title, subtitle, actions }) {
  return (
    <header
      className="px-6 py-4"
      style={{ background: 'var(--s1)', borderBottom: '1px solid var(--glass)' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--t1)' }}>{title}</h1>
          {subtitle && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--t2)' }}>{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <button
            className="relative p-2 rounded-lg transition-colors hover:bg-[var(--s4)]"
            style={{ color: 'var(--t2)' }}
            aria-label="Notifications"
          >
            <BellIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
