import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * 편집 페이지 SPA — 생성 JSON 의 parts 를 그린다. html 조각만 innerHTML 이고 카드는 React 요소다.
 * 기대 문구는 copy.mjs 의 상수·함수에서 가져온다.
 */

const seo = vi.hoisted(() => vi.fn());
vi.mock('../../../seo/useSeo', () => ({ useSeo: seo }));
vi.mock('../../../hooks/useHeritageSurface', () => ({
  useHeritageSurface: () => undefined,
  useHeritageTheme: () => ['light', () => undefined],
}));
vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  fetchAttraction: vi.fn(),
}));
const fixtures = vi.hoisted(() => ({
  draft: {
    slug: 'seoul-free',
    title: '서울 무료 실내 관광지',
    description: '설명',
    status: 'draft',
    reviewedBy: null,
    reviewedAt: null,
    attractionIds: ['101'],
    source: 'portal-fe/src/content/guides/seoul-free.md',
    headings: [],
    parts: [{ html: '<p>첫 문단</p>' }, { cardId: '101' }, { html: '<p>끝 문단</p>' }],
  },
  published: {
    slug: 'palace',
    title: '서울 고궁 반나절',
    description: '설명',
    status: 'published',
    reviewedBy: '권기덕',
    reviewedAt: '2026-10-10',
    attractionIds: ['101'],
    source: 'portal-fe/src/content/guides/palace.md',
    headings: [],
    parts: [{ cardId: '101' }],
  },
  listPublished: true,
}));
vi.mock('../guides', () => ({
  get GUIDES() {
    const list = fixtures.listPublished ? [fixtures.draft, fixtures.published] : [fixtures.draft];
    return Object.fromEntries(list.map((g) => [g.slug, g]));
  },
}));

import { fetchAttraction } from '../../../api/placeApi';
import { GUIDE_DRAFT_BAND, GUIDE_INDEX_META, guideCard, guidePath, guideUrl } from '../../../seo/copy.mjs';
import GuidePage from '../GuidePage';
import GuideIndexPage from '../GuideIndexPage';

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/guides" element={<GuideIndexPage />} />
          <Route path="/guides/:slug" element={<GuidePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const lastSeo = () => seo.mock.calls.at(-1)?.[0];

// 원천 이름에 태그와 엔터티가 섞여 온다 — 태그는 평문화로 걷히고, 디코드된 「<script>」는 글자로 남아야 한다
const ATTRACTION = {
  id: '101',
  title: '<script>alert(1)</script>&lt;script&gt;경복궁',
  address: '서울특별시 종로구 사직로 161',
  feeText: '무료',
};
const NAME = guideCard(ATTRACTION).name;

beforeEach(() => {
  fixtures.listPublished = true;
  vi.mocked(fetchAttraction).mockResolvedValue(ATTRACTION as never);
});
afterEach(() => {
  cleanup();
  seo.mockReset();
});

describe('GuidePage', () => {
  it('/guides/:slug — 조각 순서대로 그리고, draft 는 띠와 noindex', async () => {
    const { container } = renderAt(guidePath('seoul-free'));
    expect(screen.getByRole('heading', { level: 1, name: '서울 무료 실내 관광지' })).toBeTruthy();
    expect(screen.getByText(GUIDE_DRAFT_BAND)).toBeTruthy();
    expect(lastSeo()).toMatchObject({ canonical: guideUrl('seoul-free'), noindex: true });
    await screen.findByRole('link', { name: NAME });
    const text = container.textContent ?? '';
    expect(text.indexOf('첫 문단')).toBeLessThan(text.indexOf(NAME));
    expect(text.indexOf(NAME)).toBeLessThan(text.indexOf('끝 문단'));
    expect(vi.mocked(fetchAttraction)).toHaveBeenCalledWith('101');
  });

  it('카드 이름의 <script> 는 요소가 아니라 글자다', async () => {
    const { container } = renderAt(guidePath('seoul-free'));
    await screen.findByRole('link', { name: NAME });
    expect(NAME).toContain('<script>');
    expect(container.querySelector('script')).toBeNull();
  });

  it('published 는 띠가 없고 noindex 도 없다', () => {
    renderAt(guidePath('palace'));
    expect(screen.queryByText(GUIDE_DRAFT_BAND)).toBeNull();
    expect(lastSeo()).toMatchObject({ noindex: false });
  });

  it('없는 slug → NotFound', () => {
    renderAt(guidePath('none'));
    expect(screen.getByRole('heading', { level: 1, name: '페이지를 찾을 수 없습니다' })).toBeTruthy();
  });
});

describe('GuideIndexPage', () => {
  it('published 만 보인다', () => {
    renderAt(guidePath());
    expect(screen.getByRole('heading', { level: 1, name: GUIDE_INDEX_META.heading })).toBeTruthy();
    expect(screen.getByRole('link', { name: '서울 고궁 반나절' }).getAttribute('href')).toBe(guidePath('palace'));
    expect(screen.queryByRole('link', { name: '서울 무료 실내 관광지' })).toBeNull();
  });

  it('published 0장이면 NotFound', () => {
    fixtures.listPublished = false;
    renderAt(guidePath());
    expect(screen.getByRole('heading', { level: 1, name: '페이지를 찾을 수 없습니다' })).toBeTruthy();
  });
});

