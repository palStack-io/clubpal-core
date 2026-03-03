import { BellIcon } from '@heroicons/react/24/outline'

export default function Header({ title, subtitle, actions }) {
  return (
    <header className="bg-white border-b border-gray-200 dark:bg-[#0e0e12] dark:border-[rgba(255,255,255,0.08)] px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 dark:text-[#9898b0] mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <button className="relative p-2 text-gray-500 dark:text-[#9898b0] hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#22222c] rounded-lg transition-colors">
            <BellIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
