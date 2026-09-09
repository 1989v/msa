import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const GAMES_ROOT = resolve(__dirname, '../../public/games');

/** 가짜 WebSocket — 보낸 것을 모으고, 받은 것을 흘려 넣는다 */
class FakeSocket {
  static last: FakeSocket | null = null;
  readyState = 1;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    FakeSocket.last = this;
  }
  send(s: string) {
    this.sent.push(s);
  }
  close() {
    this.readyState = 3;
  }
  /** 서버가 보낸 것처럼 */
  deliver(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
  frames() {
    return this.sent.map((s) => JSON.parse(s));
  }
}

function loadRelay() {
  const sandbox: Record<string, any> = {
    console,
    JSON,
    Uint8Array,
    String,
    setInterval: () => 0,
    clearInterval: () => {},
    crypto: { getRandomValues: (a: Uint8Array) => a.fill(7) },
    localStorage: { getItem: () => '민수' },
    location: { protocol: 'https:', host: 'game.1989v.com' },
    WebSocket: FakeSocket,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(readFileSync(resolve(GAMES_ROOT, 'lib/relay.js'), 'utf-8'), ctx);
  return sandbox;
}

describe('공용 릴레이 클라이언트', () => {
  it('파티 방 만들기는 대기열을 우회하고 마감·잠금을 면제받는다', () => {
    const g = loadRelay();
    const net = g.GameRelay.create({ slug: 'party', nick: '방장' });
    net.createParty({ seats: 6 });
    FakeSocket.last!.onopen!();

    const join = FakeSocket.last!.frames()[0];
    expect(join).toMatchObject({ t: 'join', room: null, seats: 6, private: true, manualStart: true });
  });

  it('초대 링크 입장은 코드를 실어 보내고 방을 만들지 않는다', () => {
    const g = loadRelay();
    const net = g.GameRelay.create({ slug: 'party' });
    net.enterParty('ABC123', { spectate: true });
    FakeSocket.last!.onopen!();

    expect(FakeSocket.last!.frames()[0]).toMatchObject({
      t: 'join',
      room: 'ABC123',
      private: true,
      spectate: true,
    });
  });

  it('좌석 토큰을 들고 있고, 판마다 새 토큰으로 갈아탄다', () => {
    const g = loadRelay();
    const net = g.GameRelay.create({ slug: 'party' });
    net.createParty({});
    FakeSocket.last!.onopen!();

    FakeSocket.last!.deliver({ t: 'joined', room: 'ROOM01', seat: 0, seats: 6, token: 'join-token' });
    expect(net.state.token).toBe('join-token');
    expect(net.state.spectator).toBe(false);

    FakeSocket.last!.deliver({ t: 'start', seed: 42, players: ['방장'], round: 1, token: 'round1' });
    expect(net.state.token).toBe('round1');
    expect(net.state.round).toBe(1);
  });

  it('관전자는 좌석이 없고 토큰도 없다', () => {
    const g = loadRelay();
    const net = g.GameRelay.create({ slug: 'party' });
    net.enterParty('ROOM01', { spectate: true });
    FakeSocket.last!.onopen!();

    FakeSocket.last!.deliver({ t: 'joined', room: 'ROOM01', seat: -1, seats: 6 });
    expect(net.state.spectator).toBe(true);
    expect(net.state.token).toBe('');
  });

  it('시작 명령이 설정을 실어 보낸다 — 시드는 서버가 돌려준다', () => {
    const g = loadRelay();
    const net = g.GameRelay.create({ slug: 'party' });
    net.createParty({});
    FakeSocket.last!.onopen!();
    net.startRound({ course: 'pinball', pick: 1 });

    const start = FakeSocket.last!.frames().find((f) => f.t === 'start');
    expect(start.cfg).toEqual({ course: 'pinball', pick: 1 });
    // 클라이언트가 시드를 보내지 않는다 — 보내도 서버가 무시하지만 애초에 안 만든다
    expect(start.seed).toBeUndefined();
  });

  it('대전 경로는 파티 옵션을 안 붙인다 — 배포된 계약 그대로', () => {
    const g = loadRelay();
    const net = g.GameRelay.create({ slug: 'echo-duel' });
    net.connect();
    FakeSocket.last!.onopen!();

    const join = FakeSocket.last!.frames()[0];
    expect(join.private).toBeUndefined();
    expect(join.manualStart).toBeUndefined();
  });

  it('서버 ping 에 pong 으로 답한다 — 유휴 종료를 안 맞는다', () => {
    const g = loadRelay();
    const net = g.GameRelay.create({ slug: 'party' });
    net.createParty({});
    FakeSocket.last!.onopen!();
    FakeSocket.last!.deliver({ t: 'ping' });

    expect(FakeSocket.last!.frames().some((f) => f.t === 'pong')).toBe(true);
  });

  it('2석 방의 opponentLeft 를 좌석 번호로 바꿔 준다 — 배포된 이름을 서버가 안 바꿔도 되게', () => {
    const g = loadRelay();
    const seen: number[] = [];
    const net = g.GameRelay.create({ slug: 'echo-duel', onLeft: (m: any) => seen.push(m.seat) });
    net.connect();
    FakeSocket.last!.onopen!();
    FakeSocket.last!.deliver({ t: 'joined', room: 'R', seat: 0, seats: 2 });
    FakeSocket.last!.deliver({ t: 'opponentLeft' });

    expect(seen).toEqual([1]);
  });
});

describe('T59 정적 게이트 — 사본이 다시 생기지 않는다', () => {
  /**
   * 게임 21곳이 각자 토큰 읽기를 복사해 갖고 있다가 쿠키 전환이 통째로 지나간 사고와
   * 같은 모양을 막는다(ADR-0079). 새 게임이 릴레이에 붙으면서 WS 코드를 인라인으로
   * 붙여넣으면 여기서 잡힌다.
   */
  it('공용 클라이언트가 존재하고 파티 옵션을 갖는다', () => {
    const src = readFileSync(resolve(GAMES_ROOT, 'lib/relay.js'), 'utf-8');
    expect(src).toMatch(/createParty/);
    expect(src).toMatch(/enterParty/);
    expect(src).toMatch(/manualStart/);
  });

  it('새로 릴레이에 붙는 게임은 lib/relay.js 를 쓴다', () => {
    // 기존 3종(echo-duel·sketch-sleuth·frost-outpost)은 이 규칙이 생기기 전에 배포됐다.
    // 그 셋을 옮기는 것은 별건이라 예외로 두되, **목록을 늘리지 못하게** 여기 박아 둔다.
    const GRANDFATHERED = ['echo-duel', 'sketch-sleuth', 'frost-outpost', 'last-one', 'deep-night'];

    const offenders: string[] = [];
    for (const slug of readdirSync(GAMES_ROOT, { withFileTypes: true })) {
      if (!slug.isDirectory() || slug.name === 'lib' || slug.name === '_src') continue;
      const html = resolve(GAMES_ROOT, slug.name, 'index.html');
      if (!existsSync(html)) continue;
      const src = readFileSync(html, 'utf-8');
      const usesRelay = /\/ws\/games\//.test(src) || /new WebSocket\(/.test(src);
      const usesLib = /lib\/relay\.js/.test(src);
      if (usesRelay && !usesLib && !GRANDFATHERED.includes(slug.name)) offenders.push(slug.name);
    }
    expect(offenders, '릴레이를 인라인으로 붙여넣은 게임').toEqual([]);
  });
});
