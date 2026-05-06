import type { ReactNode } from 'react';
import './TrancheCard.css';

export interface TrancheCardProps {
  /** 회차 번호 표시 (예: "1차", "2차") */
  trancheLabel: ReactNode;
  /** 우측 상단 등락률 표시 (예: "-0.68% (-2,038원)") */
  delta?: ReactNode;
  /** 등락률 색상 분류 */
  deltaTone?: 'profit' | 'loss' | 'neutral';
  /** 우측 상단 상태 배지 (예: "보유중", "익절") */
  statusBadge?: ReactNode;
  /** 매수가 */
  buyPrice: ReactNode;
  /** 매도가 (목표가) */
  sellPrice: ReactNode;
  /** 보유 수량 */
  quantity: ReactNode;
  /** 하단 보조 정보 1줄 (예: "투자금 300,000원 · 매수 +0.2% · 매도 +0.1%") */
  meta1?: ReactNode;
  /** 하단 보조 정보 2줄 (예: "체결: 120,717,000 · 현재가: 119,897,000원") */
  meta2?: ReactNode;
  /** 클릭 핸들러 */
  onClick?: () => void;
  className?: string;
}

/**
 * TrancheCard — 분할매매 회차별 카드.
 *
 * 샘플 1 (자동매매 상세) 의 회차 리스트 패턴 정확 재현:
 *   ┌──────────────────────────────────────┐
 *   │ 1차          -0.68% (-2,038원)  보유중│
 *   │                                       │
 *   │ 매수가  매도가  수량                  │
 *   │ 120,717,000  120,958,434  0.002485    │
 *   │                                       │
 *   │ 투자금 300,000원 · 매수 +0.2%         │
 *   │ 체결: 120,717,000 · 현재가: 119,897... │
 *   └──────────────────────────────────────┘
 */
export function TrancheCard({
  trancheLabel,
  delta,
  deltaTone = 'neutral',
  statusBadge,
  buyPrice,
  sellPrice,
  quantity,
  meta1,
  meta2,
  onClick,
  className,
}: TrancheCardProps) {
  const cls = `ko-tranche-card${onClick ? ' ko-tranche-card--interactive' : ''}${
    className ? ` ${className}` : ''
  }`;

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={cls}
      onClick={onClick}
      onKeyDown={handleKey}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <header className="ko-tranche-card__header">
        <span className="ko-tranche-card__label">{trancheLabel}</span>
        <div className="ko-tranche-card__header-right">
          {delta && (
            <span className={`ko-tranche-card__delta ko-tranche-card__delta--${deltaTone}`}>
              {delta}
            </span>
          )}
          {statusBadge && <span className="ko-tranche-card__badge">{statusBadge}</span>}
        </div>
      </header>

      <div className="ko-tranche-card__grid">
        <div className="ko-tranche-card__field">
          <span className="ko-tranche-card__field-label">매수가</span>
          <span className="ko-tranche-card__field-value">{buyPrice}</span>
        </div>
        <div className="ko-tranche-card__field">
          <span className="ko-tranche-card__field-label">매도가</span>
          <span className="ko-tranche-card__field-value">{sellPrice}</span>
        </div>
        <div className="ko-tranche-card__field">
          <span className="ko-tranche-card__field-label">수량</span>
          <span className="ko-tranche-card__field-value">{quantity}</span>
        </div>
      </div>

      {(meta1 || meta2) && (
        <div className="ko-tranche-card__meta">
          {meta1 && <div>{meta1}</div>}
          {meta2 && <div>{meta2}</div>}
        </div>
      )}
    </div>
  );
}
