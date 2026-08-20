import AuthButton from './AuthButton';
import { useResumeStatus } from '../hooks/useResumeStatus';
import { useScrollDirection } from '../hooks/useScrollDirection';
import ThemeToggle from './ThemeToggle';
import './GNB.css';

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
  // 모바일 앱 셸 — 아래로 스크롤하면 머리띠가 접힌다 (CSS 가 모바일에서만 적용)
  const collapsed = useScrollDirection();

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className={`gnb${collapsed ? ' gnb--collapsed' : ''}`}>
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
