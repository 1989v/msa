import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AdministrativeRegion } from '../../../api/placeApi';

vi.mock('../../../api/placeApi', async (original) => ({
  ...await original<typeof import('../../../api/placeApi')>(),
  fetchAdministrativeRegions: vi.fn(),
  searchAttractions: vi.fn(),
  suggestPlaces: vi.fn(async () => []),
  fetchRegionVisitors: vi.fn(async () => ({ months: [] })),
  fetchRegionVisitorRanking: vi.fn(async () => ({ items: [] })),
}));
vi.mock('../../../analytics/tracker', async (original) => ({
  ...await original<typeof import('../../../analytics/tracker')>(), track: vi.fn(),
}));
vi.mock('../../../hooks/useHeritageSurface', () => ({
  useHeritageSurface() {}, useHeritageTheme: () => ['light', () => {}],
}));
vi.mock('../../../components/Footer', () => ({ default: () => null }));
vi.mock('../googleMaps', async (original) => ({
  ...await original<typeof import('../googleMaps')>(), mapsApiKey: () => '',
}));

import { fetchAdministrativeRegions, searchAttractions } from '../../../api/placeApi';
import {
  placeHubIntro, placeHubMeta, placeHreflangAlternates, placeUrl,
  regionIntro, regionMeta, regionUrl, regionVisitGuide,
} from '../../../seo/copy.mjs';
import { placeHubPages, renderRegionDetail } from '../../../../scripts/prerender-seo.mjs';
import PlacePage, { resetPlaceSessionForTest } from '../PlacePage';
import RegionPage from '../RegionPage';

const shell = '<html><head><!--seo:start--><!--seo:end--></head><body><div id="root"></div></body></html>';
const provinces: AdministrativeRegion[] = [
  { code: '11', name: '서울특별시', nameEn: 'Seoul' },
  { code: '50', name: '제주특별자치도', nameEn: 'Jeju' },
  { code: '26', name: '부산광역시', nameEn: 'Busan' },
  { code: '41', name: '경기도', nameEn: 'Gyeonggi' },
].map(region => ({ ...region, level: 'SIDO', parentCode: null, latitude: null, longitude: null, attractionCount: 1234 }));
const district: AdministrativeRegion = { ...provinces[0], code: '11110', level: 'SIGUNGU', parentCode: '11', name: '종로구', nameEn: 'Jongno-gu', attractionCount: null };
const langs = ['ko', 'en'] as const;
function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/place" element={<PlacePage />} />
    <Route path="/en/place" element={<PlacePage />} />
    <Route path="/regions/:code" element={<RegionPage />} />
    <Route path="/en/regions/:code" element={<RegionPage />} />
  </Routes></MemoryRouter></QueryClientProvider>);
}
function seoChecks(doc: Document, canonical: string, sub: string) {
  expect(doc.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  expect(doc.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(canonical);
  expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '').not.toContain('noindex');
  for (const alternate of placeHreflangAlternates(sub)) {
    expect(doc.querySelector(`link[hreflang="${alternate.hreflang}"]`)?.getAttribute('href')).toBe(alternate.href);
  }
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  document.head.innerHTML = '';
  resetPlaceSessionForTest();
  window.matchMedia = vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
  vi.mocked(fetchAdministrativeRegions).mockImplementation(({ level }) => Promise.resolve(level === 'SIDO' ? provinces : [district]));
  vi.mocked(searchAttractions).mockResolvedValue({
    searchId: 'fixture', attractions: [], totalElements: 0, totalPages: 1, currentPage: 0,
  });
});
afterEach(cleanup);

it.each(langs)('shares the full homepage introduction in initial HTML and runtime: %s', async lang => {
  const view = mount(lang === 'en' ? '/en/place' : '/place');
  await screen.findByText(placeHubIntro(lang));
  const pages = placeHubPages(shell, { ko: [], en: [] }, { ko: provinces, en: provinces });
  const doc = new DOMParser().parseFromString(pages[lang === 'en' ? 1 : 0].html, 'text/html');
  expect(view.container.querySelector('.place-header > .place-subtitle')?.textContent).toBe(doc.querySelector('.place-subtitle')?.textContent);
  expect(view.container.querySelectorAll('h1')).toHaveLength(1);
  expect(view.container.querySelector('h1')?.firstChild?.textContent).toBe(lang === 'en' ? 'K-Tour Map' : 'K-관광 지도');
  expect(doc.querySelectorAll('h1')).toHaveLength(1);
  expect(doc.querySelector('h1')?.textContent).toBe(placeHubMeta(lang).heading);
  await waitFor(() => expect(document.title).toBe(placeHubMeta(lang).title));
  for (const target of [document, doc]) {
    seoChecks(target, placeUrl(lang), '');
    expect(target.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(placeHubMeta(lang).description);
  }
  for (const region of provinces) expect(doc.querySelector(`a[href="${lang === 'en' ? '/en' : ''}/regions/${region.code}"]`)).not.toBeNull();
});

it.each(langs.flatMap(lang => provinces.slice(0, 3).map(region => ({ lang, region }))))('keeps the full region sentence and reviewed guidance in runtime and initial HTML: $lang/$region.code', async ({ lang, region }) => {
  const sub = `/regions/${region.code}`;
  const view = mount(`${lang === 'en' ? '/en' : ''}${sub}`);
  await screen.findByRole('heading', { name: regionMeta(lang, region, 1234).heading });
  const guide = regionVisitGuide(lang, region)!;
  const intro = regionIntro(lang, region, 1234);
  expect(screen.getByText(guide)).toBeInTheDocument();
  expect(view.container.querySelectorAll('.place-detail-overview')).toHaveLength(2);
  const doc = new DOMParser().parseFromString(renderRegionDetail(shell, lang, region, { bothLangs: true, children: [district], top: [{ id: '42', title: 'Sample attraction' }] }), 'text/html');
  for (const body of [view.container, doc.body]) {
    expect(body.querySelectorAll('h1')).toHaveLength(1);
    expect(body.querySelectorAll('.place-detail-overview')[0].textContent).toBe(intro);
    expect(body.querySelectorAll('.place-detail-overview')[1].textContent).toBe(guide);
    expect(body.querySelectorAll('.place-detail-overview')[0].textContent).not.toContain('…');
  }
  expect(doc.querySelector(`a[href="${lang === 'en' ? '/en' : ''}/regions/11110"]`)).not.toBeNull();
  expect(doc.querySelector(`a[href="${lang === 'en' ? '/en' : ''}/attractions/42"]`)).not.toBeNull();
  for (const target of [document, doc]) {
    seoChecks(target, regionUrl(lang, region.code), sub);
    expect(target.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(regionMeta(lang, region, 1234).description);
  }
});

it.each([provinces[3], district, { ...provinces[0], level: 'SIGUNGU' as const }])('does not apply a reviewed province guide outside its province scope: $code/$level', async region => {
  vi.mocked(fetchAdministrativeRegions).mockResolvedValue([region]);
  const view = mount(`/regions/${region.code}`);
  await screen.findByRole('heading', { name: regionMeta('ko', region, region.attractionCount).heading });
  const doc = new DOMParser().parseFromString(renderRegionDetail(shell, 'ko', region), 'text/html');
  expect(view.container.querySelectorAll('.place-detail-overview')).toHaveLength(1);
  expect(doc.querySelectorAll('.place-detail-overview')).toHaveLength(1);
  expect(regionVisitGuide('ko', region)).toBeNull();
  if (region.attractionCount === null) expect(view.container.querySelector('.place-detail-overview')?.textContent).not.toMatch(/0곳/);
});

it('preserves prerender metadata while region data is loading and after a query failure', async () => {
  document.head.innerHTML = '<title>Existing title</title><meta name="description" content="Existing description"><link rel="canonical" href="https://place.1989v.com/regions/11"><meta name="robots" content="index, follow">';
  let reject!: (error: Error) => void;
  vi.mocked(fetchAdministrativeRegions).mockReturnValue(new Promise((_, no) => { reject = no; }));
  const view = mount('/regions/11');
  expect(screen.getByText('불러오는 중…')).toBeInTheDocument();
  expect(view.container.querySelector('.place-detail-overview')).toBeNull();
  const before = document.head.innerHTML;
  await act(async () => reject(Error('offline')));
  await screen.findByText('정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  expect(document.head.innerHTML).toBe(before);
  expect(screen.queryByText('지역을 찾을 수 없습니다.')).toBeNull();
  expect(view.container.querySelector('.place-detail-overview')).toBeNull();
});
