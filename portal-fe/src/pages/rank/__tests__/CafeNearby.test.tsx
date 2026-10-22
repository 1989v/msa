import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CafeNearby from '../CafeNearby';
import * as api from '../../../api/rankingApi';
import type { CafeNearbyResult } from '../../../api/rankingApi';

vi.mock('../CafeNearbyMap', () => ({ default: () => <div aria-label="매장 위치 지도" /> }));
vi.mock('../../../api/rankingApi', () => ({ fetchCafeAreas: vi.fn(), fetchCafeDrinkNames: vi.fn(), searchCafeNearby: vi.fn() }));
const getPosition = vi.fn();
const empty: CafeNearbyResult = { basis: 'serving', sort: 'distance', radiusKm: 1, locationKind: 'CURRENT', areaLabel: null, coverage: { status: 'SUPPORTED', reason: '', brands: [] }, storeSource: '상가정보', storeSourceAsOf: null, storeFetchedAt: '2026-10-21', projectionAsOf: '2026-10-21', mappingRuleVersion: 'v1', totalStores: 0, matchedBrands: 0, page: 0, size: 20, hasNext: false, items: [] };
function setup() {
 const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 return render(<QueryClientProvider client={client}><CafeNearby filters={{ group: '라떼' }} close={vi.fn()} /></QueryClientProvider>);
}
beforeEach(() => {
 getPosition.mockReset();
 Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: getPosition } });
 vi.mocked(api.fetchCafeAreas).mockImplementation(async parent => parent ? [{ code: parent === '1100000000' ? '1168000000' : '5011000000', name: parent === '1100000000' ? '강남구' : '제주시', level: 'DISTRICT', parentCode: parent, centerSource: 'https://www.data.go.kr', sourceAsOf: '2026-10-19' }] : [{ code: '1100000000', name: '서울특별시', level: 'PROVINCE', parentCode: null, centerSource: 'https://www.data.go.kr', sourceAsOf: '2026-10-19' }, { code: '5000000000', name: '제주특별자치도', level: 'PROVINCE', parentCode: null, centerSource: 'https://www.data.go.kr', sourceAsOf: '2026-10-19' }]);
 vi.mocked(api.searchCafeNearby).mockResolvedValue(empty);
});
afterEach(() => vi.clearAllMocks());
describe('one-shot memory-only location', () => {
 it('never asks automatically; explicit action requests once and cancellation ignores late position', async () => {
  setup(); expect(getPosition).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
  expect(getPosition).toHaveBeenCalledTimes(1);
  expect(getPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  fireEvent.click(screen.getByRole('button', { name: '위치 요청 취소' }));
  getPosition.mock.calls[0][0]({ coords: { latitude: 37.51234567, longitude: 127.01234567, accuracy: 10 } });
  await Promise.resolve(); expect(api.searchCafeNearby).not.toHaveBeenCalled();
 });
 it('denial completes through real province/district selection, radius stays in request body', async () => {
  vi.mocked(api.searchCafeNearby).mockResolvedValue({ ...empty, locationKind: 'AREA', areaLabel: '강남구' });
  setup(); fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
  getPosition.mock.calls[0][1]({ code: 1 });
  expect(await screen.findByText(/위치 권한이 거부되었습니다/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('시도: 시도 선택'));
  fireEvent.click(await screen.findByRole('button', { name: '서울특별시' }));
  fireEvent.click(screen.getByText('시군구: 시군구 선택'));
  fireEvent.click(await screen.findByRole('button', { name: '강남구' }));
  await waitFor(() => expect(api.searchCafeNearby).toHaveBeenCalledWith(expect.objectContaining({ location: { kind: 'AREA', areaCode: '1168000000' }, radiusKm: 1 }), expect.any(AbortSignal)));
  expect(await screen.findByRole('link', { name: '중심점 출처: 기상청 단기예보 지역대표 위경도' })).toHaveAttribute('href', 'https://www.data.go.kr');
  fireEvent.click(screen.getByRole('button', { name: '500m' }));
  await waitFor(() => expect(api.searchCafeNearby).toHaveBeenLastCalledWith(expect.objectContaining({ radiusKm: 0.5 }), expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole('button', { name: '위치 변경' }));
  fireEvent.click(screen.getByText('시도: 서울특별시'));
  fireEvent.click(screen.getByRole('button', { name: '제주특별자치도' }));
  fireEvent.click(screen.getByText('시군구: 시군구 선택'));
  await screen.findByRole('button', { name: '제주시' });
  expect(screen.queryByRole('button', { name: '강남구' })).not.toBeInTheDocument();
 });
 it('submits position only to the body, aborts on exit, and does not save position in web storage', async () => {
  const local = vi.spyOn(Storage.prototype, 'setItem');
  const view = setup(); fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
  getPosition.mock.calls[0][0]({ coords: { latitude: 37.51234567, longitude: 127.01234567, accuracy: 1400 } });
  await waitFor(() => expect(api.searchCafeNearby).toHaveBeenCalled());
  expect(screen.getByText(/위치가 넓게 추정되었습니다/)).toBeInTheDocument();
  const [body, signal] = vi.mocked(api.searchCafeNearby).mock.calls[0];
  expect(body).toEqual(expect.objectContaining({ location: { kind: 'CURRENT', lat: 37.51234567, lng: 127.01234567 } }));
  expect(window.location.href).not.toContain('37.51234567'); expect(local).not.toHaveBeenCalled();
  view.unmount(); expect(signal.aborted).toBe(true); local.mockRestore();
 });
 it('publishes only public store destinations and no user origin in outbound links', async () => {
  vi.mocked(api.searchCafeNearby).mockResolvedValue({ ...empty, totalStores: 1, matchedBrands: 1, items: [{ storeKey: 's', brandSlug: 'starbucks', brandName: '스타벅스', storeName: '스타벅스', branchName: '강남점', displayName: '스타벅스 강남점', address: '서울', latitude: 37.5, longitude: 127, distanceM: 100, mappingStatus: 'CONFIRMED', selectedDrink: null, variants: [], selectionRequired: true, autoSelected: false, sourceAsOf: null, menuAvailability: 'UNVERIFIED' }] });
  setup(); fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
  getPosition.mock.calls[0][0]({ coords: { latitude: 37.51234567, longitude: 127.01234567, accuracy: 10 } });
  const google = await screen.findByRole('link', { name: '길찾기 ↗' });
  const target = new URL(google.getAttribute('href')!); expect(target.searchParams.get('destination')).toBe('37.5,127'); expect(target.searchParams.has('origin')).toBe(false);
  const naver = screen.getByRole('link', { name: '네이버 메뉴·가격 ↗' });
  expect(decodeURIComponent(naver.getAttribute('href')!)).toBe('https://map.naver.com/p/search/스타벅스 강남점');
  expect(screen.getByText(/매장 메뉴 판매 미확인/)).toBeInTheDocument();
 });
});

it('clears a pending request when province changes and ignores the late response', async () => {
 let resolve!: (value: CafeNearbyResult) => void;
 vi.mocked(api.searchCafeNearby).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
 setup(); fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
 getPosition.mock.calls[0][0]({ coords: { latitude: 37.5, longitude: 127, accuracy: 10 } });
 await screen.findByText('주변 매장 검색 중…');
 fireEvent.click(screen.getByRole('button', { name: '위치 변경' }));
 fireEvent.click(screen.getByText('시도: 시도 선택'));
 await screen.findByRole('button', { name: '서울특별시' });
 const signal = vi.mocked(api.searchCafeNearby).mock.calls[0][1];
 fireEvent.click(screen.getByRole('button', { name: '서울특별시' }));
 expect(signal.aborted).toBe(true);
 expect(screen.queryByText('주변 매장 검색 중…')).not.toBeInTheDocument();
 resolve(empty); await Promise.resolve();
 expect(screen.queryByText(/현재 위치 기준/)).not.toBeInTheDocument();
});

it('distinguishes a physical store with missing nutrition from an empty radius', async () => {
 vi.mocked(api.searchCafeNearby).mockResolvedValue({ ...empty, nearbyStoresWithoutNutrition: 3 });
 setup(); fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
 getPosition.mock.calls[0][0]({ coords: { latitude: 37.5, longitude: 127, accuracy: 10 } });
 expect(await screen.findByText(/매장은 있으나 비교할 영양 자료가 없습니다/)).toBeInTheDocument();
 expect(screen.queryByText(/현재 조건에 맞는 매장이 없습니다/)).not.toBeInTheDocument();
 expect(screen.getByRole('link', { name: /매장 출처: 상가정보/ })).toHaveAttribute('href', 'https://www.data.go.kr/data/15012005/openapi.do');
});


it('retains calorie and exact-size filters in a memory-only nearby request', async () => {
 const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
 render(<QueryClientProvider client={client}><CafeNearby filters={{ group: '라떼', maxKcal: 200, sizeLabel: 'Tall' }} close={vi.fn()} /></QueryClientProvider>);
 fireEvent.click(screen.getByRole('button', { name: '현재 위치 사용' }));
 getPosition.mock.calls[0][0]({ coords: { latitude: 37.5, longitude: 127, accuracy: 10 } });
 await waitFor(() => expect(api.searchCafeNearby).toHaveBeenCalledWith(expect.objectContaining({ maxKcal: 200, sizeLabel: 'Tall' }), expect.any(AbortSignal)));
});
