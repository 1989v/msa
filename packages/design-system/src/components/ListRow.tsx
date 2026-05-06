import type { KeyboardEvent, ReactNode } from 'react';
import './ListRow.css';

export interface ListRowProps {
  /** 좌측 원형 아바타 (이니셜 텍스트 또는 아이콘) */
  avatar?: ReactNode;
  /** 메인 라벨 (예: "Bitcoin", "1차") */
  primary: ReactNode;
  /** 보조 라벨 (예: "BTC", "매수가 120,717,000") */
  secondary?: ReactNode;
  /** 우측 큰 값 (예: "119,916,000원", "-0.68%") */
  value?: ReactNode;
  /** 우측 보조 값 (예: "-0.04%", "수량 0.002485") */
  valueSub?: ReactNode;
  /** value/valueSub 색상 분류 */
  valueTone?: 'profit' | 'loss' | 'neutral';
  /** chevron / arrow 아이콘 표시 (외부 link 등) */
  trailing?: ReactNode;
  /** 클릭 콜백 — 있으면 전체 row 가 button-like */
  onClick?: () => void;
  /** href 가 있으면 anchor 처럼 렌더 */
  href?: string;
  className?: string;
}

/**
 * ListRow — 카드형 리스트 row.
 *
 * 샘플 1 의 회차별 리스트 + 샘플 2 의 종목 리스트(아바타 + 이름 + 가격) 통합 패턴.
 * - 좌측 avatar (선택), 좌측 primary/secondary 텍스트
 * - 우측 value/valueSub (수익/손실 톤)
 * - 우측 trailing (chevron) 선택
 * - onClick / href 시 hover/focus 스타일 + a11y
 */
export function ListRow({
  avatar,
  primary,
  secondary,
  value,
  valueSub,
  valueTone = 'neutral',
  trailing,
  onClick,
  href,
  className,
}: ListRowProps) {
  const interactive = Boolean(onClick || href);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const content = (
    <>
      {avatar && <div className="ko-list-row__avatar">{avatar}</div>}
      <div className="ko-list-row__text">
        <div className="ko-list-row__primary">{primary}</div>
        {secondary && <div className="ko-list-row__secondary">{secondary}</div>}
      </div>
      {(value != null || valueSub != null) && (
        <div className={`ko-list-row__value ko-list-row__value--${valueTone}`}>
          {value != null && <div className="ko-list-row__value-main">{value}</div>}
          {valueSub != null && <div className="ko-list-row__value-sub">{valueSub}</div>}
        </div>
      )}
      {trailing && <div className="ko-list-row__trailing">{trailing}</div>}
    </>
  );

  const cls = `ko-list-row${interactive ? ' ko-list-row--interactive' : ''}${className ? ` ${className}` : ''}`;

  if (href) {
    return (
      <a className={cls} href={href}>
        {content}
      </a>
    );
  }

  if (onClick) {
    return (
      <div
        className={cls}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
      >
        {content}
      </div>
    );
  }

  return <div className={cls}>{content}</div>;
}
