/**
 * 익명 식별자 (ADR-0095 · ADR-0078 최소 식별).
 *
 * 개인을 식별하지 않는다 — 로그인 여부와 무관하게 도는 임의 키다.
 * `visitorId` 는 기기에 남고(재방문 구분), `sessionId` 는 탭을 닫으면 사라진다.
 */

const VISITOR_KEY = 'kgd.visitorId';
const SESSION_KEY = 'kgd.sessionId';

function randomId(): string {
  // crypto.randomUUID 는 안전 컨텍스트(https/localhost)에서만 있다 — 없으면 대체한다.
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `r-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * 저장소는 실패할 수 있다 — 사파리 프라이빗·쿠키 차단·용량 초과.
 * 계측이 화면을 깨뜨리면 안 되므로 실패하면 **그 회차 임시 id** 로 계속 간다.
 */
function readOrCreate(store: Storage | undefined, key: string): string {
  try {
    if (!store) return randomId();
    const found = store.getItem(key);
    if (found) return found;
    const made = randomId();
    store.setItem(key, made);
    return made;
  } catch {
    return randomId();
  }
}

let visitorCache: string | null = null;
let sessionCache: string | null = null;

export function visitorId(): string {
  if (visitorCache) return visitorCache;
  visitorCache = readOrCreate(safeStorage('local'), VISITOR_KEY);
  return visitorCache;
}

export function sessionId(): string {
  if (sessionCache) return sessionCache;
  sessionCache = readOrCreate(safeStorage('session'), SESSION_KEY);
  return sessionCache;
}

/** 같은 화면 한 벌. 목록을 다시 그릴 때마다 새로 만들어 노출↔클릭을 짝짓는다. */
export function newViewId(): string {
  return randomId();
}

function safeStorage(kind: 'local' | 'session'): Storage | undefined {
  try {
    return kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

/** 테스트 전용 — 캐시를 비운다. */
export function resetIdentityForTest(): void {
  visitorCache = null;
  sessionCache = null;
}
