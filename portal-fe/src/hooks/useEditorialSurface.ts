import { useEffect } from 'react';

/**
 * 브랜드/제품 화면에서 에디토리얼 표면을 켠다 (DESIGN.md §12).
 *
 * 토큰은 `:root` 에 걸어야 한다 — 페이지 컨테이너에만 걸면 오버스크롤 여백과
 * `body` 배경이 다크로 남아 화면 밖이 어긋나 보인다.
 *
 * 참조 카운트를 쓰는 이유: 라우트가 바뀔 때 새 화면이 먼저 mount 되고 이전 화면의
 * cleanup 이 나중에 도는 순서가 나올 수 있다. 그때 단순 해제를 하면 방금 켠 표면이
 * 꺼져 다크로 깜빡인다. 마지막 사용자가 나갈 때만 되돌린다.
 */
let activeCount = 0;
let restoreTheme: string | null = null;

export function useEditorialSurface() {
  useEffect(() => {
    const root = document.documentElement;

    if (activeCount === 0) {
      restoreTheme = root.getAttribute('data-theme');
      root.setAttribute('data-theme', 'light');
      root.setAttribute('data-surface', 'editorial');
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
