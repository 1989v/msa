import { useCallback } from 'react';

/**
 * 모션 문법(kh-motion.css)의 발화자.
 *
 * 반환된 ref 콜백을 컨테이너에 걸면, 뷰포트에 들어오는 순간
 * `data-reveal="pending" → "in"` 이 붙어 안의 동사(.kh-seep / .kh-rule-draw /
 * .kh-settle / .kh-stamp)가 깨어난다. 1회성이다 — 다시 나가도 재생하지 않는다.
 *
 * 속성은 JS 만 붙인다: 프리렌더 HTML·무 JS 환경에는 속성이 없어 콘텐츠가
 * 그대로 보인다. reduced-motion 이면 아예 붙이지 않는다.
 *
 * 하나의 콜백을 여러 요소에 걸어도 된다 — 정리는 React 19 ref cleanup 이 맡는다.
 */
export function useReveal<T extends HTMLElement = HTMLElement>() {
  return useCallback((el: T | null) => {
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.dataset.reveal === 'in') return; // StrictMode 재마운트 시 재생 방지

    el.dataset.reveal = 'pending';
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.reveal = 'in';
          io.disconnect();
        }
      },
      // 아래 가장자리를 8% 지나야 발화 — 경계에 걸친 채 안 보이는 재생을 막는다.
      // threshold 를 올리면 뷰포트보다 큰 섹션이 영영 발화하지 못한다.
      { threshold: 0, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
}
