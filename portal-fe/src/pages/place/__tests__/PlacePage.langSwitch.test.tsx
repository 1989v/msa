import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attraction } from '../../../api/placeApi';

vi.mock('../../../seo/useSeo', () => ({ useSeo: () => undefined }));
vi.mock('../../../components/AuthButton', () => ({ default: () => null }));
vi.mock('../../../api/resumeApi', () => ({ fetchResumeStatus: () => Promise.resolve(false) }));
vi.mock('../../../components/favorite/FavoriteButton', () => ({ default: () => null }));
vi.mock('../../../analytics/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../analytics/tracker')>()),
  track: vi.fn(),
}));
vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  searchAttractions: vi.fn(),
  fetchAdministrativeRegions: vi.fn(),
  fetchAttraction: vi.fn(),
  suggestPlaces: vi.fn(),
}));

import { fetchAdministrativeRegions, searchAttractions, suggestPlaces } from '../../../api/placeApi';
import App from '../../../App';

/*
 * 언어 전환은 실제 라우터(App 의 BrowserRouter · /place → /en/place)를 지나야 한다 — 테스트 안에 라우트를 다시 적으면
 * 전환 뒤 화면이 같은 컴포넌트 인스턴스인지 새 인스턴스인지가 앱과 달라진다.
 */

const item = (id: string): Attraction => ({
  id, contentId: id, lang: 'ko', title: `관광지 ${id}`, category: 'nature', areaCode: null,
  address: null, latitude: 37.5, longitude: 127, imageUrl: null, tel: null, overview: null,
  distanceKm: null, position: 0,
});

const calls = () => vi.mocked(searchAttractions).mock.calls.map(([q]) => q);

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
  vi.mocked(suggestPlaces).mockResolvedValue([]);
  vi.mocked(searchAttractions).mockImplementation((q) =>
    Promise.resolve({ searchId: 's', attractions: [item('a1')], totalElements: 1, totalPages: 1, currentPage: q.page ?? 0, attributeFacets: null }),
  );
});
afterEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, '', '/');
});

describe('언어 전환 뒤 고른 칩', () => {
  it('국문 전용 칩을 고른 채 /en 으로 넘어가면 그 칩이 active 로 남고, 누르면 풀린다', async () => {
    window.history.pushState({}, '', '/place');
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <App />
      </QueryClientProvider>,
    );
    await screen.findByText('관광지 a1');
    // 속성 칩은 「필터」 다이얼로그 안 — 고른 뒤 닫고 언어를 바꾼다
    fireEvent.click(screen.getByRole('button', { name: /^필터/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '필터' })).getByRole('button', { name: /^반려동물 동반/ }));
    await waitFor(() => expect(calls().at(-1)).toMatchObject({ pet: ['ALLOWED'] }));
    fireEvent.keyDown(document, { key: 'Escape' });

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    await waitFor(() => expect(window.location.pathname).toBe('/en/place'));
    fireEvent.click(await screen.findByRole('button', { name: /^Filters/ }));
    const group = await within(screen.getByRole('dialog', { name: 'Filters' })).findByRole('group', { name: 'Visitor info filters' });
    await waitFor(() => expect(calls().at(-1)).toMatchObject({ lang: 'en', pet: ['ALLOWED'] }));

    const petChip = within(group).getByRole('button', { name: /^Pets allowed/ });
    expect(petChip).toHaveClass('active');
    expect(petChip).toHaveAttribute('aria-pressed', 'true');
    // 고른 칩은 영문 목록 끝에 붙는다
    expect(Array.from(group.querySelectorAll('.place-attr-chip')).map((el) => el.getAttribute('data-attr'))).toEqual([
      'openToday', 'parking', 'admissionFree', 'wellness', 'petAllowed',
    ]);

    fireEvent.click(petChip);
    await waitFor(() => expect(calls().at(-1)).toMatchObject({ lang: 'en', page: 0 }));
    expect(calls().at(-1)!.pet).toBeUndefined();
    expect(within(group).queryByRole('button', { name: /^Pets allowed/ })).toBeNull();
  });
});
