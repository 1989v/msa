import { useEffect, useState } from 'react';

/**
 * CSS 브레이크포인트와 같은 조건을 JS 렌더 분기에 쓰기 위한 훅.
 * innerWidth 스냅샷과 달리 회전·창 크기 변경을 따라간다.
 * (place 화면 전용 — 다른 화면에서 필요해지면 그때 공용 hooks 로 올린다)
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
