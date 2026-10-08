/**
 * 찜 의도 — 게스트가 관광지 별을 누른 뒤 로그인으로 넘어가는 동안 「무엇을 찜하려 했는지」를 들고 있는다.
 *
 * 로그인은 apex 로 넘어갔다 돌아오는 왕복이라 화면 상태가 사라진다. 이 탭(현재 호스트)의 sessionStorage 에
 * 하나만 두고(덮어쓰기), 10분이 지나면 없는 것으로 본다 — 한참 뒤에 로그인한 사람에게 예전 클릭이 찜으로
 * 실리지 않게. 이 모듈은 아무것도 import 하지 않는다 — `clearLocalSession` 이 불러도 의존이 늘지 않는다.
 */

export const FAVORITE_INTENT_KEY = 'kgd.favoriteIntent.v1';
export const FAVORITE_INTENT_TTL_MS = 10 * 60_000;

export interface FavoriteIntent {
  targetType: 'ATTRACTION';
  targetKey: string;
  /** epoch ms */
  createdAt: number;
}

/** 저장소를 못 쓰는 브라우저(사파리 프라이빗·용량 초과)에서는 의도 없이 로그인만 한다 */
export function writeFavoriteIntent(targetKey: string, now = Date.now()): void {
  const intent: FavoriteIntent = { targetType: 'ATTRACTION', targetKey, createdAt: now };
  try {
    sessionStorage.setItem(FAVORITE_INTENT_KEY, JSON.stringify(intent));
  } catch {
    /* 의도 없이 진행 */
  }
}

/** 유효한 의도만 돌려준다. 지우지 않는다 — 소비하는 쪽이 정한다 */
export function readFavoriteIntent(now = Date.now()): FavoriteIntent | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(FAVORITE_INTENT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<FavoriteIntent> | null;
    if (!v || v.targetType !== 'ATTRACTION') return null;
    if (typeof v.targetKey !== 'string' || v.targetKey === '') return null;
    if (typeof v.createdAt !== 'number' || !Number.isFinite(v.createdAt)) return null;
    const age = now - v.createdAt;
    if (age < 0 || age > FAVORITE_INTENT_TTL_MS) return null;
    return { targetType: 'ATTRACTION', targetKey: v.targetKey, createdAt: v.createdAt };
  } catch {
    return null;
  }
}

export function clearFavoriteIntent(): void {
  try {
    sessionStorage.removeItem(FAVORITE_INTENT_KEY);
  } catch {
    /* 저장소가 없으면 지울 것도 없다 */
  }
}
