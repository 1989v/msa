// 진행 (2026-09-12 Phase 2): 경험치·레벨·골드·스탯 분배·색 조합 스킨. 순수 함수 + localStorage.
// 서버 동기화는 save.ts. 스탯 배분은 명단(roster)에 실려 방장이 상한을 다시 검사한다(sanitizeStatDelta) — 클라이언트 값은 믿지 않는다.
import { MAX_STAT_ALLOC, MAX_STAT_POINTS, type RankEntry, type Stats, type Skin } from '@amp/shared';
import { matchScore } from './score.ts';

export interface Progress {
  v: 1;
  xp: number;
  gold: number;
  matches: number;
  kos: number;
  wins: number;
  alloc: Partial<Stats>;   // 분배한 스탯 포인트 (스탯별 0~MAX_STAT_ALLOC)
  owned: string[];         // 산 스킨 id (`shirt:8` …)
  skin: Skin;              // 입은 색 (팔레트 인덱스, -1 = 기본)
  updated: number;         // ms
}

export const STAT_KEYS: (keyof Stats)[] = ['hp', 'atk', 'def', 'jmp', 'spd', 'tec'];
export const STAT_NAMES: Record<keyof Stats, string> = { hp: '체력', atk: '근력', def: '방어', jmp: '점프', spd: '이동', tec: '기술' };
export const STAT_DESC: Record<keyof Stats, string> = { hp: '최대 체력 +10', atk: '주는 데미지 +5%', def: '받는 데미지 −5%', jmp: '점프 높이', spd: '이동 속도 +5%', tec: '기술 쿨다운 −5%' };

/** 레벨 n 이 되는 누적 경험치: 120 × n(n−1)/2 — Lv2 120 · Lv3 360 · Lv4 720 · Lv10 5,400 · Lv30 52,200 */
export const MAX_LEVEL = 30;
export const xpForLevel = (lv: number): number => (120 * (lv - 1) * lv) / 2;
export function levelFor(xp: number): number {
  let lv = 1;
  while (lv < MAX_LEVEL && xp >= xpForLevel(lv + 1)) lv++;
  return lv;
}
export function levelProgress(xp: number): { level: number; cur: number; need: number } {
  const level = levelFor(xp);
  if (level >= MAX_LEVEL) return { level, cur: 0, need: 0 };
  return { level, cur: xp - xpForLevel(level), need: xpForLevel(level + 1) - xpForLevel(level) };
}
/** 레벨마다 스탯 포인트 1 (Lv1 은 0) — 상한은 시뮬의 MAX_STAT_POINTS 와 같다 */
export const statPoints = (p: Progress): number => Math.min(MAX_STAT_POINTS, levelFor(p.xp) - 1);
export const usedPoints = (p: Progress): number => STAT_KEYS.reduce((s, k) => s + (p.alloc[k] ?? 0), 0);
export const freePoints = (p: Progress): number => Math.max(0, statPoints(p) - usedPoints(p));

export interface Rewards { score: number; xp: number; gold: number }
/** 한 판의 보상: 경험치 = 점수(온라인 ×1.5) · 골드 = 점수/10 + 승리 20 + 온라인 10 */
export function matchRewards(me: RankEntry, online: boolean): Rewards {
  const score = matchScore(me);
  const xp = Math.round(score * (online ? 1.5 : 1));
  const gold = Math.round(score / 10) + (me.win ? 20 : 0) + (online ? 10 : 0);
  return { score, xp, gold };
}

export function applyMatch(p: Progress, me: RankEntry, online: boolean): { p: Progress; rewards: Rewards; from: number; to: number } {
  const rewards = matchRewards(me, online);
  const from = levelFor(p.xp);
  const next: Progress = { ...p, xp: p.xp + rewards.xp, gold: p.gold + rewards.gold, matches: p.matches + 1, kos: p.kos + me.kos, wins: p.wins + (me.win ? 1 : 0), updated: Date.now() };
  return { p: next, rewards, from, to: levelFor(next.xp) };
}

/** 스탯 포인트 하나를 넣거나(+1) 뺀다(−1). 상한·남은 포인트를 넘으면 null */
export function allocate(p: Progress, stat: keyof Stats, delta: 1 | -1): Progress | null {
  const cur = p.alloc[stat] ?? 0;
  const next = cur + delta;
  if (next < 0 || next > MAX_STAT_ALLOC) return null;
  if (delta > 0 && freePoints(p) <= 0) return null;
  return { ...p, alloc: { ...p.alloc, [stat]: next }, updated: Date.now() };
}

// ---- 색 조합 스킨 (상점) ----
/** 상의: 앞 8은 자리 색(무료, 기본 -1 은 내 자리 색), 뒤 8은 상점 */
export const SHIRT_PALETTE = ['#ff6a2a', '#4488ff', '#4ade80', '#ffb020', '#a78bfa', '#33d1ff', '#f472b6', '#f5f2ea', '#e11d48', '#0f766e', '#7c2d12', '#1e293b', '#fde047', '#c084fc', '#22d3ee', '#111111'];
export const HAIR_PALETTE = ['#f5d0a0', '#ffffff', '#e8c65a', '#d8452e', '#4488ff', '#4ade80'];
export const BAND_PALETTE = ['#4488ff', '#4ade80', '#f472b6', '#f5f2ea'];
export type SkinKind = keyof Skin;
export interface ShopItem { id: string; kind: SkinKind; idx: number; name: string; color: string; price: number }
const SHIRT_NAMES = ['진홍', '심해', '흙', '먹', '레몬', '라벤더', '하늘', '칠흑'];
const HAIR_NAMES = ['금발', '백발', '노랑', '빨강', '파랑', '초록'];
const BAND_NAMES = ['파랑', '초록', '분홍', '흰색'];
export const SHOP: ShopItem[] = [
  ...SHIRT_NAMES.map((name, i) => ({ id: `shirt:${8 + i}`, kind: 'shirt' as const, idx: 8 + i, name: `상의 · ${name}`, color: SHIRT_PALETTE[8 + i], price: 150 })),
  ...HAIR_NAMES.map((name, i) => ({ id: `hair:${i}`, kind: 'hair' as const, idx: i, name: `머리 · ${name}`, color: HAIR_PALETTE[i], price: 250 })),
  ...BAND_NAMES.map((name, i) => ({ id: `band:${i}`, kind: 'band' as const, idx: i, name: `머리띠 · ${name}`, color: BAND_PALETTE[i], price: 200 })),
];
export const owns = (p: Progress, id: string): boolean => p.owned.includes(id);
export function buy(p: Progress, id: string): { ok: boolean; reason?: string; p: Progress } {
  const item = SHOP.find((s) => s.id === id);
  if (!item) return { ok: false, reason: '없는 물건', p };
  if (owns(p, id)) return { ok: false, reason: '이미 갖고 있다', p };
  if (p.gold < item.price) return { ok: false, reason: `골드 부족 (${item.price} 필요)`, p };
  return { ok: true, p: { ...p, gold: p.gold - item.price, owned: [...p.owned, id], updated: Date.now() } };
}
/** 입기 — 산 것만. -1 이면 기본으로 */
export function wear(p: Progress, kind: SkinKind, idx: number): Progress | null {
  if (idx >= 0 && !owns(p, `${kind}:${idx}`)) return null;
  return { ...p, skin: { ...p.skin, [kind]: idx }, updated: Date.now() };
}

// ---- 저장 ----
export const PROGRESS_KEY = 'amp.progress.v1';
export const emptyProgress = (): Progress => ({ v: 1, xp: 0, gold: 0, matches: 0, kos: 0, wins: 0, alloc: {}, owned: [], skin: { shirt: -1, hair: -1, band: -1 }, updated: 0 });
const int = (v: unknown, lo: number, hi: number, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
/** 어디서 온 값이든(로컬·서버) 형태를 맞춘다 — 깨진 값 하나로 진행이 통째로 날아가지 않게 */
export function sanitizeProgress(raw: unknown): Progress {
  const e = emptyProgress();
  if (!raw || typeof raw !== 'object') return e;
  const r = raw as Record<string, unknown>;
  const alloc: Partial<Stats> = {};
  const ra = (r.alloc && typeof r.alloc === 'object' ? r.alloc : {}) as Record<string, unknown>;
  for (const k of STAT_KEYS) { const v = int(ra[k], 0, MAX_STAT_ALLOC); if (v > 0) alloc[k] = v; }
  const owned = Array.isArray(r.owned) ? r.owned.filter((x): x is string => typeof x === 'string' && SHOP.some((s) => s.id === x)) : [];
  const rs = (r.skin && typeof r.skin === 'object' ? r.skin : {}) as Record<string, unknown>;
  const skin: Skin = {
    shirt: int(rs.shirt, -1, SHIRT_PALETTE.length - 1, -1),
    hair: int(rs.hair, -1, HAIR_PALETTE.length - 1, -1),
    band: int(rs.band, -1, BAND_PALETTE.length - 1, -1),
  };
  const p: Progress = { v: 1, xp: int(r.xp, 0, 1e9), gold: int(r.gold, 0, 1e9), matches: int(r.matches, 0, 1e9), kos: int(r.kos, 0, 1e9), wins: int(r.wins, 0, 1e9), alloc, owned, skin, updated: int(r.updated, 0, 1e15) };
  // 안 산 색은 입을 수 없다 · 포인트 초과분은 뒤 스탯부터 뺀다
  for (const k of ['shirt', 'hair', 'band'] as SkinKind[]) if (p.skin[k] >= 0 && !(k === 'shirt' && p.skin[k] < 8) && !owns(p, `${k}:${p.skin[k]}`)) p.skin[k] = -1;
  let over = usedPoints(p) - statPoints(p);
  for (const k of [...STAT_KEYS].reverse()) { if (over <= 0) break; const v = p.alloc[k] ?? 0; const cut = Math.min(v, over); if (cut > 0) { p.alloc[k] = v - cut; over -= cut; } }
  return p;
}
export function loadProgress(): Progress {
  try { const raw = localStorage.getItem(PROGRESS_KEY); return raw ? sanitizeProgress(JSON.parse(raw)) : emptyProgress(); } catch { return emptyProgress(); }
}
export function saveProgress(p: Progress): void {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* 저장 공간 없음 — 세션 안에서는 메모리로 간다 */ }
}
