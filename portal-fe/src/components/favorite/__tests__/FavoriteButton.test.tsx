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

function renderButton(targetKey = 'abyssal-crown') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<FavoriteButton type="GAME" targetKey={targetKey} />} />
          <Route path="/shop/login" element={<div>로그인 화면</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

describe('FavoriteButton (게스트)', () => {
  it('하트는 보이되 비활성이고, 누르면 로그인으로 보낸다', async () => {
    renderButton();

    const button = screen.getByRole('button', { name: '게임 찜' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(button);
    expect(screen.getByText('로그인 화면')).toBeInTheDocument();
    // 게스트 탭이 API 를 부르면 안 된다
    expect(addFavorite).not.toHaveBeenCalled();
  });
});

describe('FavoriteButton (로그인)', () => {
  beforeEach(() => {
    localStorage.setItem('portal_access_token', 'token');
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
