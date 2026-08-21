import type { ComponentType } from 'react';
import { Compass, Gamepad2, Heart, Home, LayoutGrid, Layers } from 'lucide-react';

/**
 * 모바일 앱 셸 — 호스트별 하단 탭 구성 (kh-motion-app-shell spec §4).
 *
 * 탭바는 뷰포트 < 768px 에서만 보인다 (kh-shell.css). 호스트 인식은
 * App.tsx / serviceHref.ts 와 같은 서브도메인 규칙을 쓴다.
 *
 * - apex: 홈·포트폴리오·내 찜·서비스 — 기술/샵은 상시 탭에서 내리고(약한 진입점)
 *   서비스 탐색 오버레이와 홈 타일 그리드가 받는다.
 * - blog: 홈·내 찜·서비스 — apex 탭을 그대로 내면 블로그 origin 아래로 다른 서비스
 *   화면이 새므로(cross-host) 자기 탭을 갖는다. 카테고리·스튜디오는 BlogShell 머리가 맡는다.
 * - game: 로비·장르·서비스 — 풀 내비게이션('1989v') 탭 대신 탐색 오버레이.
 * - resume / deal: 셸 없음 — 문서·단일 목록 성격에 탭바는 소음이다.
 * - place: 지역 드릴다운 착지 후 별도 적용 (spec §5).
 * - 게임 플레이 화면: 탭바 숨김 — 게임 rAF 와의 경합 + 몰입 면.
 */

export interface ShellTab {
  key: string;
  label: string;
  icon: ComponentType<{ size?: string | number; strokeWidth?: string | number }>;
  /** 내부 라우트 — Link(viewTransition) 이동 */
  to?: string;
  /** 호스트 간 — 풀 내비게이션 */
  href?: string;
  /** 눌렀을 때 여는 시트 — genres: 게임 장르 목록 / explorer: 서비스 탐색 오버레이 */
  sheet?: 'genres' | 'explorer';
  /** 활성 판정 */
  isActive: (pathname: string) => boolean;
}

/* 탭 간 이동은 push 스택 전환이 아니라 cross-fade 다 — 클릭 시 1회성 표식을 남기고
 * AppShellChrome 이 방향 판정 때 소비한다. */
let tabNav = false;

export function markTabNav() {
  tabNav = true;
}

export function consumeTabNav(): boolean {
  const was = tabNav;
  tabNav = false;
  return was;
}

/** 서비스 탐색 탭 — 어느 호스트에서든 같은 오버레이를 연다 (하드 내비게이션 없음) */
const EXPLORER_TAB: ShellTab = {
  key: 'services',
  label: '서비스',
  icon: Compass,
  sheet: 'explorer',
  isActive: () => false,
};

const FAVORITES_TAB: ShellTab = {
  key: 'favorites',
  label: '내 찜',
  icon: Heart,
  to: '/favorites',
  isActive: (p) => p === '/favorites' || p === '/en/favorites',
};

const APEX_TABS: ShellTab[] = [
  {
    key: 'home',
    label: '홈',
    icon: Home,
    to: '/',
    isActive: (p) => p === '/' || p === '/en',
  },
  {
    key: 'portfolio',
    label: '포트폴리오',
    icon: Layers,
    to: '/portfolio',
    isActive: (p) => p.startsWith('/portfolio'),
  },
  FAVORITES_TAB,
  EXPLORER_TAB,
];

const GAME_TABS: ShellTab[] = [
  {
    key: 'lobby',
    label: '로비',
    icon: Gamepad2,
    to: '/',
    isActive: (p) =>
      p === '/' || p === '/en' || (p.includes('/games') && !p.includes('/games/genre/')),
  },
  {
    key: 'genres',
    label: '장르',
    icon: LayoutGrid,
    sheet: 'genres',
    isActive: (p) => /\/games\/genre\//.test(p),
  },
  // '1989v' 풀 내비게이션 탭이 있던 자리 — 오버레이가 본진(1989v 홈) 행을 품으므로
  // 컨텍스트를 버리는 하드 이동 없이 같은 목적지를 전부 커버한다.
  EXPLORER_TAB,
];

const BLOG_TABS: ShellTab[] = [
  {
    key: 'home',
    label: '홈',
    icon: Home,
    to: '/',
    isActive: (p) => p === '/',
  },
  FAVORITES_TAB,
  EXPLORER_TAB,
];

/** 게임 플레이 화면 — 허브(/games)·장르(/games/genre/*)가 아닌 /games/{slug} */
const GAME_PLAY_PATH = /^\/(en\/)?games\/(?!genre\/)[^/]+\/?$/;

export function shellTabsFor(hostname: string, pathname: string): ShellTab[] | null {
  if (GAME_PLAY_PATH.test(pathname)) return null;
  // 로그인·OAuth 콜백 — 일회성 중단 화면이라 탭바가 목적을 흐린다 (게임 플레이와 같은
  // 몰입 판정). 나가는 길은 LoginShell 의 로고·푸터 서비스 탐색이 이미 제공한다.
  // `/login` 은 blog 호스트에만 라우트가 있어 다른 호스트에선 무해하다.
  if (pathname === '/shop/login' || pathname === '/login' || pathname === '/oauth/callback') return null;

  const sub = hostname.split('.')[0];
  if (sub === 'resume' || sub === 'deal' || sub === 'place') return null;
  if (sub === 'game') return GAME_TABS;
  if (sub === 'blog') return BLOG_TABS;
  return APEX_TABS;
}
