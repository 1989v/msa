import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/cn'

interface PageHeaderProps {
  title: string
  subtitle?: string
  back?: boolean | string // true: history.back(), string: navigate(path)
  rightSlot?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, back, rightSlot, className }: PageHeaderProps) {
  const navigate = useNavigate()

  function onBack() {
    if (typeof back === 'string') {
      navigate(back)
    } else {
      navigate(-1)
    }
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-[200] bg-ink-50/95 backdrop-blur-sm',
        'pt-[max(env(safe-area-inset-top),0.5rem)]',
        'border-b border-ink-100',
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3 min-h-[3.5rem]">
        {back && (
          <button
            type="button"
            onClick={onBack}
            aria-label="뒤로 가기"
            className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100 active:bg-ink-200 transition-colors"
          >
            <ChevronLeft size={24} aria-hidden />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-ink-900 truncate">{title}</h1>
          {subtitle && <p className="text-sm text-ink-500 truncate">{subtitle}</p>}
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
    </header>
  )
}
