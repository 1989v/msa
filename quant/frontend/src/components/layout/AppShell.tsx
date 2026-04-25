import { ReactNode } from 'react'
import { BottomTabBar } from './BottomTabBar'
import { SafeArea } from './SafeArea'
import { cn } from '@/lib/cn'

interface AppShellProps {
  children: ReactNode
  /** false 면 BottomTabBar 미노출 (예: 풀스크린 차트) */
  withTabBar?: boolean
  className?: string
}

export function AppShell({ children, withTabBar = true, className }: AppShellProps) {
  return (
    <SafeArea>
      <main
        className={cn(
          'flex-1 w-full mx-auto max-w-app',
          // 하단 탭바 높이만큼 pb (탭바 자체가 safe-bottom 흡수)
          withTabBar ? 'pb-24' : 'pb-4',
          className,
        )}
      >
        {children}
      </main>
      {withTabBar && <BottomTabBar />}
    </SafeArea>
  )
}
