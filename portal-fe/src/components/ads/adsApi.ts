import { apiClient } from '../../shell/apiClient';
import { FLUSH_INTERVAL_MS, FLUSH_SIZE } from '../../analytics/tracker';
import { sessionId, visitorId } from '../../analytics/identity';

/**
 * 자체 광고 결정과 이벤트 전송 (ADR-0098).
 *
 * 결정은 **한 페이지에 한 번** 부른다 — 같은 틱에 요청된 지면을 (호스트, 문맥 키)별로 모아 한 요청에 싣는다.
 * 서버는 이 요청의 로그인 신원으로 광고주 본인 여부를 판정한다 — 신원은 세션 쿠키가 싣는다(ADR-0101).
 * 같은 오리진 상대 경로로 불러야 쿠키가 실린다. 다른 오리진으로 부르면 그 판정이 조용히 꺼져
 * 광고주가 자기 광고를 보고 눌러도 과금된다.
 */

export type FillSource = 'PAID' | 'ADSENSE' | 'HOUSE' | 'EMPTY';

/** 유료 광고 한 건. 광고주 문자열(`title`·`body`·`advertiserName`)은 텍스트로만 그린다. */
export interface PaidAd {
  creativeId: number;
  title: string;
  body: string;
  advertiserName: string;
  imageUrl: string;
  clickUrl: string;
  impressionToken: string;
}

/** 자체 홍보 소재. `link` 는 앱 안 경로 또는 https 주소다. */
export interface HouseCreative {
  creativeId: number;
  title: string;
  body: string;
  emoji: string | null;
  link: string;
  imageUrl: string | null;
}

export interface PlacementDecision {
  ad: PaidAd | null;
  house: HouseCreative[];
}

/**
 * 결정을 기다리는 상한. 넘으면 유료 광고 없이 다음 순서(AdSense)로 간다.
 * 서버 처리는 수 ms 지만 CF 엣지 → OCI 왕복이 0.3~2s 라 800ms 로는 첫 방문 결정이 자주 끊겼다.
 */
export const DECISION_TIMEOUT_MS = 1500;

const DECISIONS_PATH = '/api/v1/ads/decisions';
const EVENTS_PATH = '/api/v1/ads/events';
const CLICK_PREFIX = '/api/v1/ads/click/';
const ASSET_PREFIX = '/api/v1/ads/assets/';

const NO_DECISION: PlacementDecision = { ad: null, house: [] };

/** API 경로를 `apiClient` 와 같은 기준 주소로 바꾼다 — 링크·이미지·비콘이 결정 요청과 같은 곳을 본다. */
export function apiUrl(path: string): string {
  return `${apiClient.defaults.baseURL ?? ''}${path}`;
}

/** 클릭 리다이렉터 주소 + analytics 신원. 클릭 사본의 방문자를 노출 사본과 맞추는 데만 쓰이고 과금과는 무관하다. */
export function clickHref(clickUrl: string): string {
  const query = new URLSearchParams({ vid: visitorId(), sid: sessionId() });
  return `${apiUrl(clickUrl)}?${query.toString()}`;
}

/** 앱 안 경로 — `//host`·`/\host` 는 다른 오리진으로 나가므로 제외한다(서버 검증과 같은 규칙). */
export function isAppPath(link: string): boolean {
  return /^\/(?![/\\])/.test(link);
}

// ─── 결정 ─────────────────────────────────────────────────────────────────

interface PendingBatch {
  keys: Set<string>;
  result: Promise<Map<string, PlacementDecision>>;
}

const pending = new Map<string, PendingBatch>();

/**
 * 지면 하나의 결정을 받는다. 같은 틱의 다른 지면과 한 요청으로 묶인다.
 * 실패(오류·타임아웃·빈 200·형식 불일치)는 던지지 않고 「유료 없음·HOUSE 없음」으로 끝난다.
 */
export function requestDecision(placementKey: string, contextKey: string): Promise<PlacementDecision> {
  const host = window.location.hostname;
  const batchKey = `${host}|${contextKey}`;
  let batch = pending.get(batchKey);
  if (!batch) {
    const keys = new Set<string>();
    const result = new Promise<void>((resolve) => setTimeout(resolve, 0)).then(() => {
      // 여기서 묶음을 닫는다 — 이 뒤에 온 지면은 새 요청으로 간다
      pending.delete(batchKey);
      return fetchDecisions([...keys], host, contextKey);
    });
    batch = { keys, result };
    pending.set(batchKey, batch);
  }
  batch.keys.add(placementKey);
  return batch.result.then((byKey) => byKey.get(placementKey) ?? NO_DECISION);
}

async function fetchDecisions(
  placements: string[],
  host: string,
  contextKey: string,
): Promise<Map<string, PlacementDecision>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // axios timeout 은 요청을 끊고, 경쟁 타이머는 화면이 기다리는 상한을 어떤 전송 방식에서든 DECISION_TIMEOUT_MS 로 묶는다
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('ads decision timeout')), DECISION_TIMEOUT_MS);
    });
    const request = apiClient.post(
      DECISIONS_PATH,
      { placements, host, ...(contextKey ? { contextKey } : {}) },
      { timeout: DECISION_TIMEOUT_MS },
    );
    const res = await Promise.race([request, deadline]);
    return parseDecisions(res.data);
  } catch {
    return new Map();
  } finally {
    clearTimeout(timer);
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

const isString = (v: unknown): v is string => typeof v === 'string';

function parseAd(v: unknown): PaidAd | null {
  if (!isRecord(v)) return null;
  const { creativeId, title, body, advertiserName, imageUrl, clickUrl, impressionToken } = v;
  if (typeof creativeId !== 'number') return null;
  if (![title, body, advertiserName, imageUrl, clickUrl, impressionToken].every(isString)) return null;
  // 링크·이미지는 광고 서버의 두 경로만 받는다 — 다른 값이 오면 카드를 그리지 않는다
  if (!(clickUrl as string).startsWith(CLICK_PREFIX) || !(imageUrl as string).startsWith(ASSET_PREFIX)) return null;
  return v as unknown as PaidAd;
}

function parseHouse(v: unknown): HouseCreative | null {
  if (!isRecord(v)) return null;
  const { creativeId, title, body, emoji, link, imageUrl } = v;
  if (typeof creativeId !== 'number' || !isString(title) || !isString(body) || !isString(link)) return null;
  if (!(isAppPath(link) || link.startsWith('https://'))) return null;
  return {
    creativeId,
    title,
    body,
    emoji: isString(emoji) ? emoji : null,
    link,
    imageUrl: isString(imageUrl) && imageUrl.startsWith(ASSET_PREFIX) ? imageUrl : null,
  };
}

/** 응답(`ApiResponse<DecisionResponse>`)을 지면 키별 결정으로. 모양이 맞지 않으면 빈 결과다. */
export function parseDecisions(body: unknown): Map<string, PlacementDecision> {
  const byKey = new Map<string, PlacementDecision>();
  const data = isRecord(body) ? body.data : undefined;
  const placements = isRecord(data) ? data.placements : undefined;
  if (!Array.isArray(placements)) return byKey;
  for (const p of placements) {
    if (!isRecord(p) || !isString(p.placementKey)) continue;
    const house = Array.isArray(p.house)
      ? p.house.map(parseHouse).filter((h): h is HouseCreative => h !== null)
      : [];
    byKey.set(p.placementKey, { ad: parseAd(p.ad), house });
  }
  return byKey;
}

// ─── 이벤트 ───────────────────────────────────────────────────────────────

/**
 * 가시 노출 토큰과 지면별 채움 출처를 모아 보낸다 — 모으는 수·시간은 analytics 전송기(`tracker.ts`)와 같다.
 * 화면을 떠날 때는 `sendBeacon` 으로 흘린다. 신원은 analytics 사본용이고 과금 근거가 아니다(과금은 토큰과 게이트웨이 방문자).
 */

let tokens: string[] = [];
let fills: { placementKey: string; source: FillSource }[] = [];
const seenTokens = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let leaveInstalled = false;

export function queueImpression(token: string): void {
  if (seenTokens.has(token)) return;
  seenTokens.add(token);
  tokens.push(token);
  schedule();
}

export function reportFill(placementKey: string, source: FillSource): void {
  fills.push({ placementKey, source });
  schedule();
}

function schedule(): void {
  installFlushOnLeave();
  if (tokens.length >= FLUSH_SIZE || fills.length >= FLUSH_SIZE) {
    flushAdEvents();
    return;
  }
  if (timer === null) timer = setTimeout(() => flushAdEvents(), FLUSH_INTERVAL_MS);
}

/** @param useBeacon 화면을 떠나는 중이면 true — 그때의 fetch 는 취소된다 */
export function flushAdEvents(useBeacon = false): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (tokens.length === 0 && fills.length === 0) return;
  const body = JSON.stringify({ tokens, visitorId: visitorId(), sessionId: sessionId(), fills });
  tokens = [];
  fills = [];
  const url = apiUrl(EVENTS_PATH);
  // 계측 실패가 화면을 깨뜨리지 않는다
  try {
    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'include',
    }).catch(() => {});
  } catch {
    /* 계측은 실패해도 된다 */
  }
}

function installFlushOnLeave(): void {
  if (leaveInstalled || typeof window === 'undefined') return;
  leaveInstalled = true;
  window.addEventListener('pagehide', () => flushAdEvents(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAdEvents(true);
  });
}

/** 테스트 전용. */
export function resetAdsForTest(): void {
  pending.clear();
  tokens = [];
  fills = [];
  seenTokens.clear();
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}
