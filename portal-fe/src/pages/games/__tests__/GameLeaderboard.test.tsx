import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GameLeaderboard from '../GameLeaderboard';
import type { ScoreEntry, ScoreTrack } from '../../../api/gameApi';

vi.mock('../../../api/gameApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/gameApi')>();
  return {
    ...actual,
    fetchLeaderboard: vi.fn(),
    getGameNickname: vi.fn(() => null),
  };
});

import { fetchLeaderboard, getGameNickname } from '../../../api/gameApi';

const entry = (rank: number, nickname: string, score: number): ScoreEntry => ({
  rank,
  nickname,
  score,
  detail: null,
});

/** 트랙별로 다른 보드를 돌려주도록 — 두 보드는 합쳐지지 않는다 */
function serve(base: ScoreEntry[], modded: ScoreEntry[]) {
  vi.mocked(fetchLeaderboard).mockImplementation((_slug: string, track: ScoreTrack) =>
    Promise.resolve(track === 'BASE' ? base : modded),
  );
}

function renderBoard() {
  return render(<GameLeaderboard slug="coin-corgi" lang="ko" reloadToken={0} />);
}

describe('게임 상세 랭킹', () => {
  beforeEach(() => {
    vi.mocked(getGameNickname).mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('기록이 없으면 오류가 아니라 초대로 보여준다', async () => {
    serve([], []);
    renderBoard();

    expect(await screen.findByText('아직 기록이 없습니다')).toBeInTheDocument();
    expect(screen.getByText('첫 기록에 도전해 보세요 — 위 플레이 버튼으로 시작합니다.')).toBeInTheDocument();
    expect(screen.queryByText('랭킹을 불러오지 못했습니다.')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('한 트랙에만 기록이 있으면 보드 전환 탭을 두지 않는다 — 빈 탭을 보여주지 않는다', async () => {
    serve([entry(1, '가', 900)], []);
    renderBoard();

    expect(await screen.findByText('가')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('두 트랙 모두 기록이 있으면 탭이 생기고, 전환하면 그 보드만 보인다', async () => {
    serve([entry(1, '무강화1등', 900)], [entry(1, '강화1등', 5000)]);
    renderBoard();

    expect(await screen.findByText('무강화1등')).toBeInTheDocument();
    expect(screen.queryByText('강화1등')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: '강화' }));

    await waitFor(() => expect(screen.getByText('강화1등')).toBeInTheDocument());
    expect(screen.queryByText('무강화1등')).toBeNull();
  });

  it('내 기록 줄은 색이 아니라 낱말로도 표시된다', async () => {
    vi.mocked(getGameNickname).mockReturnValue('가');
    serve([entry(1, '가', 900), entry(2, '나', 500)], []);
    const { container } = renderBoard();

    expect(await screen.findByText('내 기록')).toBeInTheDocument();
    expect(container.querySelectorAll('tr.is-me')).toHaveLength(1);
  });

  it('닉네임이 없으면 기록이 남는 방법을 알려준다', async () => {
    serve([entry(1, '가', 900)], []);
    renderBoard();

    expect(await screen.findByText('게임 안에서 닉네임을 정하면 기록이 이 표에 남습니다.')).toBeInTheDocument();
  });

  it('조회에 실패하면 빈 보드로 위장하지 않고 다시 시도를 준다', async () => {
    vi.mocked(fetchLeaderboard).mockRejectedValue(new Error('empty 200'));
    renderBoard();

    expect(await screen.findByText('랭킹을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.queryByText('아직 기록이 없습니다')).toBeNull();
  });
});
