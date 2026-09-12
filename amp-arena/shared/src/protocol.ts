// 게임 플랫폼 릴레이(`/ws/games/arena`) 위에서 오가는 아레나 메시지. 릴레이는 `move` 의 `d` 를 열어보지 않고
// 그대로 나르므로, 여기 정의된 것이 방장 ↔ 게스트 사이의 전부다. 권위는 방장 클라이언트(가장 낮은 좌석)에 있다.
import type { Input } from './input.ts';
import type { AccessoryId } from './accessories.ts';
import type { StyleId } from './styles.ts';
import type { MapId } from './maps.ts';
import type { ModeId } from './modes.ts';
import type { Snapshot } from './snapshot.ts';
import type { Stats } from './player.ts';
import type { WorldEvent, RankEntry } from './world.ts';

/** 색 조합 스킨 — 팔레트 인덱스, -1 은 기본(상의는 자리 색, 머리는 직업 색, 머리띠는 주황) */
export interface Skin { shirt: number; hair: number; band: number }

/** 엠블럼(가슴 그림): 12×12 격자를 팔레트 인덱스 한 자리씩 이어 붙인 144자 문자열. 0=투명, 1~9=색.
    자유 그림이 아니라 저해상 격자인 이유는 릴레이(4KB) 안에서 명단에 실어 남에게도 보여야 하기 때문이다 —
    8명치 144자면 약 1.2KB 라 스냅샷과 달리 시작 때 한 번 보내는 cfg 에 든다. */
export const EMBLEM_SIZE = 12;
export const EMBLEM_CELLS = EMBLEM_SIZE * EMBLEM_SIZE;
const EMBLEM_RE = new RegExp(`^[0-9]{${EMBLEM_CELLS}}$`);
export function sanitizeEmblem(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !EMBLEM_RE.test(raw)) return undefined;
  return /[1-9]/.test(raw) ? raw : undefined; // 전부 0(빈 그림)이면 싣지 않는다
}
export function sanitizeSkin(raw: unknown): Skin | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-1, Math.min(hi, Math.round(v))) : -1);
  const s = { shirt: n(r.shirt, 15), hair: n(r.hair, 7), band: n(r.band, 7) };
  return s.shirt < 0 && s.hair < 0 && s.band < 0 ? undefined : s;
}

/** 매치 참가자 한 줄. id = 릴레이 좌석 번호 = 월드 플레이어 번호. stats·skin 은 진행(레벨·상점)에서 온다 */
export interface RosterEntry { id: number; name: string; team: number; acc: AccessoryId; style: StyleId; bot: boolean; stats?: Partial<Stats>; skin?: Skin; emblem?: string }

/** 방장이 정해 뿌리는 매치 설정. 승계 때마다 epoch 가 오르고 host 가 바뀐다. */
export interface MatchConfig {
  epoch: number;
  host: number;
  map: MapId;
  mode: ModeId;
  seconds: number;
  seed: number;
  roster: RosterEntry[];
  /** 관전 좌석 — 명단에 없고 스냅샷만 받는다 (2026-09-12) */
  spectators?: number[];
}

/** 대기실에서 서로에게 알리는 내 선택. 방을 만들 때 정한 매치 설정은 방장 것만 의미가 있다. */
export interface Pick { name: string; acc: AccessoryId; style: StyleId; team: number; spectate?: boolean; stats?: Partial<Stats>; skin?: Skin; emblem?: string } // spectate: 싸우지 않고 본다 — 명단에서 빠진다. stats·skin·emblem: 진행
export interface RoomSettings { map: MapId; mode: ModeId; seconds: number; fillBots: boolean }

/** 게스트 → 방장 (`to` 지정) 또는 방 전체 브로드캐스트 */
export type GuestMsg =
  | { t: 'hi'; pick: Pick; settings?: RoomSettings }  // 브로드캐스트: 입장·선택 변경·새 사람 등장 때 다시
  | { t: 'i'; inputs: Input[] }                         // → 방장, 20Hz (3틱마다 새 입력 3개)
  | { t: 'p'; at: number }                              // → 방장 ping
  | { t: 'q'; at: number }                              // → 방장, 방장 ping 응답
  | { t: 'c'; text: string };                           // 브로드캐스트 채팅

/** 방장 → 게스트 (브로드캐스트, ping 만 `to`) */
export type HostMsg =
  | { t: 'cfg'; cfg: MatchConfig }
  | { t: 's'; e: number; snap: Snapshot; acks: number[]; ev: WorldEvent[] } // 10Hz. acks[좌석] = 그 좌석의 마지막 반영 입력 seq
  | { t: 'end'; e: number; ranking: RankEntry[]; score: [number, number] }
  | { t: 'host'; e: number; host: number }               // 승계: 새 방장이 보낸다
  | { t: 'p'; at: number }
  | { t: 'q'; at: number };

export type ArenaMsg = GuestMsg | HostMsg;

/** 릴레이가 정한 상한 (game/CLAUDE.md 「온라인 대전 릴레이」). 넘기면 연결이 끊긴다. */
export const RELAY_MAX_CHARS = 4096;
export const RELAY_MAX_MSGS_PER_SEC = 40;
/** 우리가 지키는 여유 있는 상한 */
export const RELAY_SAFE_CHARS = 3900;
export const RELAY_SAFE_MSGS_PER_SEC = 36;

export const NICK_MIN = 2;
export const NICK_MAX = 10;
export const CHAT_MAX = 120;

export function sanitizeName(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const s = raw.replace(/[\x00-\x1f<>]/g, '').trim();
  if (s.length < NICK_MIN || s.length > NICK_MAX) return fallback;
  return s;
}

/** 릴레이 `start.players` 로 점유 좌석을 읽는다 — 빈 문자열이 빈 좌석 */
export function occupiedSeats(players: string[]): number[] {
  const out: number[] = [];
  players.forEach((n, i) => { if (n !== '') out.push(i); });
  return out;
}

/** 방장 = 점유 좌석 중 가장 낮은 번호 (릴레이의 정의와 같다) */
export function hostOf(occupied: Iterable<number>): number {
  let h = -1;
  for (const s of occupied) if (h < 0 || s < h) h = s;
  return h;
}
