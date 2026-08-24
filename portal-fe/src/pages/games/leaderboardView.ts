import type { GameLang, ScoreBoardDef, ScoreEntry, ScorePeriod, ScoreTrack } from '../../api/gameApi';

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

/** 한 게임의 기간별 보드. 기간 안에 다시 트랙이 있다 — 축이 둘이라 4장이다. */
export type PeriodBoards = Record<ScorePeriod, TrackBoards>;

export const PERIOD_ORDER: ScorePeriod[] = ['ALL_TIME', 'DAILY'];

export const PERIOD_LABELS: Record<GameLang, Record<ScorePeriod, string>> = {
  ko: { ALL_TIME: '전체', DAILY: '오늘' },
  en: { ALL_TIME: 'All time', DAILY: 'Today' },
};

/** 어느 기간에든 기록이 하나라도 있으면 보여줄 표가 있다는 뜻이다 */
export function hasAnyPeriodRecord(boards: PeriodBoards): boolean {
  return PERIOD_ORDER.some((period) => hasAnyRecord(boards[period]));
}

/**
 * 레일 한 칸이 실제로 보여줄 것 — 오늘 기록이 있으면 오늘을, 없으면 역대를.
 *
 * 오늘 것만 싣게 하면 아무도 안 논 날에는 레일이 통째로 사라진다. 기록이 드문 지금
 * 그런 날이 대부분이라, 살아 있어 보이려던 위젯이 오히려 자주 없는 위젯이 된다.
 */
export function railView(board: { entries: ScoreEntry[]; todayEntries: ScoreEntry[] }): {
  entries: ScoreEntry[];
  period: ScorePeriod;
} {
  return board.todayEntries.length > 0
    ? { entries: board.todayEntries, period: 'DAILY' }
    : { entries: board.entries, period: 'ALL_TIME' };
}

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

/**
 * 처음 보여줄 모드 — 게임이 선언한 첫 보드. 선언이 없으면 null 이고, 그때는 서버에
 * board 를 안 보낸다(= 모드를 나누지 않은 게임의 기본 보드).
 *
 * 트랙과 달리 "기록이 있는 것"으로 고르지 않는다. 모드별 보드는 요청을 하나만 하므로
 * 다른 모드에 기록이 있는지 알 수 없고, 알려고 전부 읽으면 요청이 셋으로 늘어난다.
 */
export function initialBoard(defs: ScoreBoardDef[]): string | null {
  return defs.length > 0 ? defs[0].key : null;
}

/** 모드 이름 — 영문 이름이 없으면 한국어를 그대로 쓴다. 키를 화면에 띄우지는 않는다. */
export function boardLabel(def: ScoreBoardDef, lang: GameLang): string {
  return (lang === 'en' ? def.nameEn : def.name) || def.name || def.key;
}

/**
 * 레일 한 칸의 모드 이름 — 없으면 null 이고, 그때는 칩 자체를 그리지 않는다.
 * 게임이 보낸 키가 아직 카탈로그에 없을 때 이름이 빈다. 그 경우 키(`rockfall`)를 대신
 * 띄우지 않는다 — 화면에 영문 식별자가 나가느니 칩이 없는 편이 낫다.
 */
export function railBoardLabel(
  board: { boardName: string | null; boardNameEn: string | null },
  lang: GameLang,
): string | null {
  return (lang === 'en' ? board.boardNameEn || board.boardName : board.boardName) || null;
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
