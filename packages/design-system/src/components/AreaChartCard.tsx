import type { ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './AreaChartCard.css';

export interface AreaPoint {
  /** X 축 라벨 (예: "4/17", "Mon") */
  x: string;
  /** Y 값 */
  y: number;
}

export interface AreaChartCardProps {
  /** 카드 타이틀 (예: "누적수익 그래프") */
  title?: ReactNode;
  /** 우측 헤더 메타 정보 (예: "+9.3만원" 또는 small caption) */
  meta?: ReactNode;
  /** 차트 데이터 */
  data: AreaPoint[];
  /** 색상 톤 — profit (녹색) / loss (빨강) / neutral (보조 색) */
  tone?: 'profit' | 'loss' | 'neutral';
  /** 차트 높이 (기본 200px) */
  height?: number;
  /** Y 축 라벨 포매터 (예: v => `${v}만`) */
  yFormatter?: (value: number) => string;
  /** Tooltip 값 포매터 (예: v => `${v.toFixed(1)}만원`) */
  tooltipFormatter?: (value: number) => string;
  /** Tooltip 라벨 (예: '누적수익') */
  tooltipLabel?: string;
  /** 카드 wrapper 비활성화 — 다른 카드 안에 임베드 시 사용 */
  bare?: boolean;
  /** 추가 CSS class */
  className?: string;
  /** 빈 데이터 상태 */
  emptyMessage?: ReactNode;
}

/**
 * AreaChartCard — sample 2 (포트폴리오 누적수익 그래프) 정확 매칭.
 *
 * 시각 특성:
 *  - 다크 카드 배경 위에 녹색 그라디언트 area
 *  - 미니멀 axes (tick line / axis line 제거, 작은 글씨)
 *  - tabular-nums tooltip
 *  - profit/loss/neutral 톤별 자동 색 분기
 *
 * 사용 예:
 * ```tsx
 * <AreaChartCard
 *   title="누적수익 그래프"
 *   meta="+9.3만원"
 *   data={[{x:'4/17',y:0}, {x:'4/19',y:1.2}, ...]}
 *   tone="profit"
 *   yFormatter={v => `${v}만`}
 *   tooltipFormatter={v => `${v.toFixed(1)}만원`}
 * />
 * ```
 */
export function AreaChartCard({
  title,
  meta,
  data,
  tone = 'profit',
  height = 200,
  yFormatter,
  tooltipFormatter,
  tooltipLabel,
  bare = false,
  className,
  emptyMessage,
}: AreaChartCardProps) {
  const toneColor =
    tone === 'profit'
      ? 'oklch(0.72 0.19 145)'
      : tone === 'loss'
        ? 'oklch(0.65 0.22 25)'
        : 'oklch(0.68 0.16 245)';
  const gradId = `ko-area-grad-${tone}`;

  const empty = !data || data.length === 0;

  const chart = (
    <div className="ko-areachart__canvas" style={{ height }}>
      {empty ? (
        <div className="ko-areachart__empty">{emptyMessage ?? '데이터 없음'}</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={toneColor} stopOpacity={0.45} />
                <stop offset="100%" stopColor={toneColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="x"
              stroke="var(--ko-text-muted)"
              tick={{ fontSize: 11, fill: 'var(--ko-text-muted)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--ko-text-muted)"
              tick={{ fontSize: 11, fill: 'var(--ko-text-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={yFormatter}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--ko-surface-2)',
                border: '1px solid var(--ko-border-subtle)',
                borderRadius: 'var(--ko-radius-md)',
                color: 'var(--ko-text-primary)',
                fontSize: 12,
                fontVariantNumeric: 'tabular-nums',
              }}
              labelStyle={{ color: 'var(--ko-text-muted)', fontSize: 11 }}
              formatter={(v) => {
                const num = typeof v === 'number' ? v : Number(v);
                const display = tooltipFormatter && Number.isFinite(num) ? tooltipFormatter(num) : String(v);
                return [display, tooltipLabel ?? ''];
              }}
            />
            <Area
              type="monotone"
              dataKey="y"
              stroke={toneColor}
              strokeWidth={2.5}
              fill={`url(#${gradId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  if (bare) {
    return <div className={`ko-areachart${className ? ` ${className}` : ''}`}>{chart}</div>;
  }

  return (
    <div className={`ko-areachart ko-areachart--card${className ? ` ${className}` : ''}`}>
      {(title || meta) && (
        <header className="ko-areachart__header">
          {title && <span className="ko-areachart__title">{title}</span>}
          {meta && (
            <span className={`ko-areachart__meta ko-areachart__meta--${tone}`}>{meta}</span>
          )}
        </header>
      )}
      {chart}
    </div>
  );
}
