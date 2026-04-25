import { NavLink } from 'react-router-dom'
import { Home, LineChart, ListOrdered, Trophy } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Tab {
  to: string
  label: string
  icon: typeof Home
  /** "/" 만 정확매칭, 나머지는 prefix 매칭 (NavLink end prop) */
  exact?: boolean
}

const tabs: Tab[] = [
  { to: '/', label: '홈', icon: Home, exact: true },
  { to: '/strategies', label: '전략', icon: LineChart },
  { to: '/runs', label: '백테스트', icon: ListOrdered },
  { to: '/leaderboard', label: '리더보드', icon: Trophy },
]

export function BottomTabBar() {
  return (
    <nav
      aria-label="주요 메뉴"
      className={cn(
        'fixed bottom-0 inset-x-0 z-[200] bg-white border-t border-ink-100',
        'pb-[max(env(safe-area-inset-bottom),0.25rem)]',
      )}
    >
      <ul className="flex items-stretch justify-around px-2 max-w-app mx-auto">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.exact}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.5rem]',
                  'transition-colors duration-150',
                  isActive ? 'text-ink-900' : 'text-ink-400 hover:text-ink-700',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <tab.icon size={22} aria-hidden strokeWidth={isActive ? 2.25 : 1.75} />
                  <span className="text-xs font-medium">{tab.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
