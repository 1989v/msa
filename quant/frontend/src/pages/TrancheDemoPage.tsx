import { useState } from 'react';
import {
  Checkbox,
  KpiCard,
  PrimaryButton,
  SegmentControl,
  TrancheCard,
} from '@kgd/design-system';

/**
 * TrancheDemoPage — 샘플 1 (자동매매 상세) 정확 매칭 demo.
 *
 * 구성:
 *   1. 코인 헤더 (비트코인 / KRW-BTC · 빗썸 + 휴지통 아이콘)
 *   2. KpiCard row variant 2개 (현재가, 확정 손익)
 *   3. PrimaryButton danger full-width (정지 ⏸)
 *   4. Checkbox 2개 (자동매수 ON, 자동매도 ON)
 *   5. 메트릭 grid 2x2 (시작가/차수, 재시작 갭/예상 재시작 시작가)
 *   6. SegmentControl underline (진행중 / 완료)
 *   7. TrancheCard 4개 (1차~4차)
 */

type TabKey = 'progress' | 'done';

interface Tranche {
  no: string;
  buyPrice: string;
  sellPrice: string;
  qty: string;
  delta: string;
  badge: string;
  meta1: string;
  meta2: string;
}

const tranches: Tranche[] = [
  {
    no: '1차',
    buyPrice: '120,717,000',
    sellPrice: '120,958,434',
    qty: '0.002485',
    delta: '-0.68% (-2,038원)',
    badge: '보유중',
    meta1: '투자금 300,000원 · 매수 +0.2%',
    meta2: '체결: 120,717,000 · 현재가: 119,897,000원',
  },
  {
    no: '2차',
    buyPrice: '120,583,000',
    sellPrice: '120,703,582',
    qty: '0.000829',
    delta: '-0.57% (-569원)',
    badge: '보유중',
    meta1: '투자금 100,000원 · 매수 -0.1% · 매도 +0.1%',
    meta2: '체결: 120,583,000 · 현재가: 119,897,000원',
  },
  {
    no: '3차',
    buyPrice: '120,462,000',
    sellPrice: '120,582,461',
    qty: '0.000830',
    delta: '-0.47% (-469원)',
    badge: '보유중',
    meta1: '투자금 100,000원 · 매수 -0.1% · 매도 +0.1%',
    meta2: '체결: 120,462,000 · 현재가: 119,897,000원',
  },
  {
    no: '4차',
    buyPrice: '120,338,000',
    sellPrice: '120,458,337',
    qty: '0.000831',
    delta: '-0.37% (-366원)',
    badge: '보유중',
    meta1: '투자금 100,000원 · 매수 -0.1% · 매도 +0.1%',
    meta2: '체결: 120,338,000 · 현재가: 119,897,000원',
  },
];

export function TrancheDemoPage() {
  const [tab, setTab] = useState<TabKey>('progress');
  const [autoBuy, setAutoBuy] = useState(true);
  const [autoSell, setAutoSell] = useState(true);

  return (
    <div
      className="min-h-screen px-4 py-5 max-w-md mx-auto"
      style={{ background: 'var(--ko-surface-0)', color: 'var(--ko-text-primary)' }}
    >
      {/* 1. 코인 헤더 */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold">비트코인</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ko-text-muted)' }}>
            KRW-BTC · 빗썸
          </p>
        </div>
        <button
          aria-label="삭제"
          className="p-2"
          style={{
            color: 'var(--ko-status-loss)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <path
              d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* 2. 현재가 / 확정 손익 KPI (row layout) */}
      <div className="flex flex-col gap-2 mb-4">
        <KpiCard
          layout="row"
          label="현재가"
          value="119,897,000원"
          delta="-0.05%"
          deltaTone="loss"
        />
        <KpiCard
          layout="row"
          label="확정 손익"
          value="+72,503원"
          deltaTone="profit"
        />
      </div>

      {/* 3. 정지 버튼 (full-width danger) */}
      <div className="mb-4">
        <PrimaryButton
          tone="danger"
          size="lg"
          fullWidth
          leadingIcon={
            <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          }
        >
          정지
        </PrimaryButton>
      </div>

      {/* 4. 자동매수 / 자동매도 체크박스 */}
      <div className="flex items-center gap-6 mb-4">
        <Checkbox
          label="자동매수 ON"
          checked={autoBuy}
          onChange={(e) => setAutoBuy(e.target.checked)}
        />
        <Checkbox
          label="자동매도 ON"
          checked={autoSell}
          onChange={(e) => setAutoSell(e.target.checked)}
        />
      </div>

      {/* 5. 메트릭 grid 2x2 */}
      <div
        className="mb-5"
        style={{
          background: 'var(--ko-surface-1)',
          border: '1px solid var(--ko-border-subtle)',
          borderRadius: 'var(--ko-radius-lg)',
          padding: 'var(--ko-space-4) var(--ko-space-5)',
        }}
      >
        <div className="grid grid-cols-2 gap-y-4 gap-x-4">
          <Metric label="시작가" value="120,721,000원" />
          <Metric label="차수" value="52차수" />
          <Metric label="재시작 갭" value="0.1%" />
          <Metric label="예상 재시작 시작가" value="120,837,475원" />
        </div>
      </div>

      {/* 6. 진행중 / 완료 segment (underline) */}
      <div className="mb-3">
        <SegmentControl
          variant="underline"
          ariaLabel="회차 상태"
          options={[
            { value: 'progress', label: '진행중' },
            { value: 'done', label: '완료' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {/* 7. 회차 카드 리스트 */}
      <div className="flex flex-col gap-2">
        {tranches.map((t) => (
          <TrancheCard
            key={t.no}
            trancheLabel={t.no}
            delta={t.delta}
            deltaTone="loss"
            statusBadge={t.badge}
            buyPrice={t.buyPrice}
            sellPrice={t.sellPrice}
            quantity={t.qty}
            meta1={t.meta1}
            meta2={t.meta2}
          />
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: 'var(--ko-text-muted)' }}>
        {label}
      </span>
      <span className="text-base font-semibold tabular-nums">{value}</span>
    </div>
  );
}
