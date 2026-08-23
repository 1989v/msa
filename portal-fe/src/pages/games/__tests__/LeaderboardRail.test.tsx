import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LeaderboardRail from '../LeaderboardRail';
import type { LeaderboardBoard } from '../../../api/gameApi';

vi.mock('../../../api/gameApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/gameApi')>();
  return {
    ...actual,
    fetchActiveLeaderboards: vi.fn(),
    getGameNickname: vi.fn(() => null),
  };
});

import { fetchActiveLeaderboards, getGameNickname } from '../../../api/gameApi';

const board = (slug: string, title: string): LeaderboardBoard => ({
  slug,
  title,
  titleEn: null,
  thumbnailUrl: `/thumbs/${slug}.png`,
  track: 'BASE',
  entries: [
    { rank: 1, nickname: `${slug}-1등`, score: 900, detail: null },
    { rank: 2, nickname: `${slug}-2등`, score: 500, detail: null },
  ],
});

/** jsdom 에는 matchMedia 가 없다 — 두 분기를 모두 결정적으로 재현하려고 직접 심는다 */
function stubReducedMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: reduce, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
}

/** 마운트 직후의 fetch 체인을 흘려보낸다 (가짜 타이머 아래에서도 마이크로태스크는 그대로 돈다) */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderRail() {
  return render(
    <MemoryRouter>
      <LeaderboardRail lang="ko" />
    </MemoryRouter>,
  );
}

describe('허브 랭킹 레일', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubReducedMotion(false);
    vi.mocked(getGameNickname).mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('기록이 있는 보드가 하나도 없으면 아무것도 그리지 않는다', async () => {
    vi.mocked(fetchActiveLeaderboards).mockResolvedValue([]);
    const { container } = renderRail();
    await flush();

    expect(container.querySelector('.games-rail')).toBeNull();
  });

  it('조회가 실패해도 허브 상단에 오류 상자를 세우지 않는다', async () => {
    vi.mocked(fetchActiveLeaderboards).mockRejectedValue(new Error('gateway down'));
    const { container } = renderRail();
    await flush();

    expect(container.querySelector('.games-rail')).toBeNull();
  });

  it('보드가 하나뿐이면 이전/다음 버튼을 두지 않는다', async () => {
    vi.mocked(fetchActiveLeaderboards).mockResolvedValue([board('coin-corgi', '코인 코기')]);
    renderRail();
    await flush();

    expect(screen.getByText('코인 코기')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다음 랭킹' })).toBeNull();
  });

  it('6초마다 다음 게임으로 넘어가고 끝에서 처음으로 돌아온다', async () => {
    vi.mocked(fetchActiveLeaderboards).mockResolvedValue([board('a', '가 게임'), board('b', '나 게임')]);
    renderRail();
    await flush();

    expect(screen.getByText('가 게임')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('나 게임')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByText('가 게임')).toBeInTheDocument();
  });

  it('포인터가 올라가 있는 동안에는 저절로 넘어가지 않는다', async () => {
    vi.mocked(fetchActiveLeaderboards).mockResolvedValue([board('a', '가 게임'), board('b', '나 게임')]);
    const { container } = renderRail();
    await flush();

    // 멈춤 상태가 반영된 **뒤에** 시간을 흘려야 한다 — 같은 act 안에서 흘리면
    // 인터벌이 아직 살아 있는 채로 6초가 지나간다
    await act(async () => {
      fireEvent.mouseOver(container.querySelector('.games-rail')!);
    });
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText('가 게임')).toBeInTheDocument();
  });

  it('모션을 줄인 사용자에게는 저절로 움직이지 않되, 버튼으로는 넘길 수 있다', async () => {
    stubReducedMotion(true);
    vi.mocked(fetchActiveLeaderboards).mockResolvedValue([board('a', '가 게임'), board('b', '나 게임')]);
    renderRail();
    await flush();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText('가 게임')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음 랭킹' }));
    expect(screen.getByText('나 게임')).toBeInTheDocument();
  });

  it('내 기록은 색이 아니라 낱말로도 짚어 준다', async () => {
    vi.mocked(getGameNickname).mockReturnValue('a-1등');
    vi.mocked(fetchActiveLeaderboards).mockResolvedValue([board('a', '가 게임')]);
    renderRail();
    await flush();

    expect(screen.getByText('나')).toBeInTheDocument();
  });
});
