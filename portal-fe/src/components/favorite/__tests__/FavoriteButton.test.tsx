import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FavoriteItem, FavoriteTargetType } from '../../../api/wishlistApi';
import FavoriteButton from '../FavoriteButton';
import type { FavoriteTracking } from '../useFavorites';

vi.mock('../../../api/wishlistApi', () => ({
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  fetchFavoriteKeys: vi.fn(),
  fetchFavorites: vi.fn(),
}));
vi.mock('../../../analytics/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../analytics/tracker')>()),
  track: vi.fn(),
}));

import { addFavorite, fetchFavoriteKeys, removeFavorite } from '../../../api/wishlistApi';
import { track } from '../../../analytics/tracker';

function renderButton(
  targetKey = 'abyssal-crown',
  lang?: 'ko' | 'en',
  opts: { type?: FavoriteTargetType; tracking?: FavoriteTracking; onBeforeLogin?: () => void } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <FavoriteButton
                type={opts.type ?? 'GAME'}
                targetKey={targetKey}
                lang={lang}
                tracking={opts.tracking}
                onBeforeLogin={opts.onBeforeLogin}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 토큰은 HttpOnly 라 JS 가 못 본다 — 로그인 여부는 표시 쿠키로 본다 (ADR-0101) */
function setSession(memberId: string | null) {
  document.cookie = memberId
    ? `portal_user_id=${memberId}; Path=/`
    : 'portal_user_id=; Path=/; Max-Age=0';
}

beforeEach(() => {
  setSession(null);
  vi.clearAllMocks();
});

afterEach(() => {
  setSession(null);
});

describe('FavoriteButton (게스트)', () => {
  it('하트는 보이되 비활성이고, 누르면 로그인으로 보낸다', async () => {
    renderButton();

    const button = screen.getByRole('button', { name: '게임 찜' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    // 로그인은 apex 한 곳이라 호스트를 넘는 이동이다 — jsdom 이 실제 이동을 막으므로
    // href 대입을 가로채 목적지만 확인한다 (ADR-0079)
    const assigned: string[] = [];
    const original = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, get href() { return ''; }, set href(v: string) { assigned.push(v); } },
    });

    await userEvent.click(button);

    if (original) Object.defineProperty(window, 'location', original);
    expect(assigned.at(-1)).toContain('/login?next=');
    // 게스트 탭이 API 를 부르면 안 된다
    expect(addFavorite).not.toHaveBeenCalled();
  });
});

describe('FavoriteButton (로그인)', () => {
  beforeEach(() => {
    setSession('token');
  });

  it('/keys 하이드레이션으로 찜됨 상태가 켜진다', async () => {
    vi.mocked(fetchFavoriteKeys).mockResolvedValue(['abyssal-crown']);

    renderButton();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '게임 찜 해제' })).toHaveAttribute('aria-pressed', 'true'),
    );
  });

  it('토글은 낙관적 — 응답 전에 상태가 먼저 바뀐다', async () => {
    vi.mocked(fetchFavoriteKeys).mockResolvedValue([]);
    vi.mocked(addFavorite).mockImplementation(() => new Promise(() => undefined)); // 영원히 pending

    renderButton();
    const button = await screen.findByRole('button', { name: '게임 찜' });

    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(addFavorite).toHaveBeenCalledWith('GAME', 'abyssal-crown');
  });

  it('실패하면 롤백된다', async () => {
    vi.mocked(fetchFavoriteKeys).mockResolvedValue(['abyssal-crown']);
    vi.mocked(removeFavorite).mockRejectedValue(new Error('down'));

    renderButton();
    const button = await screen.findByRole('button', { name: '게임 찜 해제' });

    await userEvent.click(button);
    // 낙관적으로 꺼졌다가, 실패가 돌아오면 다시 켜진다
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'));
    expect(removeFavorite).toHaveBeenCalledWith('GAME', 'abyssal-crown');
  });
});

describe('FavoriteButton 문구', () => {
  beforeEach(() => {
    vi.mocked(fetchFavoriteKeys).mockResolvedValue([]);
  });

  it('lang 을 안 넘기면 국문이다 — 영문 면은 place 뿐이라 나머지는 그대로 둔다', async () => {
    renderButton('abyssal-crown');
    expect(await screen.findByRole('button', { name: '게임 찜' })).toBeTruthy();
  });

  it('영문은 어순이 달라 문장을 따로 만든다 — 명사만 갈아끼우면 어색해진다', async () => {
    renderButton('abyssal-crown', 'en');
    const btn = await screen.findByRole('button', { name: 'Save game' });
    // 글자 없이 별만 그린다 — 문구는 접근성 이름과 툴팁이 갖는다
    expect(btn.textContent).toBe('');
    expect(btn.getAttribute('title')).toBe('Save');
    expect(btn.querySelector('svg polygon')).not.toBeNull();
  });
});

/**
 * 찜 완료 계측 — 서버 성공 뒤에만 CLICK/FAVORITE 한 건. `tracking` prop 을 주는
 * place 화면 셋만 원장에 남고, 낙관 반전·롤백·게스트·pending 은 보내지 않는다.
 */
describe('FavoriteButton 계측 (ATTRACTION)', () => {
  const targetKey = 'A-12345';
  const tracking: FavoriteTracking = { screenType: 'PLACE_HUB', screenRef: '11', viewId: 'v1' };
  /** `null` 이 「prop 없음」 — `undefined` 를 넘기면 기본 인자가 끼어든다 */
  const renderTracked = (t: FavoriteTracking | null = tracking) =>
    renderButton(targetKey, undefined, { type: 'ATTRACTION', tracking: t ?? undefined });
  const impressionCalls = () => vi.mocked(track).mock.calls.filter((c) => c[0] === 'IMPRESSION');
  /** PUT 응답 — 계측은 응답 본문을 보지 않으므로 모양만 맞춘다 */
  const savedItem: FavoriteItem = {
    id: 1, targetType: 'ATTRACTION', targetKey, collectionId: null, createdAt: '2026-10-08T00:00:00Z',
  };

  beforeEach(() => {
    setSession('token');
    vi.mocked(fetchFavoriteKeys).mockResolvedValue([]);
  });

  it('추가 성공 → CLICK/FAVORITE 한 건, payload.saved=true, viewId 는 prop 값', async () => {
    vi.mocked(addFavorite).mockResolvedValue(savedItem);

    renderTracked();
    await userEvent.click(await screen.findByRole('button', { name: '관광지 찜' }));

    await waitFor(() => expect(track).toHaveBeenCalledTimes(1));
    expect(track).toHaveBeenCalledWith(
      'CLICK',
      {
        entityType: 'ATTRACTION',
        entityId: targetKey,
        screenType: 'PLACE_HUB',
        screenRef: '11',
        sectionId: 'FAVORITE',
        payload: { saved: true },
      },
      'v1',
    );
  });

  it('이미 찜된 것을 해제 → payload.saved=false — 요청 종류가 방향을 정한다', async () => {
    vi.mocked(fetchFavoriteKeys).mockResolvedValue([targetKey]);
    vi.mocked(removeFavorite).mockResolvedValue(undefined);

    renderTracked();
    await userEvent.click(await screen.findByRole('button', { name: '관광지 찜 해제' }));

    await waitFor(() => expect(track).toHaveBeenCalledTimes(1));
    expect(vi.mocked(track).mock.calls[0][1].payload).toEqual({ saved: false });
    expect(removeFavorite).toHaveBeenCalledWith('ATTRACTION', targetKey);
  });

  it('실패(롤백)에는 보내지 않는다', async () => {
    vi.mocked(addFavorite).mockRejectedValue(new Error('down'));

    renderTracked();
    const button = await screen.findByRole('button', { name: '관광지 찜' });
    await userEvent.click(button);

    // 낙관적으로 켜졌다가 롤백으로 다시 꺼진다 — 그 사이 어디서도 원장 호출이 없다
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'));
    expect(addFavorite).toHaveBeenCalledTimes(1);
    expect(track).not.toHaveBeenCalled();
  });

  it('게스트 클릭(로그인 이동)에는 보내지 않는다', async () => {
    setSession(null);

    renderTracked();
    const button = screen.getByRole('button', { name: '관광지 찜' });

    const assigned: string[] = [];
    const original = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, get href() { return ''; }, set href(v: string) { assigned.push(v); } },
    });
    await userEvent.click(button);
    if (original) Object.defineProperty(window, 'location', original);

    expect(assigned.at(-1)).toContain('/login?next=');
    expect(track).not.toHaveBeenCalled();
  });

  it('tracking prop 이 없으면 성공해도 보내지 않는다 — 비-place 호출처는 계측 밖', async () => {
    vi.mocked(addFavorite).mockResolvedValue(savedItem);

    renderTracked(null);
    await userEvent.click(await screen.findByRole('button', { name: '관광지 찜' }));

    await waitFor(() => expect(addFavorite).toHaveBeenCalledTimes(1));
    expect(track).not.toHaveBeenCalled();
  });

  it('마운트 뒤·토글 뒤 어느 시점에도 IMPRESSION 을 보내지 않는다', async () => {
    vi.mocked(addFavorite).mockResolvedValue(savedItem);

    renderTracked();
    const button = await screen.findByRole('button', { name: '관광지 찜' });
    expect(impressionCalls()).toHaveLength(0);

    await userEvent.click(button);
    await waitFor(() => expect(track).toHaveBeenCalledTimes(1));
    expect(impressionCalls()).toHaveLength(0);
  });

  it('응답이 pending 인 동안은 0, 서버가 성공을 돌려준 뒤에 1', async () => {
    let resolveAdd: ((item: FavoriteItem) => void) | undefined;
    vi.mocked(addFavorite).mockImplementation(
      () => new Promise<FavoriteItem>((resolve) => { resolveAdd = resolve; }),
    );

    renderTracked();
    const button = await screen.findByRole('button', { name: '관광지 찜' });
    await userEvent.click(button);

    // 낙관 반전은 끝났지만 서버는 아직 — 원장은 비어 있어야 한다
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(track).not.toHaveBeenCalled();

    resolveAdd?.(savedItem);
    await waitFor(() => expect(track).toHaveBeenCalledTimes(1));
    expect(vi.mocked(track).mock.calls[0][0]).toBe('CLICK');
  });
});

/**
 * 로그인 복귀 — 게스트가 관광지 별을 누르면 이동 전에 찜 의도를 남기고, 호출처가 준 저장 함수를
 * href 대입보다 먼저 부른다. 다른 타입은 의도를 남기지 않는다.
 */
describe('FavoriteButton 로그인 복귀 (게스트)', () => {
  const INTENT_KEY = 'kgd.favoriteIntent.v1';
  /** 일어난 순서 — 저장 함수와 href 대입이 같은 배열에 쌓인다 */
  let order: string[];
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    sessionStorage.clear();
    order = [];
    original = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        get href() { return 'http://localhost/'; },
        set href(v: string) { order.push(`href:${v}`); },
      },
    });
  });
  afterEach(() => {
    if (original) Object.defineProperty(window, 'location', original);
    sessionStorage.clear();
  });

  it('ATTRACTION — 의도를 저장하고, onBeforeLogin 을 href 대입 전에 한 번 부른다', async () => {
    const before = Date.now();
    const onBeforeLogin = vi.fn(() => {
      // 저장 함수가 불릴 때 의도는 이미 있다 — 같은 클릭 안에서 둘 다 끝난다
      order.push(`before:${sessionStorage.getItem(INTENT_KEY) != null}`);
    });
    renderButton('126508', undefined, { type: 'ATTRACTION', onBeforeLogin });

    await userEvent.click(screen.getByRole('button', { name: '관광지 찜' }));

    expect(onBeforeLogin).toHaveBeenCalledTimes(1);
    expect(order).toHaveLength(2);
    expect(order[0]).toBe('before:true');
    expect(order[1]).toMatch(/^href:.*\/login\?next=/);
    const intent = JSON.parse(sessionStorage.getItem(INTENT_KEY)!);
    expect(intent).toEqual({ targetType: 'ATTRACTION', targetKey: '126508', createdAt: expect.any(Number) });
    expect(intent.createdAt).toBeGreaterThanOrEqual(before);
    expect(intent.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it.each<FavoriteTargetType>(['PRODUCT', 'GAME', 'BLOG_POST'])('%s — 의도를 남기지 않고 로그인으로만 보낸다', async (type) => {
    renderButton('k-1', undefined, { type });

    await userEvent.click(screen.getByRole('button'));

    expect(sessionStorage.getItem(INTENT_KEY)).toBeNull();
    expect(order).toHaveLength(1);
    expect(order[0]).toMatch(/^href:.*\/login\?next=/);
  });

  it('onBeforeLogin 이 없으면 지금처럼 로그인으로 보낸다', async () => {
    renderButton('126508', undefined, { type: 'ATTRACTION' });

    await userEvent.click(screen.getByRole('button', { name: '관광지 찜' }));

    expect(order).toHaveLength(1);
    expect(order[0]).toMatch(/^href:.*\/login\?next=/);
    expect(addFavorite).not.toHaveBeenCalled();
  });
});
