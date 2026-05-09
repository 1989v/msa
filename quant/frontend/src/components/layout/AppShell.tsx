import { ReactNode } from 'react'
import { BottomTabBar } from './BottomTabBar'
import { SafeArea } from './SafeArea'
import { cn } from '@/lib/cn'

interface AppShellProps {
  children: ReactNode
  /** false 면 BottomTabBar 미노출 (예: 풀스크린 차트) */
  withTabBar?: boolean
  /** Layout width — 'app' (default, 모바일 max-w-480) | 'full' (lg 이상에서 풀폭, 차트·발견 화면 등). */
  width?: 'app' | 'full'
  className?: string
}

export function AppShell({
  children,
  withTabBar = true,
  width = 'app',
  className,
}: AppShellProps) {
  return (
    <SafeArea>
      <main
        className={cn(
          'flex-1 w-full mx-auto',
          // 모바일은 항상 max-w-app, lg 이상에서만 width prop 영향
          width === 'full'
            ? 'max-w-app lg:max-w-screen-2xl lg:px-4'
            : 'max-w-app',
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
