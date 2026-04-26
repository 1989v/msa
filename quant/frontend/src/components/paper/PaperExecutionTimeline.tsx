import { cn } from '@/lib/cn'

export interface PaperExecution {
    roundIndex: number
    side: 'BUY' | 'SELL'
    price: string
    ts: string
}

interface Props {
    executions: PaperExecution[]
    /** 표시 상한 (default 20) */
    limit?: number
}

/**
 * 페이퍼 트레이딩 가상 체결 타임라인.
 *
 * - 최신이 위 (head)
 * - 한국 PnL 컨벤션: 매수=빨강(상승 의미), 매도=파랑
 * - ts (ISO-8601) 의 HH:mm:ss 만 표시
 */
export function PaperExecutionTimeline({ executions, limit = 20 }: Props) {
    const items = executions.slice(0, limit)

    return (
        <section
            aria-label="최근 체결"
            className="rounded-2xl border border-ink-200 bg-white p-4"
        >
            <div className="text-sm text-ink-500 mb-3">최근 체결</div>
            {items.length === 0 ? (
                <div className="text-ink-400 text-sm">아직 체결 없음</div>
            ) : (
                <ol className="space-y-2">
                    {items.map((ex, i) => (
                        <li
                            key={`${ex.ts}-${ex.roundIndex}-${i}`}
                            className="flex items-center gap-3 text-sm"
                        >
                            <span className="text-ink-400 tabular-nums">
                                {formatHms(ex.ts)}
                            </span>
                            <span
                                className={cn(
                                    'font-bold',
                                    ex.side === 'BUY'
                                        ? 'text-pnl-up'
                                        : 'text-pnl-down',
                                )}
                            >
                                {ex.side === 'BUY' ? '매수' : '매도'}
                            </span>
                            <span className="text-ink-500 tabular-nums">
                                회차 {ex.roundIndex + 1}
                            </span>
                            <span className="ml-auto tabular-nums text-ink-900">
                                {Number(ex.price).toLocaleString()}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    )
}

function formatHms(ts: string): string {
    // ISO-8601 ("2026-04-24T12:34:56.789Z") 의 HH:mm:ss 만 추출.
    // 파싱 실패 시 원본 반환.
    if (ts.length >= 19 && ts.charAt(10) === 'T') {
        return ts.slice(11, 19)
    }
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return ts
    return d.toISOString().slice(11, 19)
}
