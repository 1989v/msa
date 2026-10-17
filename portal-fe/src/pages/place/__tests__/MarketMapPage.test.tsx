import { useEffect, type ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { fetchAttraction, type AttractionDetail } from '../../../api/placeApi';
import { fetchMarket, fetchMarketDishes, type MarketResponse, type MarketStore } from '../../../api/marketApi';
import MarketMapPage from '../MarketMapPage';
import type MarketMap from '../MarketMap';
import { groupMarketPins } from '../marketView';
import { marketListStores } from '../MarketList';
vi.mock('../../../api/placeApi', async original => ({ ...await original<typeof import('../../../api/placeApi')>(), fetchAttraction: vi.fn() }));
vi.mock('../../../api/marketApi', async original => ({ ...await original<typeof import('../../../api/marketApi')>(), fetchMarket: vi.fn(), fetchMarketDishes: vi.fn() }));
const bounds = { north: 37.51, south: 37.49, west: 126.99, east: 127.01 };
let mapProps: ComponentProps<typeof MarketMap>;
vi.mock('../MarketMap', () => ({ default: (props: ComponentProps<typeof MarketMap>) => {
  mapProps = props;
  useEffect(() => { props.onViewportChange?.({ bounds, zoom: 17 }); }, []);
  return <div data-testid="map"><button onClick={() => props.onSelect('필지2')}>핀 선택</button><button onClick={() => props.onViewportChange?.({ bounds: { ...bounds, north: 0, south: -1 }, zoom: 19 })}>지도 이동</button></div>;
} }));
const shop = (id: number, name: string, extra: Partial<MarketStore> = {}): MarketStore => ({
  id, name, items: null, zoneId: 1, membership: 'IN', latitude: 37.5, longitude: 127,
  roadAddress: null, jibunAddress: `필지${id}`, buildingName: null, dong: null, floor: null, ho: null,
  categoryMajor: null, categoryMid: null, categorySub: null, sources: ['ONNURI'], pinKind: 'EXACT', manual: false, actorKind: null, relativePosition: null, positionNote: null, ...extra,
});
const data: MarketResponse = {
  market: { name: '시장', marketType: 'STREET', sourceMarketType: null, storeCountRaw: '4', openingCycle: null, facilities: null, attribution: null },
  zones: [1, 2].map(id => ({ id, parentId: null, kind: 'BUILDING', name: `구역${id}`, dong: null, floor: null, children: [] })),
  stores: [shop(1, '가게'), shop(2, '하늘가게', { latitude: 37.5001 }), shop(3, '먼가게', { zoneId: 2, latitude: 38 }), shop(4, '가나다 위치없음', { latitude: null })],
};
function Address() { const location = useLocation(); const navigate = useNavigate(); return <><output data-testid="address">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>이전 주소</button></>; }
function mount(entry = '/attractions/7/market', entries = [entry]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}><Address /><Routes>
    <Route path="/attractions/:id/market" element={<MarketMapPage />} /><Route path="/en/attractions/:id/market" element={<MarketMapPage />} />
    <Route path="/attractions/:id" element={<p>관광지 상세</p>} /><Route path="/en/attractions/:id" element={<p>Attraction detail</p>} /><Route path="/before" element={<p>Before</p>} />
  </Routes></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.mocked(fetchAttraction).mockResolvedValue({ id: '7', contentId: '100', title: '관광지', lang: 'ko', alternateId: '8' } as AttractionDetail);
  vi.mocked(fetchMarket).mockResolvedValue(data); vi.mocked(fetchMarketDishes).mockResolvedValue([]);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe('dedicated market map page', () => {
  it.each(['/attractions/7/market', '/en/attractions/7/market'])('loads attraction and market on %s with a detail back link', async entry => {
    mount(entry); await screen.findByRole('heading', { name: entry.startsWith('/en') ? '관광지' : '시장' });
    expect(fetchAttraction).toHaveBeenCalledWith('7');
    const en = entry.startsWith('/en'); expect(fetchMarket).toHaveBeenCalledWith('100', false, en ? 'en' : 'ko');
    expect(screen.getByRole('link', { name: en ? 'Back to attraction' : '관광지 상세로' })).toHaveAttribute('href', `${en ? '/en' : ''}/attractions/7`);
    expect(document.querySelectorAll('.market-map-list')).toHaveLength(1);
    expect(document.querySelector('.place-market-cluster-sheet')).toBeNull();
  });
  it.each(['absent', 'failed'])('replaces unavailable market route with detail: %s', async kind => {
    if (kind === 'absent') vi.mocked(fetchMarket).mockResolvedValue(null); else vi.mocked(fetchMarket).mockRejectedValue(new Error('offline'));
    mount('/attractions/7/market', ['/before', '/attractions/7/market']);
    await screen.findByText('관광지 상세');
    fireEvent.click(screen.getByRole('button', { name: '이전 주소' })); await screen.findByText('Before');
  });
  it('keeps good-price menus, attribution, and TourAPI menu details in the dedicated list', async () => {
    vi.mocked(fetchMarket).mockResolvedValue({ ...data,
      market: { ...data.market, goodPrice: { storeCount: 1, minPrice: 5000, maxPrice: 6000, attribution: { name: '착한가격 원천', url: 'https://example.com/price', license: '공개' } }, attribution: { name: '시장 원천', url: 'https://example.com/market', license: '공공누리' } },
      stores: [shop(2, '하늘가게', { goodPrice: { category: '한식', matchedBy: 'NAME', menus: [{ name: '칼국수', price: 5000 }, { name: '수제비', price: null }, { name: '비빔밥', price: 6000 }] }, tourMenu: { firstMenu: '빈대떡', treatMenu: '육회', attraction: { id: 9, lang: 'ko' } } })],
    });
    mount(); const list = await screen.findByRole('complementary');
    await within(list).findByText('착한가격');
    expect(list).toHaveTextContent('착한가격업소 1곳 · 5,000~6,000원');
    expect(within(list).getByRole('link', { name: '착한가격 원천' })).toHaveAttribute('href', 'https://example.com/price');
    expect(within(list).getByRole('link', { name: '시장 원천' })).toHaveAttribute('href', 'https://example.com/market');
    expect(list).toHaveTextContent('출처: 한국관광공사 TourAPI'); expect(list).toHaveTextContent('대표 메뉴: 빈대떡'); expect(list).toHaveTextContent('취급 메뉴: 육회');
    expect(list).toHaveTextContent('칼국수 5,000원 · 수제비'); expect(within(list).queryByText(/비빔밥/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '핀 선택' }));
    expect(list).toHaveTextContent('칼국수 5,000원 · 수제비 · 비빔밥 6,000원');
  });
  it('roundtrips marketQuery with replace, removes empty values, and preserves other query state', async () => {
    mount('/attractions/7/market?marketQuery=가게&keep=1', ['/before', '/attractions/7/market?marketQuery=가게&keep=1']);
    const input = await screen.findByRole('searchbox'); expect(input).toHaveValue('가게');
    fireEvent.change(input, { target: { value: '먼가게' } });
    expect(screen.getByTestId('address')).toHaveTextContent('marketQuery=%EB%A8%BC%EA%B0%80%EA%B2%8C&keep=1');
    fireEvent.change(input, { target: { value: '' } }); expect(screen.getByTestId('address')).toHaveTextContent('/attractions/7/market?keep=1');
    fireEvent.click(screen.getByRole('button', { name: '이전 주소' })); await screen.findByText('Before');
  });
  it('intersects viewport and zones but searches outside the viewport, with matching heading and rows', async () => {
    mount();
    await screen.findByRole('heading', { name: '현 지도에서 2곳 · 지도 위치 없음 1곳' });
    const list = screen.getByRole('complementary');
    expect(within(list).queryByText('먼가게')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '구역2 (1)' }));
    expect(screen.getByRole('heading', { name: '현 지도에서 0곳' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '먼가게' } });
    expect(screen.getByRole('heading', { name: '찾은 가게 1곳' })).toBeInTheDocument(); expect(within(list).getByText('먼가게')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } }); fireEvent.click(screen.getByRole('button', { name: '전체 구역' }));
    fireEvent.click(screen.getByRole('button', { name: '지도 이동' })); expect(screen.getByRole('heading', { name: '현 지도에서 0곳 · 지도 위치 없음 1곳' })).toBeInTheDocument();
    expect(within(list).getByText('지도 위치 없음')).toBeInTheDocument();
  });
  it('keeps selected parcel shops first and highlighted, missing coordinates last, and focuses a row on map', async () => {
    mount(); await screen.findByRole('heading', { name: '현 지도에서 2곳 · 지도 위치 없음 1곳' });
    fireEvent.click(screen.getByRole('button', { name: '핀 선택' }));
    const rows = within(screen.getByRole('complementary')).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('하늘가게'); expect(rows[0]).toHaveAttribute('data-selected', 'true'); expect(rows[0]).toHaveTextContent('선택한 필지');
    expect(rows.at(-1)).toHaveTextContent('지도 위치 없음');
    fireEvent.click(screen.getByRole('button', { name: '지도에서 보기: 가게' })); expect(mapProps.focusStoreId).toBe(1);
  });
  it('paginates by 50 in the same list and resets after a query', async () => {
    vi.mocked(fetchMarket).mockResolvedValue({ ...data, stores: Array.from({ length: 72 }, (_, index) => shop(index + 1, `상점${String(index).padStart(3, '0')}`)) });
    mount(); await screen.findByRole('heading', { name: '현 지도에서 72곳' });
    fireEvent.click(screen.getByRole('button', { name: '가게 목록 크기 조절' }));
    expect(within(screen.getByRole('complementary')).getAllByRole('listitem')).toHaveLength(50);
    fireEvent.click(screen.getByRole('button', { name: '더 보기' })); expect(within(screen.getByRole('complementary')).getAllByRole('listitem')).toHaveLength(72);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '상점' } }); expect(within(screen.getByRole('complementary')).getAllByRole('listitem')).toHaveLength(50);
  });
  it('cycles peek/half/full, moves only one snap for a 60px drag, and opens half on pin or search focus', async () => {
    mount(); await screen.findByRole('heading', { name: '시장' });
    const page = document.querySelector('main')!; const handle = screen.getByRole('button', { name: '가게 목록 크기 조절' });
    expect(page).toHaveAttribute('data-snap', 'peek');
    fireEvent.click(handle); expect(page).toHaveAttribute('data-snap', 'half'); fireEvent.click(handle); expect(page).toHaveAttribute('data-snap', 'full'); fireEvent.click(handle); expect(page).toHaveAttribute('data-snap', 'peek');
    // JSDOM lacks PointerEvent on some versions; provide the browser's pointer coordinates.
    const pointer = (type: string, y: number) => { const event = new Event(type, { bubbles: true }); Object.defineProperty(event, 'clientY', { value: y }); fireEvent(handle, event); };
    pointer('pointerdown', 200); pointer('pointerup', 145); expect(page).toHaveAttribute('data-snap', 'peek');
    pointer('pointerdown', 200); pointer('pointerup', 140); fireEvent.click(handle); expect(page).toHaveAttribute('data-snap', 'half');
    pointer('pointerdown', 200); pointer('pointerup', 0); fireEvent.click(handle); expect(page).toHaveAttribute('data-snap', 'full');
    fireEvent.click(screen.getByRole('button', { name: '핀 선택' })); expect(page).toHaveAttribute('data-snap', 'half');
    fireEvent.click(handle); expect(page).toHaveAttribute('data-snap', 'full'); fireEvent.focus(screen.getByRole('searchbox')); expect(page).toHaveAttribute('data-snap', 'half');
  });
  it('includes outside shops only on request and shares top-eight ordering with other-road expansion', async () => {
    const zones = Array.from({ length: 11 }, (_, index) => ({ ...data.zones[0], id: index + 1, name: `구역${index + 1}` }));
    vi.mocked(fetchMarket).mockResolvedValue({ ...data, zones }); mount(); await screen.findByRole('heading', { name: '시장' });
    expect(screen.getByRole('button', { name: '다른 길 3개' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: '구역11 (0)' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다른 길 3개' })); expect(screen.getByRole('button', { name: '구역11 (0)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: '시장 밖도 보기' })); await waitFor(() => expect(fetchMarket).toHaveBeenLastCalledWith('100', true, 'ko'));
  });
});
it('uses match rank before Korean names while keeping a selected multi-shop parcel together and coordinate-less rows last', () => {
  const stores = [shop(1, '가 나', { items: '국밥' }), shop(2, '국밥집', { jibunAddress: '같은필지' }), shop(3, '다른국밥집', { jibunAddress: '같은필지' }), shop(4, '국밥가', { latitude: null })];
  const market = { ...data, stores };
  const key = groupMarketPins(stores).find(pin => pin.stores.some(store => store.id === 2))!.key;
  const { rows, selected } = marketListStores(market, '국밥', null, { bounds, zoom: 17 }, key, false);
  expect(rows.map(store => store.id)).toEqual([2, 3, 1, 4]); expect(selected.size).toBe(3);
});
