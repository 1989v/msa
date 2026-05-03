import type { PaperSlotState } from '@/api/sse/paperStream'

export interface SlotInfo {
    roundIndex: number
    state: PaperSlotState
    entryPrice?: string
}

interface Props {
    slots: SlotInfo[]
}

const STATE_COLORS: Record<PaperSlotState, string> = {
    EMPTY: 'bg-ink-100 text-ink-500 border-ink-200',
    PENDING_BUY: 'bg-amber-100 text-amber-700 border-amber-200',
    FILLED: 'bg-pnl-up/10 text-pnl-up border-pnl-up/30',
    PENDING_SELL: 'bg-blue-100 text-blue-700 border-blue-200',
    CLOSED: 'bg-ink-200 text-ink-700 border-ink-300',
}

const STATE_LABEL: Record<PaperSlotState, string> = {
    EMPTY: '대기',
    PENDING_BUY: '매수 중',
    FILLED: '보유',
    PENDING_SELL: '매도 중',
    CLOSED: '청산',
}

/**
 * 회차 슬롯 그리드.
 *
 * - 최대 50회차이지만, UI는 우선 7열 grid 로 시각화 (회차 ≥ 8 시 줄바꿈)
 * - 각 슬롯: 회차 번호 + 상태 + (FILLED/PENDING_SELL 시) 진입가
 */
export function TrancheSlotGrid({ slots }: Props) {
    return (
        <section
            aria-label="회차 슬롯 상태"
            className="rounded-2xl border border-ink-200 bg-white p-4"
        >
            <div className="text-sm text-ink-500 mb-3">회차 슬롯</div>
            {slots.length === 0 ? (
                <div className="text-ink-400 text-sm">회차 정보 없음</div>
            ) : (
                <ul className="grid grid-cols-7 gap-2">
                    {slots.map((slot) => (
                        <li
                            key={slot.roundIndex}
                            className={`rounded-lg border p-2 text-center text-xs ${STATE_COLORS[slot.state]}`}
                            title={STATE_LABEL[slot.state]}
                        >
                            <div className="font-bold tabular-nums">
                                {slot.roundIndex + 1}
                            </div>
                            {slot.entryPrice && (
                                <div className="tabular-nums mt-1 truncate">
                                    {Number(slot.entryPrice).toLocaleString()}
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
