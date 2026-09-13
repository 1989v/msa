import { describe, expect, it } from 'vitest';
import { shouldEnterFullStage, type StageEnv } from '../stageOrientation';

const base: StageEnv = { orientation: 'LANDSCAPE', fullscreen: false };

describe('가로 전용 게임을 시작할 때 무대를 전체화면으로', () => {
  it('가로 전용 게임이면 전체화면으로 올린다', () => {
    expect(shouldEnterFullStage(base)).toBe(true);
  });

  it('데스크톱에서도 올린다 — 1440×900 창의 무대는 521px 라 대기실 659px 가 잘렸다', () => {
    expect(shouldEnterFullStage({ orientation: 'LANDSCAPE', fullscreen: false })).toBe(true);
  });

  it('세로 전용·양방 게임은 건드리지 않는다 — 세로가 그 게임의 정답이다', () => {
    expect(shouldEnterFullStage({ ...base, orientation: 'PORTRAIT' })).toBe(false);
    expect(shouldEnterFullStage({ ...base, orientation: 'BOTH' })).toBe(false);
    expect(shouldEnterFullStage({ ...base, orientation: null })).toBe(false);
    expect(shouldEnterFullStage({ ...base, orientation: undefined })).toBe(false);
  });

  it('이미 전체화면이면 다시 요청하지 않는다 — 두 번 부르면 브라우저가 거절한다', () => {
    expect(shouldEnterFullStage({ ...base, fullscreen: true })).toBe(false);
  });
});
