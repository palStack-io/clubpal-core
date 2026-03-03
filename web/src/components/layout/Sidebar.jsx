import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  UserGroupIcon,
  TrophyIcon,
  SparklesIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  TrophyIcon as TrophyIconSolid,
  SparklesIcon as SparklesIconSolid,
  UserCircleIcon as UserCircleIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  CalendarDaysIcon as CalendarDaysIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  MagnifyingGlassIcon as MagnifyingGlassIconSolid,
} from '@heroicons/react/24/solid'
import { useAuth } from '../../contexts/AuthContext'

const nav = [
  { to: '/dashboard', label: 'Dashboard', Icon: HomeIcon, IconSolid: HomeIconSolid },
  { to: '/events', label: 'Events', Icon: CalendarDaysIcon, IconSolid: CalendarDaysIconSolid },
  { to: '/groups', label: 'Groups', Icon: UserGroupIcon, IconSolid: UserGroupIconSolid },
  { to: '/leaderboard', label: 'Leaderboard', Icon: TrophyIcon, IconSolid: TrophyIconSolid },
  { to: '/stats', label: 'My Stats', Icon: ChartBarIcon, IconSolid: ChartBarIconSolid },
]

const discoverNav = [
  { to: '/discover/restaurants', label: 'Restaurants' },
  { to: '/discover/movies', label: 'Movies' },
  { to: '/discover/books', label: 'Books' },
  { to: '/discover/hikes', label: 'Hikes' },
  { to: '/discover/games', label: 'Games' },
  { to: '/discover/arts', label: 'Arts & Culture' },
]

const bottomNav = [
  { to: '/activities', label: 'Activities', Icon: SparklesIcon, IconSolid: SparklesIconSolid },
  { to: '/profile', label: 'Profile', Icon: UserCircleIcon, IconSolid: UserCircleIconSolid },
  { to: '/settings', label: 'Settings', Icon: Cog6ToothIcon, IconSolid: Cog6ToothIconSolid },
]

function NavItem({ to, label, Icon, IconSolid }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary-50 text-primary-700 dark:bg-[rgba(244,63,94,0.12)] dark:text-[#fb7185]'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-[#9898b0] dark:hover:bg-[#22222c] dark:hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <IconSolid className="h-5 w-5 flex-shrink-0" />
          ) : (
            <Icon className="h-5 w-5 flex-shrink-0" />
          )}
          {label}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-white border-r border-gray-200 dark:bg-[#0e0e12] dark:border-[rgba(255,255,255,0.08)] flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-gray-100 dark:border-[rgba(255,255,255,0.08)]">
        <div className="h-8 w-8 bg-primary-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">C</span>
        </div>
        <span className="font-bold text-gray-900 dark:text-white text-lg">ClubPal</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(item => <NavItem key={item.to} {...item} />)}

        {/* Discover section */}
        <div className="pt-4 pb-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#55556a] mb-1">
            Discover
          </p>
          {discoverNav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-[rgba(244,63,94,0.12)] dark:text-[#fb7185]'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-[#9898b0] dark:hover:bg-[#22222c] dark:hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        <div className="pt-2 space-y-0.5">
          {bottomNav.map(item => <NavItem key={item.to} {...item} />)}
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 dark:border-[rgba(255,255,255,0.08)] p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
            {user?.full_name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {user?.full_name || user?.username}
            </p>
            <p className="text-xs text-gray-500 dark:text-[#55556a] truncate">@{user?.username}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-3 w-full text-left text-xs text-gray-500 dark:text-[#55556a] hover:text-red-600 dark:hover:text-red-400 transition-colors px-1"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
