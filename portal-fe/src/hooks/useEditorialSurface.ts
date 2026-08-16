import { useEffect } from 'react';

/**
 * 브랜드/포트폴리오 화면에서 에디토리얼 표면을 켠다.
 *
 * 토큰은 `:root` 에 걸어야 한다 — 페이지 컨테이너에만 걸면 오버스크롤 여백과
 * `body` 배경이 다크로 남아 화면 밖이 어긋나 보인다.
 *
 * 화면을 벗어나면 되돌린다. 게임·개념사전처럼 다크를 유지하는 화면으로 넘어갔을 때
 * 속성이 남아 있으면 그 화면이 라이트로 뒤집힌다.
 */
export function useEditorialSurface() {
  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.getAttribute('data-theme');

    root.setAttribute('data-theme', 'light');
    root.setAttribute('data-surface', 'editorial');

    return () => {
      root.removeAttribute('data-surface');
      if (previousTheme === null) {
        root.removeAttribute('data-theme');
      } else {
        root.setAttribute('data-theme', previousTheme);
      }
    };
  }, []);
}
