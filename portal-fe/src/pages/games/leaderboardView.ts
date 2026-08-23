import type { GameLang, ScoreEntry, ScoreTrack } from '../../api/gameApi';

/** 한 게임의 트랙별 보드. 둘 다 비어 있는 것이 지금 대부분의 게임에서 **정상 상태**다. */
export type TrackBoards = Record<ScoreTrack, ScoreEntry[]>;

export const TRACK_ORDER: ScoreTrack[] = ['BASE', 'MODDED'];

/**
 * 트랙 이름은 게임 안 랭킹 위젯(`public/games/lib/rank.js`)이 쓰는 낱말을 그대로 쓴다.
 * 같은 보드를 게임 안팎에서 다른 이름으로 부르면 다른 보드로 읽힌다.
 */
export const TRACK_LABELS: Record<GameLang, Record<ScoreTrack, string>> = {
  ko: { BASE: '무강화', MODDED: '강화' },
  en: { BASE: 'No upgrades', MODDED: 'Upgraded' },
};

/** 기록이 있는 트랙만. 빈 탭을 띄우느니 탭 자체를 없앤다. */
export function trackedTracks(boards: TrackBoards): ScoreTrack[] {
  return TRACK_ORDER.filter((track) => boards[track].length > 0);
}

/**
 * 처음 보여줄 트랙 — 기록이 있는 쪽이고, 둘 다 있으면 무강화가 기본 보드다.
 * 하나도 없으면 null: 보여줄 표가 아니라 "첫 기록에 도전" 안내가 나갈 자리라는 뜻이다.
 */
export function initialTrack(boards: TrackBoards): ScoreTrack | null {
  return trackedTracks(boards)[0] ?? null;
}

export function hasAnyRecord(boards: TrackBoards): boolean {
  return trackedTracks(boards).length > 0;
}

/**
 * 트랙 전환 시 다음 선택 — 이미 보고 있던 트랙에 기록이 남아 있으면 유지하고,
 * 아니면 기록이 있는 트랙으로 옮긴다 (새로고침으로 보드가 바뀌는 경우).
 */
export function keepOrPickTrack(current: ScoreTrack | null, boards: TrackBoards): ScoreTrack | null {
  if (current && boards[current].length > 0) return current;
  return initialTrack(boards);
}

/** 회전 인덱스 — 끝에서 처음으로 돌아온다. 빈 목록은 0. */
export function stepIndex(current: number, length: number, delta: number): number {
  if (length <= 0) return 0;
  return (((current + delta) % length) + length) % length;
}

/** 내 기록 판정 — 게스트 제출을 허용하므로 닉네임이 곧 신원이다. */
export function isMyEntry(entry: ScoreEntry, nickname: string | null): boolean {
  return !!nickname && entry.nickname === nickname;
}
