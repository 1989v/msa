import { useCallback, useState } from 'react';

/** Fetch once when a section approaches the viewport; links render independently. */
export function useNearViewport() {
  const [ready, setReady] = useState(() => typeof IntersectionObserver === 'undefined');
  const observe = useCallback((node: HTMLElement | null) => {
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setReady(true);
      observer.disconnect();
    }, { rootMargin: '320px', threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [observe, ready] as const;
}
