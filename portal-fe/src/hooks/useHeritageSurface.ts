import { useCallback, useEffect, useState } from 'react';

/**
 * K-Heritage 표면 (DESIGN.md §12).
 *
 * 라이트(전통)와 다크(현대 엔지니어링)가 **둘 다 일급**이다. 한쪽이 기본이고 다른 쪽이
 * 파생인 구조가 아니라서, 사용자 선택을 저장하고 없으면 시스템 설정을 따른다.
 *
 * 토큰은 `:root` 에 건다 — 페이지 컨테이너에만 걸면 오버스크롤 여백과 `body` 배경이
 * 어긋난다.
 *
 * 참조 카운트를 쓰는 이유: 라우트 전환에서 새 화면이 먼저 mount 되고 이전 화면의
 * cleanup 이 나중에 도는 순서가 나올 수 있다. 그때 단순 해제를 하면 방금 켠 표면이
 * 꺼져 깜빡인다. 마지막 사용자가 나갈 때만 되돌린다.
 */

const STORAGE_KEY = 'kh-theme';

export type HeritageTheme = 'light' | 'dark';

let activeCount = 0;
const listeners = new Set<(theme: HeritageTheme) => void>();

/**
 * 서브도메인이 각각 다른 오리진이라 localStorage 로는 선택이 건너가지 않는다
 * (`1989v.com` 에서 고른 톤이 `place.1989v.com` 에 없어 시스템 설정으로 떨어졌다).
 * 등록 도메인에 건 쿠키는 서브도메인이 함께 읽는다. apex 에서도 host-only 로 두면
 * 서브도메인이 못 받으므로 항상 `.` 를 붙인다.
 */
function cookieDomain(): string {
  const host = window.location.hostname;
  if (host === 'localhost' || /^\d+(\.\d+){3}$/.test(host)) return '';
  const parts = host.split('.');
  return parts.length >= 2 ? `; domain=.${parts.slice(-2).join('.')}` : '';
}

function readCookie(): HeritageTheme | null {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${STORAGE_KEY}=`));
  const value = hit?.slice(STORAGE_KEY.length + 1);
  return value === 'light' || value === 'dark' ? value : null;
}

function readLocal(): HeritageTheme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // 사파리 프라이빗 모드 등에서 localStorage 접근이 막힌다. 시스템 설정으로 떨어진다.
    return null;
  }
}

function storedTheme(): HeritageTheme | null {
  // 쿠키 도입 전 방문자의 선택이 localStorage 에 남아 있다. 쿠키가 막힌 환경의 대비책이기도 하다.
  return readCookie() ?? readLocal();
}

function storeTheme(theme: HeritageTheme) {
  // 1년. Lax 면 서브도메인 간 일반 이동에서 전송된다.
  document.cookie =
    `${STORAGE_KEY}=${theme}; path=/; max-age=31536000; SameSite=Lax${cookieDomain()}`;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장이 막혀도 이번 세션 동안은 바뀐 채로 쓸 수 있어야 한다.
  }
}

function systemTheme(): HeritageTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(): HeritageTheme {
  return storedTheme() ?? systemTheme();
}

/** 모바일 브라우저 주소창 색. 톤을 바꿔도 여기가 그대로면 위쪽 띠만 반대 톤으로 남는다. */
function applyThemeColor(theme: HeritageTheme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', theme === 'dark' ? '#131313' : '#f9f8f2');
}

function applyTheme(theme: HeritageTheme) {
  document.documentElement.setAttribute('data-theme', theme);
  applyThemeColor(theme);
  listeners.forEach((notify) => notify(theme));
}

/** 브랜드 면이 아닌 유일한 화면(`/tech`)은 dark-trading 팔레트를 전제로 그려진다. */
const NON_HERITAGE_PATHS = new Set(['/tech']);

/**
 * 첫 페인트부터 고른 톤으로 칠한다 — 훅은 effect 에서 돌기 때문에 그 전에 한 번
 * 칠해두지 않으면 라이트를 고른 사람도 매번 다크가 번쩍인 뒤 바뀐다.
 */
export function bootstrapTheme(pathname: string) {
  const root = document.documentElement;
  if (NON_HERITAGE_PATHS.has(pathname)) {
    root.setAttribute('data-theme', 'dark');
    return;
  }
  root.setAttribute('data-surface', 'heritage');
  const theme = resolveTheme();
  // 쿠키 도입 전 선택은 이 오리진에만 있다. 다시 토글하지 않으면 서브도메인은 계속
  // 시스템 설정으로 떨어지므로, 처음 만났을 때 공유 쿠키로 올려준다.
  if (!readCookie() && readLocal()) storeTheme(theme);
  applyTheme(theme);
}

export function useHeritageSurface() {
  useEffect(() => {
    const root = document.documentElement;

    if (activeCount === 0) {
      root.setAttribute('data-surface', 'heritage');
      applyTheme(resolveTheme());
    }
    activeCount += 1;

    return () => {
      activeCount -= 1;
      if (activeCount > 0) return;

      // 되돌릴 곳은 하나뿐이다 — 브랜드 면을 벗어나면 dark-trading 이고 그건 다크 고정이다.
      // 직전 값을 기억해 되돌리면, 첫 페인트를 라이트로 칠한 뒤 /tech 로 갔을 때
      // 라이트가 따라가 버린다.
      root.removeAttribute('data-surface');
      root.setAttribute('data-theme', 'dark');
      applyThemeColor('dark');
    };
  }, []);
}

/** 테마 토글. 선택은 저장된다 — 다음 방문에도, 다른 서브도메인에서도 같은 톤으로 열린다. */
export function useHeritageTheme(): [HeritageTheme, () => void] {
  const [theme, setTheme] = useState<HeritageTheme>(() =>
    typeof window === 'undefined' ? 'light' : resolveTheme(),
  );

  useEffect(() => {
    listeners.add(setTheme);
    return () => {
      listeners.delete(setTheme);
    };
  }, []);

  const toggle = useCallback(() => {
    const next: HeritageTheme = resolveTheme() === 'dark' ? 'light' : 'dark';
    storeTheme(next);
    applyTheme(next);
  }, []);

  return [theme, toggle];
}
