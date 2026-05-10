// charting/components/PaperOrderTicket.tsx
//
// 토스 증권 order 페이지 (https://www.tossinvest.com/stocks/A005490/order) 의
// 우측 주문창 레퍼런스 — 매수/매도 탭 + 가격 + 수량 + 즉시 주문.
//
// Phase 1 페이퍼 (localStorage) — 사용자 학습/시뮬레이션 용. 백엔드 페이퍼
// 트레이딩 wire-up 은 Phase 2 후속 (POST /api/v1/strategies/{id}/paper/orders).
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

export type OrderSide = 'BUY' | 'SELL'

export interface PaperFill {
  id: string
  asset: string
  market: string
  side: OrderSide
  price: number
  qty: number
  ts: number
}

interface Props {
  asset: string
  market: string
  /** 호가/현재가 자동 prefill 기준. */
  currentPrice: number | null
  /** 가격 포맷터 (자산 클래스별 통화). */
  formatPrice: (n: number) => string
  /** 외부에서 가격 클릭 시 prefillPrice 설정. */
  prefillPrice?: number | null
}

const STORAGE_KEY = 'quant:paper-orders:v1'

function loadAll(): Record<string, PaperFill[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveAll(state: Record<string, PaperFill[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota / private mode — silent */
  }
}

export const PaperOrderTicket = memo(function PaperOrderTicket({
  asset,
  market,
  currentPrice,
  formatPrice,
  prefillPrice,
}: Props) {
  const key = `${asset}:${market}`
  const [side, setSide] = useState<OrderSide>('BUY')
  const [price, setPrice] = useState<string>('')
  const [qty, setQty] = useState<string>('')
  const [fills, setFills] = useState<PaperFill[]>(() => {
    const all = loadAll()
    return all[key] ?? []
  })

  // 종목 변경 시 fills reload
  useEffect(() => {
    const all = loadAll()
    setFills(all[key] ?? [])
  }, [key])

  // 외부 prefill (호가창 가격 클릭) 또는 currentPrice 가 변경되면 input 초기화
  useEffect(() => {
    if (prefillPrice != null && Number.isFinite(prefillPrice)) {
      setPrice(String(Math.floor(prefillPrice * 100) / 100))
    }
  }, [prefillPrice])
  useEffect(() => {
    if (price === '' && currentPrice != null && Number.isFinite(currentPrice)) {
      setPrice(String(Math.floor(currentPrice * 100) / 100))
    }
  }, [currentPrice, price])

  // 보유 수량 / 평균단가 / 손익 (간단 평균법)
  const position = useMemo(() => {
    let net = 0
    let cost = 0
    for (const f of fills) {
      if (f.side === 'BUY') {
        cost += f.price * f.qty
        net += f.qty
      } else {
        const avg = net > 0 ? cost / net : 0
        cost -= avg * f.qty
        net -= f.qty
      }
    }
    const avgPrice = net > 0 ? cost / net : 0
    const live = currentPrice ?? 0
    const pnl = net > 0 && live > 0 ? (live - avgPrice) * net : 0
    return { qty: net, avgPrice, pnl }
  }, [fills, currentPrice])

  const submit = useCallback(() => {
    const p = parseFloat(price)
    const q = parseFloat(qty)
    if (!Number.isFinite(p) || p <= 0) return
    if (!Number.isFinite(q) || q <= 0) return
    if (side === 'SELL' && q > position.qty) return // 보유 초과 매도 차단
    const fill: PaperFill = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      asset,
      market,
      side,
      price: p,
      qty: q,
      ts: Date.now(),
    }
    const all = loadAll()
    const next = [fill, ...(all[key] ?? [])].slice(0, 200)
    all[key] = next
    saveAll(all)
    setFills(next)
    setQty('')
  }, [price, qty, side, asset, market, key, position.qty])

  const clearAll = useCallback(() => {
    const all = loadAll()
    delete all[key]
    saveAll(all)
    setFills([])
  }, [key])

  const sideColor = side === 'BUY' ? 'var(--ko-quote-rise)' : 'var(--ko-quote-fall)'
  const sideBg =
    side === 'BUY'
      ? 'color-mix(in oklch, var(--ko-quote-rise) 14%, transparent)'
      : 'color-mix(in oklch, var(--ko-quote-fall) 14%, transparent)'

  return (
    <div
      className="rounded-lg overflow-hidden text-sm"
      style={{
        background: 'var(--ko-surface-1)',
        border: '1px solid var(--ko-border-subtle)',
      }}
    >
      {/* 매수/매도 탭 */}
      <div className="grid grid-cols-2">
        {(['BUY', 'SELL'] as OrderSide[]).map(s => {
          const active = s === side
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className="py-2.5 text-sm font-bold transition-colors"
              style={{
                color: active
                  ? s === 'BUY'
                    ? 'var(--ko-quote-rise)'
                    : 'var(--ko-quote-fall)'
                  : 'var(--ko-text-muted)',
                background: active
                  ? s === 'BUY'
                    ? 'color-mix(in oklch, var(--ko-quote-rise) 14%, transparent)'
                    : 'color-mix(in oklch, var(--ko-quote-fall) 14%, transparent)'
                  : 'transparent',
                borderBottom: active
                  ? `2px solid ${s === 'BUY' ? 'var(--ko-quote-rise)' : 'var(--ko-quote-fall)'}`
                  : '2px solid transparent',
              }}
            >
              {s === 'BUY' ? '매수' : '매도'}
            </button>
          )
        })}
      </div>

      <div className="p-3 space-y-2">
        {/* 가격 input + 현재가 적용 */}
        <div>
          <div
            className="text-[10px] uppercase tracking-wider mb-1"
            style={{ color: 'var(--ko-text-muted)' }}
          >
            가격
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={price}
              onChange={e => setPrice(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded text-sm tabular-nums focus:outline-none"
              style={{
                background: 'var(--ko-surface-2)',
                color: 'var(--ko-text-primary)',
                border: '1px solid var(--ko-border-subtle)',
              }}
              placeholder={currentPrice != null ? formatPrice(currentPrice) : '—'}
            />
            <button
              type="button"
              onClick={() => {
                if (currentPrice != null) setPrice(String(currentPrice))
              }}
              className="px-2.5 py-1.5 rounded text-[11px]"
              style={{
                background: 'var(--ko-surface-2)',
                color: 'var(--ko-text-secondary)',
                border: '1px solid var(--ko-border-subtle)',
              }}
            >
              현재가
            </button>
          </div>
        </div>

        {/* 수량 input + 빠른 % 버튼 */}
        <div>
          <div
            className="text-[10px] uppercase tracking-wider mb-1"
            style={{ color: 'var(--ko-text-muted)' }}
          >
            수량
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={qty}
            onChange={e => setQty(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded text-sm tabular-nums focus:outline-none"
            style={{
              background: 'var(--ko-surface-2)',
              color: 'var(--ko-text-primary)',
              border: '1px solid var(--ko-border-subtle)',
            }}
            placeholder="0"
          />
          {side === 'SELL' && position.qty > 0 && (
            <div className="flex gap-1 mt-1">
              {[10, 25, 50, 100].map(pct => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setQty(String((position.qty * pct) / 100))}
                  className="flex-1 px-1 py-0.5 rounded text-[10px]"
                  style={{
                    background: 'var(--ko-surface-2)',
                    color: 'var(--ko-text-secondary)',
                    border: '1px solid var(--ko-border-subtle)',
                  }}
                >
                  {pct}%
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 주문 금액 */}
        {Number(price) > 0 && Number(qty) > 0 && (
          <div
            className="flex justify-between text-[11px] px-2 py-1.5 rounded"
            style={{
              background: 'var(--ko-surface-2)',
              color: 'var(--ko-text-muted)',
            }}
          >
            <span>주문금액</span>
            <span className="tabular-nums" style={{ color: 'var(--ko-text-primary)' }}>
              {formatPrice(Number(price) * Number(qty))}
            </span>
          </div>
        )}

        {/* 매수/매도 submit */}
        <button
          type="button"
          onClick={submit}
          className="w-full py-2.5 rounded font-bold text-sm transition-opacity hover:opacity-90"
          style={{ background: sideBg, color: sideColor, border: `1px solid ${sideColor}` }}
        >
          {side === 'BUY' ? '매수' : '매도'} 주문
        </button>

        {/* 보유 포지션 — 페이퍼 */}
        <div
          className="grid grid-cols-3 gap-2 text-[11px] px-1 pt-2"
          style={{ borderTop: '1px solid var(--ko-border-subtle)' }}
        >
          <div>
            <div style={{ color: 'var(--ko-text-muted)' }}>보유</div>
            <div className="tabular-nums" style={{ color: 'var(--ko-text-primary)' }}>
              {position.qty > 0 ? position.qty.toFixed(4) : '—'}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--ko-text-muted)' }}>평단가</div>
            <div className="tabular-nums" style={{ color: 'var(--ko-text-primary)' }}>
              {position.avgPrice > 0 ? formatPrice(position.avgPrice) : '—'}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--ko-text-muted)' }}>평가손익</div>
            <div
              className="tabular-nums"
              style={{
                color:
                  position.pnl > 0
                    ? 'var(--ko-quote-rise)'
                    : position.pnl < 0
                      ? 'var(--ko-quote-fall)'
                      : 'var(--ko-text-primary)',
              }}
            >
              {position.qty > 0 ? `${position.pnl >= 0 ? '+' : ''}${formatPrice(position.pnl)}` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* 페이퍼 체결 내역 */}
      {fills.length > 0 && (
        <div
          className="px-3 py-2 space-y-1"
          style={{ borderTop: '1px solid var(--ko-border-subtle)' }}
        >
          <div className="flex justify-between items-center mb-1">
            <span
              className="text-[10px] uppercase tracking-wider"
              style={{ color: 'var(--ko-text-muted)' }}
            >
              페이퍼 체결 ({fills.length})
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px]"
              style={{ color: 'var(--ko-text-muted)', textDecoration: 'underline' }}
            >
              초기화
            </button>
          </div>
          <ul className="space-y-0.5 max-h-40 overflow-y-auto">
            {fills.slice(0, 20).map(f => (
              <li
                key={f.id}
                className="grid grid-cols-4 gap-2 text-[11px] tabular-nums"
              >
                <span
                  style={{
                    color:
                      f.side === 'BUY'
                        ? 'var(--ko-quote-rise)'
                        : 'var(--ko-quote-fall)',
                  }}
                >
                  {f.side === 'BUY' ? '매수' : '매도'}
                </span>
                <span style={{ color: 'var(--ko-text-secondary)' }}>
                  {formatPrice(f.price)}
                </span>
                <span style={{ color: 'var(--ko-text-secondary)' }}>{f.qty.toFixed(4)}</span>
                <span style={{ color: 'var(--ko-text-muted)' }}>
                  {new Date(f.ts).toLocaleTimeString('ko-KR', { hour12: false })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
})
