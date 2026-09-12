// 플랫폼 기록: 점수식·요청 몸체·안내 문구. 전송 자체는 운영 실측(tools/e2e-prod-score.mjs)이 본다.
import { describe, it, expect } from 'vitest';
import { matchScore, buildScoreRequest, scoreNote } from '../src/platform/score.ts';
import type { RankEntry } from '@amp/shared';

const me = (o: Partial<RankEntry> = {}): RankEntry => ({ id: 0, name: '가디', team: 0, kos: 3, deaths: 1, dmg: 240, alive: true, hp: 60, rank: 1, win: true, ...o });

describe('matchScore', () => {
  it('KO 100 · 데미지 1 · 승리 50', () => {
    expect(matchScore(me())).toBe(300 + 240 + 50);
    expect(matchScore(me({ win: false, kos: 0, dmg: 12 }))).toBe(12);
  });
  it('음수 데미지는 0 으로', () => { expect(matchScore(me({ kos: 0, win: false, dmg: -5 }))).toBe(0); });
});

describe('buildScoreRequest', () => {
  it('닉네임·점수·보드·상세를 담는다', () => {
    const r = buildScoreRequest(me(), 'online', '콜로세움', '개인 데스매치', 8);
    expect(r).toEqual({ nickname: '가디', score: 590, board: 'online', detail: '1위/8명 · 3KO · 240dmg · 콜로세움 개인 데스매치' });
  });
});

describe('scoreNote', () => {
  it('새 기록 / 유지 / 실패를 가른다', () => {
    expect(scoreNote('practice', 590, { applied: true, rank: 2 })).toBe('연습 순위표 2위 · 590점 (새 기록)');
    expect(scoreNote('online', 590, { applied: false, rank: 5 })).toBe('온라인 순위표 5위 · 590점 (최고 기록 유지)');
    expect(scoreNote('online', 590, null)).toBe('온라인 기록 590점 · 순위표에 못 올렸습니다');
  });
});
