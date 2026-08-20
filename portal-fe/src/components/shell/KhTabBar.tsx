import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { markTabNav, shellTabsFor } from '../../shell/appShell';
import KhSheet from './KhSheet';
import {
  GENRE_LABELS_EN,
  GENRE_LABELS_KO,
  gamePath,
  genreSlug,
} from '../../seo/copy.mjs';

/**
 * 하단 탭바 — 모바일 주 이동 축 (kh-motion-app-shell spec §4).
 *
 * 항상 렌더하고 노출은 CSS 가 결정한다 (< 768px 만). 탭 구성은 호스트별로
 * appShell.tsx 에 선언돼 있고, 구성이 없는 호스트(resume/deal/place)와
 * 게임 플레이 화면에서는 아예 그리지 않는다.
 *
 * 탭 간 이동은 push 가 아니라 cross-fade 다 — markTabNav 가 방향 판정을
 * 'tab' 으로 돌려 스택 전환 애니메이션을 비껴간다.
 */
export default function KhTabBar() {
  const { pathname } = useLocation();
  const [genresOpen, setGenresOpen] = useState(false);
  const tabs = shellTabsFor(window.location.hostname, pathname);
  const active = tabs !== null;

  // 탭바가 있을 때만 본문 하단 여백을 연다 (kh-shell.css 의 data-tabbar 규칙)
  useEffect(() => {
    if (active) document.documentElement.dataset.tabbar = 'on';
    else delete document.documentElement.dataset.tabbar;
    return () => {
      delete document.documentElement.dataset.tabbar;
    };
  }, [active]);

  if (!tabs) return null;

  const lang = pathname.startsWith('/en') ? 'en' : 'ko';
  const genreEntries = Object.entries(
    lang === 'en' ? GENRE_LABELS_EN : GENRE_LABELS_KO,
  ) as [string, string][];

  return (
    <>
      <nav className="kh-tabbar" aria-label={lang === 'en' ? 'Primary' : '주 메뉴'}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.isActive(pathname);
          const cls = `kh-tabbar-item${isActive ? ' is-active' : ''}`;
          const body = (
            <>
              <Icon size={20} strokeWidth={1.75} />
              <span>{tab.label}</span>
            </>
          );
          if (tab.sheet) {
            return (
              <button
                key={tab.key}
                type="button"
                className={cls}
                aria-haspopup="dialog"
                onClick={() => setGenresOpen(true)}
              >
                {body}
              </button>
            );
          }
          if (tab.href) {
            return (
              <a key={tab.key} className={cls} href={tab.href}>
                {body}
              </a>
            );
          }
          return (
            <Link
              key={tab.key}
              className={cls}
              to={tab.to!}
              viewTransition
              onClick={markTabNav}
              aria-current={isActive ? 'page' : undefined}
            >
              {body}
            </Link>
          );
        })}
      </nav>

      {genresOpen && (
        <KhSheet
          label={lang === 'en' ? 'Genres' : '장르'}
          onClose={() => setGenresOpen(false)}
        >
          <ul className="kh-genre-list">
            {genreEntries.map(([genre, label]) => (
              <li key={genre}>
                <Link
                  to={gamePath(lang, `/games/genre/${genreSlug(genre)}`)}
                  viewTransition
                  onClick={() => {
                    markTabNav();
                    setGenresOpen(false);
                  }}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </KhSheet>
      )}
    </>
  );
}
