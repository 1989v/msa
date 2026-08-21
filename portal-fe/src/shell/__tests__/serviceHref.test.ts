import { describe, expect, it, vi, afterEach } from 'vitest';

/**
 * `isApexProd` 는 모듈 로드 시점에 hostname 을 읽는다 — 호스트별 동작을 보려면
 * hostname 을 먼저 세우고 모듈을 새로 import 해야 한다.
 */
async function loadWithHost(hostname: string) {
  vi.stubGlobal('window', { location: { hostname } });
  vi.resetModules();
  return import('../serviceHref');
}

describe('resolveServiceHref', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('apex 프로덕션에서 서브도메인 서비스는 정규 주소를 건다', async () => {
    const { resolveServiceHref } = await loadWithHost('1989v.com');
    expect(resolveServiceHref('deal', '/deal')).toBe('https://deal.1989v.com/');
    expect(resolveServiceHref('place', '/place')).toBe('https://place.1989v.com/');
    // 게임 타일의 DB 값은 /games 지만 정규 주소는 게임 호스트의 루트다
    expect(resolveServiceHref('game', '/games')).toBe('https://game.1989v.com/');
    // ADR-0066 체크리스트 ④ — 이 줄이 빠지면 타일이 apex 경로를 걸고 hover·링크복사·
    // 새 탭·크롤러가 전부 apex 에 머문다
    expect(resolveServiceHref('blog', '/blog')).toBe('https://blog.1989v.com/');
  });

  it('로컬에서는 상대 경로 그대로 — 개발 중에 프로덕션으로 튀지 않는다', async () => {
    const { resolveServiceHref } = await loadWithHost('localhost');
    expect(resolveServiceHref('deal', '/deal')).toBe('/deal');
    expect(resolveServiceHref('place', '/place')).toBe('/place');
    expect(resolveServiceHref('game', '/games')).toBe('/games');
    expect(resolveServiceHref('blog', '/blog')).toBe('/blog');
  });

  it('서브도메인이 없는 서비스는 apex 에서도 상대 경로를 유지한다', async () => {
    const { resolveServiceHref } = await loadWithHost('1989v.com');
    expect(resolveServiceHref('tech', '/tech')).toBe('/tech');
    expect(resolveServiceHref('portfolio', '/portfolio')).toBe('/portfolio');
  });
});

describe('resolveExplorerHref', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('서브도메인 프로덕션 호스트에서도 정규 주소로 보낸다 — 상대 경로면 다른 서비스가 게임 origin 아래로 샌다', async () => {
    const { resolveExplorerHref } = await loadWithHost('game.1989v.com');
    expect(resolveExplorerHref('place', '/place')).toBe('https://place.1989v.com/');
    expect(resolveExplorerHref('blog', '/blog')).toBe('https://blog.1989v.com/');
    // 서브도메인이 없는 서비스는 apex 절대 주소로
    expect(resolveExplorerHref('tech', '/tech')).toBe('https://1989v.com/tech');
    expect(resolveExplorerHref('shop', '/shop')).toBe('https://1989v.com/shop');
  });

  it('apex 프로덕션 — 서브도메인 서비스는 origin, 나머지는 apex 절대 주소', async () => {
    const { resolveExplorerHref } = await loadWithHost('1989v.com');
    expect(resolveExplorerHref('game', '/games')).toBe('https://game.1989v.com/');
    expect(resolveExplorerHref('tech', '/tech')).toBe('https://1989v.com/tech');
  });

  it('로컬에서는 상대 경로 그대로', async () => {
    const { resolveExplorerHref } = await loadWithHost('localhost');
    expect(resolveExplorerHref('place', '/place')).toBe('/place');
    expect(resolveExplorerHref('tech', '/tech')).toBe('/tech');
  });
});

describe('portalHomeHref', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('프로덕션 호스트에서는 apex 절대 주소, 로컬에서는 루트', async () => {
    expect((await loadWithHost('blog.1989v.com')).portalHomeHref()).toBe('https://1989v.com/');
    expect((await loadWithHost('1989v.com')).portalHomeHref()).toBe('https://1989v.com/');
    expect((await loadWithHost('localhost')).portalHomeHref()).toBe('/');
  });
});
