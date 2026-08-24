import { describe, expect, it } from 'vitest';
import type { ScoreEntry } from '../../../api/gameApi';
import {
  boardLabel,
  hasAnyPeriodRecord,
  initialBoard,
  railBoardLabel,
  hasAnyRecord,
  initialTrack,
  isMyEntry,
  keepOrPickTrack,
  railView,
  stepIndex,
  trackedTracks,
  type PeriodBoards,
  type TrackBoards,
} from '../leaderboardView';

const entry = (rank: number, nickname: string): ScoreEntry => ({ rank, nickname, score: 100 - rank, detail: null });

const boards = (base: ScoreEntry[], modded: ScoreEntry[]): TrackBoards => ({ BASE: base, MODDED: modded });

describe('보드 트랙 — 무강화/강화는 합치지 않는다', () => {
  it('기록이 있는 트랙만 탭이 된다', () => {
    expect(trackedTracks(boards([entry(1, '가')], []))).toEqual(['BASE']);
    expect(trackedTracks(boards([], [entry(1, '나')]))).toEqual(['MODDED']);
    expect(trackedTracks(boards([entry(1, '가')], [entry(1, '나')]))).toEqual(['BASE', 'MODDED']);
  });

  it('기록이 하나도 없으면 탭도 기본 트랙도 없다 — 이게 대부분의 게임의 정상 상태다', () => {
    const empty = boards([], []);
    expect(trackedTracks(empty)).toEqual([]);
    expect(initialTrack(empty)).toBeNull();
    expect(hasAnyRecord(empty)).toBe(false);
  });

  it('둘 다 있으면 무강화가 기본 보드다', () => {
    expect(initialTrack(boards([entry(1, '가')], [entry(1, '나')]))).toBe('BASE');
  });

  it('무강화가 비어 있으면 강화 보드로 연다 — 빈 탭을 먼저 보여주지 않는다', () => {
    expect(initialTrack(boards([], [entry(1, '나')]))).toBe('MODDED');
  });

  it('보고 있던 트랙에 기록이 남아 있으면 새로 읽어도 그 트랙을 유지한다', () => {
    expect(keepOrPickTrack('MODDED', boards([entry(1, '가')], [entry(1, '나')]))).toBe('MODDED');
  });

  it('보고 있던 트랙이 비면 기록이 있는 트랙으로 옮긴다', () => {
    expect(keepOrPickTrack('MODDED', boards([entry(1, '가')], []))).toBe('BASE');
    expect(keepOrPickTrack('BASE', boards([], []))).toBeNull();
  });
});

describe('레일 회전 인덱스', () => {
  it('끝에서 처음으로, 처음에서 끝으로 돌아온다', () => {
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 3, -1)).toBe(2);
    expect(stepIndex(0, 3, 1)).toBe(1);
  });

  it('한 칸뿐이면 어디로 가도 제자리다', () => {
    expect(stepIndex(0, 1, 1)).toBe(0);
    expect(stepIndex(0, 1, -1)).toBe(0);
  });

  it('빈 목록은 0 — 인덱스가 범위를 벗어나지 않는다', () => {
    expect(stepIndex(5, 0, 1)).toBe(0);
  });

  it('범위를 벗어난 인덱스도 delta 0 으로 접어 넣을 수 있다', () => {
    expect(stepIndex(7, 3, 0)).toBe(1);
  });
});

describe('내 기록 판정 — 닉네임이 곧 신원이다 (게스트 제출 허용)', () => {
  it('닉네임이 없으면 어떤 줄도 내 것이 아니다', () => {
    expect(isMyEntry(entry(1, '가'), null)).toBe(false);
    expect(isMyEntry(entry(1, '가'), '')).toBe(false);
  });

  it('정확히 같은 닉네임만 내 줄이다', () => {
    expect(isMyEntry(entry(1, '가'), '가')).toBe(true);
    expect(isMyEntry(entry(1, '가'), '가나')).toBe(false);
  });
});

describe('보드 기간 — 전체와 오늘은 서로 다른 원장이다', () => {
  const periods = (allTime: TrackBoards, daily: TrackBoards): PeriodBoards => ({
    ALL_TIME: allTime,
    DAILY: daily,
  });

  it('어느 기간에든 기록이 있으면 보여줄 표가 있다', () => {
    expect(hasAnyPeriodRecord(periods(boards([entry(1, '가')], []), boards([], [])))).toBe(true);
    expect(hasAnyPeriodRecord(periods(boards([], []), boards([], [entry(1, '나')])))).toBe(true);
  });

  it('어느 기간에도 기록이 없으면 토글도 세우지 않는다', () => {
    expect(hasAnyPeriodRecord(periods(boards([], []), boards([], [])))).toBe(false);
  });

  it('오늘이 비어 있어도 전체에 기록이 있으면 토글은 선다 — 빈 오늘은 초대다', () => {
    const withEmptyDay = periods(boards([entry(1, '가')], []), boards([], []));
    expect(hasAnyPeriodRecord(withEmptyDay)).toBe(true);
    expect(hasAnyRecord(withEmptyDay.DAILY)).toBe(false);
  });

  it('기간을 옮겼을 때 그 기간에 없는 트랙은 있는 트랙으로 옮겨 준다', () => {
    const daily = boards([], [entry(1, '강화오늘')]);
    expect(keepOrPickTrack('BASE', daily)).toBe('MODDED');
  });
});

describe('레일이 실을 보드 고르기', () => {
  const rail = (todayEntries: ReturnType<typeof entry>[]) => ({
    entries: [entry(1, '역대1등')],
    todayEntries,
  });

  it('오늘 기록이 있으면 오늘 것을 싣는다', () => {
    const view = railView(rail([entry(1, '오늘1등')]));
    expect(view.period).toBe('DAILY');
    expect(view.entries.map((e) => e.nickname)).toEqual(['오늘1등']);
  });

  it('오늘 아무도 안 놀았으면 역대 기록으로 채운다 — 레일이 사라지지 않는다', () => {
    const view = railView(rail([]));
    expect(view.period).toBe('ALL_TIME');
    expect(view.entries.map((e) => e.nickname)).toEqual(['역대1등']);
  });
});

describe('모드 보드', () => {
  const MODES = [
    { key: 'leak', name: '물 막기', nameEn: 'Water' },
    { key: 'rockfall', name: '돌 막기', nameEn: null },
  ];

  it('처음 보여줄 모드는 선언된 첫 보드다', () => {
    expect(initialBoard(MODES)).toBe('leak');
  });

  it('모드를 안 나눈 게임은 null — 그때는 board 를 아예 안 보낸다', () => {
    expect(initialBoard([])).toBeNull();
  });

  it('영문 이름이 없으면 한국어를 그대로 쓴다 — 키를 화면에 띄우지 않는다', () => {
    expect(boardLabel(MODES[0], 'en')).toBe('Water');
    expect(boardLabel(MODES[1], 'en')).toBe('돌 막기');
    expect(boardLabel(MODES[1], 'ko')).toBe('돌 막기');
  });

  it('레일 칩은 카탈로그에 이름이 없으면 아예 안 뜬다 — 영문 식별자가 나가느니 없는 게 낫다', () => {
    expect(railBoardLabel({ boardName: '돌 막기', boardNameEn: 'Rocks' }, 'en')).toBe('Rocks');
    expect(railBoardLabel({ boardName: '돌 막기', boardNameEn: null }, 'en')).toBe('돌 막기');
    expect(railBoardLabel({ boardName: null, boardNameEn: null }, 'ko')).toBeNull();
  });
});
