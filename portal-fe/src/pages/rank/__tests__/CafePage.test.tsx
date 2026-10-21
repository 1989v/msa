import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import CafePage from '../CafePage';
import * as api from '../../../api/rankingApi';
import type { CafeDrink } from '../../../api/rankingApi';
vi.mock('../../../api/rankingApi', () => ({ fetchCafeBrands: vi.fn(), fetchCafeGroups: vi.fn(), fetchCafeDrinks: vi.fn(), fetchCafeDrink: vi.fn() }));
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
function setup(path = '/cafe') {
  const router = createMemoryRouter([{ path: '/cafe', element: <CafePage /> }, { path: '/cafe/drinks/:drinkKey', element: <CafePage /> }], { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><RouterProvider router={router} /></QueryClientProvider>);
  return router;
}
beforeEach(() => {
  vi.mocked(api.fetchCafeBrands).mockResolvedValue([{ brandSlug: 'a', brandName: '브랜드', count: 5, checkedAt: '2026-10-20', sourceUrls: ['https://example.com'] }]);
  vi.mocked(api.fetchCafeGroups).mockResolvedValue([{ group: '바닐라라떼', count: 5 }]);
  vi.mocked(api.fetchCafeDrinks).mockResolvedValue({ content: [fixture()], totalElements: 1, page: 0, size: 20 });
  vi.mocked(api.fetchCafeDrink).mockResolvedValue(fixture());
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => vi.clearAllMocks());
describe('cafe search and filter drafts', () => {
  it('does not request while typing Korean composition; submits once with complete text', async () => {
    const router = setup();
    const input = screen.getByRole('searchbox');
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '바닐라' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(router.state.location.search).toBe('');
    expect(api.fetchCafeDrinks).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    fireEvent.change(input, { target: { value: '바닐라라떼' } });
    fireEvent.submit(screen.getByRole('search'));
    await screen.findByRole('table');
    expect(api.fetchCafeDrinks).toHaveBeenCalledTimes(1);
    expect(api.fetchCafeDrinks).toHaveBeenCalledWith(expect.objectContaining({ q: '바닐라라떼' }));

  });
  it('keeps modal changes local, cancels with Escape and applies one request', async () => {
    const router = setup('/cafe?group=바닐라라떼');
    await screen.findByRole('table');
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
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: '100ml당' }));
    await screen.findByText('47.9');
    fireEvent.click(screen.getByRole('link', { name: '바닐라라떼' }));
    await screen.findByText('공식 미공개 · 가격 정보 미제공');
    expect(screen.getByRole('button', { name: '100ml당' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('47.9')).toBeInTheDocument();
  });
  it('switches all three metrics and restores conditions, page and focus from detail', async () => {
    const router = setup('/cafe?group=바닐라라떼&basis=100ml&page=2');
    await screen.findByRole('table');
    expect(screen.getByText('47.9')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: '바닐라라떼' });
    link.focus();
    fireEvent.click(link);
    await screen.findByRole('region', { name: '음료 상세' });
    await screen.findByText('공식 미공개 · 가격 정보 미제공');
    fireEvent.click(screen.getByRole('button', { name: '‹ 비교로 돌아가기' }));
    await screen.findByRole('table');
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
    await screen.findByRole('table');
    expect(screen.getByRole('heading', { name: '기타·유형 미분류' })).toBeInTheDocument();
    expect(screen.getByText(/서로 같은 메뉴를 뜻하지 않음/)).toBeInTheDocument();
    expect(screen.getByText(/현재 페이지: 산출 가능 1행 · 산출 불가 1행/)).toBeInTheDocument();
  });
  it('retains results with partial metadata failure and missing-volume variants', async () => {
    vi.mocked(api.fetchCafeGroups).mockRejectedValue(new Error('offline'));
    vi.mocked(api.fetchCafeDrinks).mockResolvedValue({ content: [fixture({ cupVolumeMl: null, volumeMl: null, sugarPer100ml: null, caffeinePer100ml: null, kcalPer100ml: null })], totalElements: 1, page: 0, size: 20 });
    setup('/cafe?basis=100ml');
    await screen.findByRole('table');
    expect(screen.getByText('유형 정보 조회 실패')).toBeInTheDocument();
    expect(screen.getAllByText('산출 불가')).toHaveLength(3);
    expect(screen.getByText('디카페인')).toBeInTheDocument();
    expect(screen.getByText(/현재 페이지: 산출 가능 0행/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1회 제공량으로 돌아가기' }));
    await screen.findByText('198.4');
  });
});
