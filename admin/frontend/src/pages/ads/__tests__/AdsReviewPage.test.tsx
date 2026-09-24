import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdsReviewPage } from '../AdsReviewPage';
import * as adsApi from '@/api/ads';
import type { AdminCreative } from '@/api/ads';

vi.mock('@/api/ads', async () => {
  const actual = await vi.importActual<typeof adsApi>('@/api/ads');
  return {
    ...actual,
    listPendingCreatives: vi.fn(),
    approveCreative: vi.fn(),
    rejectCreative: vi.fn(),
    fetchCreativeImage: vi.fn(),
  };
});

// 광고주가 적은 문자열 — HTML 로 해석되면 <b>·<img> 요소가 생긴다
const HOSTILE_TITLE = '<b>굵게</b> 원서 모임';
const HOSTILE_BODY = '<img src=x onerror=alert(1)> 첫 달 무료';

const pending = (over: Partial<AdminCreative> = {}): AdminCreative => ({
  id: 31,
  campaignId: 11,
  advertiserId: 7,
  status: 'PENDING',
  title: HOSTILE_TITLE,
  body: HOSTILE_BODY,
  link: 'https://example.com/landing',
  emoji: null,
  imageUrl: null,
  rejectReason: null,
  reviewedAt: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adsApi.listPendingCreatives).mockResolvedValue([pending()]);
});

describe('AdsReviewPage', () => {
  it('광고주 문자열은 텍스트로만 그린다 — 심사자 화면에서도 HTML 로 해석하지 않는다', async () => {
    const { container } = render(<AdsReviewPage />);
    expect(await screen.findByText(HOSTILE_TITLE)).toBeInTheDocument();
    expect(screen.getByText(HOSTILE_BODY)).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
  });

  it('반려는 고른 사유 코드와 함께 보낸다', async () => {
    vi.mocked(adsApi.rejectCreative).mockResolvedValue(pending({ status: 'REJECTED', rejectReason: 'GAMBLING' }));
    render(<AdsReviewPage />);
    await screen.findByText(HOSTILE_TITLE);

    await userEvent.selectOptions(screen.getByLabelText('반려 사유'), 'GAMBLING');
    await userEvent.click(screen.getByRole('button', { name: '반려' }));

    await waitFor(() => expect(adsApi.rejectCreative).toHaveBeenCalledWith(31, 'GAMBLING'));
    expect(adsApi.approveCreative).not.toHaveBeenCalled();
  });
});
