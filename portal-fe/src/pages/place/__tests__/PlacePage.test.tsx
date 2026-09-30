import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attraction, AttractionQuery, AttributeFacets } from '../../../api/placeApi';

vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  searchAttractions: vi.fn(),
  fetchAdministrativeRegions: vi.fn(),
  fetchAttraction: vi.fn(),
  suggestPlaces: vi.fn(),
}));
vi.mock('../../../components/favorite/FavoriteButton', () => ({ default: () => null }));

import { fetchAdministrativeRegions, searchAttractions, suggestPlaces } from '../../../api/placeApi';
import PlacePage from '../PlacePage';

const facets = (over: Partial<AttributeFacets> = {}): AttributeFacets => ({
  openToday: 120,
  parking: { YES: 80 },
  creditCard: { YES: 0 },
  strollerRental: { YES: 3 },
  pet: { ALLOWED: 5, PARTIAL: 0 },
  admission: { FREE: 1234 },
  ...over,
});

const item = (id: string): Attraction => ({
  id, contentId: id, lang: 'ko', title: `관광지 ${id}`, category: 'nature', areaCode: null,
  address: null, latitude: 37.5, longitude: 127, imageUrl: null, tel: null, overview: null,
  distanceKm: null, position: 0,
});

/** 요청 조건에 따라 응답을 만든다 — 쪽마다 다른 id, 속성 필터가 걸리면 다른 id 대역. */
function respond(q: AttractionQuery, facetsFor: (q: AttractionQuery) => AttributeFacets | null) {
  const page = q.page ?? 0;
  const prefix = q.parking ? 'p' : 'a';
  return Promise.resolve({
    searchId: 's',
    attractions: [item(`${prefix}${page}-1`), item(`${prefix}${page}-2`)],
    totalElements: 6,
    totalPages: 3,
    currentPage: page,
    // 서버 계약: facets=true 일 때만 싣는다
    attributeFacets: q.facets ? facetsFor(q) : null,
  });
}

let mobile = false;
function stubMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: mobile,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function renderPage(path = '/place') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <PlacePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const calls = () => vi.mocked(searchAttractions).mock.calls.map(([q]) => q);
const chip = (label: RegExp) => screen.getByRole('button', { name: label });
const chipLabels = () =>
  Array.from(document.querySelectorAll('.place-attr-chip')).map((el) => el.getAttribute('data-attr'));

describe('PlacePage 속성 칩', () => {
  beforeEach(() => {
    mobile = false;
    stubMedia();
    vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
    vi.mocked(suggestPlaces).mockResolvedValue([]);
    vi.mocked(searchAttractions).mockReset();
    vi.mocked(searchAttractions).mockImplementation((q) => respond(q, () => facets()));
  });
  afterEach(() => vi.clearAllMocks());

  it('일곱 칩을 분류 칩과 다른 묶음에 그리고, 첫 쪽 응답의 건수를 붙인다', async () => {
    renderPage();
    await screen.findByText('관광지 a0-1');

    const group = screen.getByRole('group', { name: '방문 정보 필터' });
    expect(group.querySelectorAll('.place-attr-chip')).toHaveLength(7);
    expect(group.closest('.place-filters')).toBeNull();
    expect(within(group).getByText('정보가 있는 곳만 거릅니다')).toBeInTheDocument();

    await waitFor(() => expect(chip(/^주차 가능/)).toHaveTextContent('80'));
    expect(chip(/^입장 무료/)).toHaveTextContent('1,234');
    expect(chip(/^오늘 정기휴무 아님/)).toHaveTextContent('120');
    expect(calls()[0]).toMatchObject({ page: 0, facets: true });
  });

  it('안 고른 칩이 0 이면 흐리게 두고 자리를 지킨다 — 숨기지 않는다', async () => {
    renderPage();
    await waitFor(() => expect(chip(/^신용카드/)).toHaveTextContent('0'));

    expect(chipLabels()).toEqual([
      'openToday', 'parking', 'creditCard', 'strollerRental', 'petAllowed', 'petPartial', 'admissionFree',
    ]);
    expect(chip(/^신용카드/)).toHaveClass('is-empty');
    expect(chip(/^반려동물 일부 구역/)).toHaveClass('is-empty');
    expect(chip(/^주차 가능/)).not.toHaveClass('is-empty');
  });

  it('고른 칩은 건수가 0 이 되어도 활성이다 — 풀 수 있어야 한다', async () => {
    vi.mocked(searchAttractions).mockImplementation((q) =>
      respond(q, (req) => facets(req.parking ? { parking: { YES: 0 } } : {})),
    );
    renderPage();
    await screen.findByText('관광지 a0-1');

    fireEvent.click(chip(/^주차 가능/));
    await screen.findByText('관광지 p0-1');
    await waitFor(() => expect(chip(/^주차 가능/)).toHaveTextContent('0'));

    expect(chip(/^주차 가능/)).toHaveClass('active');
    expect(chip(/^주차 가능/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^주차 가능/)).not.toHaveClass('is-empty');
  });

  it('칩을 누르면 속성 파라미터를 싣고 첫 쪽을 건수와 함께 다시 받는다', async () => {
    renderPage();
    await screen.findByText('관광지 a0-1');

    fireEvent.click(chip(/^반려동물 동반/));
    fireEvent.click(chip(/^반려동물 일부 구역/));
    await waitFor(() => expect(calls().at(-1)).toMatchObject({ pet: ['ALLOWED', 'PARTIAL'], page: 0, facets: true }));
  });

  it('다음 쪽은 건수를 요청하지 않고, 앞서 받은 건수를 그대로 보인다', async () => {
    renderPage();
    await screen.findByText('관광지 a0-1');
    await waitFor(() => expect(chip(/^주차 가능/)).toHaveTextContent('80'));

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    await screen.findByText('관광지 a1-1');

    const page1 = calls().find((q) => q.page === 1);
    expect(page1).toBeDefined();
    expect(page1!.facets).toBeFalsy();
    expect(chip(/^주차 가능/)).toHaveTextContent('80');
  });

  it('모바일 누적 목록은 필터가 바뀌면 처음부터 다시 쌓는다', async () => {
    mobile = true;
    stubMedia();
    renderPage();
    await screen.findByText('관광지 a0-1');
    fireEvent.click(screen.getByRole('button', { name: '더 보기' }));
    await screen.findByText('관광지 a1-1');
    expect(screen.getByText('관광지 a0-1')).toBeInTheDocument(); // 누적

    fireEvent.click(chip(/^주차 가능/));
    await screen.findByText('관광지 p0-1');

    expect(screen.queryByText('관광지 a0-1')).toBeNull();
    expect(screen.queryByText('관광지 a1-1')).toBeNull();
    expect(calls().at(-1)).toMatchObject({ parking: 'YES', page: 0, facets: true });
  });

  it('건수를 못 받으면(null) 숫자 없이 칩만 그린다 — 0 으로 흐리지 않는다', async () => {
    vi.mocked(searchAttractions).mockImplementation((q) => respond(q, () => null));
    renderPage();
    await screen.findByText('관광지 a0-1');

    expect(document.querySelectorAll('.place-attr-count')).toHaveLength(0);
    expect(document.querySelectorAll('.place-attr-chip.is-empty')).toHaveLength(0);
    expect(document.querySelectorAll('.place-attr-chip')).toHaveLength(7);
  });

  it('영문 화면은 영문 칩·안내 문구를 쓴다', async () => {
    renderPage('/en/place');
    await screen.findByText('관광지 a0-1');

    const group = screen.getByRole('group', { name: 'Visitor info filters' });
    expect(within(group).getByRole('button', { name: /^Not closed today/ })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: /^Pets in some areas/ })).toBeInTheDocument();
    expect(within(group).getByText('Filters only places that list this information')).toBeInTheDocument();
  });
});
