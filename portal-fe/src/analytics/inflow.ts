/**
 * place 유입 값 정규화 — 이전 사이트·캠페인 표시·착지 화면을 원장에 남길 모양으로 줄인다.
 *
 * 주소 전체(검색어·토큰이 실린 경로)는 남기지 않는다. 이전 사이트는 호스트만,
 * UTM 은 안전한 낱말일 때만, 착지 경로는 id·코드 없이 유형만 남긴다.
 * 경로 유형 표는 봇 집계(`place/ingest/src/crawl_stats.py`)에도 사본이 있고,
 * 두 구현은 `place/ingest/tests/fixtures/path_types.json` 하나로 함께 검사한다.
 */

export type LandingType = 'hub' | 'detail' | 'region' | 'attr_landing' | 'editorial' | 'other';

export interface UtmFields {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

const REFERRER_SCHEMES = new Set(['http:', 'https:', 'android-app:']);
const MAX_HOST_LENGTH = 253;

/**
 * 이전 사이트의 호스트(소문자). 경로·쿼리·포트·사용자 정보는 버린다.
 * 같은 호스트면 빈 값이 아니라 `'self'` — 주소를 직접 친 방문(빈 값)과 가르기 위해서다.
 */
export function referrerHostOf(referrer: string, currentHost: string): string {
  if (!referrer) return '';
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return '';
  }
  if (!REFERRER_SCHEMES.has(url.protocol)) return '';
  const host = url.hostname.toLowerCase();
  if (!host || host.length > MAX_HOST_LENGTH) return '';
  return host === currentHost.toLowerCase() ? 'self' : host;
}

const UTM_KEYS = [
  ['utm_source', 'utmSource'],
  ['utm_medium', 'utmMedium'],
  ['utm_campaign', 'utmCampaign'],
] as const;
const UTM_VALUE = /^[A-Za-z0-9._~-]{1,64}$/;

/**
 * `utm_source`·`utm_medium`·`utm_campaign` 만 읽는다. 값이 안전한 낱말이 아니면 `'invalid'` —
 * 이메일·토큰이 UTM 자리에 실려 원장에 남지 않게 하되, 잘못 붙은 UTM 이 있었다는 사실은 남긴다.
 * 없거나 빈 값인 키는 결과에서 뺀다.
 */
export function utmOf(search: string): UtmFields {
  const params = new URLSearchParams(search);
  const out: UtmFields = {};
  for (const [param, key] of UTM_KEYS) {
    const value = (params.get(param) ?? '').trim();
    if (!value) continue;
    out[key] = UTM_VALUE.test(value) ? value : 'invalid';
  }
  return out;
}

function isEnglish(pathname: string): boolean {
  return pathname === '/en' || pathname.startsWith('/en/');
}

export function langOf(pathname: string): 'en' | 'ko' {
  return isEnglish(pathname) ? 'en' : 'ko';
}

/** 착지 경로 유형. `/en`·`/place` 접두와 끝 슬래시는 떼고 비교한다. 대소문자는 그대로. */
export function landingTypeOf(pathname: string): LandingType {
  let path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (isEnglish(path)) path = path.slice(3);
  if (path === '/place' || path.startsWith('/place/')) path = path.slice(6);
  if (path === '') path = '/';

  if (path === '/') return 'hub';
  if (/^\/attractions\/[^/]+$/.test(path)) return 'detail';
  if (/^\/regions\/[^/]+$/.test(path)) return 'region';
  if (/^\/regions\/[^/]+\/[^/]+$/.test(path)) return 'attr_landing';
  if (/^\/guides(\/[^/]+)?$/.test(path)) return 'editorial';
  return 'other';
}
