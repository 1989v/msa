import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { fetchMarket, type MarketResponse, type MarketStore } from '../../../api/marketApi';
import AttractionMarket from '../AttractionMarket';
import type MarketNaverMap from '../MarketNaverMap';
vi.mock('../../../api/marketApi', async original => ({ ...await original<typeof import('../../../api/marketApi')>(), fetchMarket: vi.fn() }));
let previewProps: ComponentProps<typeof MarketNaverMap>;
vi.mock('../MarketNaverMap', () => ({ default: (props: ComponentProps<typeof MarketNaverMap>) => { previewProps = props; return <div data-testid="preview" />; } }));
beforeEach(() => { vi.mocked(fetchMarket).mockResolvedValue(data); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const shop = (overrides: Partial<MarketStore> = {}): MarketStore => ({
  id: 1, name: '유명순대국', items: '순대', zoneId: null, membership: 'IN', latitude: 37.5, longitude: 127,
  roadAddress: null, jibunAddress: '서울 1', buildingName: null, dong: null, floor: null, ho: null,
  categoryMajor: '음식', categoryMid: '한식', categorySub: null, sources: ['ONNURI'], pinKind: 'EXACT',
  manual: false, actorKind: null, relativePosition: null, positionNote: null, ...overrides,
});
const data: MarketResponse = {
  market: { name: '시장', marketType: 'STREET', sourceMarketType: null, storeCountRaw: '10', openingCycle: '매일', facilities: '주차장',
    attribution: { name: '전국전통시장표준데이터', url: 'https://www.data.go.kr/data/15012894/standard.do', license: '공공누리 제1유형' } },
  attribution: ['© OpenStreetMap contributors'],
  zones: [], stores: [shop(), shop({ id: 2, name: '한지 가게', latitude: 37.501 }), shop({ id: 3, name: '좌표 없는 가게', latitude: null, jibunAddress: null })],
};

function mount(lang: 'ko' | 'en' = 'ko') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  // 카드의 링크·이동은 라우터 안에서만 뜻이 있다(앱에서는 항상 Router 아래에 있다).
  return render(<QueryClientProvider client={client}><MemoryRouter><AttractionMarket contentId="100" attractionId="7" lang={lang} /></MemoryRouter></QueryClientProvider>);
}
describe('attraction market summary card', () => {
  it.each(['ko', 'en'] as const)('shows facts, sources, and a noninteractive full-map preview in %s', async lang => {
    mount(lang); const card = await screen.findByRole('article', { name: '시장' });
    for (const value of [lang === 'ko' ? '거리형' : 'Street market', '10', '매일', '주차장']) expect(within(card).getByText(value)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: '전국전통시장표준데이터' })).toHaveAttribute('href', data.market.attribution!.url);
    expect(card).toHaveTextContent('공공누리 제1유형');
    expect(card).toHaveTextContent('© OpenStreetMap contributors');
    expect(previewProps).toMatchObject({ contentId: '100', interactive: false, initialZoom: 16, lang });
    const href = `${lang === 'en' ? '/en' : ''}/attractions/7/market`;
    const links = within(card).getAllByRole('link', { name: lang === 'ko' ? '지도 전체 보기' : 'View full map' });
    expect(links).toHaveLength(2); links.forEach(link => expect(link).toHaveAttribute('href', href));
    expect(card.closest('section')).toHaveAttribute('id', 'market'); expect(card.closest('section')).toHaveAttribute('data-place-section', 'market');
    expect(screen.queryByRole('searchbox')).toBeNull(); expect(screen.queryByRole('checkbox')).toBeNull(); expect(within(card).queryByRole('list')).toBeNull();
  });
  it.each(['ko', 'en'] as const)('links the top three IN-only shop types in %s', async lang => {
    vi.mocked(fetchMarket).mockResolvedValue({ ...data, stores: [shop(), shop({ id: 2 }), shop({ id: 3, categoryMajor: '소매', categoryMid: '식료품 소매' }), shop({ id: 4, categoryMajor: '소매', categoryMid: '섬유·의복·신발 소매' }), shop({ id: 5, categoryMajor: null }), ...[6, 7, 8].map(id => shop({ id, membership: 'OUT', nearby: true, categoryMajor: '음식', categoryMid: '비알코올' }))] });
    mount(lang); const nav = await screen.findByRole('navigation', { name: lang === 'ko' ? '가게 유형' : 'Shop types' });
    const links = within(nav).getAllByRole('link');
    expect(links.map(link => link.textContent)).toEqual(lang === 'ko' ? ['음식점 (2)', '식료품 (1)', '의류·신발 (1)'] : ['Restaurants (2)', 'Groceries (1)', 'Clothing & shoes (1)']);
    expect(links.map(link => link.getAttribute('href'))).toEqual(['food', 'grocery', 'fashion'].map(key => `${lang === 'en' ? '/en' : ''}/attractions/7/market?type=${key}`));
    expect(nav).toHaveClass('place-market-types');
  });
  it('keeps good-price summary, tourism restaurants and steward below the card', async () => {
    vi.mocked(fetchMarket).mockResolvedValue({ ...data, market: { ...data.market, id: 3, goodPrice: { storeCount: 1, minPrice: 5000, maxPrice: 6000, attribution: { name: '행정안전부 착한가격업소', url: 'https://example.com/price', license: '공개' } } }, restaurants: [{ title: '별도 음식점', firstMenu: '김밥', treatMenu: null, attraction: { id: 9, lang: 'ko' }, latitude: 37.5, longitude: 127 }] });
    mount(); const card = await screen.findByRole('article');
    expect(card).toHaveTextContent('착한가격업소 1곳 · 5,000~6,000원'); expect(within(card).getByRole('link', { name: '행정안전부 착한가격업소' })).toHaveAttribute('href', 'https://example.com/price');
    const restaurant = screen.getByRole('region', { name: '관광공사 소개 음식점' });
    expect(within(restaurant).getByRole('link', { name: '별도 음식점' })).toHaveAttribute('href', '/attractions/9');
    expect(restaurant).toHaveTextContent('김밥'); expect(card.contains(restaurant)).toBe(false);
    expect(screen.getByRole('region', { name: '상인회 담당자 신청' })).toBeInTheDocument();
  });
  it.each(['absent', 'failed'])('omits unavailable optional market: %s', async kind => {
    if (kind === 'absent') vi.mocked(fetchMarket).mockResolvedValue(null); else vi.mocked(fetchMarket).mockRejectedValue(new Error('offline'));
    const { container } = mount(); await vi.waitFor(() => expect(fetchMarket).toHaveBeenCalled()); expect(container.querySelector('#market')).toBeNull();
  });
});
