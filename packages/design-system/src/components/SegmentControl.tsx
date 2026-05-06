import type { ReactNode } from 'react';
import './SegmentControl.css';

export interface SegmentOption<V extends string> {
  value: V;
  label: ReactNode;
  /** 보조 카운트 표시 (예: "12") */
  count?: ReactNode;
}

export interface SegmentControlProps<V extends string> {
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** 시각 변형 — 'pill' (둥근 알약, 샘플 2 빗썸/업비트) / 'underline' (탭 underline, 샘플 1 진행중/완료) */
  variant?: 'pill' | 'underline';
  /** 접근성 라벨 */
  ariaLabel?: string;
  className?: string;
}

/**
 * SegmentControl — 2~N 개 선택지 segment.
 *
 * 샘플 1 의 "진행중/완료" 탭 (underline) + 샘플 2 의 "빗썸/업비트" segment (pill) 통합.
 * - role="tablist" + role="tab" + aria-selected
 * - keyboard navigation (Arrow Left/Right)
 */
export function SegmentControl<V extends string>({
  options,
  value,
  onChange,
  variant = 'pill',
  ariaLabel,
  className,
}: SegmentControlProps<V>) {
  const cls = `ko-segment ko-segment--${variant}${className ? ` ${className}` : ''}`;

  const handleKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next =
      e.key === 'ArrowRight'
        ? (idx + 1) % options.length
        : (idx - 1 + options.length) % options.length;
    onChange(options[next].value);
    // focus next button
    const btns = (e.currentTarget.parentElement?.querySelectorAll(
      '[role="tab"]',
    ) ?? []) as NodeListOf<HTMLButtonElement>;
    btns[next]?.focus();
  };

  return (
    <div className={cls} role="tablist" aria-label={ariaLabel}>
      {options.map((opt, idx) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={`ko-segment__btn${active ? ' ko-segment__btn--active' : ''}`}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKey(e, idx)}
          >
            <span>{opt.label}</span>
            {opt.count != null && <span className="ko-segment__count">{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
