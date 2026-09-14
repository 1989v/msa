import { sessionId, visitorId } from './identity';
import type { EventAction, TrackedEvent, TrackedItem } from './events';

/**
 * 노출·클릭 전송기 (ADR-0095).
 *
 * **모아서 보낸다.** 목록 한 화면이 카드 20장이면 노출도 20건이라 건당 요청은 낭비다.
 * 화면을 떠날 때는 `sendBeacon` 으로 흘린다 — 그 순간의 fetch 는 취소된다.
 */

/** 이만큼 모이면 바로 보낸다. */
export const FLUSH_SIZE = 20;
/** 이 시간이 지나면 적게 모였어도 보낸다 (ms). */
export const FLUSH_INTERVAL_MS = 5_000;

const ENDPOINT = '/api/v1/events';

let queue: TrackedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
/** 같은 (viewId, entityId, action) 은 한 번만 — 스크롤로 오가도 노출이 늘면 안 된다. */
const seen = new Set<string>();

function keyOf(e: TrackedEvent): string {
  return `${e.viewId}|${e.entityType}|${e.entityId}|${e.action}`;
}

export function track(action: EventAction, item: TrackedItem, viewId: string): void {
  const event: TrackedEvent = { ...item, action, viewId, occurredAt: Date.now() };
  const key = keyOf(event);
  if (seen.has(key)) return;
  seen.add(key);
  queue.push(event);
  if (queue.length >= FLUSH_SIZE) {
    flush();
    return;
  }
  if (timer === null) {
    timer = setTimeout(flush, FLUSH_INTERVAL_MS);
  }
}

/**
 * @param useBeacon 화면을 떠나는 중이면 true. 그때는 fetch 가 취소되므로 beacon 을 쓴다.
 */
export function flush(useBeacon = false): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];

  const body = JSON.stringify({ events: batch });
  const headers = {
    'Content-Type': 'application/json',
    'X-Visitor-Id': visitorId(),
    'X-Session-Id': sessionId(),
  };

  // 계측 실패가 화면을 깨뜨리지 않는다 — 조용히 버린다.
  try {
    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      // beacon 은 헤더를 못 실어 식별자를 본문에 같이 보낸다.
      const payload = JSON.stringify({
        events: batch,
        visitorId: visitorId(),
        sessionId: sessionId(),
      });
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
      return;
    }
    void fetch(ENDPOINT, { method: 'POST', headers, body, keepalive: true }).catch(() => {});
  } catch {
    /* 계측은 실패해도 된다 */
  }
}

/** 화면을 떠날 때 남은 것을 흘린다. `pagehide` 는 모바일 사파리에서 유일하게 믿을 수 있다. */
export function installFlushOnLeave(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onHide = () => flush(true);
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush(true);
  };
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('pagehide', onHide);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

/** 테스트 전용. */
export function resetTrackerForTest(): void {
  queue = [];
  seen.clear();
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

/** 테스트 전용 — 아직 안 보낸 것. */
export function pendingForTest(): TrackedEvent[] {
  return [...queue];
}
