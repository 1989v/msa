import type { ReactNode } from 'react';
import './StatCard.css';

export interface StatCardProps {
  /** 카드 헤더 (예: "보유자산 평가액", "누적수익") */
  title: ReactNode;
  /** 우측 헤더 보조 (예: "평가손익 -976원") */
  meta?: ReactNode;
  /** 메인 메트릭 (큰 숫자) */
  primary: ReactNode;
  /** 메인 메트릭 의미 (profit/loss/neutral) */
  primaryTone?: 'profit' | 'loss' | 'neutral';
  /** 하단 보조 정보 row (예: "예수금 2,008,529원", "거래금액 70,185,658원") */
  footer?: ReactNode;
  /** 차트 / 추가 컨텐츠 슬롯 */
  children?: ReactNode;
  className?: string;
}

/**
 * StatCard — 헤더 + 큰 메트릭 + footer + 차트/콘텐츠 슬롯.
 *
 * 샘플 2 의 "보유자산 평가액" / "누적수익" 카드 패턴을 직접 구현.
 * KpiCard 보다 공간을 더 차지하며, 차트나 보조 row 를 추가 렌더 가능.
 */
export function StatCard({
  title,
  meta,
  primary,
  primaryTone = 'neutral',
  footer,
  children,
  className,
}: StatCardProps) {
  return (
    <div className={`ko-stat-card${className ? ` ${className}` : ''}`}>
      <header className="ko-stat-card__header">
        <span className="ko-stat-card__title">{title}</span>
        {meta && <span className="ko-stat-card__meta">{meta}</span>}
      </header>

      <div className={`ko-stat-card__primary ko-stat-card__primary--${primaryTone}`}>
        {primary}
      </div>

      {footer && <div className="ko-stat-card__footer">{footer}</div>}
      {children && <div className="ko-stat-card__body">{children}</div>}
    </div>
  );
}
