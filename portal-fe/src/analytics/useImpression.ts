import { useEffect, useRef } from 'react';
import type { TrackedItem } from './events';
import { track } from './tracker';

/**
 * 노출 기록 (ADR-0095).
 *
 * **그려진 것이 아니라 보인 것**을 센다. 화면 밖에 있거나 스쳐 지나간 것을 세면
 * CTR 이 분모부터 틀린다.
 */

/** 면적이 이만큼 보여야 노출로 친다. */
export const VISIBLE_RATIO = 0.5;
/** 이만큼 계속 보여야 노출로 친다 (ms). 스크롤로 지나간 것을 거른다. */
export const DWELL_MS = 1_000;

/**
 * @param onVisible 가시 노출이 확정될 때 한 번 부른다 — 광고 카드처럼 analytics 원장이 아닌 곳에 노출을 알릴 때.
 *   기준(면적·머무름)은 여기 하나를 쓴다.
 */
export function useImpression<T extends Element>(
  item: TrackedItem | null,
  viewId: string,
  onVisible?: () => void,
): (node: T | null) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // 콜백 ref 가 다시 불릴 때마다 최신 값을 쓰도록 — item 이 바뀌어도 관찰을 다시 걸지 않는다.
  // 렌더 중에 ref 를 건드리지 않는다(React 규칙) — 커밋 뒤에 맞춘다.
  const itemRef = useRef(item);
  const viewIdRef = useRef(viewId);
  const onVisibleRef = useRef(onVisible);
  useEffect(() => {
    itemRef.current = item;
    viewIdRef.current = viewId;
    onVisibleRef.current = onVisible;
  }, [item, viewId, onVisible]);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    observerRef.current?.disconnect();
  }, []);

  return (node: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!node || typeof IntersectionObserver === 'undefined') return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO) {
          if (timerRef.current !== null) return;
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            const current = itemRef.current;
            if (current) track('IMPRESSION', current, viewIdRef.current);
            onVisibleRef.current?.();
            // 한 번 기록했으면 더 볼 필요가 없다 — 중복은 tracker 가 막지만 관찰도 멈춘다.
            observerRef.current?.disconnect();
          }, DWELL_MS);
        } else if (timerRef.current !== null) {
          // 머무름을 못 채우고 나갔다 — 노출이 아니다.
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      },
      { threshold: [VISIBLE_RATIO] },
    );
    observerRef.current.observe(node);
  };
}
