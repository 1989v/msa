import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthButton from './AuthButton';
import KhSheet from './shell/KhSheet';
import ServiceExplorer from './chrome/ServiceExplorer';
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
  // 모바일(< 768px)에서는 메뉴·토글·로그인이 전부 서랍으로 들어간다 — 좁은 폭에서
  // 로그인 칩이 머리띠 밖으로 밀려 나가던 가로 오버플로의 근본 수술이다.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const menuItems = [
    ...items,
    ...(resumeVisible ? [{ label: '이력서', href: 'https://resume.1989v.com' }] : []),
  ];

  return (
    <nav className={`gnb${collapsed ? ' gnb--collapsed' : ''}`}>
      <div className="gnb-inner">
        <a className="gnb-logo" href="/">
          1989v
          {pageLabel && <span className="gnb-page-label">{pageLabel}</span>}
        </a>
        <ul className="gnb-menu">
          {menuItems.map((item) => (
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
        <button
          type="button"
          className="gnb-hamburger"
          aria-label="메뉴"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
      </div>

      {/* 서랍은 바텀시트다 — 모바일 다이얼로그는 시트 하나로 통일돼 있고(장르·지역·상세),
          상단 고정 패널은 접히는 머리띠(transform)에 기준점이 걸려 스크롤과 함께 흔들린다. */}
      {drawerOpen && (
        <KhSheet label="메뉴" onClose={() => setDrawerOpen(false)}>
          <ul className="gnb-drawer-list">
            {menuItems.map((item) => (
              <li key={item.label}>
                {item.href ? (
                  <a className="gnb-drawer-item" href={item.href}>
                    {item.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    className="gnb-drawer-item"
                    onClick={() => {
                      setDrawerOpen(false);
                      scrollToSection(item.anchor!);
                    }}
                  >
                    {item.label}
                  </button>
                )}
              </li>
            ))}
            {onSearchFocus && (
              <li>
                <button
                  type="button"
                  className="gnb-drawer-item"
                  onClick={() => {
                    setDrawerOpen(false);
                    onSearchFocus();
                  }}
                >
                  검색
                </button>
              </li>
            )}
            <li>
              <Link className="gnb-drawer-item" to="/favorites" onClick={() => setDrawerOpen(false)}>
                내 찜
              </Link>
            </li>
            <li>
              <button
                type="button"
                className="gnb-drawer-item"
                aria-haspopup="dialog"
                onClick={() => {
                  setDrawerOpen(false);
                  setExplorerOpen(true);
                }}
              >
                서비스 탐색
              </button>
            </li>
          </ul>
          <div className="gnb-drawer-actions">
            <ThemeToggle />
            <AuthButton />
          </div>
        </KhSheet>
      )}

      {explorerOpen && <ServiceExplorer onClose={() => setExplorerOpen(false)} />}
    </nav>
  );
}
