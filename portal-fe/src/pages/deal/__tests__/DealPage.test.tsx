import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DealPage from '../DealPage';
import { DEAL_AFFILIATE_NOTE } from '../../../seo/copy.mjs';
import type { DealSection } from '../../../api/dealApi';

vi.mock('../../../api/dealApi', () => ({
  fetchDealSections: vi.fn(),
  fetchDealSearch: vi.fn(),
}));

import { fetchDealSearch, fetchDealSections } from '../../../api/dealApi';

const sections: DealSection[] = [
  {
    category: { code: 'travel', label: '여행', tagline: '항공 · 숙소' },
    offers: [
      {
        slug: 'trip-com',
        merchant: '트립닷컴',
        title: '해외 호텔 예약',
        benefit: '최대 10% 할인',
        summary: null,
        revenueType: 'AFFILIATE',
        disclosureRequired: true,
        validUntil: null,
      },
      {
        slug: 'airport-coupon',
        merchant: '공항공사',
        title: '주차 할인 쿠폰',
        benefit: '무료 쿠폰',
        summary: null,
        revenueType: 'PLAIN',
        disclosureRequired: false,
        validUntil: null,
      },
    ],
  },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DealPage />
    </QueryClientProvider>,
  );
}

describe('DealPage', () => {
  beforeEach(() => {
    vi.mocked(fetchDealSections).mockResolvedValue(sections);
    vi.mocked(fetchDealSearch).mockReset();
  });

  it('공정위 고지는 제휴 카드 안에만 붙는다 — 페이지 전체가 광고로 읽히지 않아야 한다', async () => {
    renderPage();
    const notes = await screen.findAllByText(DEAL_AFFILIATE_NOTE);
    const affiliate = screen.getByRole('link', { name: /해외 호텔 예약/ });

    expect(notes).toHaveLength(1);
    expect(affiliate).toContainElement(notes[0]);
  });

  it('제휴 링크에만 sponsored 를 붙인다 — 수수료 없는 링크까지 광고로 표시하지 않는다', async () => {
    renderPage();
    const affiliate = await screen.findByRole('link', { name: /해외 호텔 예약/ });
    const plain = await screen.findByRole('link', { name: /주차 할인 쿠폰/ });

    expect(affiliate).toHaveAttribute('rel', 'sponsored nofollow noopener');
    expect(plain).toHaveAttribute('rel', 'nofollow noopener');
  });

  it('모든 아웃바운드는 리다이렉터를 거친다 — 원본 URL 을 화면에 걸지 않는다', async () => {
    renderPage();
    const affiliate = await screen.findByRole('link', { name: /해외 호텔 예약/ });
    const plain = await screen.findByRole('link', { name: /주차 할인 쿠폰/ });

    expect(affiliate).toHaveAttribute('href', '/go/trip-com');
    expect(plain).toHaveAttribute('href', '/go/airport-coupon');
  });

  it('검색 결과도 같은 카드 규칙을 탄다 — 고지·rel·리다이렉터가 목록과 갈리면 안 된다', async () => {
    vi.mocked(fetchDealSearch).mockResolvedValue([
      {
        category: { code: 'commerce', label: '커머스', tagline: null },
        offers: [
          {
            slug: 'coupang-rocket',
            merchant: '쿠팡',
            title: '로켓와우 체험',
            benefit: '무료 체험',
            summary: null,
            revenueType: 'AFFILIATE',
            disclosureRequired: true,
            validUntil: null,
          },
        ],
      },
    ]);
    renderPage();
    await screen.findByRole('link', { name: /해외 호텔 예약/ });

    fireEvent.change(screen.getByLabelText('혜택 검색'), { target: { value: '쿠팡' } });

    const hit = await screen.findByRole('link', { name: /로켓와우 체험/ });
    expect(fetchDealSearch).toHaveBeenCalledWith('쿠팡');
    expect(hit).toHaveAttribute('href', '/go/coupang-rocket');
    expect(hit).toHaveAttribute('rel', 'sponsored nofollow noopener');
    expect(screen.getAllByText(DEAL_AFFILIATE_NOTE)).toHaveLength(1);
  });

  it('검색 중에는 전체 목록 대신 결과만 남는다 — 둘이 함께 보이면 무엇이 결과인지 흐려진다', async () => {
    vi.mocked(fetchDealSearch).mockResolvedValue([]);
    renderPage();
    await screen.findByRole('link', { name: /해외 호텔 예약/ });

    fireEvent.change(screen.getByLabelText('혜택 검색'), { target: { value: '없는혜택' } });

    expect(await screen.findByText(/에 해당하는 혜택이 없습니다/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /해외 호텔 예약/ })).toBeNull();
  });

});
