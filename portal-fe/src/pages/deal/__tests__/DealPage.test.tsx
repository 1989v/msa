import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DealPage from '../DealPage';
import { DEAL_DISCLOSURE } from '../../../seo/copy.mjs';
import type { DealSection } from '../../../api/dealApi';

vi.mock('../../../api/dealApi', () => ({
  fetchDealSections: vi.fn(),
}));

import { fetchDealSections } from '../../../api/dealApi';

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
  });

  it('공정위 고지를 화면에 고정 노출한다', async () => {
    renderPage();
    expect(await screen.findByText(DEAL_DISCLOSURE)).toBeInTheDocument();
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

  it('제휴 링크에만 고지 배지를 단다', async () => {
    renderPage();
    expect(await screen.findByText('제휴')).toBeInTheDocument();
    expect(screen.getAllByText('제휴')).toHaveLength(1);
  });
});
