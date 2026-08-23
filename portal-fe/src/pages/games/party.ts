/**
 * 파티 인계 규약 — 허브에서 정한 참가자·방식을 게임(iframe)에 넘긴다.
 *
 * **URL 쿼리로 넘기지 않는다.** 게임은 정적 파일이라 `?names=민수,영희` 는 그대로
 * 웹서버 접근 로그에 남는다 — 「이름은 이 기기 밖으로 나가지 않는다」는 이 장르 게임들의
 * 약속이 그 순간 깨진다. 허브와 게임은 같은 오리진이므로 `localStorage` 를 공유한다.
 *
 * 한 번 쓰고 버린다(one-shot). 게임이 읽어 소비하면 지우므로, 새로고침해도 다시 시작되지 않는다.
 */
export const PARTY_KEY = 'kgd.party.v1';

/** 두 게임이 모두 지원하는 방식만 둔다 — 지원 못 하는 방식을 넘기면 인계가 반쪽이 된다 */
export type PartyMode = 'last' | 'order';

export interface PartyHandoff {
  v: 1;
  slug: string;
  names: string[];
  mode: PartyMode;
  at: number;
}

/** 넘긴 뒤 이 시간이 지나면 무시한다 — 옛 값으로 엉뚱한 판이 시작되면 안 된다 */
export const PARTY_TTL_MS = 3 * 60 * 1000;

export const PARTY_MIN = 2;
export const PARTY_MAX = 12;

export const PARTY_MODES: { key: PartyMode; ko: string; en: string; hint: string }[] = [
  { key: 'last', ko: '한 명이 걸린다', en: 'One is picked', hint: '커피 사는 사람 정하기' },
  { key: 'order', ko: '순서 정하기', en: 'Running order', hint: '차례를 정한다' },
];

export function writeParty(slug: string, names: string[], mode: PartyMode): void {
  const payload: PartyHandoff = { v: 1, slug, names, mode, at: Date.now() };
  try {
    localStorage.setItem(PARTY_KEY, JSON.stringify(payload));
  } catch {
    /* 저장 불가 환경 — 게임이 자기 준비 화면을 띄운다 */
  }
}

/** 소비하지 않고 들여다보기만 한다 (허브가 자동 시작 여부를 판단할 때) */
export function peekParty(slug: string): PartyHandoff | null {
  try {
    const raw = localStorage.getItem(PARTY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PartyHandoff;
    if (p?.v !== 1 || p.slug !== slug) return null;
    if (!Array.isArray(p.names) || p.names.length < PARTY_MIN) return null;
    if (Date.now() - p.at > PARTY_TTL_MS) return null;
    return p;
  } catch {
    return null;
  }
}

/** 이름 목록 정리 — 빈 줄 제거, 길이 제한, 인원 상한 */
export function parseNames(text: string): string[] {
  return String(text || '')
    .split(/[\n,]/)
    .map((t) => t.trim().slice(0, 12))
    .filter(Boolean)
    .slice(0, PARTY_MAX);
}

export function defaultNames(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `참가자 ${i + 1}`);
}
