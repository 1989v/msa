import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const GAMES_ROOT = resolve(__dirname, '../../public/games');

/** 배포된 파서를 그대로 올린다 — 흉내 내면 「v 를 올리면 죽는다」를 못 잰다 */
function loadParser(stored: unknown) {
  const store = new Map<string, string>();
  if (stored !== undefined) store.set('kgd.party.v1', JSON.stringify(stored));
  const sandbox: Record<string, any> = {
    JSON,
    Date,
    String,
    Math,
    isFinite,
    parseInt,
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      removeItem: (k: string) => store.delete(k),
    },
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(readFileSync(resolve(GAMES_ROOT, 'lib/party.js'), 'utf-8'), ctx);
  return sandbox.GameParty;
}

const BASE = {
  v: 1,
  slug: 'marble-race',
  names: ['민수', '영희', '철수', '지훈'],
  mode: 'last',
  at: Date.now(),
};

describe('T42 명부 규약 — 버전을 올리지 않는다', () => {
  it('v:1 이면 인계를 받아낸다', () => {
    const p = loadParser(BASE).take('marble-race');
    expect(p).not.toBeNull();
    expect(p.names).toEqual(BASE.names);
  });

  it('**v 를 2로 올리면 인계가 통째로 죽는다** — 새 필드가 무시되는 게 아니다', () => {
    // 이 검사가 「버전을 올리지 않는다」의 근거다. 배포된 파서가 모르는 버전을 버리므로
    // 사용자에게는 참가자 이름을 다시 입력하는 화면이 뜬다.
    expect(loadParser({ ...BASE, v: 2 }).take('marble-race')).toBeNull();
  });

  it('새 선택 필드를 얹어도 v:1 파서가 그대로 받아낸다 — 가법 확장', () => {
    const p = loadParser({ ...BASE, pick: 2, weights: [3, 1, 1, 1], room: 'ABC123' }).take('marble-race');
    expect(p).not.toBeNull();
    expect(p.pick).toBe(2);
    expect(p.weights).toEqual([3, 1, 1, 1]);
    expect(p.room).toBe('ABC123');
  });

  it('선택 필드가 없으면 기본값으로 돈다 — 규약을 못 읽는 게임과 같은 상태', () => {
    const p = loadParser(BASE).take('marble-race');
    expect(p.pick).toBe(1);
    expect(p.weights).toEqual([1, 1, 1, 1]);
    expect(p.room).toBeNull();
  });

  it('T45 mode:order 에서는 걸리는 인원 수가 뜻이 없어 1 로 접힌다', () => {
    const p = loadParser({ ...BASE, mode: 'order', pick: 3 }).take('marble-race');
    expect(p.mode).toBe('order');
    expect(p.pick).toBe(1);
  });

  it('걸리는 인원은 참가자 수보다 작다 — 전원이 걸리면 정하는 것이 없다', () => {
    const p = loadParser({ ...BASE, pick: 99 }).take('marble-race');
    expect(p.pick).toBe(BASE.names.length - 1);
  });

  it('비율은 상한을 넘지 않는다 — 한 사람이 판을 덮으면 지켜보는 재미가 사라진다', () => {
    const p = loadParser({ ...BASE, weights: [99, 0, -3, 2] }).take('marble-race');
    expect(p.weights).toEqual([9, 1, 1, 2]);
  });

  it('읽으면 지운다 — 새로고침이 같은 판을 다시 열지 않는다', () => {
    const gp = loadParser(BASE);
    expect(gp.take('marble-race')).not.toBeNull();
    expect(gp.take('marble-race')).toBeNull();
  });
});

describe('SR-3.6 결정자 3종이 인원 수·비율을 실현한다', () => {
  const boot = (slug: string) => readFileSync(resolve(GAMES_ROOT, slug, 'js/main.js'), 'utf-8');

  it('구슬 레이스 — 비율을 이름 뒤 xN 으로, 걸리는 인원을 등수 지목으로 옮긴다', () => {
    const src = boot('marble-race');
    expect(src).toMatch(/party\.weights/);
    expect(src).toMatch(/' x' \+ w/);
    expect(src).toMatch(/Meta\.setRank/);
  });

  it('카드 뽑기 — 비율을 카드 장수로, 걸리는 인원을 여러 명 뽑기로 옮긴다', () => {
    const src = boot('card-flip');
    expect(src).toMatch(/party\.weights/);
    expect(src).toMatch(/Meta\.setHits\(party\.pick\)/);
    expect(src).toMatch(/'several'/);
  });

  it('사다리타기 — 비율을 줄 개수로, 걸리는 인원을 걸림 칸 수로 옮긴다', () => {
    const src = boot('ladder-draw');
    expect(src).toMatch(/party\.weights/);
    expect(src).toMatch(/Meta\.setHits\(party\.pick\)/);
    // 걸림 판정이 「0번 칸」이 아니라 「hits 개 칸」을 본다
    const game = readFileSync(resolve(GAMES_ROOT, 'ladder-draw/js/game.js'), 'utf-8');
    expect(game).toMatch(/S\.L\.ends\[slot\] < \(S\.hits \|\| 1\)/);
  });

  it('세 게임 모두 party.pick 을 읽는다 — 한 곳만 빠지면 그 게임에서 설정이 조용히 무시된다', () => {
    for (const slug of ['marble-race', 'card-flip', 'ladder-draw']) {
      expect(boot(slug), slug).toMatch(/party\.pick/);
    }
  });
});

describe('T24 카드 뽑기 — 입력이 결과를 바꾸므로 중계한다', () => {
  const src = readFileSync(resolve(GAMES_ROOT, 'card-flip/js/main.js'), 'utf-8');

  it('내가 뒤집으면 방에 알린다', () => {
    expect(src).toMatch(/partyNet\.move\(\{ flip: i \}\)/);
  });

  it('거절된 입력은 안 뿌린다 — 뿌리면 남의 판이 어긋난다', () => {
    expect(src).toMatch(/if \(ok && partyNet\)/);
  });

  it('남이 뒤집은 것도 **같은 경로**를 탄다 — 경로가 갈리면 판이 갈린다', () => {
    expect(src).toMatch(/function applyRemoteFlip\(i\) \{ flipLocal\(i, true\); \}/);
    expect(src).toMatch(/function tryFlip\(i\) \{\s*var ok = flipLocal\(i, false\);/);
  });

  it('파티 화면이 배선할 수 있게 전역으로 낸다 — iframe 이라 부모가 직접 못 부른다', () => {
    expect(src).toMatch(/global\.CardFlipParty = \{ attach: setPartyNet, remoteFlip: applyRemoteFlip \}/);
  });
});
