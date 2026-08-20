import { useEffect, useState } from 'react';

/**
 * 접히는 헤더의 신호 — 아래로 스크롤하면 true, 위로 한 틱이면 false.
 * 최상단 근처(64px)에서는 항상 false 다. rAF 로 묶어 스크롤마다 setState 하지 않는다.
 */
export function useScrollDirection(threshold = 12) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        if (y < 64) setHidden(false);
        else if (dy > threshold) setHidden(true);
        else if (dy < -threshold) setHidden(false);
        if (Math.abs(dy) > threshold) lastY = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return hidden;
}
