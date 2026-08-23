import { describe, expect, it } from 'vitest';
import type { ScoreEntry } from '../../../api/gameApi';
import {
  hasAnyRecord,
  initialTrack,
  isMyEntry,
  keepOrPickTrack,
  stepIndex,
  trackedTracks,
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
