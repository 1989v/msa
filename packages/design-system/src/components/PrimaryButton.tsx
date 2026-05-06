import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './PrimaryButton.css';

export interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** 시각 분류 — 'primary' (파랑) / 'danger' (빨강, 정지/삭제) / 'subtle' (회색) */
  tone?: 'primary' | 'danger' | 'subtle';
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** full-width (샘플 1 의 정지 버튼 패턴) */
  fullWidth?: boolean;
  /** 좌측 아이콘 슬롯 */
  leadingIcon?: ReactNode;
  /** 우측 아이콘 슬롯 */
  trailingIcon?: ReactNode;
}

/**
 * PrimaryButton — CTA 버튼.
 *
 * 샘플 1 의 full-width 빨강 "정지" 버튼 + 일반 액션 버튼 통합.
 * - 3 가지 tone, 3 가지 size, fullWidth 옵션
 * - 좌/우 아이콘 슬롯
 * - disabled 상태 + focus-visible 링
 */
export function PrimaryButton({
  children,
  tone = 'primary',
  size = 'md',
  fullWidth,
  leadingIcon,
  trailingIcon,
  className,
  type,
  ...rest
}: PrimaryButtonProps) {
  const cls = [
    'ko-btn',
    `ko-btn--${tone}`,
    `ko-btn--${size}`,
    fullWidth ? 'ko-btn--full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type ?? 'button'} className={cls} {...rest}>
      {leadingIcon && <span className="ko-btn__icon">{leadingIcon}</span>}
      <span>{children}</span>
      {trailingIcon && <span className="ko-btn__icon">{trailingIcon}</span>}
    </button>
  );
}
