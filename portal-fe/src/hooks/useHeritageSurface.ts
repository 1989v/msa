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
let restoreTheme: string | null = null;
const listeners = new Set<(theme: HeritageTheme) => void>();

function storedTheme(): HeritageTheme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    // 사파리 프라이빗 모드 등에서 localStorage 접근이 막힌다. 시스템 설정으로 떨어진다.
    return null;
  }
}

function systemTheme(): HeritageTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(): HeritageTheme {
  return storedTheme() ?? systemTheme();
}

function applyTheme(theme: HeritageTheme) {
  document.documentElement.setAttribute('data-theme', theme);
  listeners.forEach((notify) => notify(theme));
}

export function useHeritageSurface() {
  useEffect(() => {
    const root = document.documentElement;

    if (activeCount === 0) {
      restoreTheme = root.getAttribute('data-theme');
      root.setAttribute('data-surface', 'heritage');
      applyTheme(resolveTheme());
    }
    activeCount += 1;

    return () => {
      activeCount -= 1;
      if (activeCount > 0) return;

      root.removeAttribute('data-surface');
      if (restoreTheme === null) {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', restoreTheme);
      }
      restoreTheme = null;
    };
  }, []);
}

/** 테마 토글. 선택은 저장된다 — 다음 방문에도 같은 톤으로 열린다. */
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
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 저장이 막혀도 이번 세션 동안은 바뀐 채로 쓸 수 있어야 한다.
    }
    applyTheme(next);
  }, []);

  return [theme, toggle];
}
