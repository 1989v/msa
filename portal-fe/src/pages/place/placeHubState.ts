/**
 * 허브 화면 상태 — 게스트가 허브의 별을 눌러 로그인으로 넘어갈 때 한 번 남기고, 돌아온 첫 마운트가 읽는다.
 *
 * 상태가 바뀔 때마다 저장하지 않는다 — 로그인 왕복 하나만을 위한 것이라 이동 직전 한 번이면 된다.
 * 10분이 지나면 없는 것으로 본다. 저장소 값은 누구나 고칠 수 있는 외부 입력이라, 화면이 아는 값만
 * 받고 하나라도 어긋나면 통째로 버린다(일부만 살리면 화면이 만들 수 없는 조합이 생긴다).
 *
 * 이 모듈은 타입 말고는 import 하지 않는다 — `clearLocalSession`(auth) 이 불러도 place 묶음을 끌고 가지 않는다.
 * 그래서 「아는 값」 목록은 읽는 쪽(PlacePage)이 넘긴다.
 */

export const PLACE_HUB_STATE_KEY = 'kgd.placeHubState.v1';
export const PLACE_HUB_STATE_TTL_MS = 10 * 60_000;

export interface PlaceHubState {
  keyword: string;
  exactFor: string | null;
  category: string | null;
  attributes: string[];
  areaCode: string | null;
  sidoCode: string | null;
  sigunguCode: string | null;
  geo: { lat: number; lng: number; radiusKm: number } | null;
  listEventStatus: string | null;
  selectedId: string | null;
  page: number;
  /** epoch ms */
  createdAt: number;
}

/** 화면이 아는 값 — 분류·속성·행사 상태 */
export interface PlaceHubKnownValues {
  categories: readonly string[];
  attributes: readonly string[];
  eventStatuses: readonly string[];
}

export function writePlaceHubState(state: Omit<PlaceHubState, 'createdAt'>, now = Date.now()): void {
  try {
    sessionStorage.setItem(PLACE_HUB_STATE_KEY, JSON.stringify({ ...state, createdAt: now }));
  } catch {
    /* 저장소를 못 쓰면 상태 없이 로그인한다 — 돌아오면 첫 화면이다 */
  }
}

export function clearPlaceHubState(): void {
  try {
    sessionStorage.removeItem(PLACE_HUB_STATE_KEY);
  } catch {
    /* 저장소가 없으면 지울 것도 없다 */
  }
}

const isNumericString = (v: unknown): v is string => typeof v === 'string' && /^\d+$/.test(v);
const optional = <T>(v: unknown, ok: (x: unknown) => x is T): v is T | null | undefined => v == null || ok(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 저장값 검증 — 통과하면 정규화한 상태, 아니면 null */
export function parsePlaceHubState(raw: unknown, known: PlaceHubKnownValues, now = Date.now()): PlaceHubState | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;

  if (!isFiniteNumber(v.createdAt)) return null;
  const age = now - v.createdAt;
  if (age < 0 || age > PLACE_HUB_STATE_TTL_MS) return null;

  if (!isString(v.keyword)) return null;
  if (!optional(v.exactFor, isString)) return null;
  const inList = (list: readonly string[]) => (x: unknown): x is string => isString(x) && list.includes(x);
  if (!optional(v.category, inList(known.categories))) return null;
  if (!optional(v.listEventStatus, inList(known.eventStatuses))) return null;
  if (!Array.isArray(v.attributes) || !v.attributes.every(inList(known.attributes))) return null;
  for (const code of [v.areaCode, v.sidoCode, v.sigunguCode, v.selectedId]) {
    if (!optional(code, isNumericString)) return null;
  }
  if (typeof v.page !== 'number' || !Number.isInteger(v.page) || v.page < 0) return null;

  let geo: PlaceHubState['geo'] = null;
  if (v.geo != null) {
    if (typeof v.geo !== 'object') return null;
    const g = v.geo as Record<string, unknown>;
    if (!isFiniteNumber(g.lat) || !isFiniteNumber(g.lng) || !isFiniteNumber(g.radiusKm) || g.radiusKm <= 0) return null;
    geo = { lat: g.lat, lng: g.lng, radiusKm: g.radiusKm };
  }

  return {
    keyword: v.keyword,
    exactFor: (v.exactFor as string | null | undefined) ?? null,
    category: (v.category as string | null | undefined) ?? null,
    attributes: [...(v.attributes as string[])],
    areaCode: (v.areaCode as string | null | undefined) ?? null,
    sidoCode: (v.sidoCode as string | null | undefined) ?? null,
    sigunguCode: (v.sigunguCode as string | null | undefined) ?? null,
    geo,
    listEventStatus: (v.listEventStatus as string | null | undefined) ?? null,
    selectedId: (v.selectedId as string | null | undefined) ?? null,
    page: v.page,
    createdAt: v.createdAt,
  };
}

/**
 * 읽기만 한다 — `useState` 초기값 함수로 쓰므로 StrictMode 에서 두 번 불린다. 지우는 것은 마운트 effect 의 몫이다.
 */
export function readPlaceHubState(known: PlaceHubKnownValues, now = Date.now()): PlaceHubState | null {
  try {
    const raw = sessionStorage.getItem(PLACE_HUB_STATE_KEY);
    return raw ? parsePlaceHubState(JSON.parse(raw), known, now) : null;
  } catch {
    return null;
  }
}
