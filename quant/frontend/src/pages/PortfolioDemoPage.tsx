import { useState } from 'react';
import { AreaChartCard, ListRow, SegmentControl, StatCard } from '@kgd/design-system';

/**
 * PortfolioDemoPage — 샘플 2 (포트폴리오) 정확 매칭 demo.
 *
 * 구성:
 *   1. 빗썸 / 업비트 SegmentControl (pill variant)
 *   2. 보유자산 평가액 StatCard
 *   3. 누적수익 StatCard (큰 녹색 숫자)
 *   4. 누적수익 그래프 StatCard (recharts AreaChart, 녹색 그라디언트)
 *   5. 바로투자 — 6 코인 ListRow
 */

type Exchange = 'BITHUMB' | 'UPBIT';

const cumulativeReturn: Array<{ date: string; value: number }> = [
  { date: '4/17', value: 0 },
  { date: '4/19', value: 1.2 },
  { date: '4/21', value: 2.5 },
  { date: '4/23', value: 3.1 },
  { date: '4/25', value: 4.4 },
  { date: '4/27', value: 5.2 },
  { date: '4/29', value: 6.0 },
  { date: '5/1', value: 7.6 },
  { date: '5/3', value: 8.4 },
  { date: '5/5', value: 9.0 },
  { date: '5/6', value: 9.3 },
];

interface CoinRow {
  symbol: string;
  name: string;
  abbr: string;
  price: string;
  delta: string;
  tone: 'profit' | 'loss';
}

const coins: CoinRow[] = [
  { symbol: 'BTC', name: 'Bitcoin', abbr: 'BT', price: '119,916,000원', delta: '-0.04%', tone: 'loss' },
  { symbol: 'ETH', name: 'Ethereum', abbr: 'ET', price: '3,494,000원', delta: '-1.05%', tone: 'loss' },
  { symbol: 'XRP', name: 'Ripple', abbr: 'XR', price: '2,090원', delta: '+0.34%', tone: 'profit' },
  { symbol: 'SOL', name: 'Solana', abbr: 'SO', price: '128,200원', delta: '+1.99%', tone: 'profit' },
  { symbol: 'DOGE', name: 'Dogecoin', abbr: 'DO', price: '170원', delta: '+2.41%', tone: 'profit' },
  { symbol: 'ADA', name: 'Cardano', abbr: 'AD', price: '388원', delta: '+3.74%', tone: 'profit' },
];

export function PortfolioDemoPage() {
  const [exchange, setExchange] = useState<Exchange>('BITHUMB');

  return (
    <div
      className="min-h-screen px-4 py-5 max-w-md mx-auto"
      style={{ background: 'var(--ko-surface-0)', color: 'var(--ko-text-primary)' }}
    >
      {/* 1. 거래소 segment */}
      <div className="mb-5">
        <SegmentControl
          variant="pill"
          ariaLabel="거래소 선택"
          options={[
            { value: 'BITHUMB', label: '빗썸' },
            { value: 'UPBIT', label: '업비트' },
          ]}
          value={exchange}
          onChange={(v) => setExchange(v as Exchange)}
        />
      </div>

      {/* 2. 보유자산 평가액 */}
      <div className="mb-3">
        <StatCard
          title="보유자산 평가액"
          meta={
            <span style={{ color: 'var(--ko-status-loss)' }}>평가손익 -976원</span>
          }
          primary="5,270,281원"
          primaryTone="neutral"
          footer={
            <>
              <span style={{ color: 'var(--ko-text-muted)' }}>예수금 2,008,529원</span>
            </>
          }
        />
      </div>

      {/* 3. 누적수익 */}
      <div className="mb-3">
        <StatCard
          title="누적수익"
          meta={
            <span style={{ color: 'var(--ko-text-muted)' }}>거래금액 70,185,658원</span>
          }
          primary="+93,085원"
          primaryTone="profit"
          footer={
            <>
              <span style={{ color: 'var(--ko-text-muted)' }}>수익률 0.1326%</span>
            </>
          }
        />
      </div>

      {/* 4. 누적수익 그래프 (디자인 시스템 AreaChartCard) */}
      <div className="mb-6">
        <AreaChartCard
          title="누적수익 그래프"
          meta="+9.3만원"
          tone="profit"
          height={200}
          data={cumulativeReturn.map((d) => ({ x: d.date, y: d.value }))}
          yFormatter={(v) => `${v}만`}
          tooltipFormatter={(v) => `${v.toFixed(1)}만원`}
          tooltipLabel="누적수익"
        />
      </div>

      {/* 5. 바로투자 */}
      <h2
        className="text-base font-bold mb-3"
        style={{ color: 'var(--ko-text-primary)' }}
      >
        바로투자
      </h2>
      <div className="flex flex-col gap-2">
        {coins.map((c) => (
          <ListRow
            key={c.symbol}
            avatar={<span>{c.abbr}</span>}
            primary={c.name}
            secondary={c.symbol}
            value={c.price}
            valueSub={c.delta}
            valueTone={c.tone}
            trailing={
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 18l6-6-6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            onClick={() => {/* navigate to detail */}}
          />
        ))}
      </div>
    </div>
  );
}
