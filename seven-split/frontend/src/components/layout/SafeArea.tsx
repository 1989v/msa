import { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * iOS notch / Android nav bar 안전 영역.
 * env(safe-area-inset-*) 사용. content-fit=viewport 가 index.html 에 설정됨.
 */
export function SafeArea({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'min-h-screen flex flex-col',
        // 상단 safe-area는 헤더 내부에서 처리, 하단은 BottomTabBar에서 처리
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
