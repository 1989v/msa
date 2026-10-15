import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fetchMarket, type MarketResponse, type MarketStore } from '../../../api/marketApi';
import AttractionMarket from '../AttractionMarket';
import gwangmyeong from './fixtures/gwangmyeong-public-market.json';

vi.mock('../../../api/marketApi', () => ({ fetchMarket: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

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
    const search = await screen.findByRole('searchbox', { name: '가게 이름 찾기' });
    fireEvent.change(search, { target: { value: ' 유 명 순대 ' } });
    expect(screen.getByRole('status')).toHaveTextContent('찾은 가게: 1');
    fireEvent.change(search, { target: { value: '홍두깨칼국수' } });
    expect(screen.getByRole('status')).toHaveTextContent('없음: 홍두깨칼국수');
    fireEvent.click(screen.getByRole('checkbox', { name: '시장 밖도 보기' }));
    await waitFor(() => expect(fetchMarket).toHaveBeenCalledWith('100', true, 'ko'));
  });

  it('renders found pins last with an above-pin shop label and preserves the address alongside the floor', async () => {
    vi.mocked(fetchMarket).mockResolvedValue({ ...data, stores: [
      shop({ roadAddress: '오리로', floor: '1' }),
      shop({ id: 2, name: '다른 가게', jibunAddress: '서울 2', longitude: 127.001 }),
    ] });
    const { container } = mount();
    const search = await screen.findByRole('searchbox', { name: '가게 이름 찾기' });
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
    expect(await screen.findByRole('searchbox', { name: 'Find a shop by name' })).toBeInTheDocument();
    expect(fetchMarket).toHaveBeenCalledWith('100', false, 'en');
    expect(screen.getByText('유명순대국')).toBeInTheDocument();
    expect(screen.getAllByText('Onnuri merchant')).toHaveLength(3);
  });
});
