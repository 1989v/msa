import { AlertTriangle } from 'lucide-react'
import type { ApiError } from '@/api/client'

export function ErrorBanner({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl bg-pnl-down/10 px-4 py-3 text-pnl-down"
    >
      <AlertTriangle size={20} aria-hidden className="mt-0.5 shrink-0" />
      <div className="flex-1 space-y-1">
        <p className="text-base font-medium">요청을 처리하지 못했습니다.</p>
        <p className="text-sm opacity-80">
          {error.code} · {error.message}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 text-sm font-medium underline underline-offset-2"
          >
            다시 시도
          </button>
        )}
      </div>
    </div>
  )
}
