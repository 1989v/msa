import type { MouseEvent } from 'react';
import { useHeritageTheme } from '../hooks/useHeritageSurface';

/**
 * 테마 토글. K-Heritage 는 라이트(전통)와 다크(현대 엔지니어링)가 둘 다 일급이라
 * 어느 한쪽을 기본으로 숨기지 않고 사용자가 고르게 둔다.
 *
 * GNB 밖에서도 쓴다 — place/game/resume 은 각각 자기 호스트의 첫 화면인데 GNB 가 없어서,
 * 토글이 GNB 안에만 있으면 그 화면들은 기기 시스템 설정에 갇힌다.
 *
 * 전환은 먹이 번지듯 — 누른 자리에서 새 정경이 원으로 번져 나온다 (View Transitions API).
 * 미지원 브라우저·reduced-motion 이면 즉시 바뀐다. 색 변화만 있고 레이아웃은 그대로라
 * 스냅샷 두 장 사이의 clip-path 하나로 끝난다 (k-heritage.css 의 data-theme-wipe).
 */
export default function ThemeToggle({ className = 'kh-theme-toggle' }: { className?: string }) {
  const [theme, toggle] = useHeritageTheme();

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    const root = document.documentElement;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof document.startViewTransition !== 'function' || root.hasAttribute('data-theme-wipe')) {
      toggle();
      return;
    }
    const x = e.clientX || window.innerWidth - 40;
    const y = e.clientY || 32;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.setAttribute('data-theme-wipe', '');
    const transition = document.startViewTransition(() => toggle());
    transition.ready
      .then(() =>
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 720, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
        ),
      )
      .catch(() => undefined);
    void transition.finished.finally(() => root.removeAttribute('data-theme-wipe'));
  };

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
