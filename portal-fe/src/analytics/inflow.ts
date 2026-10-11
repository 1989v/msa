/**
 * place 유입 값 정규화 — 이전 사이트·캠페인 표시·착지 화면을 원장에 남길 모양으로 줄인다.
 *
 * 주소 전체(검색어·토큰이 실린 경로)는 남기지 않는다. 이전 사이트는 호스트만,
 * UTM 은 안전한 낱말일 때만, 착지 경로는 id·코드 없이 유형만 남긴다.
 * 경로 유형 표는 봇 집계(`place/ingest/src/crawl_stats.py`)에도 사본이 있고,
 * 두 구현은 `place/ingest/tests/fixtures/path_types.json` 하나로 함께 검사한다.
 */

import { newViewId } from './identity';
import { installFlushOnLeave, track } from './tracker';

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

/*
 * 유입 기록은 탭 세션당 한 번 — 같은 탭의 SPA 이동·새로고침은 새 행을 만들지 않는다.
 * 저장소를 못 쓰면(사파리 프라이빗·용량 초과) 모듈 변수가 대신한다 — 그때는 새로고침마다 1회.
 */
const ENTRY_RECORDED_KEY = 'kgd.place.entryRecorded';
let entryRecordedFallback = false;
let uninstallFlushOnLeave: (() => void) | null = null;

function claimEntry(): boolean {
  try {
    if (sessionStorage.getItem(ENTRY_RECORDED_KEY)) return false;
    sessionStorage.setItem(ENTRY_RECORDED_KEY, '1');
    return true;
  } catch {
    if (entryRecordedFallback) return false;
    entryRecordedFallback = true;
    return true;
  }
}

/**
 * place 호스트 부팅 시 한 번 — 이전 사이트·착지 유형·언어·UTM 을 `place-entry` 세션 시작 한 행으로 남긴다.
 * 허브 세션(`place-hub`)은 허브·속성 랜딩을 연 세션만 세고, 이 행은 착지 화면과 상관없이 모든 place 세션을 센다.
 * 이 행의 viewId 는 노출↔클릭을 잇지 않는 단독 키다 — 착지 화면은 payload 의 `landingType` 이 말한다.
 *
 * 떠날 때 흘리는 것을 여기서 직접 설치한다. 편집 글 화면처럼 설치하지 않는 화면으로 착지해
 * 5초 안에 떠나면 이 행이 대기열에서 사라지기 때문이다.
 */
export function recordPlaceEntry(): void {
  if (uninstallFlushOnLeave === null) uninstallFlushOnLeave = installFlushOnLeave();
  if (!claimEntry()) return;
  const { hostname, pathname, search } = window.location;
  track(
    'SESSION_START',
    {
      entityType: 'PAGE',
      entityId: 'place-entry',
      screenType: 'PLACE_ENTRY',
      screenRef: '',
      payload: {
        referrerHost: referrerHostOf(document.referrer, hostname),
        landingType: landingTypeOf(pathname),
        lang: langOf(pathname),
        ...utmOf(search),
      },
    },
    newViewId(),
  );
}

/** 테스트 전용 — 세션 플래그(저장소·모듈 변수)와 떠날 때 흘리는 설치를 비운다. */
export function resetPlaceEntryForTest(): void {
  entryRecordedFallback = false;
  uninstallFlushOnLeave?.();
  uninstallFlushOnLeave = null;
  try {
    sessionStorage.removeItem(ENTRY_RECORDED_KEY);
  } catch {
    /* 저장소가 없으면 모듈 변수만 비운다 */
  }
}
