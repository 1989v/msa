import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, type Location } from 'react-router-dom';
import CafePage, { cafeMinimumRows } from '../CafePage';
import * as api from '../../../api/rankingApi';
import type { CafeDrink } from '../../../api/rankingApi';
vi.mock('../../../api/rankingApi', () => ({ fetchCafeNearbyCapability: vi.fn(), fetchCafeAreas: vi.fn(), searchCafeNearby: vi.fn(), fetchCafeDrinkNames: vi.fn(), fetchCafeComparison: vi.fn(), fetchCafeBrands: vi.fn(), fetchCafeGroups: vi.fn(), fetchCafeDrinks: vi.fn(), fetchCafeDrink: vi.fn() }));
vi.mock('../../../components/ThemeToggle', () => ({ default: () => <span>테마</span> }));
vi.mock('../../../components/Footer', () => ({ default: () => <footer>출처 안내</footer> }));
vi.mock('../../../hooks/useHeritageSurface', () => ({ useHeritageSurface: () => {} }));
const fixture = (patch: Partial<CafeDrink> = {}): CafeDrink => ({
  drinkKey: 'key', drinkName: '바닐라라떼', brandSlug: 'a', brandName: '브랜드', menuName: '바닐라라떼', menuNameEn: null,
  sourceCategory: '커피', temperature: 'ICE', sizeLabel: 'R', volumeMl: 414, servingBasis: '공식 414ml',
  kcal: 198.4, sugarG: 15.2, caffeineMg: 5, caffeineStatus: 'DECAF', sodiumMg: null, carbsG: null,
  fatG: null, satFatG: null, proteinG: null, rawNutrition: { 카페인: '5 mg' }, priceKrw: null, priceNote: null,
  allergens: null, sourceUrl: 'https://example.com', checkedAt: '2026-10-20', notes: '기본 레시피',
  cupVolumeMl: 414, volumeSource: 'ROW', drinkGroup: '바닐라라떼', sugarPer100ml: 3.6715,
  caffeinePer100ml: 1.2077, kcalPer100ml: 47.9227, ...patch,
});
function setup(path = '/cafe', props: Parameters<typeof CafePage>[0] = {}) {
  // MemoryRouter, not createMemoryRouter: the data router builds a fetch Request with jsdom's AbortSignal,
  // which Node 24's undici rejects, so every navigation silently failed in CI while passing on Node 22.
  const router = { state: { location: undefined as unknown as Location } };
  function LocationProbe() { router.state.location = useLocation(); return null; }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><LocationProbe /><Routes>
    <Route path="/cafe/search" element={<CafePage {...props} />} />
    <Route path="/cafe/filter" element={<CafePage {...props} />} />
    <Route path="/cafe/results" element={<CafePage {...props} />} />
    <Route path="/cafe" element={<CafePage {...props} />} />
    <Route path="/cafe/drink/:drinkName" element={<CafePage {...props} />} />
    <Route path="/cafe/drinks/:drinkKey" element={<CafePage {...props} />} />
  </Routes></MemoryRouter></QueryClientProvider>);
  return router;
}
beforeEach(() => {
  vi.mocked(api.fetchCafeNearbyCapability).mockResolvedValue({ nearbyEnabled: false, reason: "SOURCE_NOT_READY", sourceAsOf: null, fetchedAt: null });
  vi.mocked(api.fetchCafeAreas).mockResolvedValue([]);
  vi.mocked(api.fetchCafeDrinkNames).mockResolvedValue([]);
  vi.mocked(api.fetchCafeComparison).mockResolvedValue([]);
  vi.mocked(api.fetchCafeBrands).mockResolvedValue([{ brandSlug: 'a', brandName: '브랜드', count: 5, checkedAt: '2026-10-20', sourceUrls: ['https://example.com'] }]);
  vi.mocked(api.fetchCafeGroups).mockResolvedValue([{ group: '바닐라라떼', count: 5 }]);
  vi.mocked(api.fetchCafeDrinks).mockResolvedValue({ content: [fixture()], totalElements: 1, page: 0, size: 20, sizeLabels: ['R', 'Tall(톨)'] });
  vi.mocked(api.fetchCafeDrink).mockResolvedValue(fixture());
  localStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => vi.clearAllMocks());

describe('v3 home and search', () => {
  it('shows four popular names ordered by distinct brand count and ten curated group chips', async () => {
    vi.mocked(api.fetchCafeDrinkNames).mockResolvedValue([{ drinkName: '티', brandCount: 1, rowCount: 99 }, { drinkName: '라떼', brandCount: 8, rowCount: 30 }, { drinkName: '모카', brandCount: 4, rowCount: 20 }, { drinkName: '아메리카노', brandCount: 6, rowCount: 12 }, { drinkName: '콜드브루', brandCount: 2, rowCount: 8 }]);
    setup();
    expect(screen.getByRole('heading', { name: '카페 음료 비교' })).toBeInTheDocument();
    const popular = screen.getByRole('navigation', { name: '많이 찾는 음료' });
    await waitFor(() => expect(within(popular).getAllByRole('link')).toHaveLength(4));
    expect(within(popular).getAllByRole('link').map(link => link.textContent)).toEqual(['라떼8개 브랜드', '아메리카노6개 브랜드', '모카4개 브랜드', '콜드브루2개 브랜드']);
    const chips = within(screen.getByRole('navigation', { name: '음료 유형' })).getAllByRole('link');
    expect(chips.map(chip => chip.textContent)).toEqual(['전체', '커피', '커피 라떼', '논커피 라떼', '티', '에이드·탄산', '스무디·프라페', '주스', '디카페인', '기타']);
    expect(new URL(chips[1].getAttribute('href')!, 'https://example.com').searchParams.get('category')).toBe('coffee');
    expect(chips[8]).toHaveAttribute('href', '/cafe/search?category=decaf&page=0');
    expect(screen.queryByRole('button', { name: '주변 카페에서 음료 찾기' })).toBeNull();
    expect(document.querySelector('select')).toBeNull();
  });
  it.each([['당류 낮은 음료', { maxSugar: 10 }], ['저카페인 음료', { maxCaffeine: 50 }], ['저칼로리 음료', { maxKcal: 200 }]] as const)('launches the real %s results', async (name, patch) => {
    const router = setup();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
    await screen.findByRole('list', { name: '음료 비교' });
    expect(router.state.location.pathname).toBe('/cafe/results');
    expect(api.fetchCafeDrinks).toHaveBeenCalledWith(expect.objectContaining(patch));
  });
  it('suppresses Korean IME debounce and submission, then searches complete text once', async () => {
    const router = setup();
    await waitFor(() => expect(api.fetchCafeDrinkNames).toHaveBeenCalledWith(''));
    vi.mocked(api.fetchCafeDrinkNames).mockClear();
    fireEvent.click(screen.getByRole('button', { name: '음료 이름 검색' }));
    const input = screen.getByRole('searchbox');
    fireEvent.compositionStart(input); fireEvent.change(input, { target: { value: '바닐라' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true }); fireEvent.submit(screen.getByRole('search'));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
    expect(api.fetchCafeDrinkNames).not.toHaveBeenCalled(); expect(api.fetchCafeDrinks).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/cafe');
    fireEvent.change(input, { target: { value: '바닐라라떼' } }); fireEvent.compositionEnd(input);
    await waitFor(() => expect(api.fetchCafeDrinkNames).toHaveBeenCalledWith('바닐라라떼'));
    fireEvent.submit(screen.getByRole('search'));
    await screen.findByRole('list', { name: '음료 비교' });
    expect(router.state.location.pathname).toBe('/cafe/search');
    expect(api.fetchCafeDrinks).toHaveBeenCalledWith(expect.objectContaining({ q: '바닐라라떼' }));
    expect(localStorage.getItem('cafe-recent-searches')).toContain('바닐라라떼');
  });
  it('highlights autocomplete, saves/removes recent searches and keeps popular names after close', async () => {
    vi.mocked(api.fetchCafeDrinkNames).mockImplementation(async q => q ? [{ drinkName: '바닐라라떼', brandCount: 8, rowCount: 46 }] : [{ drinkName: '라떼', brandCount: 5, rowCount: 10 }]);
    setup(); await screen.findByRole('link', { name: '라떼 5개 브랜드' });
    fireEvent.click(screen.getByRole('button', { name: '음료 이름 검색' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '바닐라' } });
    const link = await screen.findByRole('link', { name: /바닐라\s*라떼 8개 브랜드/ });
    expect(link.querySelector('mark')).toHaveTextContent('바닐라'); fireEvent.click(link);
    await screen.findByRole('heading', { name: /바닐라라떼 카페별 비교/ });
    fireEvent.click(screen.getByRole('button', { name: '음료 이름 검색' }));
    fireEvent.click(screen.getByRole('button', { name: '바닐라라떼 최근 검색 삭제' }));
    expect(localStorage.getItem('cafe-recent-searches')).toBe('[]');
  });
  it('uses full server totals per brand while retaining other conditions', async () => {
    vi.mocked(api.fetchCafeDrinks).mockImplementation(async filters => ({ content: filters.size === 1 ? [] : [fixture()], totalElements: filters.brand?.length ? 12 : 50, page: 0, size: filters.size ?? 20, sizeLabels: ['R', 'Tall(톨)'] }));
    setup('/cafe/search?q=라떼&maxSugar=10&brand=a');
    expect(await screen.findByRole('button', { name: '전체 50' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '브랜드 12' })).toHaveAttribute('aria-pressed', 'true');
    expect(api.fetchCafeDrinks).toHaveBeenCalledWith(expect.objectContaining({ q: '라떼', maxSugar: 10, brand: [], size: 1 }));
    expect(api.fetchCafeDrinks).toHaveBeenCalledWith(expect.objectContaining({ q: '라떼', maxSugar: 10, brand: ['a'], size: 1 }));
  });
  it('uses exact-size/temperature/sort popovers and Escape restores trigger focus', async () => {
    setup('/cafe/search?q=라떼'); await screen.findByRole('list', { name: '음료 비교' });
    const trigger = screen.getByRole('button', { name: '사이즈' }); fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('group', { name: '사이즈' }), { key: 'Escape' }); expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger); fireEvent.click(screen.getByRole('button', { name: 'Tall(톨)' }));
    await waitFor(() => expect(api.fetchCafeDrinks).toHaveBeenCalledWith(expect.objectContaining({ sizeLabel: 'Tall(톨)' })));
    fireEvent.click(screen.getByRole('button', { name: 'ICE/HOT' })); fireEvent.click(screen.getByRole('button', { name: 'HOT' }));
    await waitFor(() => expect(api.fetchCafeDrinks).toHaveBeenCalledWith(expect.objectContaining({ temperature: 'HOT' })));
    fireEvent.click(screen.getByRole('button', { name: '정렬' })); fireEvent.click(screen.getByRole('button', { name: '카페인 높은 순' }));
    await waitFor(() => expect(api.fetchCafeDrinks).toHaveBeenCalledWith(expect.objectContaining({ sort: 'caffeine', direction: 'desc' })));
    expect(document.querySelector('select')).toBeNull();
  });
});

describe('v3 condition filter and result states', () => {
  it('handles the router-supported trailing slash without falling into the search screen', async () => {
    setup('/cafe/filter/');
    expect(screen.getByRole('heading', { name: '조건으로 찾기' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /당류 조건/ })).toBeInTheDocument();
    await screen.findByRole('button', { name: '조건에 맞는 음료 찾기 (1개)' });
  });
  it('debounces server totals, preserves valid URL bounds and navigates with all range values', async () => {
    const router = setup('/cafe/filter?maxSugar=100');
    const slider = screen.getByRole('slider', { name: /당류 조건/ });
    expect(slider).toHaveAttribute('max', '100'); expect(slider).toHaveValue('100'); expect(slider).toHaveAttribute('aria-valuetext', '100g 이하');
    await screen.findByRole('button', { name: '조건에 맞는 음료 찾기 (1개)' });
    vi.mocked(api.fetchCafeDrinks).mockClear();
    fireEvent.change(slider, { target: { value: '11' } }); fireEvent.change(slider, { target: { value: '12' } });
    expect(api.fetchCafeDrinks).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: /조건에 맞는 음료 찾기/ })).toBeDisabled();
    await waitFor(() => expect(api.fetchCafeDrinks).toHaveBeenCalledTimes(1));
    expect(api.fetchCafeDrinks).toHaveBeenCalledWith(expect.objectContaining({ maxSugar: 12, maxCaffeine: 50, maxKcal: 200, size: 1 }));
    fireEvent.click(await screen.findByRole('button', { name: '조건에 맞는 음료 찾기 (1개)' }));
    expect(router.state.location.pathname).toBe('/cafe/results');
    expect(router.state.location.search).toContain('maxSugar=12');
  });
  it('keeps count errors retryable and never supplies a fabricated count', async () => {
    vi.mocked(api.fetchCafeDrinks).mockRejectedValue(new Error('offline'));
    setup('/cafe/filter'); expect(await screen.findByRole('alert')).toHaveTextContent('개수를 불러오지 못했습니다');
    expect(screen.getByRole('button', { name: /조회 실패/ })).toBeDisabled();
    vi.mocked(api.fetchCafeDrinks).mockResolvedValue({ content: [], totalElements: 0, page: 0, size: 1 });
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByRole('button', { name: '조건에 맞는 음료 찾기 (0개)' })).toBeEnabled();
  });
  it('removes active condition chips and renders neutral metric cards', async () => {
    const router = setup('/cafe/results?maxSugar=10&maxCaffeine=50&maxKcal=200');
    await screen.findByRole('list', { name: '음료 비교' });
    expect(document.querySelector('.cafe-metric-cells--muted')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '당류 ≤ 10g 조건 삭제' }));
    expect(router.state.location.search).not.toContain('maxSugar'); expect(router.state.location.search).toContain('maxKcal=200');
  });
  it('separates loading, retryable errors and genuinely empty results', async () => {
    let reject: (reason: Error) => void = () => {};
    vi.mocked(api.fetchCafeDrinks).mockImplementation(() => new Promise((_resolve, no) => { reject = no; }));
    setup('/cafe/results'); expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
    await act(async () => reject(new Error('offline'))); expect(await screen.findByRole('alert')).toHaveTextContent('음료를 불러오지 못했습니다');
    expect(screen.queryByText('조건에 맞는 음료가 없습니다.')).toBeNull();
    vi.mocked(api.fetchCafeDrinks).mockResolvedValue({ content: [], totalElements: 0, page: 0, size: 20 });
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('조건에 맞는 음료가 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '결과 페이지' })).toBeNull();
  });
});

describe('v3 comparison and detail', () => {
  const comparisonRows = () => [fixture({ brandSlug: 'a', brandName: '가브랜드', sugarG: 10 }), fixture({ drinkKey: 'b', brandSlug: 'b', brandName: '나브랜드', sugarG: 10 }), fixture({ drinkKey: 'c', brandSlug: 'c', brandName: '다브랜드', sugarG: null })];
  it('renders a semantic table, badges every tied minimum and recommends every tied brand', async () => {
    vi.mocked(api.fetchCafeComparison).mockResolvedValue(comparisonRows().map(row => ({ brandSlug: row.brandSlug, brandName: row.brandName, representative: row, variants: [row] })));
    setup('/cafe/drink/바닐라라떼'); const table = await screen.findByRole('table');
    expect(within(table).getAllByText('당류 가장 낮아요!')).toHaveLength(2);
    for (const badge of within(table).getAllByText('당류 가장 낮아요!')) expect(badge.closest('td')).toHaveAttribute('colspan', '4');
    expect(within(table).queryByRole('button')).toBeNull();
    expect(screen.getByText('당류를 줄이고 싶다면 가브랜드, 나브랜드 바닐라라떼가 공동으로 가장 낮아요.')).toBeInTheDocument();
    expect(within(table).getByText('미공개')).toBeInTheDocument();
    expect(api.fetchCafeComparison).toHaveBeenCalledWith('바닐라라떼', {});
  });
  it('recomputes minima for selected basis and preserves a selected variant through basis changes', async () => {
    const a = fixture({ sugarG: 10, cupVolumeMl: 100, sugarPer100ml: 10 });
    const large = fixture({ drinkKey: 'large', sugarG: 30, sizeLabel: 'L', cupVolumeMl: 500, sugarPer100ml: 6 });
    const b = fixture({ drinkKey: 'b', brandSlug: 'b', brandName: '나브랜드', sugarG: 20, cupVolumeMl: 500, sugarPer100ml: 4 });
    vi.mocked(api.fetchCafeComparison).mockResolvedValue([{ brandSlug: 'a', brandName: a.brandName, representative: a, variants: [a, large] }, { brandSlug: 'b', brandName: b.brandName, representative: b, variants: [b] }]);
    setup('/cafe/drink/라떼'); await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: '기본 사이즈' })); fireEvent.click(screen.getByRole('button', { name: /ICE · L · 500ml/ }));
    fireEvent.click(screen.getByRole('button', { name: '100ml당 기준' }));
    await waitFor(() => expect(screen.getByRole('link', { name: /브랜드 ICE · L · 500ml/ })).toHaveAttribute('href', '/cafe/drinks/large?basis=100ml'));
    expect(screen.getByText('당류를 줄이고 싶다면 나브랜드 라떼가 가장 낮아요.')).toBeInTheDocument();
  });
  it('excludes unknown and nonfinite values from deterministic recommendation minima', () => {
    const a = fixture({ sugarG: 0, caffeineMg: 0, caffeineStatus: 'ZERO' });
    const b = fixture({ drinkKey: 'b', brandSlug: 'b', sugarG: 0, caffeineMg: 0, caffeineStatus: 'UNDISCLOSED' });
    const c = fixture({ drinkKey: 'c', sugarG: NaN });
    expect(cafeMinimumRows([b, c, a], 'sugar', 'serving')).toEqual([a, b]);
    expect(cafeMinimumRows([b, a], 'caffeine', 'serving')).toEqual([a]);
    expect(cafeMinimumRows([fixture({ sugarG: undefined as unknown as null })], 'sugar', 'serving')).toEqual([]);
    expect(cafeMinimumRows([fixture({ cupVolumeMl: 0 })], 'sugar', '100ml')).toEqual([]);
  });
  it('shows genuine source date, all same-brand variants and a real-notes-only description tab', async () => {
    const large = fixture({ drinkKey: 'large', sizeLabel: 'L', temperature: 'HOT' });
    vi.mocked(api.fetchCafeComparison).mockResolvedValue([{ brandSlug: 'a', brandName: '브랜드', representative: fixture(), variants: [fixture(), large] }, { brandSlug: 'b', brandName: '다른 브랜드', representative: fixture({ drinkKey: 'wrong' }), variants: [fixture({ drinkKey: 'wrong' })] }]);
    setup('/cafe/drinks/key'); await screen.findByRole('heading', { name: '바닐라라떼' });
    await waitFor(() => expect(api.fetchCafeComparison).toHaveBeenCalledWith('바닐라라떼', {}));
    expect(screen.getByRole('link', { name: '공식 영양정보 원문 ↗' })).toHaveAttribute('href', 'https://example.com');
    expect(screen.getByText(/원천 확인일 2026-10-20/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '제품 설명' })); expect(screen.getByRole('tabpanel')).toHaveTextContent('기본 레시피');
    fireEvent.click(screen.getByRole('tab', { name: '사이즈별 정보' }));
    expect(within(screen.getByRole('tabpanel')).getAllByRole('link')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'ICE · R · 414ml · 디카페인' }));
    expect(screen.queryByRole('button', { name: /wrong/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'HOT · L · 414ml · 디카페인' }));
    await waitFor(() => expect(api.fetchCafeDrink).toHaveBeenCalledWith('large'));
  });
  it('renders nullable metadata and nonfinite values without invented description or leaked nulls', async () => {
    vi.mocked(api.fetchCafeDrink).mockResolvedValue(fixture({ temperature: null, sizeLabel: null, cupVolumeMl: null, volumeMl: null, servingBasis: null, kcal: NaN, sugarG: undefined as unknown as null, caffeineMg: null, caffeineStatus: 'UNDISCLOSED', notes: null }));
    setup('/cafe/drinks/key'); await screen.findByText(/공식 미공개 · 가격 정보 미제공/);
    expect(document.body.textContent).not.toMatch(/null|undefined|NaN|\(\s*\)/);
    expect(screen.queryByRole('tab', { name: '제품 설명' })).toBeNull();
    expect(screen.getAllByText('산출 불가')).toHaveLength(2);
  });
  it('restores conditions, page, basis, scroll and focused result when returning from detail', async () => {
    const router = setup('/cafe/results?maxSugar=10&basis=100ml&page=2');
    const cards = await screen.findByRole('list', { name: '음료 비교' }); const link = within(cards).getByRole('link'); link.focus(); fireEvent.click(link);
    await screen.findByRole('heading', { name: '바닐라라떼' });
    expect(screen.getByRole('button', { name: '100ml당 기준' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '비교로 돌아가기' })); await screen.findByRole('list', { name: '음료 비교' });
    expect(router.state.location.search).toContain('page=2'); expect(router.state.location.search).toContain('basis=100ml');
    await waitFor(() => expect(document.activeElement).toBe(within(screen.getByRole('list', { name: '음료 비교' })).getByRole('link')));
  });
  it('keeps one-hop back navigation and basis through size-list and dropdown changes', async () => {
    const large = fixture({ drinkKey: 'large', sizeLabel: 'L' });
    vi.mocked(api.fetchCafeDrink).mockImplementation(async key => key === 'large' ? large : fixture());
    vi.mocked(api.fetchCafeComparison).mockResolvedValue([{ brandSlug: 'a', brandName: '브랜드', representative: fixture(), variants: [fixture(), large] }]);
    const router = setup('/cafe/results?basis=100ml&page=2');
    fireEvent.click(within(await screen.findByRole('list', { name: '음료 비교' })).getByRole('link'));
    await screen.findByRole('heading', { name: '바닐라라떼' });
    fireEvent.click(screen.getByRole('tab', { name: '사이즈별 정보' }));
    fireEvent.click(await within(screen.getByRole('tabpanel')).findByRole('link', { name: 'ICE · L · 414ml · 디카페인' }));
    await waitFor(() => expect(router.state.location.search).toContain('basis=100ml'));
    fireEvent.click(await screen.findByRole('button', { name: 'ICE · L · 414ml · 디카페인' }));
    fireEvent.click(screen.getByRole('button', { name: 'ICE · R · 414ml · 디카페인' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cafe/drinks/key'));
    fireEvent.click(screen.getByRole('button', { name: '비교로 돌아가기' }));
    expect(router.state.location.pathname).toBe('/cafe/results');
    expect(router.state.location.search).toContain('basis=100ml'); expect(router.state.location.search).toContain('page=2');
  });
  it('shares the current URL using clipboard fallback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    setup('/cafe/drink/라떼'); fireEvent.click(screen.getByRole('button', { name: '공유' }));
    expect(await screen.findByText('링크를 복사했습니다.')).toBeInTheDocument(); expect(writeText).toHaveBeenCalledWith(window.location.href);
  });
});

it('opens nearby only when enabled and sends exact detail variant after explicit location action', async () => {
  const getPosition = vi.fn(); Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: getPosition } });
  vi.mocked(api.searchCafeNearby).mockRejectedValue(new Error('unavailable'));
  setup('/cafe/drinks/key', { nearbyEnabled: true }); await screen.findByRole('heading', { name: '바닐라라떼' });
  fireEvent.click(screen.getByRole('button', { name: '100ml당 기준' })); fireEvent.click(screen.getByRole('button', { name: '주변 카페에서 음료 찾기' }));
  expect(getPosition).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
  await act(async () => getPosition.mock.calls[0][0]({ coords: { latitude: 37.5, longitude: 127, accuracy: 10 } }));
  await waitFor(() => expect(api.searchCafeNearby).toHaveBeenCalledWith(expect.objectContaining({ selectedDrinkKeys: ['key'], drinkName: '바닐라라떼', basis: '100ml' }), expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole('button', { name: '전국 음료 비교로 돌아가기' })); expect(screen.getByRole('heading', { name: '바닐라라떼' })).toBeInTheDocument(); expect(window.location.href).not.toContain('37.5');
});
it('places the capability-enabled nearby row below banner and preserves drink selection before locating', async () => {
  const getPosition = vi.fn(); Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: getPosition } });
  vi.mocked(api.fetchCafeDrinkNames).mockResolvedValue([{ drinkName: '라떼', brandCount: 8, rowCount: 20 }]); vi.mocked(api.searchCafeNearby).mockRejectedValue(new Error('offline'));
  const onNearbyOpen = vi.fn(); setup('/cafe', { nearbyEnabled: true, onNearbyOpen });
  const entry = screen.getByRole('button', { name: '주변 카페에서 음료 찾기' });
  expect(document.querySelector('.cafe-banner')!.compareDocumentPosition(entry) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(entry); expect(onNearbyOpen).toHaveBeenCalledTimes(1); fireEvent.click(await screen.findByRole('button', { name: '라떼 · 8개 브랜드' }));
  expect(api.searchCafeNearby).not.toHaveBeenCalled(); expect(getPosition).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
  await act(async () => getPosition.mock.calls[0][0]({ coords: { latitude: 37.5, longitude: 127, accuracy: 10 } }));
  await waitFor(() => expect(api.searchCafeNearby).toHaveBeenCalledWith(expect.objectContaining({ drinkName: '라떼', location: { kind: 'CURRENT', lat: 37.5, lng: 127 } }), expect.any(AbortSignal)));
});

it('hides confirmed empty brand tabs while keeping failed and pending counts honest', async () => {
  vi.mocked(api.fetchCafeBrands).mockResolvedValue(['empty', 'failed', 'pending'].map(brandSlug => ({ brandSlug, brandName: brandSlug, count: 1, checkedAt: '2026-10-20', sourceUrls: [] })));
  vi.mocked(api.fetchCafeDrinks).mockImplementation(async filters => {
    if (filters.brand?.[0] === 'failed') throw new Error('unavailable');
    if (filters.brand?.[0] === 'pending') return new Promise(() => {});
    return { content: [], totalElements: 0, page: 0, size: 20 };
  });
  setup('/cafe/search?q=라떼');
  expect(await screen.findByRole('button', { name: 'failed 조회 실패' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /empty/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'pending …' })).toBeInTheDocument();
});

it('keeps zero caffeine numeric without the official-zero helper', async () => {
  vi.mocked(api.fetchCafeDrink).mockResolvedValue(fixture({ caffeineStatus: 'ZERO', caffeineMg: 0 }));
  setup('/cafe/drinks/key');
  expect((await screen.findAllByLabelText(/^카페인 0mg\s*$/)).length).toBeGreaterThan(0);
  expect(screen.queryByText('공식 0')).toBeNull();
});

it.each(['/cafe/search', '/cafe/results'])('keeps category selection and toggle-off in %s with other conditions', async path => {
  const router = setup(`${path}?category=coffee&brand=a&q=라떼&temperature=ICE&maxSugar=10&basis=100ml&sort=kcal&direction=desc&page=2`);
  const chips = screen.getByRole('navigation', { name: '음료 유형' });
  expect(within(chips).getByRole('link', { name: '커피' })).toHaveAttribute('aria-current', 'true');
  const preceding = path.endsWith('search') ? document.querySelector('.cafe-search-toolbar') : screen.getByLabelText('적용된 조건');
  expect(preceding?.nextElementSibling).toBe(chips);
  if (path.endsWith('search')) expect(chips.nextElementSibling).toBe(screen.getByRole('navigation', { name: '카페별 검색 결과' }));
  fireEvent.click(within(chips).getByRole('link', { name: '논커피 라떼' }));
  await waitFor(() => expect(api.fetchCafeDrinks).toHaveBeenCalledWith(expect.objectContaining({ group: ['말차·녹차라떼', '고구마라떼', '초코', '밀크티', '우유·요거트'], q: '라떼', brand: ['a'], temperature: 'ICE', maxSugar: 10, basis: '100ml', sort: 'kcal', direction: 'desc', page: 0 })));
  expect(router.state.location.pathname).toBe(path);
  expect(new URLSearchParams(router.state.location.search).getAll('category')).toEqual(['non-coffee']);
  expect(new URLSearchParams(router.state.location.search).has('group')).toBe(false);
  fireEvent.click(within(chips).getByRole('link', { name: '논커피 라떼' }));
  await waitFor(() => expect(within(chips).getByRole('link', { name: '전체' })).toHaveAttribute('aria-current', 'true'));
  expect(new URLSearchParams(router.state.location.search).get('category')).toBe('all');
  expect(api.fetchCafeDrinks).toHaveBeenLastCalledWith(expect.objectContaining({ group: undefined, caffeine: undefined, maxSugar: 10, q: '라떼' }));
});

it('recognizes a legacy single-group selection and clears a decaf category chip', async () => {
  const router = setup('/cafe/search?group=기타&maxKcal=200');
  const chips = screen.getByRole('navigation', { name: '음료 유형' });
  expect(within(chips).getByRole('link', { name: '기타' })).toHaveAttribute('aria-current', 'true');
  fireEvent.click(within(chips).getByRole('link', { name: '디카페인' }));
  await waitFor(() => expect(api.fetchCafeDrinks).toHaveBeenCalledWith(expect.objectContaining({ group: undefined, caffeine: 'decaf', maxKcal: 200 })));
  expect(new URLSearchParams(router.state.location.search).get('category')).toBe('decaf');
  fireEvent.click(within(chips).getByRole('link', { name: '디카페인' }));
  await waitFor(() => expect(api.fetchCafeDrinks).toHaveBeenCalledWith(expect.objectContaining({ caffeine: undefined, maxKcal: 200 })));
});

it.each([
  ['coffee', /아메리카노 · 에스프레소 · 콜드브루/],
  ['decaf', /디카페인/],
])('removes an applied %s condition without restoring it from category metadata', async (category, label) => {
  const router = setup(`/cafe/results?category=${category}&maxSugar=10`);
  fireEvent.click(within(screen.getByLabelText('적용된 조건')).getByRole('button', { name: label }));
  await waitFor(() => expect(api.fetchCafeDrinks).toHaveBeenCalledWith(expect.objectContaining({ group: undefined, caffeine: undefined, maxSugar: 10 })));
  expect(new URLSearchParams(router.state.location.search).has('category')).toBe(false);
  expect(within(screen.getByRole('navigation', { name: '음료 유형' })).getByRole('link', { name: '전체' })).toHaveAttribute('aria-current', 'true');
});
