import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FavoriteButton from '../FavoriteButton';

vi.mock('../../../api/wishlistApi', () => ({
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  fetchFavoriteKeys: vi.fn(),
  fetchFavorites: vi.fn(),
}));

import { addFavorite, fetchFavoriteKeys, removeFavorite } from '../../../api/wishlistApi';

function renderButton(targetKey = 'abyssal-crown', lang?: 'ko' | 'en') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={<FavoriteButton type="GAME" targetKey={targetKey} lang={lang} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** 토큰은 도메인 쿠키에 산다 (ADR-0079) — 테스트도 같은 곳을 봐야 한다 */
function setSession(token: string | null) {
  document.cookie = token
    ? `portal_access_token=${token}; Path=/`
    : 'portal_access_token=; Path=/; Max-Age=0';
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
    expect(btn.textContent).toContain('Save');
    expect(btn.textContent).not.toContain('찜');
  });
});
