import type { ComponentType } from 'react';
import { Braces, Gamepad2, Home, LayoutGrid, Layers, ShoppingBag } from 'lucide-react';

/**
 * 모바일 앱 셸 — 호스트별 하단 탭 구성 (kh-motion-app-shell spec §4).
 *
 * 탭바는 뷰포트 < 768px 에서만 보인다 (kh-shell.css). 호스트 인식은
 * App.tsx / serviceHref.ts 와 같은 서브도메인 규칙을 쓴다.
 *
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
  /** 눌렀을 때 여는 시트 */
  sheet?: 'genres';
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

const APEX_TABS: ShellTab[] = [
  {
    key: 'home',
    label: '홈',
    icon: Home,
    to: '/',
    isActive: (p) => p === '/' || p === '/en',
  },
  {
    key: 'tech',
    label: '기술',
    icon: Braces,
    to: '/tech',
    isActive: (p) => p.startsWith('/tech'),
  },
  {
    key: 'portfolio',
    label: '포트폴리오',
    icon: Layers,
    to: '/portfolio',
    isActive: (p) => p.startsWith('/portfolio'),
  },
  {
    key: 'shop',
    label: '샵',
    icon: ShoppingBag,
    to: '/shop',
    isActive: (p) => p.startsWith('/shop'),
  },
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
  {
    key: 'main',
    label: '1989v',
    icon: Home,
    href: 'https://1989v.com',
    isActive: () => false,
  },
];

/** 게임 플레이 화면 — 허브(/games)·장르(/games/genre/*)가 아닌 /games/{slug} */
const GAME_PLAY_PATH = /^\/(en\/)?games\/(?!genre\/)[^/]+\/?$/;

export function shellTabsFor(hostname: string, pathname: string): ShellTab[] | null {
  if (GAME_PLAY_PATH.test(pathname)) return null;

  const sub = hostname.split('.')[0];
  if (sub === 'resume' || sub === 'deal' || sub === 'place') return null;
  if (sub === 'game') return GAME_TABS;
  return APEX_TABS;
}
