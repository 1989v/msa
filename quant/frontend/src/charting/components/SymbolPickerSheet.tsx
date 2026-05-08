// charting/components/SymbolPickerSheet.tsx
//
// 종목 선택 sheet/dialog. 모바일 = bottom sheet, 데스크톱 = side dialog (max-w-md).
// ESC 키 / overlay 클릭으로 닫힘.
import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function SymbolPickerSheet({ open, onClose, title = '종목 선택', children }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Focus first input inside the sheet (search box) on open.
    const t = setTimeout(() => {
      const input = dialogRef.current?.querySelector<HTMLInputElement>(
        'input[type="text"], input[type="search"], input:not([type])',
      )
      input?.focus()
    }, 30)
    return () => {
      document.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto md:inset-y-0 md:right-auto md:left-0 md:rounded-r-2xl md:rounded-tl-none md:max-w-md md:max-h-none"
        style={{
          background: 'var(--ko-surface-1)',
          border: '1px solid var(--ko-border-subtle)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-base font-semibold"
            style={{ color: 'var(--ko-text-primary)' }}
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--ko-text-muted)' }}
            aria-label="닫기"
            title="닫기 (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}
