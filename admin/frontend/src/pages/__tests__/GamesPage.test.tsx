import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GamesPage } from '../GamesPage';
import * as gamesApi from '@/api/games';
import type { AdminGameSummary } from '@/api/games';

vi.mock('@/api/games', async () => {
  const actual = await vi.importActual<typeof gamesApi>('@/api/games');
  return {
    ...actual,
    fetchAdminGames: vi.fn(),
    fetchAdminGame: vi.fn(),
    fetchGameTags: vi.fn(),
    updateGameMetadata: vi.fn(),
    updateGameTags: vi.fn(),
    changeGameStatus: vi.fn(),
  };
});

const row = (over: Partial<AdminGameSummary> = {}): AdminGameSummary => ({
  id: 1,
  slug: 'snake',
  title: '스네이크',
  titleEn: 'Snake',
  thumbnailUrl: '/thumbs/snake.png',
  status: 'PUBLISHED',
  genre: 'ARCADE',
  tags: ['arcade'],
  playCount: 1200,
  ratingAvg: 8.4,
  ratingCount: 12,
  updatedAt: '2026-08-01T00:00:00Z',
  ...over,
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GamesPage />
    </QueryClientProvider>,
  );
}

/**
 * 행은 매번 새로 조회한다 — 조회 결과가 도착한 뒤 테이블이 다시 그려지면서
 * 앞서 잡아둔 DOM 노드가 떨어져 나가기 때문.
 */
const rowOf = (title: string) => within(screen.getByText(title).closest('tr') as HTMLElement);

const waitForRows = () =>
  waitFor(() => expect(screen.getByText('스네이크')).toBeInTheDocument());

beforeEach(() => {
  vi.mocked(gamesApi.fetchAdminGames).mockReset();
  vi.mocked(gamesApi.changeGameStatus).mockReset();
});

describe('GamesPage', () => {
  it('상태 무관 목록을 렌더링한다 — DRAFT/SUSPENDED 도 배지와 함께 보인다', async () => {
    vi.mocked(gamesApi.fetchAdminGames).mockResolvedValue({
      content: [
        row(),
        row({ id: 2, slug: 'draft-game', title: '초안 게임', titleEn: null, status: 'DRAFT' }),
        row({ id: 3, slug: 'stopped-game', title: '멈춘 게임', status: 'SUSPENDED' }),
      ],
      totalElements: 3,
      totalPages: 1,
      number: 0,
      size: 20,
    });

    renderPage();
    await waitForRows();

    expect(screen.getByText('초안 게임')).toBeInTheDocument();
    expect(screen.getByText('멈춘 게임')).toBeInTheDocument();
    expect(rowOf('초안 게임').getByText('초안')).toBeInTheDocument();
    expect(rowOf('멈춘 게임').getByText('숨김')).toBeInTheDocument();
    expect(screen.getByText('총 3종')).toBeInTheDocument();
    // 영문 제목 미입력은 눈에 띄게 표시된다 (SEO 누락 방지)
    expect(screen.getByText('— (en 미입력)')).toBeInTheDocument();
  });

  it('검색어·상태 필터가 조회 파라미터로 전달된다', async () => {
    vi.mocked(gamesApi.fetchAdminGames).mockResolvedValue({
      content: [row()], totalElements: 1, totalPages: 1, number: 0, size: 20,
    });
    const user = userEvent.setup();
    renderPage();
    await waitForRows();

    await user.type(screen.getByLabelText('게임 검색'), 'snake');
    await user.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() =>
      expect(gamesApi.fetchAdminGames).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'snake', page: 0 }),
      ),
    );

    await user.selectOptions(screen.getByLabelText('상태 필터'), 'DRAFT');
    await waitFor(() =>
      expect(gamesApi.fetchAdminGames).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'DRAFT' }),
      ),
    );
  });

  it('허용된 전이만 행 토글로 노출한다 — DRAFT 행의 토글은 비활성', async () => {
    vi.mocked(gamesApi.fetchAdminGames).mockResolvedValue({
      content: [
        row(),
        row({ id: 2, slug: 'draft-game', title: '초안 게임', status: 'DRAFT' }),
        row({ id: 3, slug: 'stopped-game', title: '멈춘 게임', status: 'SUSPENDED' }),
      ],
      totalElements: 3,
      totalPages: 1,
      number: 0,
      size: 20,
    });
    vi.mocked(gamesApi.changeGameStatus).mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderPage();
    await waitForRows();

    // DRAFT 는 PUBLISHED ⇄ SUSPENDED 토글 대상이 아니다 (상태머신상 불가능한 전이)
    expect(rowOf('초안 게임').getByRole('button', { name: '공개' })).toBeDisabled();
    expect(rowOf('멈춘 게임').getByRole('button', { name: '공개' })).toBeEnabled();

    await user.click(rowOf('스네이크').getByRole('button', { name: '숨김' }));
    expect(gamesApi.changeGameStatus).toHaveBeenCalledWith('snake', 'SUSPEND');
  });
});
