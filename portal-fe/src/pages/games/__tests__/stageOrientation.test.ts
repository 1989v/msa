import { describe, expect, it } from 'vitest';
import { shouldAutoLandscape, type StageEnv } from '../stageOrientation';

const base: StageEnv = { orientation: 'LANDSCAPE', coarsePointer: true, portrait: true, fullscreen: false };

describe('가로 전용 게임의 자동 가로 전환', () => {
  it('가로 전용 + 터치 + 세로면 전환한다', () => {
    expect(shouldAutoLandscape(base)).toBe(true);
  });

  it('세로 전용·양방 게임은 건드리지 않는다 — 세로가 그 게임의 정답이다', () => {
    expect(shouldAutoLandscape({ ...base, orientation: 'PORTRAIT' })).toBe(false);
    expect(shouldAutoLandscape({ ...base, orientation: 'BOTH' })).toBe(false);
    expect(shouldAutoLandscape({ ...base, orientation: null })).toBe(false);
  });

  it('데스크톱에서는 전환하지 않는다 — 창을 마음대로 돌리면 안 된다', () => {
    expect(shouldAutoLandscape({ ...base, coarsePointer: false })).toBe(false);
  });

  it('이미 가로면 아무것도 하지 않는다', () => {
    expect(shouldAutoLandscape({ ...base, portrait: false })).toBe(false);
  });

  it('이미 전체화면이면 다시 요청하지 않는다 — 두 번 부르면 브라우저가 거절한다', () => {
    expect(shouldAutoLandscape({ ...base, fullscreen: true })).toBe(false);
  });
});
