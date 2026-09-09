import { describe, expect, it } from 'vitest';
import {
  candidates,
  needsInputRelay,
  randomFrom,
  supportsRoundOptions,
  votingApplies,
  type PartyGame,
} from '../gameChoice';

const GAMES: PartyGame[] = [
  { slug: 'marble-race', title: '구슬 레이스', tags: ['roster-ready'] },
  { slug: 'ladder-draw', title: '사다리타기', tags: ['roster-ready'] },
  { slug: 'card-flip', title: '카드 뽑기', tags: ['roster-ready', 'relay-ready', 'input-decides'] },
  { slug: 'seven-seconds', title: '7초를 맞춰라', tags: ['roster-ready', 'relay-ready', 'interactive-party'] },
  { slug: 'abyssal-crown', title: '심연의 왕관', tags: ['action'] },
];

describe('SR-5 게임 선정 — 갈래가 셋', () => {
  it('T19 [게임 픽] 은 명부를 읽는 게임만 낸다', () => {
    expect(candidates(GAMES, 'pick').map((g) => g.slug)).toEqual([
      'marble-race',
      'ladder-draw',
      'card-flip',
      'seven-seconds',
    ]);
  });

  it('T49 [랜덤] 에 참여형이 섞이지 않는다 — 지켜보려던 사람이 조작을 요구받으면 안 된다', () => {
    const pool = candidates(GAMES, 'random').map((g) => g.slug);
    expect(pool).toEqual(['marble-race', 'ladder-draw', 'card-flip']);
    expect(pool).not.toContain('seven-seconds');
  });

  it('참여형 목록은 참여형만 낸다 — 두 갈래가 겹치면 고르는 뜻이 없다', () => {
    expect(candidates(GAMES, 'interactive').map((g) => g.slug)).toEqual(['seven-seconds']);
    const random = new Set(candidates(GAMES, 'random').map((g) => g.slug));
    expect(candidates(GAMES, 'interactive').some((g) => random.has(g.slug))).toBe(false);
  });

  it('명부를 안 읽는 게임은 어느 갈래에도 안 나온다', () => {
    (['pick', 'random', 'interactive'] as const).forEach((b) => {
      expect(candidates(GAMES, b).map((g) => g.slug)).not.toContain('abyssal-crown');
    });
  });

  it('T37 새 필드를 안 읽는 게임은 조절 불가로 표시된다', () => {
    expect(supportsRoundOptions(GAMES[0])).toBe(true);
    expect(supportsRoundOptions(GAMES[4])).toBe(false);
  });

  it('입력 중계가 필요한 게임을 가려낸다 — 안 하면 기기마다 다른 판이 된다', () => {
    expect(needsInputRelay(GAMES[2])).toBe(true);
    expect(needsInputRelay(GAMES[0])).toBe(false);
    expect(needsInputRelay(GAMES[3])).toBe(false);
  });

  it('T50 [랜덤] 은 목록 안에서만 고른다', () => {
    const pool = candidates(GAMES, 'random');
    for (let i = 0; i < 30; i++) {
      expect(pool).toContain(randomFrom(pool));
    }
  });

  it('고를 것이 없으면 null 을 낸다 — 화면이 안내하고 자리가 멈추지 않는다', () => {
    expect(randomFrom([])).toBeNull();
  });

  it('T18 투표는 [참여형] → [하나 픽] 에서만 뜬다', () => {
    expect(votingApplies('interactive', 'pick')).toBe(true);
    expect(votingApplies('interactive', 'random')).toBe(false);
    expect(votingApplies('random', 'pick')).toBe(false);
    expect(votingApplies('pick', 'pick')).toBe(false);
  });
});
