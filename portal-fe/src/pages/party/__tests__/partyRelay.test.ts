import { describe, expect, it } from 'vitest';
import { EMPTY_STATE, errorText, inviteLink, isHost, isSpectator, reduce } from '../partyRelay';

describe('파티 방 상태', () => {
  it('좌석을 받으면 토큰도 함께 온다 — 같은 메시지다', () => {
    const s = reduce(EMPTY_STATE, { t: 'joined', room: 'ABC123', seat: 0, seats: 6, token: 'tk' });
    expect(s.room).toBe('ABC123');
    expect(s.token).toBe('tk');
    expect(isSpectator(s)).toBe(false);
  });

  it('T22 관전자는 좌석도 토큰도 없다 — 제출할 수단 자체가 없다', () => {
    const s = reduce(EMPTY_STATE, { t: 'joined', room: 'ABC123', seat: -1, seats: 6 });
    expect(isSpectator(s)).toBe(true);
    expect(s.token).toBe('');
  });

  it('판마다 새 토큰으로 갈아탄다 — 지난 판 토큰으로는 제출할 수 없다', () => {
    let s = reduce(EMPTY_STATE, { t: 'joined', room: 'R', seat: 1, seats: 6, token: 'join' });
    s = reduce(s, { t: 'start', round: 1, players: ['가', '나'], token: 'r1' });
    expect(s.token).toBe('r1');
    expect(s.round).toBe(1);
  });

  it('방장은 남은 좌석 중 가장 낮은 번호다 — 승계 후에도 같은 규칙', () => {
    const host = reduce(EMPTY_STATE, { t: 'joined', room: 'R', seat: 0, seats: 6 });
    const guest = reduce(EMPTY_STATE, { t: 'joined', room: 'R', seat: 2, seats: 6 });
    expect(isHost(host, [0, 2])).toBe(true);
    expect(isHost(guest, [0, 2])).toBe(false);
    // 좌석 0 이 나가면 2 가 잇는다
    expect(isHost(guest, [2])).toBe(true);
  });

  it('T23 자리 경합 거절이 복귀 안내와 함께 온다 — 막다른 길을 만들지 않는다', () => {
    const s = reduce(EMPTY_STATE, { t: 'error', code: 'ROOM_FULL' });
    expect(s.error).toContain('관전');
  });

  it('T36 모르는 오류도 무엇을 하면 되는지 알린다', () => {
    expect(errorText('WHATEVER')).toContain('새 방을 열어');
  });

  it('초대 링크에 별칭이 없다 — 웹서버 접근 로그에 남는다', () => {
    const link = inviteLink('ABC123', 'https://game.1989v.com');
    expect(link).toBe('https://game.1989v.com/party/ABC123');
    expect(link).not.toMatch(/민수|names|nick/);
  });

  it('모르는 메시지는 상태를 안 바꾼다', () => {
    const s = reduce(EMPTY_STATE, { t: 'pong' });
    expect(s).toBe(EMPTY_STATE);
  });
});
