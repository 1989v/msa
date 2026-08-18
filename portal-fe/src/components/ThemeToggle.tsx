import { useHeritageTheme } from '../hooks/useHeritageSurface';

/**
 * 테마 토글. K-Heritage 는 라이트(전통)와 다크(현대 엔지니어링)가 둘 다 일급이라
 * 어느 한쪽을 기본으로 숨기지 않고 사용자가 고르게 둔다.
 *
 * GNB 밖에서도 쓴다 — place/game/resume 은 각각 자기 호스트의 첫 화면인데 GNB 가 없어서,
 * 토글이 GNB 안에만 있으면 그 화면들은 기기 시스템 설정에 갇힌다.
 */
export default function ThemeToggle({ className = 'kh-theme-toggle' }: { className?: string }) {
  const [theme, toggle] = useHeritageTheme();
  return (
    <button
      type="button"
      className={className}
      onClick={toggle}
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
