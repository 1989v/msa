import AuthButton from './AuthButton';
import { useResumeStatus } from '../hooks/useResumeStatus';
import { useHeritageTheme } from '../hooks/useHeritageSurface';
import './GNB.css';

/**
 * 테마 토글. K-Heritage 는 라이트(전통)와 다크(현대 엔지니어링)가 둘 다 일급이라
 * 어느 한쪽을 기본으로 숨기지 않고 사용자가 고르게 둔다.
 */
function ThemeToggle() {
  const [theme, toggle] = useHeritageTheme();
  return (
    <button
      type="button"
      className="gnb-theme-toggle"
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

export interface GNBItem {
  label: string;
  /** 같은 화면 안의 섹션으로 스크롤 */
  anchor?: string;
  /** 다른 화면으로 이동 */
  href?: string;
}

interface GNBProps {
  /** 로고 옆에 붙는 페이지 성격 (메인 / IT / 게임 …). 메인에서는 생략한다. */
  pageLabel?: string;
  items?: GNBItem[];
  onSearchFocus?: () => void;
}

/** IT(코드 사전) 화면의 기본 메뉴 */
const TECH_ITEMS: GNBItem[] = [
  { label: '테크', anchor: 'tech' },
  { label: '서비스 카탈로그', anchor: 'services' },
  { label: 'About', anchor: 'about' },
  { label: '홈', href: '/' },
];

export default function GNB({ pageLabel, items = TECH_ITEMS, onSearchFocus }: GNBProps) {
  // 구직 중일 때만 이력서 진입점을 띄운다 (ADR-0064)
  const resumeVisible = useResumeStatus();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="gnb">
      <div className="gnb-inner">
        <a className="gnb-logo" href="/">
          1989v
          {pageLabel && <span className="gnb-page-label">{pageLabel}</span>}
        </a>
        <ul className="gnb-menu">
          {items.map((item) => (
            <li key={item.label}>
              {item.href ? (
                <a className="gnb-menu-item" href={item.href}>
                  {item.label}
                </a>
              ) : (
                <button className="gnb-menu-item" onClick={() => scrollToSection(item.anchor!)}>
                  {item.label}
                </button>
              )}
            </li>
          ))}
          {resumeVisible && (
            <li>
              <a className="gnb-menu-item" href="https://resume.1989v.com">
                이력서
              </a>
            </li>
          )}
        </ul>
        <div className="gnb-right">
          <ThemeToggle />
          <AuthButton />
          {onSearchFocus && (
            <button className="gnb-search-btn" onClick={onSearchFocus} aria-label="검색">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
