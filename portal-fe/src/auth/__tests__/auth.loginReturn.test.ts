import { afterEach, describe, expect, it, vi } from 'vitest';

const INTENT_KEY = 'kgd.favoriteIntent.v1';
const HUB_STATE_KEY = 'kgd.placeHubState.v1';

afterEach(() => {
  sessionStorage.clear();
  vi.resetModules();
});

describe('clearLocalSession — 로그인 복귀 흔적', () => {
  it('찜 의도와 허브 화면 상태 두 키를 지운다 — 로그아웃한 탭에 남의 찜이 이어지지 않게', async () => {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify({ targetType: 'ATTRACTION', targetKey: '1', createdAt: Date.now() }));
    sessionStorage.setItem(HUB_STATE_KEY, JSON.stringify({ keyword: '', createdAt: Date.now() }));
    sessionStorage.setItem('kgd.place.sessionStarted', '1');
    const { clearLocalSession } = await import('../auth');

    clearLocalSession();

    expect(sessionStorage.getItem(INTENT_KEY)).toBeNull();
    expect(sessionStorage.getItem(HUB_STATE_KEY)).toBeNull();
    // 이 두 키만 — 세션 범위의 다른 값은 건드리지 않는다
    expect(sessionStorage.getItem('kgd.place.sessionStarted')).toBe('1');
  });
});

describe('로그인 next 왕복 — 허브 상태를 주소에 싣지 않는다', () => {
  it('place 호스트에서 만든 로그인 주소의 next 가 safeNext 를 지나 같은 place href 로 돌아온다', async () => {
    const href = 'https://place.1989v.com/en?layout=listFirst';
    const original = Object.getOwnPropertyDescriptor(window, 'location');
    // 운영 호스트 판정은 모듈을 읽는 순간 한 번 — 위치를 바꾼 뒤 새로 읽는다
    Object.defineProperty(window, 'location', { configurable: true, value: new URL(href) });
    try {
      vi.resetModules();
      const { buildLoginHref, safeNext } = await import('../auth');

      const login = new URL(buildLoginHref());

      expect(login.origin).toBe('https://1989v.com');
      expect(login.pathname).toBe('/login');
      expect(safeNext(login.searchParams.get('next'))).toBe(href);
    } finally {
      if (original) Object.defineProperty(window, 'location', original);
    }
  });
});
