import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GameLeaderboard from '../GameLeaderboard';
import type { ScoreBoardDef, ScoreEntry, ScorePeriod, ScoreTrack } from '../../../api/gameApi';

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

/**
 * (기간 × 트랙) 넷을 각각 다르게 돌려준다 — 어느 것도 합쳐지지 않는다.
 * 오늘 보드를 생략하면 오늘 아무도 안 논 상태다 (지금 대부분의 게임의 정상 상태).
 */
function serve(
  base: ScoreEntry[],
  modded: ScoreEntry[],
  today: { BASE?: ScoreEntry[]; MODDED?: ScoreEntry[] } = {},
) {
  vi.mocked(fetchLeaderboard).mockImplementation(
    (_slug: string, track: ScoreTrack, _limit?: number, period: ScorePeriod = 'ALL_TIME') => {
      if (period === 'DAILY') return Promise.resolve(today[track] ?? []);
      return Promise.resolve(track === 'BASE' ? base : modded);
    },
  );
}

function renderBoard(scoreBoards: ScoreBoardDef[] = [], pageSize?: number) {
  return render(
    <GameLeaderboard
      slug="coin-corgi"
      lang="ko"
      scoreBoards={scoreBoards}
      reloadToken={0}
      pageSize={pageSize}
    />,
  );
}

/** 모드를 나눈 게임 — 「그어서 막기」의 실제 선언 */
const MODES: ScoreBoardDef[] = [
  { key: 'leak', name: '물 막기', nameEn: 'Water' },
  { key: 'rockfall', name: '돌 막기', nameEn: 'Rocks' },
  { key: 'bee', name: '벌 막기', nameEn: 'Bees' },
];

/** 모드별로 다른 기록을 돌려준다 — 어느 것도 합쳐지지 않는지 보려고 */
function serveByBoard(byBoard: Record<string, ScoreEntry[]>) {
  vi.mocked(fetchLeaderboard).mockImplementation(
    (
      _slug: string,
      track: ScoreTrack,
      _limit?: number,
      period: ScorePeriod = 'ALL_TIME',
      board?: string | null,
    ) => {
      if (period === 'DAILY' || track === 'MODDED') return Promise.resolve([]);
      return Promise.resolve(byBoard[board ?? ''] ?? []);
    },
  );
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
    // 보여줄 보드가 없으면 기간 토글도 없다 — 빈 조작을 세워 두지 않는다
    expect(screen.queryByRole('tab', { name: '오늘' })).toBeNull();
  });

  it('한 트랙에만 기록이 있으면 보드 전환 탭을 두지 않는다 — 빈 탭을 보여주지 않는다', async () => {
    serve([entry(1, '가', 900)], []);
    renderBoard();

    expect(await screen.findByText('가')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '무강화' })).toBeNull();
    expect(screen.queryByRole('tab', { name: '강화' })).toBeNull();
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

  it('전체/오늘 토글이 보드를 갈아 끼운다 — 오늘 기록이 역대 기록을 밀어내지 않는다', async () => {
    serve([entry(1, '역대1등', 9000)], [], { BASE: [entry(1, '오늘1등', 400)] });
    renderBoard();

    expect(await screen.findByText('역대1등')).toBeInTheDocument();
    expect(screen.queryByText('오늘1등')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: '오늘' }));

    await waitFor(() => expect(screen.getByText('오늘1등')).toBeInTheDocument());
    expect(screen.queryByText('역대1등')).toBeNull();
    expect(screen.getByText('오늘의 기록은 매일 자정(한국 시간)에 새로 시작합니다.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '전체' }));
    await waitFor(() => expect(screen.getByText('역대1등')).toBeInTheDocument());
  });

  it('오늘 아무도 안 놀았으면 오류가 아니라 비어 있는 1위 자리로 보여준다', async () => {
    serve([entry(1, '역대1등', 9000)], []);
    renderBoard();

    expect(await screen.findByText('역대1등')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '오늘' }));

    await waitFor(() => expect(screen.getByText('오늘은 아직 기록이 없습니다')).toBeInTheDocument());
    expect(screen.getByText('오늘의 1위 자리가 비어 있습니다 — 한 판이면 됩니다.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('랭킹을 불러오지 못했습니다.')).toBeNull();
  });

  it('오늘 보드에 기록이 있는 트랙이 하나뿐이면 그 트랙으로 옮겨 준다', async () => {
    serve([entry(1, '무강화역대', 900)], [entry(1, '강화역대', 5000)], {
      MODDED: [entry(1, '강화오늘', 300)],
    });
    renderBoard();

    // 역대는 무강화가 기본 보드
    expect(await screen.findByText('무강화역대')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '오늘' }));

    // 오늘은 무강화가 비어 있으니 강화 보드가 열린다 — 빈 표를 먼저 보여주지 않는다
    await waitFor(() => expect(screen.getByText('강화오늘')).toBeInTheDocument());
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

  describe('모드를 나눈 게임', () => {
    it('선언된 모드마다 탭이 서고 첫 모드가 먼저 보인다', async () => {
      serveByBoard({ leak: [entry(1, '물지기', 1009)], rockfall: [entry(1, '돌지기', 798)] });
      renderBoard(MODES);

      await screen.findByText('물지기');
      expect(screen.getByRole('tab', { name: '물 막기' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: '돌 막기' })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('tab', { name: '벌 막기' })).toBeInTheDocument();
      // 다른 모드의 기록이 섞여 들어오지 않는다
      expect(screen.queryByText('돌지기')).not.toBeInTheDocument();
    });

    it('모드를 바꾸면 그 모드만 다시 읽는다 — 요청 수는 늘지 않는다', async () => {
      serveByBoard({ leak: [entry(1, '물지기', 1009)], rockfall: [entry(1, '돌지기', 798)] });
      renderBoard(MODES);
      await screen.findByText('물지기');

      // 한 모드당 (기간 × 트랙) 넷. 셋을 미리 받지 않는다.
      expect(vi.mocked(fetchLeaderboard)).toHaveBeenCalledTimes(4);

      fireEvent.click(screen.getByRole('tab', { name: '돌 막기' }));

      await screen.findByText('돌지기');
      expect(screen.queryByText('물지기')).not.toBeInTheDocument();
      expect(vi.mocked(fetchLeaderboard)).toHaveBeenCalledTimes(8);
      expect(vi.mocked(fetchLeaderboard)).toHaveBeenLastCalledWith(
        'coin-corgi', 'MODDED', 10, 'DAILY', 'rockfall',
      );
    });

    it('고른 모드에 기록이 없어도 탭은 남는다 — 사라지면 다른 모드로 갈 길이 없다', async () => {
      serveByBoard({ leak: [], rockfall: [entry(1, '돌지기', 798)] });
      renderBoard(MODES);

      await screen.findByText('아직 기록이 없습니다');
      const rock = screen.getByRole('tab', { name: '돌 막기' });
      expect(rock).toBeInTheDocument();

      fireEvent.click(rock);
      await screen.findByText('돌지기');
    });

    it('모드를 안 나눈 게임은 탭도 board 파라미터도 없다', async () => {
      serve([entry(1, '가', 900)], []);
      renderBoard();

      await screen.findByText('가');
      expect(screen.queryByRole('tab', { name: '물 막기' })).not.toBeInTheDocument();
      expect(vi.mocked(fetchLeaderboard)).toHaveBeenCalledWith('coin-corgi', 'BASE', 10, 'ALL_TIME', null);
    });
  });
});

describe('쪽 넘김 (상세 화면의 TOP 5 → TOP 10)', () => {
  const ten = Array.from({ length: 10 }, (_, i) => entry(i + 1, `p${i + 1}`, 1000 - i));

  it('다섯 줄만 보이고, 넘기면 나머지 다섯 줄이 온다', async () => {
    serve(ten, []);
    renderBoard([], 5);

    await waitFor(() => expect(screen.getByText('p1')).toBeInTheDocument());
    expect(screen.queryByText('p6')).not.toBeInTheDocument();
    expect(screen.getByText('1–5')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('다음 순위'));
    expect(screen.getByText('p6')).toBeInTheDocument();
    expect(screen.queryByText('p1')).not.toBeInTheDocument();
    expect(screen.getByText('6–10')).toBeInTheDocument();
  });

  it('pageSize 를 안 주면 전부 편다 — 허브 레일은 넘길 것이 없다', async () => {
    serve(ten, []);
    renderBoard();

    await waitFor(() => expect(screen.getByText('p10')).toBeInTheDocument());
    expect(screen.queryByLabelText('다음 순위')).not.toBeInTheDocument();
  });

  it('모드를 바꾸면 첫 쪽으로 돌아간다 — 빈 2쪽이 남으면 기록이 없는 것처럼 보인다', async () => {
    serveByBoard({ leak: ten, rockfall: [entry(1, '돌지기', 798)] });
    renderBoard(MODES, 5);

    await screen.findByText('p1');
    fireEvent.click(screen.getByLabelText('다음 순위'));
    expect(screen.getByText('p6')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: '돌 막기' }));
    await screen.findByText('돌지기');
    // 한 줄뿐인 보드로 넘어왔다 — 2쪽에 머물러 빈 표를 보여주면 안 된다
    expect(screen.queryByLabelText('다음 순위')).not.toBeInTheDocument();
  });
});
