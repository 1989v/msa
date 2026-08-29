import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 게임 상세가 **상세를 한 번만 가져오는지** 본다.
 *
 * 2026-08-25 운영 회귀: `handlePlay` 의 의존성에 `game` 에서 파생된 값이 들어가면서
 * 정체성이 매 렌더 바뀌었다. `handlePlay` 는 상세 로드 effect 의 의존성이라
 * **상세 fetch → setState → 리렌더 → effect 재실행 → 상세 fetch** 로 무한 루프가 됐다.
 * 증상은 "화면이 깜빡이고 상단이 '불러오는 중'에서 멈춰 진입 불가".
 *
 * 코드에 주석으로 경고돼 있었는데도 깨졌다 — 주석은 실행되지 않는다. 그래서 테스트로 옮긴다.
 */

vi.mock('../../../api/gameApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/gameApi')>();
  return {
    ...actual,
    fetchGameDetail: vi.fn(),
    fetchSimilarGames: vi.fn(),
    fetchLeaderboard: vi.fn(),
    getGameNickname: vi.fn(() => null),
    startGameSession: vi.fn(),
    endGameSession: vi.fn(),
    rateGame: vi.fn(),
  };
});
vi.mock('../../../api/searchApi', () => ({ fetchGraphData: vi.fn(() => Promise.resolve({ nodes: [], links: [] })) }));
vi.mock('../../../seo/useSeo', () => ({ useSeo: () => undefined }));
// 모듈을 통째로 대체하므로 **이 모듈이 내보내는 것을 다 채워야 한다.**
// 상세 화면에 GNB 가 붙으면서 ThemeToggle → useHeritageTheme 경로가 생겼고,
// 빠진 export 하나가 렌더를 던져 테스트가 exit 1 이 됐다 (2026-08-29).
vi.mock('../../../hooks/useHeritageSurface', () => ({
  useHeritageSurface: () => undefined,
  useHeritageTheme: () => ['light', () => undefined],
}));
vi.mock('../../../auth/auth', () => ({ isLoggedIn: () => false }));
// AuthButton 은 이 테스트의 관심사가 아니고, 던지면 트리가 죽어 루프가 재현되기 전에 렌더가 끊긴다
vi.mock('../../../components/AuthButton', () => ({ default: () => null }));
vi.mock('../../../components/favorite/FavoriteButton', () => ({ default: () => null }));

import {
  fetchGameDetail,
  fetchSimilarGames,
  fetchLeaderboard,
} from '../../../api/gameApi';
import GameDetailPage from '../GameDetailPage';

const DETAIL = {
  id: 1,
  slug: 'neon-drifter',
  title: '네온 드리프터',
  titleEn: null,
  description: '설명',
  descriptionEn: null,
  thumbnailUrl: '/t.png',
  coverUrl: null,
  engineType: 'CANVAS_TS',
  loadType: 'IFRAME',
  entryUrl: '/games/neon-drifter/index.html',
  /** 이 값이 회귀의 방아쇠였다 — 파생값을 콜백 의존성에 넣으면 루프가 된다 */
  orientation: 'LANDSCAPE',
  supportsMobile: true,
  developerName: 'kgd',
  sdkIntegrated: true,
  status: 'PUBLISHED',
  genre: 'ACTION',
  tags: [],
  scoreBoards: [],
  releasedAt: null,
  contentUpdatedAt: null,
  playCount: 0,
  ratingAvg: 0,
  ratingCount: 0,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/games/neon-drifter']}>
      <Routes>
        <Route path="/games/:slug" element={<GameDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('게임 상세 — 상세 조회 루프 방지', () => {
  beforeEach(() => {
    vi.mocked(fetchGameDetail).mockResolvedValue(DETAIL as never);
    vi.mocked(fetchSimilarGames).mockResolvedValue([] as never);
    vi.mocked(fetchLeaderboard).mockResolvedValue([] as never);
  });
  afterEach(() => vi.clearAllMocks());

  it('상세를 slug 당 한 번만 가져온다 — 렌더가 반복돼도 다시 부르지 않는다', async () => {
    renderPage();
    await waitFor(() => expect(vi.mocked(fetchGameDetail)).toHaveBeenCalled());
    // 리렌더가 여러 번 일어날 시간을 준다 — 루프가 있으면 호출 수가 계속 는다
    await new Promise((r) => setTimeout(r, 300));
    expect(vi.mocked(fetchGameDetail)).toHaveBeenCalledTimes(1);
  });

  it('가로 전용 게임(orientation=LANDSCAPE)이어도 마찬가지다 — 이 값이 회귀의 방아쇠였다', async () => {
    renderPage();
    await waitFor(() => expect(vi.mocked(fetchGameDetail)).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 300));
    expect(vi.mocked(fetchGameDetail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchSimilarGames)).toHaveBeenCalledTimes(1);
  });
});
