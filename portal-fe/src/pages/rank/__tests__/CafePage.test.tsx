import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, type Location } from 'react-router-dom';
import CafePage from '../CafePage';
import * as api from '../../../api/rankingApi';
import type { CafeDrink } from '../../../api/rankingApi';
vi.mock('../../../api/rankingApi', () => ({ fetchCafeNearbyCapability: vi.fn(), fetchCafeAreas: vi.fn(), searchCafeNearby: vi.fn(), fetchCafeDrinkNames: vi.fn(), fetchCafeComparison: vi.fn(), fetchCafeBrands: vi.fn(), fetchCafeGroups: vi.fn(), fetchCafeDrinks: vi.fn(), fetchCafeDrink: vi.fn() }));
vi.mock('../../../components/ThemeToggle', () => ({ default: () => <span>테마</span> }));
vi.mock('../../../components/Footer', () => ({ default: () => <footer>출처 안내</footer> }));
vi.mock('../../../hooks/useHeritageSurface', () => ({ useHeritageSurface: () => {} }));
const fixture = (patch: Partial<CafeDrink> = {}): CafeDrink => ({
  drinkKey: 'key', brandSlug: 'a', brandName: '브랜드', menuName: '바닐라라떼', menuNameEn: null,
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
  vi.mocked(api.fetchCafeDrinks).mockResolvedValue({ content: [fixture()], totalElements: 1, page: 0, size: 20 });
  vi.mocked(api.fetchCafeDrink).mockResolvedValue(fixture());
  localStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => vi.clearAllMocks());
describe('cafe search and filter drafts', () => {
  it('does not request while typing Korean composition; submits once with complete text', async () => {
    const router = setup();
    fireEvent.click(screen.getByRole('button', { name: /음료 이름 검색/ }));
    const input = screen.getByRole('searchbox');
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '바닐라' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(router.state.location.search).toBe('');
    expect(api.fetchCafeDrinks).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.change(input, { target: { value: '바닐라라떼' } });
    fireEvent.submit(screen.getByRole('search'));
    await screen.findByRole('list', { name: '음료 비교' });
    expect(api.fetchCafeDrinks).toHaveBeenCalledTimes(1);
    expect(api.fetchCafeDrinks).toHaveBeenCalledWith(expect.objectContaining({ q: '바닐라라떼' }));

  });
  it('keeps modal changes local, cancels with Escape and applies one request', async () => {
    const router = setup('/cafe?group=바닐라라떼');
    await screen.findByRole('list', { name: '음료 비교' });
    screen.getByRole('button', { name: '필터 0' }).focus();
    fireEvent.click(screen.getByRole('button', { name: '필터 0' }));
    let dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('checkbox', { name: '공식 0mg' }));
    expect(api.fetchCafeDrinks).toHaveBeenCalledTimes(1);
    expect(router.state.location.search).not.toContain('caffeineStatus');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '필터 0' }));
    fireEvent.click(screen.getByRole('button', { name: '필터 0' }));
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('checkbox', { name: '공식 0mg' })).not.toBeChecked();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: '디카페인' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '적용' }));
    await waitFor(() => expect(api.fetchCafeDrinks).toHaveBeenCalledTimes(2));
    expect(api.fetchCafeDrinks).toHaveBeenLastCalledWith(expect.objectContaining({ caffeineStatus: ['DECAF'] }));
  });
  it('uses the newly selected list basis when entering detail in the same route component', async () => {
    setup('/cafe?group=바닐라라떼');
    await screen.findByRole('list', { name: '음료 비교' });
    fireEvent.click(screen.getByRole('button', { name: '100ml당' }));
    await screen.findByText('47.9');
    fireEvent.click(screen.getByRole('link', { name: '바닐라라떼' }));
    await screen.findByText('공식 미공개 · 가격 정보 미제공');
    expect(screen.getByRole('button', { name: '100ml당' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('47.9')).toBeInTheDocument();
  });
  it('switches all three metrics and restores conditions, page and focus from detail', async () => {
    const router = setup('/cafe?group=바닐라라떼&basis=100ml&page=2');
    await screen.findByRole('list', { name: '음료 비교' });
    expect(screen.getByText('47.9')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: '바닐라라떼' });
    link.focus();
    fireEvent.click(link);
    await screen.findByRole('region', { name: '음료 상세' });
    await screen.findByText('공식 미공개 · 가격 정보 미제공');
    fireEvent.click(screen.getByRole('button', { name: '‹ 비교로 돌아가기' }));
    await screen.findByRole('list', { name: '음료 비교' });
    expect(router.state.location.search).toContain('page=2');
    expect(router.state.location.search).toContain('basis=100ml');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('link', { name: '바닐라라떼' })));
  });
});
describe('honest query states', () => {
  it('keeps error, empty result and loading separate', async () => {
    let reject: (reason: Error) => void = () => {};
    vi.mocked(api.fetchCafeDrinks).mockImplementation(() => new Promise((_resolve, no) => { reject = no; }));
    setup('/cafe?group=라떼');
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중');
    expect(screen.queryByRole('navigation', { name: '결과 페이지' })).toBeNull();
    await act(async () => reject(new Error('offline')));
    expect(await screen.findByRole('alert')).toHaveTextContent('음료를 불러오지 못했습니다');
    expect(screen.queryByText('조건에 맞는 음료가 없습니다.')).toBeNull();
    vi.mocked(api.fetchCafeDrinks).mockResolvedValue({ content: [], totalElements: 0, page: 0, size: 20 });
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('조건에 맞는 음료가 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '결과 페이지' })).toBeNull();
  });
  it('identifies unclassified types and counts partial volume coverage per page', async () => {
    vi.mocked(api.fetchCafeDrinks).mockResolvedValue({ content: [fixture(), fixture({ drinkKey: 'no-volume', cupVolumeMl: null })], totalElements: 150, page: 0, size: 20 });
    setup('/cafe?group=기타&basis=100ml');
    await screen.findByRole('list', { name: '음료 비교' });
    expect(screen.getByRole('heading', { name: '기타·유형 미분류' })).toBeInTheDocument();
    expect(screen.getByText(/서로 같은 메뉴를 뜻하지 않음/)).toBeInTheDocument();
    expect(screen.getByText(/현재 페이지: 산출 가능 1행 · 산출 불가 1행/)).toBeInTheDocument();
  });
  it('retains results with partial metadata failure and missing-volume variants', async () => {
    vi.mocked(api.fetchCafeGroups).mockRejectedValue(new Error('offline'));
    vi.mocked(api.fetchCafeDrinks).mockResolvedValue({ content: [fixture({ cupVolumeMl: null, volumeMl: null, sugarPer100ml: null, caffeinePer100ml: null, kcalPer100ml: null })], totalElements: 1, page: 0, size: 20 });
    setup('/cafe?basis=100ml');
    await screen.findByRole('list', { name: '음료 비교' });
    expect(screen.getByText('유형 정보 조회 실패')).toBeInTheDocument();
    expect(screen.getAllByText('산출 불가')).toHaveLength(3);
    expect(screen.getByText('디카페인')).toBeInTheDocument();
    expect(screen.getByText(/현재 페이지: 산출 가능 0행/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1회 제공량으로 돌아가기' }));
    await screen.findByText('198.4');
  });
});

describe('normalized name comparison and nullable responses', () => {
  it('shows all brand variants with selected basic metrics and no table', async () => {
    vi.mocked(api.fetchCafeComparison).mockResolvedValue([{ brandSlug: 'a', brandName: '브랜드', representative: fixture(), variants: [fixture(), fixture({ drinkKey: 'large', sizeLabel: 'L', temperature: 'HOT', caffeineStatus: 'DISCLOSED' })] }]);
    setup('/cafe/drink/바닐라라떼');
    await screen.findByRole('list', { name: '음료 비교' });
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(/최저 수치가 아닙니다/)).toBeInTheDocument();
    const variants = screen.getByRole('group', { name: '브랜드 공개 판 전체 2개' });
    expect(within(variants).getByRole('button', { name: /ICE · R · 414ml · 디카페인/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(variants).getByRole('button', { name: /HOT · L · 414ml · 수치 공개/ }));
    expect(screen.getByRole('link', { name: '상세 ›' })).toHaveAttribute('href', '/cafe/drinks/large?basis=serving');
    fireEvent.click(screen.getByRole('button', { name: '당류 낮은 순 ↑' }));
    await waitFor(() => expect(api.fetchCafeComparison).toHaveBeenLastCalledWith('바닐라라떼', expect.objectContaining({ direction: 'desc' })));
  });
  it('hides nearby by default, and enabled entry opens honest integration guidance', async () => {
    const onNearbyOpen = vi.fn();
    setup('/cafe', { nearbyEnabled: true, onNearbyOpen });
    fireEvent.click(screen.getByRole('button', { name: '주변 카페에서 음료 찾기' }));
    expect(screen.getByText(/매장별 판매 여부는 확인되지 않았습니다/)).toBeInTheDocument();
    expect(onNearbyOpen).toHaveBeenCalledTimes(1);
  });
  it('renders nullable real response-shaped detail without leaked values or empty parentheses', async () => {
    vi.mocked(api.fetchCafeDrink).mockResolvedValue(fixture({ temperature: null, sizeLabel: null, volumeMl: null, cupVolumeMl: null, servingBasis: null, kcal: null, sugarG: null, caffeineMg: null, caffeineStatus: 'UNDISCLOSED', priceKrw: null, notes: null }));
    setup('/cafe/drinks/key');
    await screen.findByText('공식 미공개 · 가격 정보 미제공');
    expect(document.body.textContent).not.toMatch(/null|undefined|NaN|\(\s*\)/);
    expect(screen.queryByText('주변 카페에서 음료 찾기')).toBeNull();
  });
  it('debounces completed name input without autocomplete requests during composition', async () => {
    setup();
    await waitFor(() => expect(api.fetchCafeDrinkNames).toHaveBeenCalledWith(''));
    vi.mocked(api.fetchCafeDrinkNames).mockClear();
    fireEvent.click(screen.getByRole('button', { name: /음료 이름 검색/ }));
    const input = screen.getByRole('searchbox');
    fireEvent.compositionStart(input); fireEvent.change(input, { target: { value: '라' } });
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(api.fetchCafeDrinkNames).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '라떼' } }); fireEvent.compositionEnd(input);
    await waitFor(() => expect(api.fetchCafeDrinkNames).toHaveBeenCalledWith('라떼'));
  });
});

it('enables the fixed nearby entry on the normalized drink page without mock stores', async () => {
  setup('/cafe/drink/라떼', { nearbyEnabled: true });
  const entry = screen.getByRole('button', { name: '주변 카페에서 음료 찾기' });
  expect(entry).toHaveClass('cafe-nearby-cta');
  fireEvent.click(entry);
  expect(screen.getByRole('button', { name: '현재 위치 사용' })).toBeInTheDocument();
  fireEvent.click(screen.getByText('주변 비교 도움말'));
  expect(screen.getByText(/현재 위치는 한 번만 사용하며 저장하지 않습니다/)).toBeInTheDocument();
});

it('keeps a positive numeric bar for an amount formatted below 0.1', async () => {
  vi.mocked(api.fetchCafeDrinks).mockResolvedValue({ content: [fixture({ sugarG: 0.02 })], totalElements: 1, page: 0, size: 20 });
  setup('/cafe?group=라떼');
  const cards = await screen.findByRole('list', { name: '음료 비교' });
  expect(within(cards).getByText('<0.1')).toBeInTheDocument();
  const sugarSection = within(cards).getByRole('heading', { name: '당류' }).parentElement;
  expect(sugarSection?.querySelector('i')?.style.width).toBe('2%');
});


it('opens nearby from drink detail with the exact variant selected in memory', async () => {
  const getPosition = vi.fn();
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: getPosition } });
  vi.mocked(api.searchCafeNearby).mockRejectedValue(new Error('unavailable'));
  setup('/cafe/drinks/key', { nearbyEnabled: true });
  await screen.findByRole('heading', { name: '바닐라라떼' });
  fireEvent.click(screen.getByRole('button', { name: '100ml당' }));
  fireEvent.click(screen.getByRole('button', { name: '주변 카페에서 음료 찾기' }));
  expect(getPosition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
  getPosition.mock.calls[0][0]({ coords: { latitude: 37.5, longitude: 127, accuracy: 10 } });
  await waitFor(() => expect(api.searchCafeNearby).toHaveBeenCalledWith(expect.objectContaining({ selectedDrinkKeys: ['key'], drinkName: '바닐라라떼', basis: '100ml' }), expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole('button', { name: '전국 음료 비교로 돌아가기' }));
  expect(screen.getByRole('heading', { name: '바닐라라떼' })).toBeInTheDocument();
  expect(window.location.href).not.toContain('37.5');
});

it('uses real brand counts for four horizontal popular chips and hides all nearby actions when unavailable', async () => {
  vi.mocked(api.fetchCafeDrinkNames).mockResolvedValue([
    { drinkName: '티', brandCount: 1, rowCount: 10 }, { drinkName: '라떼', brandCount: 8, rowCount: 30 },
    { drinkName: '모카', brandCount: 4, rowCount: 20 }, { drinkName: '아메리카노', brandCount: 6, rowCount: 12 },
    { drinkName: '콜드브루', brandCount: 2, rowCount: 8 },
  ]);
  setup();
  const popular = await screen.findByRole('navigation', { name: '많이 찾는 음료' });
  await waitFor(() => expect(within(popular).getAllByRole('link')).toHaveLength(4));
  expect(within(popular).getAllByRole('link').map(link => link.textContent)).toEqual(['라떼 8', '아메리카노 6', '모카 4', '콜드브루 2']);
  expect(screen.queryByRole('button', { name: '주변 카페에서 음료 찾기' })).not.toBeInTheDocument();
  expect(document.querySelector('select')).toBeNull();
});

it('highlights autocomplete and saves removable recent searches without navigation on typing', async () => {
  vi.mocked(api.fetchCafeDrinkNames).mockImplementation(async q => q ? [{ drinkName: '바닐라라떼', brandCount: 8, rowCount: 46 }] : []);
  const router = setup();
  fireEvent.click(screen.getByRole('button', { name: /음료 이름 검색/ }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '바닐라' } });
  const link = await screen.findByRole('link', { name: /바닐라\s*라떼 8개 브랜드/ });
  expect(link.querySelector('mark')?.textContent).toBe('바닐라');
  expect(router.state.location.search).toBe('');
  fireEvent.click(link);
  await screen.findByRole('heading', { name: '바닐라라떼' });
  expect(localStorage.getItem('cafe-recent-searches')).toContain('바닐라라떼');
  fireEvent.click(screen.getByRole('button', { name: /음료 이름 검색/ }));
  fireEvent.click(screen.getByRole('button', { name: '바닐라라떼 최근 검색 삭제' }));
  expect(localStorage.getItem('cafe-recent-searches')).toBe('[]');
});

it('keeps selected card variants through basis/sort changes and puts unknowns last in either direction', async () => {
  const a = fixture({ brandSlug: 'a', brandName: '가브랜드', sugarG: 5 });
  const large = fixture({ drinkKey: 'large', brandSlug: 'a', brandName: '가브랜드', sugarG: 30, sizeLabel: 'L', sugarPer100ml: 7.2 });
  const b = fixture({ drinkKey: 'b', brandSlug: 'b', brandName: '나브랜드', sugarG: null, sugarPer100ml: null });
  vi.mocked(api.fetchCafeComparison).mockResolvedValue([{ brandSlug: 'a', brandName: a.brandName, representative: a, variants: [a, large] }, { brandSlug: 'b', brandName: b.brandName, representative: b, variants: [b] }]);
  setup('/cafe/drink/라떼');
  const cards = await screen.findByRole('list', { name: '음료 비교' });
  fireEvent.click(within(screen.getByRole('group', { name: '가브랜드 공개 판 전체 2개' })).getByRole('button', { name: /L · 414ml/ }));
  fireEvent.click(screen.getByRole('button', { name: '당류 낮은 순 ↑' }));
  await waitFor(() => expect(within(cards).getAllByRole('link', { name: '상세 ›' })[0]).toHaveAttribute('href', '/cafe/drinks/large?basis=serving'));
  expect(cards.lastElementChild).toHaveTextContent('나브랜드');
  expect(cards.lastElementChild?.querySelector('.cafe-rank')?.textContent).toBe('–');
  fireEvent.click(screen.getByRole('button', { name: '100ml당' }));
  await waitFor(() => expect(within(screen.getByRole('list', { name: '음료 비교' })).getAllByRole('link', { name: '상세 ›' })[0]).toHaveAttribute('href', '/cafe/drinks/large?basis=100ml'));
});

it('keeps unfiltered popular drinks when a no-match search is closed', async () => {
  vi.mocked(api.fetchCafeDrinkNames).mockImplementation(async q => q ? [] : [{ drinkName: '라떼', brandCount: 8, rowCount: 20 }]);
  setup();
  expect(await screen.findByRole('link', { name: '라떼 8' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /음료 이름 검색/ }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '없는음료' } });
  await waitFor(() => expect(api.fetchCafeDrinkNames).toHaveBeenCalledWith('없는음료'));
  fireEvent.click(screen.getByRole('button', { name: '‹ 검색 닫기' }));
  expect(screen.getByRole('link', { name: '라떼 8' })).toBeInTheDocument();
});

it('completes the home nearby path through an actual drink selection and explicit location action', async () => {
  const getPosition = vi.fn();
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: getPosition } });
  vi.mocked(api.fetchCafeDrinkNames).mockResolvedValue([{ drinkName: '라떼', brandCount: 8, rowCount: 20 }]);
  vi.mocked(api.searchCafeNearby).mockRejectedValue(new Error('offline'));
  setup('/cafe', { nearbyEnabled: true });
  fireEvent.click(screen.getByRole('button', { name: '주변 카페에서 음료 찾기' }));
  fireEvent.click(await screen.findByRole('button', { name: '라떼 · 8개 브랜드' }));
  expect(api.searchCafeNearby).not.toHaveBeenCalled();
  expect(getPosition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
  await act(async () => getPosition.mock.calls[0][0]({ coords: { latitude: 37.5, longitude: 127, accuracy: 10 } }));
  await waitFor(() => expect(api.searchCafeNearby).toHaveBeenCalledWith(expect.objectContaining({ drinkName: '라떼', location: { kind: 'CURRENT', lat: 37.5, lng: 127 } }), expect.any(AbortSignal)));
});
