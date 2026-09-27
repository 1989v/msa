import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdsConsolePage from '../AdsConsolePage';
import type { AdvertiserDashboard, Campaign, Catalog, UploadRules } from '../../../api/adsConsoleApi';

/** 광고 형태·업로드 테스트가 함께 쓰는 카탈로그와 캠페인. 카탈로그는 서버 응답 모양(형태 규격 + 옛 필드 동반) 그대로다. */

export const advertiser: AdvertiserDashboard = {
  advertiserId: 7,
  displayName: '원서 모임',
  status: 'ACTIVE',
  suspendReason: null,
  balanceMicros: 382_400_000,
  todaySpendMicros: 0,
  todayChargedMicros: 0,
  todayTopUpMicros: 0,
  dailyTopUpLimitMicros: 500_000_000,
  maxTopUpPerCallMicros: 100_000_000,
};

export const RULES: UploadRules = { fileTypes: ['image/png', 'image/jpeg'], maxBytes: 300 * 1024, maxDimension: 2000, aspectTolerance: 0.01 };

const card = { format: 'CARD' as const, aspectRatios: ['1.91:1'], floorMicros: 100_000 };
const strip = { format: 'BANNER' as const, aspectRatios: ['6.4:1'], floorMicros: 50_000 };

export function catalogWith(uploadRules: UploadRules = RULES): Catalog {
  return {
    placements: [
      { key: 'blog-post-end', host: 'blog.1989v.com', formats: [card, strip], ...card, description: '블로그 글 끝', averageDailyRequests: 1200 },
      { key: 'game-hub-end', host: 'game.1989v.com', formats: [card], ...card, description: '게임 목록 끝', averageDailyRequests: 800 },
      { key: 'game-list-banner', host: 'game.1989v.com', formats: [strip], ...strip, description: '게임 목록 위', averageDailyRequests: 900 },
    ],
    categories: [],
    hourlyCapPercent: 25,
    uploadRules,
  };
}

export const campaignOf = (over: Partial<Campaign> = {}): Campaign => ({
  id: 11,
  name: '가을 모집',
  status: 'ACTIVE',
  bidType: 'CPM',
  bidMicros: 200_000,
  dailyBudgetMicros: 20_000_000,
  totalBudgetMicros: null,
  startAt: '2026-09-01T00:00:00',
  endAt: null,
  frequencyCapPerDay: 3,
  placementKeys: ['game-list-banner'],
  categoryCodes: [],
  inPeriod: true,
  creativeFormat: 'BANNER',
  ...over,
});

export function renderEditor(path: '/campaigns/new' | '/campaigns/11') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/campaigns/new" element={<AdsConsolePage view="campaign-new" />} />
          <Route path="/campaigns/:id" element={<AdsConsolePage view="campaign" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
