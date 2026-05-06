import type { ReactNode } from 'react';
import './KpiCard.css';

export interface KpiCardProps {
  /** 작은 라벨 텍스트 (예: "현재가", "오늘 매출") */
  label: ReactNode;
  /** 큰 KPI 값 (보통 숫자) */
  value: ReactNode;
  /** 우측 또는 하단 보조 메트릭 (예: "-0.05%", "+72,503원") */
  delta?: ReactNode;
  /** delta 의미적 분류 — 색상 결정 */
  deltaTone?: 'profit' | 'loss' | 'neutral';
  /** 좌측 아이콘 (선택) */
  icon?: ReactNode;
  /**
   * 레이아웃 — 'column' (default) 라벨 위, 값 아래 |
   * 'row' 라벨 좌, 값+delta 우 (샘플 1 자동매매 상세 패턴: "현재가 ··· 119,897,000원 -0.05%")
   */
  layout?: 'column' | 'row';
  /** 추가 CSS class */
  className?: string;
}

/**
 * KpiCard — 단일 메트릭 표시 카드.
 *
 * 디자인 출처: 샘플 1 (현재가/확정 손익), 샘플 2 (보유자산 평가액/누적수익).
 * - label 위, value 큰 글씨, delta 우측 또는 하단
 * - tabular-nums 강제 (자릿수 정렬)
 * - profit=녹색, loss=빨강, neutral=secondary
 */
export function KpiCard({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  icon,
  layout = 'column',
  className,
}: KpiCardProps) {
  const cls = `ko-kpi-card ko-kpi-card--${layout}${className ? ` ${className}` : ''}`;

  if (layout === 'row') {
    return (
      <div className={cls}>
        <span className="ko-kpi-card__label">
          {icon && <span className="ko-kpi-card__icon">{icon}</span>}
          {label}
        </span>
        <span className="ko-kpi-card__value-group">
          <span className="ko-kpi-card__value">{value}</span>
          {delta != null && (
            <span className={`ko-kpi-card__delta ko-kpi-card__delta--${deltaTone}`}>
              {delta}
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className={cls}>
      <div className="ko-kpi-card__header">
        {icon && <span className="ko-kpi-card__icon">{icon}</span>}
        <span className="ko-kpi-card__label">{label}</span>
      </div>
      <div className="ko-kpi-card__row">
        <span className="ko-kpi-card__value">{value}</span>
        {delta != null && (
          <span className={`ko-kpi-card__delta ko-kpi-card__delta--${deltaTone}`}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
