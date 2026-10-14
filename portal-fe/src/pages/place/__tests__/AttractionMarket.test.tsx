import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fetchMarket, type MarketResponse, type MarketStore } from '../../../api/marketApi';
import AttractionMarket from '../AttractionMarket';

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
