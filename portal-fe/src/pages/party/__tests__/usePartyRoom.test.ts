import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePartyRoom } from '../usePartyRoom';

/**
 * 파티 방 소켓 (ADR-0092).
 *
 * **판정 근거는 훅이 내놓은 상태와 소켓으로 나간 메시지**다 — 검사가 자기 사본으로 자리
 * 배정을 계산하면 훅이 메시지를 아예 안 읽어도 초록불이 난다. 그래서 가짜 소켓은
 * 프레임을 나르기만 하고 뜻은 해석하지 않는다.
 */

interface Sent {
  t: string;
  [k: string]: unknown;
}

class FakeSocket {
  static last: FakeSocket | null = null;
  readonly sent: Sent[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    FakeSocket.last = this;
  }

  send(raw: string) {
    this.sent.push(JSON.parse(raw) as Sent);
  }

  close() {
    this.readyState = 3;
  }

  /** 서버가 보낸 한 줄 */
  deliver(msg: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

const socket = () => FakeSocket.last!;

beforeEach(() => {
  FakeSocket.last = null;
  vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
  // 훅이 참조하는 상수 — 가짜 소켓의 readyState 와 비교된다
  (globalThis.WebSocket as unknown as { OPEN: number }).OPEN = 1;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** 방장으로 붙어 좌석 0 을 받은 상태 */
function hostedRoom() {
  const view = renderHook(() => usePartyRoom());
  act(() => view.result.current.host(16));
  act(() => socket().onopen?.());
  act(() => socket().deliver({ t: 'joined', room: 'ABC234', seat: 0, seats: 16, token: 'tok-0' }));
  return view;
}

describe('파티 방 — 자리와 명부', () => {
  it('방을 열면 릴레이에 파티 방 요청을 보낸다 — 코드는 서버가 발급한다', () => {
    const view = renderHook(() => usePartyRoom());
    act(() => view.result.current.host(16));
    act(() => socket().onopen?.());

    const join = socket().sent.find((m) => m.t === 'join')!;
    expect(join.room).toBeNull();
    expect(join.private).toBe(true);
    // 자동 마감이 걸리면 설정하는 도중에 판이 시작된다
    expect(join.manualStart).toBe(true);
    expect(join.seats).toBe(16);
  });

  it('좌석과 토큰을 받아 든다 — 토큰이 없으면 투표도 채점도 못 낸다', () => {
    const view = hostedRoom();

    expect(view.result.current.room.room).toBe('ABC234');
    expect(view.result.current.room.seat).toBe(0);
    expect(view.result.current.room.token).toBe('tok-0');
    expect(view.result.current.room.occupied).toEqual([0]);
  });

  it('누가 들어오면 자리에 더하고 방장이 명부를 다시 뿌린다', async () => {
    const view = hostedRoom();
    act(() => view.result.current.shareRoster(['민수', '영희']));
    // shareRoster 자신이 한 번 뿌린다 — 그 방송을 세어 두지 않으면 「다시 뿌렸는가」가
    // 아니라 「한 번이라도 뿌렸는가」를 재게 되어, 재방송을 지워도 통과한다
    const before = socket().sent.filter((m) => m.t === 'move').length;

    await act(async () => {
      socket().deliver({ t: 'seat', seat: 1, nick: '' });
      await Promise.resolve();
    });

    expect(view.result.current.room.occupied).toEqual([0, 1]);
    const broadcasts = socket().sent.filter((m) => m.t === 'move');
    expect(broadcasts.length).toBeGreaterThan(before);
    const last = broadcasts[broadcasts.length - 1].d as { roster: string[] };
    expect(last.roster).toEqual(['민수', '영희']);
  });

  it('참가자가 고른 이름을 방장이 그 좌석에 기록한다', async () => {
    const view = hostedRoom();
    act(() => view.result.current.shareRoster(['민수', '영희']));

    await act(async () => {
      socket().deliver({ t: 'move', seat: 2, d: { claim: '영희' } });
      await Promise.resolve();
    });

    expect(view.result.current.room.roster.taken[2]).toBe('영희');
  });

  it('나가면 그 자리의 이름이 풀린다 — 안 풀면 그 이름을 아무도 못 고른다', async () => {
    const view = hostedRoom();
    act(() => view.result.current.shareRoster(['민수', '영희']));
    await act(async () => {
      socket().deliver({ t: 'seat', seat: 1, nick: '' });
      socket().deliver({ t: 'move', seat: 1, d: { claim: '민수' } });
      await Promise.resolve();
    });
    expect(view.result.current.room.roster.taken[1]).toBe('민수');

    await act(async () => {
      socket().deliver({ t: 'left', seat: 1 });
      await Promise.resolve();
    });

    expect(view.result.current.room.roster.taken[1]).toBeUndefined();
    expect(view.result.current.room.occupied).toEqual([0]);
  });

  it('참가자는 방장이 뿌린 명부를 받아 이름 목록을 그린다', () => {
    const view = renderHook(() => usePartyRoom());
    act(() => view.result.current.join('ABC234'));
    act(() => socket().onopen?.());
    act(() => socket().deliver({ t: 'joined', room: 'ABC234', seat: 3, seats: 16, token: 'tok-3' }));

    act(() => socket().deliver({ t: 'move', seat: 0, d: { roster: ['민수', '영희'], taken: { 1: '민수' } } }));

    expect(view.result.current.room.roster.names).toEqual(['민수', '영희']);
    expect(view.result.current.room.roster.taken[1]).toBe('민수');
  });

  it('참가자의 이름 선택은 방장에게만 간다 — 방 전체에 뿌리면 대역폭이 좌석 수만큼 는다', () => {
    const view = renderHook(() => usePartyRoom());
    act(() => view.result.current.join('ABC234'));
    act(() => socket().onopen?.());
    act(() => socket().deliver({ t: 'joined', room: 'ABC234', seat: 3, seats: 16, token: 'tok-3' }));

    act(() => view.result.current.claimName('철수'));

    const claim = socket().sent.find((m) => m.t === 'move' && (m.d as { claim?: string }).claim)!;
    expect(claim.to).toBe(0);
    // 방장의 방송을 기다리지 않고 내 화면에 먼저 반영한다
    expect(view.result.current.room.roster.taken[3]).toBe('철수');
  });

  it('판이 열리면 설정을 들고 온다 — 참가자는 이걸로 어느 게임인지 안다', () => {
    const view = hostedRoom();

    act(() =>
      socket().deliver({
        t: 'start',
        seed: 7,
        round: 1,
        token: 'tok-round-1',
        players: ['', ''],
        cfg: { game: 'seven-seconds', names: ['민수', '영희'], mode: 'last' },
      }),
    );

    expect(view.result.current.room.cfg).toEqual({
      game: 'seven-seconds',
      names: ['민수', '영희'],
      mode: 'last',
    });
    // 판마다 새 토큰이 온다 — 지난 판 토큰으로는 제출할 수 없다
    expect(view.result.current.room.token).toBe('tok-round-1');
    expect(view.result.current.room.round).toBe(1);
  });

  it('연결이 끊기면 알린다 — 릴레이는 단일 노드라 재배포에 방이 사라진다', () => {
    const view = hostedRoom();

    act(() => socket().onclose?.());

    expect(view.result.current.room.lost).toBe(true);
    expect(view.result.current.room.connected).toBe(false);
  });
});
