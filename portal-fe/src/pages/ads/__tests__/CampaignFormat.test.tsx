import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../../../api/adsConsoleApi';
import * as auth from '../../../auth/auth';
import { advertiser, campaignOf, catalogWith, renderEditor } from './consoleFixtures';

vi.mock('../../../api/adsConsoleApi', async () => {
  const actual = await vi.importActual<typeof api>('../../../api/adsConsoleApi');
  return {
    ...actual,
    fetchAdvertiserMe: vi.fn(),
    fetchCampaign: vi.fn(),
    fetchCreatives: vi.fn(),
    fetchCatalog: vi.fn(),
    createCampaign: vi.fn(),
    updateCampaign: vi.fn(),
  };
});

vi.mock('../../../auth/auth', async () => {
  const actual = await vi.importActual<typeof auth>('../../../auth/auth');
  return { ...actual, isLoggedIn: vi.fn() };
});

/** C4 — 광고 형태는 새 캠페인에서만 고르고, 지면·최저가·소재 목록이 형태를 따른다. */

const placeBox = (name: RegExp) => screen.findByRole('checkbox', { name });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.isLoggedIn).mockReturnValue(true);
  vi.mocked(api.fetchAdvertiserMe).mockResolvedValue(advertiser);
  vi.mocked(api.fetchCatalog).mockResolvedValue(catalogWith());
  vi.mocked(api.fetchCreatives).mockResolvedValue([]);
  vi.mocked(api.createCampaign).mockReturnValue(new Promise(() => {}));
  vi.mocked(api.updateCampaign).mockReturnValue(new Promise(() => {}));
});

describe('캠페인 편집 — 광고 형태', () => {
  it('새 캠페인은 형태를 고르고, 바꾸면 그 형태를 받지 않는 지면이 빠지며 알린다 — 형태는 만들기 요청에 실린다', async () => {
    renderEditor('/campaigns/new');
    await userEvent.click(await placeBox(/게임 목록 끝/));
    await userEvent.click(await placeBox(/블로그 글 끝/));
    expect(screen.queryByRole('checkbox', { name: /게임 목록 위/ })).not.toBeInTheDocument();
    expect(screen.getByText(/띠배너만 받는 자리: 게임 목록 위/)).toBeInTheDocument();

    await userEvent.click(within(screen.getByRole('radiogroup', { name: '광고 형태' })).getByRole('radio', { name: /띠배너/ }));

    expect(screen.getByRole('status')).toHaveTextContent('띠배너를 받지 않는 지면을 선택에서 뺐습니다: 게임 목록 끝');
    expect(screen.queryByRole('checkbox', { name: /게임 목록 끝/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /블로그 글 끝/ })).toBeChecked();
    // 최저가는 고른 형태의 규격 값이다 — 블로그 글 끝의 띠배너 0.05
    expect(screen.getByRole('checkbox', { name: /블로그 글 끝/ }).closest('label')).toHaveTextContent('최저 CPM 0.05');

    await userEvent.type(screen.getByLabelText('캠페인 이름'), '띠 모집');
    await userEvent.type(screen.getByLabelText('입찰가'), '0.05');
    await userEvent.type(screen.getByLabelText('일예산'), '5');
    await userEvent.click(screen.getByRole('button', { name: '만들기' }));

    await waitFor(() => expect(api.createCampaign).toHaveBeenCalledTimes(1));
    const [input, format] = vi.mocked(api.createCampaign).mock.calls[0];
    expect(format).toBe('BANNER');
    expect(input.placementKeys).toEqual(['blog-post-end']);
  });

  it('기존 캠페인은 형태를 읽기 전용으로 보이고, 규격이 사라진 지면은 「이 형태를 더 받지 않음」으로 해제할 수 있다', async () => {
    vi.mocked(api.fetchCampaign).mockResolvedValue(campaignOf({ placementKeys: ['blog-post-end', 'game-hub-end'] }));
    renderEditor('/campaigns/11');

    expect(await screen.findByText(/형태를 바꾸려면 새 캠페인을 만드세요/)).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: '광고 형태' })).not.toBeInTheDocument();

    const withdrawn = await placeBox(/게임 목록 끝/);
    expect(withdrawn).toBeChecked();
    expect(withdrawn.closest('label')).toHaveTextContent('이 형태를 더 받지 않음');
    await userEvent.click(withdrawn);
    expect(screen.queryByRole('checkbox', { name: /게임 목록 끝/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(api.updateCampaign).toHaveBeenCalledTimes(1));
    const [id, input] = vi.mocked(api.updateCampaign).mock.calls[0];
    expect(id).toBe(11);
    expect(input.placementKeys).toEqual(['blog-post-end']);
    // 수정 요청에는 형태 필드가 없다
    expect(input).not.toHaveProperty('creativeFormat');
  });

  it('띠배너 캠페인의 소재 목록은 대체 텍스트 라벨로 그리고 설명 칸이 없다', async () => {
    vi.mocked(api.fetchCampaign).mockResolvedValue(campaignOf());
    vi.mocked(api.fetchCreatives).mockResolvedValue([
      {
        id: 21, campaignId: 11, status: 'PENDING', title: '가을 원서 모임 — 첫 달 무료', body: '',
        landingUrl: 'https://example.com', imageUrl: null, rejectReason: null, reviewedAt: null,
      },
    ]);
    renderEditor('/campaigns/11');

    const title = await screen.findByText('가을 원서 모임 — 첫 달 무료', { exact: false });
    expect(title).toHaveTextContent('대체 텍스트 가을 원서 모임 — 첫 달 무료');
    expect(screen.getByLabelText(/^대체 텍스트/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^문구/)).not.toBeInTheDocument();
  });
});
