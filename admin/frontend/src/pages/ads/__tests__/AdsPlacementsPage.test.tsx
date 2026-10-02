import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdsPlacementsPage } from '../AdsPlacementsPage';
import * as adsApi from '@/api/ads';
import type { AdPlacement, FormatSpec } from '@/api/ads';

vi.mock('@/api/ads', async () => {
  const actual = await vi.importActual<typeof adsApi>('@/api/ads');
  return {
    ...actual,
    listPlacements: vi.fn(),
    listUnregisteredPlacements: vi.fn(),
    addPlacementFormat: vi.fn(),
    updatePlacementFormatFloor: vi.fn(),
    removePlacementFormat: vi.fn(),
    updatePlacement: vi.fn(),
  };
});

/** C6 — 지면 형태 규격 편집: 형태별 최저가 변경·더하기·빼기, 마지막 규격은 뺄 수 없다. */

const card: FormatSpec = { format: 'CARD', aspectRatios: ['1.91:1'], floorMicros: 100_000 };
const strip: FormatSpec = { format: 'BANNER', aspectRatios: ['6.4:1'], floorMicros: 50_000 };

const placement = (key: string, formats: FormatSpec[], over: Partial<AdPlacement> = {}): AdPlacement => ({
  key,
  host: 'blog.1989v.com',
  formats,
  active: true,
  paidAllowed: true,
  description: key,
  ...over,
});

const specs = (key: string) => screen.getByTestId(`specs-${key}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adsApi.listPlacements).mockResolvedValue([
    placement('blog-post-end', [card, strip]),
    placement('game-hub-end', [card]),
  ]);
  vi.mocked(adsApi.listUnregisteredPlacements).mockResolvedValue([]);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdsPlacementsPage — 형태 규격', () => {
  it('형태마다 비율·최저가를 보이고, 최저가 변경은 그 형태에만 보낸다', async () => {
    vi.mocked(adsApi.updatePlacementFormatFloor).mockResolvedValue(placement('blog-post-end', [card, strip]));
    render(<AdsPlacementsPage />);
    await screen.findByTestId('specs-blog-post-end');

    const row = within(specs('blog-post-end')).getByText('띠배너').closest('li') as HTMLElement;
    expect(row).toHaveTextContent('6.4:1');
    expect(row).toHaveTextContent('0.05');

    await userEvent.type(screen.getByLabelText('blog-post-end 띠배너 새 최저가'), '0.07');
    await userEvent.click(within(row).getByRole('button', { name: '변경' }));
    await waitFor(() => expect(adsApi.updatePlacementFormatFloor).toHaveBeenCalledWith('blog-post-end', 'BANNER', 70_000));
  });

  it('없는 형태를 더한다 — 비율 기본값은 그 형태의 비율', async () => {
    vi.mocked(adsApi.addPlacementFormat).mockResolvedValue(placement('game-hub-end', [card, strip]));
    render(<AdsPlacementsPage />);
    await screen.findByTestId('specs-game-hub-end');

    expect(screen.getByLabelText('game-hub-end 더할 형태')).toHaveValue('BANNER');
    expect(screen.getByLabelText('game-hub-end 더할 형태 비율')).toHaveValue('6.4:1');
    await userEvent.type(screen.getByLabelText('game-hub-end 더할 형태 최저가'), '0.05');
    await userEvent.click(within(specs('game-hub-end')).getByRole('button', { name: '형태 추가' }));

    await waitFor(() =>
      expect(adsApi.addPlacementFormat).toHaveBeenCalledWith('game-hub-end', { format: 'BANNER', aspectRatios: ['6.4:1'], floorMicros: 50_000 }),
    );
    // 두 형태를 다 가진 지면에는 더하기가 없다
    expect(screen.queryByLabelText('blog-post-end 더할 형태')).not.toBeInTheDocument();
  });

  it('형태를 빼면 효과를 확인받고 보낸다 — 마지막 형태는 뺄 수 없다', async () => {
    vi.mocked(adsApi.removePlacementFormat).mockResolvedValue(placement('blog-post-end', [card]));
    render(<AdsPlacementsPage />);
    await screen.findByTestId('specs-blog-post-end');

    expect(screen.getByRole('button', { name: 'game-hub-end 카드 빼기' })).toBeDisabled();
    expect(within(specs('game-hub-end')).getByText(/마지막 형태는 뺄 수 없습니다/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'blog-post-end 띠배너 빼기' }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('시작·재개도 거절됩니다'));
    await waitFor(() => expect(adsApi.removePlacementFormat).toHaveBeenCalledWith('blog-post-end', 'BANNER'));
  });
});
