import type { InputHTMLAttributes, ReactNode } from 'react';
import './Checkbox.css';

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  /** 라벨 텍스트 (예: "자동매수 ON") */
  label: ReactNode;
  /** 라벨 색상 분류 */
  tone?: 'neutral' | 'profit' | 'loss';
}

/**
 * Checkbox — 라벨 우측 체크박스 토글.
 *
 * 샘플 1 의 "자동매수 ON" / "자동매도 ON" 패턴.
 * 파란 사각 체크박스 + 라벨 우측 가로 정렬.
 */
export function Checkbox({ label, tone = 'neutral', className, id, ...rest }: CheckboxProps) {
  // 자동 id (no id → label 클릭 정상 작동 위해 random)
  const inputId = id ?? `ko-cb-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <label
      htmlFor={inputId}
      className={`ko-checkbox ko-checkbox--${tone}${className ? ` ${className}` : ''}`}
    >
      <input id={inputId} type="checkbox" className="ko-checkbox__input" {...rest} />
      <span className="ko-checkbox__box" aria-hidden="true">
        <svg viewBox="0 0 16 16" className="ko-checkbox__check">
          <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="ko-checkbox__label">{label}</span>
    </label>
  );
}
