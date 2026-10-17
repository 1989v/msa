import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fetchMarket, fetchMarketDishes, type MarketResponse, type MarketStore } from '../../../api/marketApi';
import AttractionMarket from '../AttractionMarket';
import gwangmyeong from './fixtures/gwangmyeong-public-market.json';

vi.mock('../../../api/marketApi', async (importOriginal) => ({ ...await importOriginal<typeof import('../../../api/marketApi')>(), fetchMarket: vi.fn(), fetchMarketDishes: vi.fn() }));
beforeEach(() => { vi.mocked(fetchMarketDishes).mockResolvedValue([]); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 })); });
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

const shop = (overrides: Partial<MarketStore> = {}): MarketStore => ({
  id: 1, name: '유명순대국', items: '순대', zoneId: null, membership: 'IN', latitude: 37.5, longitude: 127,
  roadAddress: null, jibunAddress: '서울 1', buildingName: null, dong: null, floor: null, ho: null,
  categoryMajor: null, categoryMid: null, categorySub: null, sources: ['ONNURI'], pinKind: 'EXACT',
  manual: false, actorKind: null, relativePosition: null, positionNote: null, ...overrides,
});
const data: MarketResponse = {
  market: { name: '시장', marketType: 'STREET', sourceMarketType: null, storeCountRaw: '10', openingCycle: null, facilities: null,
    attribution: { name: '전국전통시장표준데이터', url: 'https://www.data.go.kr/data/15012894/standard.do', license: '공공누리 제1유형' } },
  zones: [], stores: [shop(), shop({ id: 2, name: '한지 가게', latitude: 37.501 }), shop({ id: 3, name: '좌표 없는 가게', latitude: null, jibunAddress: null })],
};
function mount(lang: 'ko' | 'en' = 'ko') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return { client, ...render(<QueryClientProvider client={client}><p>기존 관광지 상세</p><AttractionMarket contentId="100" lang={lang} /></QueryClientProvider>) };
}

describe('optional attraction market section', () => {
  it('keeps SVG paths and shops when the real metadata request returns 404', async () => {
    vi.mocked(fetchMarket).mockResolvedValue({ ...data, market: { ...data.market, contentId: '100' },
      paths: [{ id: 1, name: '시장길', named: true, source: 'OSM', geometry: [[37.5, 127], [37.501, 127]] }] });
    const { container, client } = mount();
    await screen.findByText('유명순대국');
    await waitFor(() => expect(client.getQueryData(['market-basemap-meta', '100'])).toBeNull());
    expect(fetch).toHaveBeenCalledWith('/basemaps/markets/100/meta.json');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(container.querySelector('image')).toBeNull();
    expect(screen.queryByRole('button', { name: '우리 지도로 보기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '네이버 지도로 보기' })).not.toBeInTheDocument();
    expect(container.querySelector('.place-market-path')).not.toBeNull();
    expect(screen.queryByRole('link', { name: 'OpenFreeMap' })).not.toBeInTheDocument();
  });

  it.each(['ko', 'en'] as const)('shows good-price menus, expands all menus in the selected parcel, and attributes the summary in %s', async (lang) => {
    const goodPrice = { category: '한식', matchedBy: 'NAME' as const, menus: [
      { name: '칼국수', price: 5000 }, { name: '수제비', price: null }, { name: '비빔밥', price: 6000 },
    ] };
    vi.mocked(fetchMarket).mockResolvedValue({ ...data,
      market: { ...data.market, goodPrice: { storeCount: 1, minPrice: 5000, maxPrice: 6000,
        attribution: { name: '행정안전부 착한가격업소', url: 'https://www.data.go.kr/data/3045247/fileData.do', license: '이용허락범위 제한 없음' } } },
      stores: [shop({ goodPrice })],
    });
    mount(lang);
    expect(await screen.findByText(lang === 'en' ? 'Good price' : '착한가격')).toBeInTheDocument();
    const source = screen.getByRole('link', { name: '행정안전부 착한가격업소' });
    expect(source).toHaveAttribute('href', 'https://www.data.go.kr/data/3045247/fileData.do');
    expect(source.parentElement).toHaveTextContent(lang === 'en' ? 'Good-price shops 1 · ₩5,000–6,000' : '착한가격업소 1곳 · 5,000~6,000원');
    expect(screen.getByText(lang === 'en' ? '칼국수 ₩5,000 · 수제비' : '칼국수 5,000원 · 수제비')).toBeInTheDocument();
    expect(screen.queryByText(/비빔밥/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /유명순대국/ }));
    expect(screen.getByText(lang === 'en' ? '칼국수 ₩5,000 · 수제비 · 비빔밥 ₩6,000' : '칼국수 5,000원 · 수제비 · 비빔밥 6,000원')).toBeInTheDocument();
  });

  it.each([undefined, null])('omits good-price additions safely when missing: %s', async (goodPrice) => {
    vi.mocked(fetchMarket).mockResolvedValue({ ...data, market: { ...data.market, goodPrice }, stores: [shop({ goodPrice })] });
    mount();
    await screen.findByText('유명순대국');
    expect(screen.queryByText('착한가격')).not.toBeInTheDocument();
    expect(screen.queryByText(/착한가격업소/)).not.toBeInTheDocument();
  });

  it('initializes the shop finder from marketQuery and scrolls after market data arrives', async () => {
    const scrollIntoView = vi.fn();
    const previous = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    window.history.replaceState(null, '', '/attractions/100?marketQuery=%EC%9C%A0%EB%AA%85%EC%88%9C%EB%8C%80%EA%B5%AD#market');
    try {
      vi.mocked(fetchMarket).mockResolvedValue(data);
      mount();
      expect(await screen.findByRole('searchbox', { name: '가게·품목·업종 찾기' })).toHaveValue('유명순대국');
      expect(screen.getByRole('region', { name: '시장 구역·가게' })).toHaveAttribute('id', 'market');
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
      expect(screen.getByRole('status', { name: '가게 검색 결과' })).toHaveTextContent('찾은 가게: 1');
    } finally {
      window.history.replaceState(null, '', '/');
      HTMLElement.prototype.scrollIntoView = previous;
    }
  });
  it('renders the real-coordinate display fixture even with no stores', async () => {
    // JSON imports widen tuple coordinates and enum strings; the checked-in fixture follows the public contract.
    vi.mocked(fetchMarket).mockResolvedValue({ ...gwangmyeong, stores: [] } as unknown as MarketResponse);
    const { container } = mount();
    await screen.findByRole('group', { name: '가게 위치 지도' });
    expect(container.querySelectorAll('.place-market-boundary')).toHaveLength(1);
    expect(container.querySelectorAll('.place-market-path')).toHaveLength(14);
    expect(container.querySelectorAll('.place-market-entrance')).toHaveLength(9);
    expect(screen.getByRole('heading', { name: '가게 목록 (0)' })).toBeInTheDocument();
    expect(screen.getByText('© OpenStreetMap contributors')).toBeInTheDocument();
  });
  it('draws public geometry, labels only named paths once, and preserves server attribution verbatim', async () => {
    vi.mocked(fetchMarket).mockResolvedValue({ ...data,
      boundary: { polygon: [[37.499, 126.999], [37.502, 126.999], [37.502, 127.002]], source: 'OSM', osmId: null },
      paths: [
        { id: 10, name: '오리로964번길', named: true, geometry: [[37.5, 127], [37.5001, 127], [37.501, 127]], source: 'OSM' },
        { id: 11, name: '표시하지 않는 임시 이름', named: false, geometry: [[37.5, 127], [37.5, 127.001]], source: 'MANUAL' },
        { id: 12, name: null, named: true, geometry: [[37.5, 127], [37.501, 127.001]], source: 'OSM' },
      ],
      entrances: [{ id: 1, lat: 37.5, lng: 127, pathId: 10, label: '동문', source: 'MANUAL' }],
      attribution: ['© OpenStreetMap contributors', '원천 제공 · 그대로 표시'],
    });
    const { container } = mount();
    await screen.findByRole('group', { name: '가게 위치 지도' });
    expect(container.querySelector('.place-market-boundary')).toHaveAttribute('points');
    expect(container.querySelectorAll('.place-market-path')).toHaveLength(3);
    expect(container.querySelectorAll('.place-market-path-label')).toHaveLength(1);
    expect(screen.getByText('오리로964번길')).toBeInTheDocument();
    expect(screen.queryByText('표시하지 않는 임시 이름')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.place-market-entrance')).toHaveLength(1);
    expect(screen.getByText('동문')).toBeInTheDocument();
    expect(screen.getByText('© OpenStreetMap contributors')).toBeInTheDocument();
    expect(screen.getByText('원천 제공 · 그대로 표시')).toBeInTheDocument();
  });

  it('matches pin colors to assigned paths and falls back to zone colors for unassigned or unknown paths', async () => {
    vi.mocked(fetchMarket).mockResolvedValue({ ...data,
      zones: [{ id: 1, parentId: null, kind: 'ROAD', name: '구역', dong: null, floor: null, children: [] }],
      paths: [10, 11].map((id) => ({ id, name: null, named: false, geometry: [[37.5, 127], [37.501, 127]] as [number, number][], source: 'OSM' as const })),
      stores: [shop({ pathId: 11, zoneId: 1 }), shop({ id: 2, pathId: null, zoneId: 1, jibunAddress: '서울 2', latitude: 37.501 }),
        shop({ id: 3, pathId: 999, zoneId: 1, jibunAddress: '서울 3', latitude: 37.5005 })],
    });
    const { container } = mount();
    await screen.findByRole('group', { name: '가게 위치 지도' });
    const pins = container.querySelectorAll<SVGGElement>('.place-market-pin');
    expect([...pins].map((pin) => pin.style.getPropertyValue('--market-zone-color'))).toEqual([
      'var(--market-zone-2)', 'var(--market-zone-1)', 'var(--market-zone-1)',
    ]);
    expect(container.querySelectorAll('svg g[style]')[1]).toHaveStyle({ '--market-path-color': 'var(--market-zone-2)' });
  });

  it.each([
    { boundary: null, paths: [], entrances: [], attribution: [] },
    { boundary: null, paths: null, entrances: null, attribution: null },
  ])('retains the exact legacy map for absent versus empty/null geometry: %s', async (geometry) => {
    vi.mocked(fetchMarket).mockResolvedValue(data);
    const first = mount();
    await screen.findByRole('group', { name: '가게 위치 지도' });
    const legacy = first.container.querySelector('.place-market-map')!.innerHTML;
    first.unmount();
    vi.mocked(fetchMarket).mockResolvedValue({ ...data, ...geometry });
    const next = mount();
    await screen.findByRole('group', { name: '가게 위치 지도' });
    expect(next.container.querySelector('.place-market-map')!.innerHTML).toBe(legacy);
  });

  it.each([null, new Error('unavailable')])('leaves the attraction intact on an absent or failed market response: %s', async (result) => {
    if (result instanceof Error) vi.mocked(fetchMarket).mockRejectedValue(result);
    else vi.mocked(fetchMarket).mockResolvedValue(result);
    const { client } = mount();
    await waitFor(() => expect(client.getQueryState(['attraction-market', '100', false, 'ko'])?.status).toBe(result instanceof Error ? 'error' : 'success'));
    expect(screen.getByText('기존 관광지 상세')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '시장 구역·가게' })).not.toBeInTheDocument();
  });

  it('opens the same-parcel shops and restores coordinate-less shops in the full list', async () => {
    vi.mocked(fetchMarket).mockResolvedValue(data);
    mount();
    const pin = await screen.findByRole('button', { name: '같은 필지 가게: 유명순대국, 한지 가게' });
    expect(screen.getByText(data.market.name, { exact: true })).toBeInTheDocument();
    expect(screen.getByText('좌표 없는 가게')).toBeInTheDocument();
    fireEvent.click(pin);
    expect(screen.getByRole('heading', { name: '같은 필지 가게 (2)' })).toBeInTheDocument();
    expect(screen.queryByText('좌표 없는 가게')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전체 가게 보기' }));
    expect(screen.getByText('좌표 없는 가게')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '전국전통시장표준데이터' })).toHaveAttribute('href', data.market.attribution!.url);
  });

  it('finds names, reports missing names, and requests outside shops on toggle', async () => {
    vi.mocked(fetchMarket).mockResolvedValue(data);
    mount();
    const search = await screen.findByRole('searchbox', { name: '가게·품목·업종 찾기' });
    fireEvent.change(search, { target: { value: ' 유 명 순대 ' } });
    expect(screen.getByRole('status', { name: '가게 검색 결과' })).toHaveTextContent('찾은 가게: 1');
    fireEvent.change(search, { target: { value: '홍두깨칼국수' } });
    expect(screen.getByRole('status', { name: '가게 검색 결과' })).toHaveTextContent('없음: 홍두깨칼국수');
    fireEvent.click(screen.getByRole('checkbox', { name: '시장 밖도 보기' }));
    await waitFor(() => expect(fetchMarket).toHaveBeenCalledWith('100', true, 'ko'));
  });

  it('renders found pins last with an above-pin shop label and preserves the address alongside the floor', async () => {
    vi.mocked(fetchMarket).mockResolvedValue({ ...data, stores: [
      shop({ roadAddress: '오리로', floor: '1' }),
      shop({ id: 2, name: '다른 가게', jibunAddress: '서울 2', longitude: 127.001 }),
    ] });
    const { container } = mount();
    const search = await screen.findByRole('searchbox', { name: '가게·품목·업종 찾기' });
    expect(screen.getByText('오리로 · 1층')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: '유명' } });
    const pins = container.querySelectorAll('.place-market-pin');
    expect(pins[pins.length - 1]).toHaveAttribute('data-hit', 'true');
    expect(pins[pins.length - 1].querySelector('.place-market-hit-ring')).not.toBeNull();
    expect(pins[pins.length - 1].querySelector('.place-market-hit-label')).toHaveTextContent('유명순대국');
    expect(pins[pins.length - 1].querySelector('.place-market-hit-label')).toHaveAttribute('y', '-25');
  });

  it('uses English interface copy and retains original shop names', async () => {
    vi.mocked(fetchMarket).mockResolvedValue(data);
    mount('en');
    expect(await screen.findByRole('searchbox', { name: 'Find a shop, goods or category' })).toBeInTheDocument();
    expect(fetchMarket).toHaveBeenCalledWith('100', false, 'en');
    expect(screen.getByText('유명순대국')).toBeInTheDocument();
    expect(screen.getAllByText('Onnuri merchant')).toHaveLength(3);
  });
});


describe('market section search and road filters', () => {
  it('ranks matching fields, labels menu/category evidence and marks unknown locations', async () => {
    vi.mocked(fetchMarket).mockResolvedValue({ ...data, stores: [
      shop({ id: 4, name: '업종집', categorySub: '떡볶이', membership: 'UNKNOWN' }),
      shop({ id: 3, name: '메뉴집', goodPrice: { category: '분식', matchedBy: 'NAME', menus: [{ name: '떡볶이', price: 3000 }] } }),
      shop({ id: 2, name: '품목집', items: '떡볶이' }),
      shop({ id: 1, name: '떡볶이집' }),
      shop({ id: 5, name: '분식집', categorySub: '분식' }),
    ] });
    const { container } = mount();
    const search = await screen.findByRole('searchbox', { name: '가게·품목·업종 찾기' });
    expect(search).toHaveAttribute('placeholder', '가게·품목·메뉴·업종');
    fireEvent.change(search, { target: { value: '떡볶이' } });
    const rows = within(screen.getByRole('heading', { name: '가게 목록 (4)' }).parentElement!).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('strong')!.textContent)).toEqual(['떡볶이집', '품목집', '메뉴집', '업종집']);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('이름에 맞음'), expect.stringContaining('품목에 맞음'),
      expect.stringContaining('메뉴에 맞음'), expect.stringContaining('업종에 맞음'),
    ]);
    expect(rows[3]).toHaveTextContent('위치 미확인');
    expect(within(rows[3]).queryByRole('button')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.place-market-pin[data-hit]')).toHaveLength(1);
    expect(screen.getByRole('status', { name: '가게 검색 결과' })).toHaveTextContent('찾은 가게: 4');
  });
  it('focuses a result outside the initial boundary, highlights and scrolls its row, repeats and clears on filter change', async () => {
    const scroll = vi.fn(); const previous = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scroll;
    vi.mocked(fetchMarket).mockResolvedValue({ ...data,
      boundary: { source: 'OSM', polygon: [[37.499, 126.999], [37.501, 126.999], [37.501, 127.001]] },
      stores: [shop({ id: 9, name: '먼 떡볶이', latitude: 37.51 }), shop({ id: 2, name: '가까운 가게', jibunAddress: '별도 필지' })],
    });
    try {
      const { container } = mount();
      fireEvent.change(await screen.findByRole('searchbox'), { target: { value: '먼 떡볶이' } });
      const result = screen.getByRole('button', { name: '지도에서 보기: 먼 떡볶이' });
      fireEvent.click(result);
      const selected = within(screen.getByRole('region', { name: '선택한 가게' })).getAllByRole('listitem');
      expect(selected).toHaveLength(1); expect(selected[0]).toHaveAttribute('data-selected', 'true');
      expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
      const box = () => container.querySelector('svg')!.getAttribute('viewBox')!.split(' ').map(Number);
      expect(box().slice(2)).toEqual([150, 110]);
      const pin = container.querySelector('.place-market-pin[data-selected]')!;
      const coordinates = pin.getAttribute('transform')!.match(/translate\(([-\d.]+) ([-\d.]+)\)/u)!;
      expect(box()[0] + 75).toBeCloseTo(Number(coordinates[1]));
      expect(box()[1] + 55).toBeCloseTo(Number(coordinates[2]));
      fireEvent.click(screen.getByRole('button', { name: '전체 보기' }));
      expect(box()[2]).toBe(600);
      fireEvent.click(result); expect(box()[2]).toBe(150);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: '가까운' } });
      expect(screen.queryByRole('region', { name: '선택한 가게' })).not.toBeInTheDocument();
      expect(container.querySelector('.place-market-pin[data-selected]')).toBeNull();
    } finally { HTMLElement.prototype.scrollIntoView = previous; }
  });
  it('keeps nearby OUT stores visible by default and shows their radius and membership disclaimer', async () => {
    vi.mocked(fetchMarket).mockResolvedValue({ ...data, nearbyRadiusMetres: 150, stores: [
      shop({ id: 1, name: '주변 상점', membership: 'OUT', nearby: true }),
      shop({ id: 2, name: '먼 상점', membership: 'OUT' }),
    ] });
    mount();
    expect(await screen.findByText('주변 상점')).toBeInTheDocument();
    expect(screen.queryByText('먼 상점')).not.toBeInTheDocument();
    expect(screen.getByText('주변 · 소속 미확인')).toBeInTheDocument();
    expect(screen.getByText('시장 주변 150 m 안 가게를 보입니다')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '시장 밖도 보기' })).not.toBeChecked();
  });
  it('prioritizes market roads and counts nested zones, collapses to eight and retains the selected extra chip', async () => {
    const zones = Array.from({ length: 11 }, (_, i) => ({ id: i + 1, parentId: null, kind: 'ROAD' as const, name: i === 10 ? '시장길' : `길${i + 1}`, dong: null, floor: null, children: [] }));
    const child = { ...zones[0], id: 12, parentId: 1, name: '골목안층', kind: 'FLOOR' as const };
    vi.mocked(fetchMarket).mockResolvedValue({ ...data,
      zones: [{ ...zones[0], children: [child] }, ...zones.slice(1)],
      stores: [shop({ id: 1, zoneId: 12 }), shop({ id: 2, zoneId: 12 }), shop({ id: 3, zoneId: 2 })],
    });
    mount();
    const nav = await screen.findByRole('navigation', { name: '골목·건물·층' });
    const labels = () => within(nav).getAllByRole('button').map((button) => button.textContent);
    expect(labels().slice(0, 4)).toEqual(['전체 구역', '골목안층 (2)', '길1 (2)', '길2 (1)']);
    expect(within(nav).getAllByRole('button')).toHaveLength(5);
    fireEvent.click(within(nav).getByRole('button', { name: '다른 길 9개' }));
    expect(within(nav).getAllByRole('button')).toHaveLength(14);
    fireEvent.click(within(nav).getByRole('button', { name: '길9 (0)' }));
    fireEvent.click(within(nav).getByRole('button', { name: '길 접기' }));
    expect(within(nav).getByRole('button', { name: '길9 (0)' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(nav).getByRole('button', { name: '다른 길 8개' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav).queryByRole('button', { name: '길10 (0)' })).not.toBeInTheDocument();
  });
});

describe('WU21 shared food search and menu evidence', () => {
  it('ranks related categories last and carries evidence into the sheet', async () => {
    vi.mocked(fetchMarketDishes).mockResolvedValue([{ dish: '떡볶이', dishEn: 'tteokbokki', categorySub: '김밥/만두/분식' }]);
    vi.mocked(fetchMarket).mockResolvedValue({ ...data, stores: [
      shop({ id: 2, name: '관련 가게', items: null, categorySub: '김밥/만두/분식', jibunAddress: '서울 2' }),
      shop({ id: 1, name: '떡볶이집', items: null, jibunAddress: '서울 1' }),
      shop({ id: 3, name: '다른 분식', items: null, categorySub: '분식' }),
    ] });
    const { container } = mount();
    fireEvent.change(await screen.findByRole('searchbox'), { target: { value: '떡 볶 이' } });
    await screen.findByRole('heading', { name: '가게 목록 (2)' });
    const rows = container.querySelectorAll('.place-market-panel li');
    expect([...rows].map((row) => row.querySelector('strong')?.textContent)).toEqual(['떡볶이집', '관련 가게']);
    expect(within(rows[1] as HTMLElement).getByText('관련 업종 · 김밥/만두/분식')).toHaveAttribute('data-related', 'true');
    fireEvent.click(screen.getByRole('button', { name: '지도에서 보기: 관련 가게' }));
    expect(within(screen.getByRole('region', { name: '선택한 가게' })).getByText('관련 업종 · 김밥/만두/분식')).toHaveAttribute('data-related', 'true');
    expect(container.querySelector('.place-market-locate')?.previousElementSibling?.tagName.toLowerCase()).toBe('svg');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'tteok' } });
    expect(screen.getByRole('heading', { name: '가게 목록 (0)' })).toBeInTheDocument();
  });

  it('shows English fields and sourced menus in list and sheet, plus tourism restaurant links', async () => {
    vi.mocked(fetchMarket).mockResolvedValue({ ...data,
      stores: [shop({ nameEn: 'Sunhuine', itemsEn: 'Snacks', categoryEn: 'Korean food', categorySub: '한식',
        goodPrice: { category: '한식', matchedBy: 'NAME', menus: [{ name: '빈대떡', nameEn: 'Mung bean pancake', price: 5000 }] },
        tourMenu: { firstMenu: '빈대떡', treatMenu: '육회', firstMenuEn: 'Mung bean pancake', treatMenuEn: 'Beef tartare', attraction: { id: 8, lang: 'en' } } })],
      restaurants: [{ title: '별도 음식점', nameEn: 'Restaurant', firstMenu: '김밥', treatMenu: null, firstMenuEn: 'Gimbap', attraction: { id: 9, lang: 'en' }, latitude: 37.5, longitude: 127 }],
    });
    mount('en');
    await screen.findByText('Sunhuine · 유명순대국');
    expect(screen.getByText('Mung bean pancake ₩5,000')).toBeInTheDocument();
    expect(screen.getByText('Signature menu: Mung bean pancake')).toBeInTheDocument();
    expect(screen.getByText('Other menus: Beef tartare')).toBeInTheDocument();
    expect(screen.getByText('Snacks')).toBeInTheDocument();
    expect(screen.getByText('Korean food')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Restaurant · 별도 음식점' })).toHaveAttribute('href', '/en/attractions/9');
    fireEvent.click(screen.getByRole('button', { name: /Shops on this parcel:/ }));
    const sheet = within(screen.getByRole('region', { name: 'Selected shops' }));
    expect(sheet.getByText('Signature menu: Mung bean pancake')).toBeInTheDocument();
    expect(sheet.getByText('Other menus: Beef tartare')).toBeInTheDocument();
    expect(sheet.getByText(/Source: Korea Tourism Organization/)).toBeInTheDocument();
    expect(sheet.getByText(/Source: Ministry/)).toBeInTheDocument();
  });

  it('keeps literal matches on dictionary failure and collapses zero-store roads with fewer than eight populated roads', async () => {
    vi.mocked(fetchMarketDishes).mockRejectedValue(new Error('offline'));
    vi.mocked(fetchMarket).mockResolvedValue({ ...data, zones: [1, 2].map((id) => ({ id, parentId: null, kind: 'ROAD', name: `길${id}`, dong: null, floor: null, children: [] })), stores: [shop({ zoneId: 1 })] });
    mount();
    fireEvent.change(await screen.findByRole('searchbox'), { target: { value: '순대' } });
    expect(screen.getByRole('heading', { name: '가게 목록 (1)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '길2 (0)' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다른 길 1개' }));
    fireEvent.click(screen.getByRole('button', { name: '길2 (0)' }));
    fireEvent.click(screen.getByRole('button', { name: '길 접기' }));
    expect(screen.getByRole('button', { name: '길2 (0)' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shares the day-long dictionary cache across market mounts', async () => {
    vi.mocked(fetchMarket).mockResolvedValue(data);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(<QueryClientProvider client={client}><AttractionMarket contentId="100" lang="ko" /></QueryClientProvider>);
    await screen.findByRole('searchbox');
    await waitFor(() => expect(fetchMarketDishes).toHaveBeenCalledTimes(1));
    view.rerender(<QueryClientProvider client={client}><AttractionMarket contentId="101" lang="en" /></QueryClientProvider>);
    await waitFor(() => expect(fetchMarket).toHaveBeenCalledWith('101', false, 'en'));
    expect(fetchMarketDishes).toHaveBeenCalledTimes(1);
    const cached = client.getQueryCache().find({ queryKey: ['market-dishes'] })!;
    expect(cached.isStaleByTime(86_400_000)).toBe(false);
    expect(cached.options.gcTime).toBe(86_400_000);
    client.clear();
  });
});


describe('loaded market basemap source links', () => {
  it('shows linked attribution under the map only after the current image loads', async () => {
    vi.mocked(fetchMarket).mockResolvedValue({ ...data, market: { ...data.market, contentId: '1059391', latitude: 37.5, longitude: 127 } });
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ contentId: '100', centre: { latitude: 37.5, longitude: 127 }, zoom: 18, width: 1536, height: 1152, bounds: {}, renderedAt: '2026-10-17', styleVersion: 'v1', themes: ['light', 'dark'] }) } as Response);
    const { container, client } = mount();
    await screen.findByRole('group', { name: '가게 위치 지도' });
    expect(screen.queryByRole('link', { name: 'OpenFreeMap' })).toBeNull();
    await waitFor(() => expect(container.querySelector('image')).not.toBeNull());
    const image = container.querySelector('image')!;
    expect(image.getAttribute('href')).toMatch(/^\/basemaps\/markets\/100\/z18-/);
    const cached = client.getQueryCache().find({ queryKey: ['market-basemap-meta', '100'] })!;
    expect(cached.options).toMatchObject({ staleTime: 3_600_000, retry: false });
    fireEvent.load(image);
    const source = screen.getByRole('link', { name: 'OpenFreeMap' });
    expect(source).toHaveAttribute('href', 'https://openfreemap.org/');
    expect(source.parentElement).toHaveClass('place-market-source');
    expect(source.closest('.place-market-map')).not.toBeNull();
    expect(source.parentElement).toHaveTextContent('OpenFreeMap · OpenMapTiles · © OpenStreetMap contributors');
    expect(screen.getByRole('link', { name: 'OpenMapTiles' })).toHaveAttribute('href', 'https://openmaptiles.org/');
    expect(screen.getByRole('link', { name: '© OpenStreetMap contributors' })).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
    fireEvent.error(image);
    expect(screen.queryByRole('link', { name: 'OpenFreeMap' })).toBeNull();
  });
});
