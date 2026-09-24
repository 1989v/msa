import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError, type AxiosResponse } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdsConsolePage, { type ConsoleView } from '../AdsConsolePage';
import * as api from '../../../api/adsConsoleApi';
import * as auth from '../../../auth/auth';
import type { AdvertiserDashboard, Campaign, Catalog, Creative } from '../../../api/adsConsoleApi';

vi.mock('../../../api/adsConsoleApi', async () => {
  const actual = await vi.importActual<typeof api>('../../../api/adsConsoleApi');
  return {
    ...actual,
    fetchAdvertiserMe: vi.fn(),
    fetchCampaigns: vi.fn(),
    fetchCampaign: vi.fn(),
    fetchCreatives: vi.fn(),
    fetchReport: vi.fn(),
    fetchCatalog: vi.fn(),
    createCampaign: vi.fn(),
    topUp: vi.fn(),
  };
});

vi.mock('../../../auth/auth', async () => {
  const actual = await vi.importActual<typeof auth>('../../../auth/auth');
  return { ...actual, isLoggedIn: vi.fn() };
});

const advertiser = (over: Partial<AdvertiserDashboard> = {}): AdvertiserDashboard => ({
  advertiserId: 7,
  displayName: '원서 모임',
  status: 'ACTIVE',
  suspendReason: null,
  balanceMicros: 382_400_000,
  todaySpendMicros: 17_600_000,
  todayChargedMicros: 15_200_000,
  todayTopUpMicros: 100_000_000,
  dailyTopUpLimitMicros: 500_000_000,
  maxTopUpPerCallMicros: 100_000_000,
  ...over,
});

// 광고주가 적은 문자열 — HTML 로 해석되면 <b>·<img> 요소가 생긴다
const HOSTILE_NAME = '<img src=x onerror=alert(1)> 가을 모집';
const HOSTILE_TITLE = '<b>굵게</b> 원서 읽기';

const campaign: Campaign = {
  id: 11,
  name: HOSTILE_NAME,
  status: 'ACTIVE',
  bidType: 'CPC',
  bidMicros: 300_000,
  dailyBudgetMicros: 20_000_000,
  totalBudgetMicros: null,
  startAt: '2026-09-01T00:00:00',
  endAt: null,
  frequencyCapPerDay: 3,
  placementKeys: ['blog-post-end'],
  categoryCodes: [],
  inPeriod: true,
};

const creative: Creative = {
  id: 21,
  campaignId: 11,
  status: 'REJECTED',
  title: HOSTILE_TITLE,
  body: '한 달에 한 권',
  landingUrl: 'https://example.com',
  imageUrl: null,
  rejectReason: 'MISLEADING',
  reviewedAt: '2026-09-20T10:00:00',
};

const catalog: Catalog = {
  placements: [
    {
      key: 'blog-post-end',
      host: 'blog.1989v.com',
      format: 'CARD',
      aspectRatios: ['1.91:1'],
      floorMicros: 2_000_000,
      description: '블로그 글 끝',
      averageDailyRequests: 1200,
    },
  ],
  categories: [{ code: 'tech', label: '기술' }],
};

function serverError(message: string): AxiosError {
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 400,
    data: { success: false, data: null, error: { code: 'INVALID_INPUT', message } },
  } as AxiosResponse);
}

/** 응답이 오지 않은 실패 — 서버에 충전이 기록됐는지 알 수 없다 */
function timeoutError(): AxiosError {
  return new AxiosError('timeout of 10000ms exceeded', 'ECONNABORTED');
}

function renderConsole(view: ConsoleView, path = '/ads') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AdsConsolePage view={view} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth.isLoggedIn).mockReturnValue(true);
  vi.mocked(api.fetchAdvertiserMe).mockResolvedValue(advertiser());
  vi.mocked(api.fetchCampaigns).mockResolvedValue([campaign]);
  vi.mocked(api.fetchCreatives).mockResolvedValue([creative]);
  vi.mocked(api.fetchReport).mockResolvedValue([]);
  vi.mocked(api.fetchCatalog).mockResolvedValue(catalog);
  vi.mocked(api.topUp).mockReset();
  vi.mocked(api.createCampaign).mockReset();
});

afterEach(() => {
  document.head.querySelector('meta[name="robots"]')?.remove();
});

describe('광고주 콘솔 — 색인과 첫 화면', () => {
  it('콘솔은 색인하지 않는다 — robots 메타가 noindex 다', async () => {
    renderConsole('dashboard');
    await screen.findByText('잔액');
    const robots = document.head.querySelector('meta[name="robots"]');
    expect(robots?.getAttribute('content')).toMatch(/noindex/);
  });

  it('비로그인이면 apex 로그인으로 보내고 돌아올 주소를 싣는다 — 광고주 API 는 부르지 않는다', async () => {
    vi.mocked(auth.isLoggedIn).mockReturnValue(false);
    const replaced: string[] = [];
    const original = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, href: 'http://localhost/ads', replace: (to: string) => replaced.push(to) },
    });
    try {
      renderConsole('dashboard');
      expect(await screen.findByText('로그인이 필요합니다')).toBeInTheDocument();
      await waitFor(() => expect(replaced).toHaveLength(1));
    } finally {
      if (original) Object.defineProperty(window, 'location', original);
    }
    expect(replaced[0]).toContain('/login?next=');
    expect(decodeURIComponent(replaced[0])).toContain('http://localhost/ads');
    expect(api.fetchAdvertiserMe).not.toHaveBeenCalled();
  });

  it('로그인했지만 광고주가 아니면 등록 화면이 뜬다', async () => {
    vi.mocked(api.fetchAdvertiserMe).mockResolvedValue(null);
    renderConsole('dashboard');
    expect(await screen.findByRole('heading', { name: '광고주 등록' })).toBeInTheDocument();
    expect(screen.queryByText('잔액')).not.toBeInTheDocument();
  });

  it('정지된 광고주는 읽기 전용 안내와 사유를 보고, 충전·새 캠페인 입구가 없다', async () => {
    vi.mocked(api.fetchAdvertiserMe).mockResolvedValue(
      advertiser({ status: 'SUSPENDED', suspendReason: '랜딩 불일치 반복' }),
    );
    renderConsole('dashboard');
    const notice = await screen.findByText('정지된 광고주입니다.');
    expect(notice.closest('[role="status"]')).toHaveTextContent('사유: 랜딩 불일치 반복');
    expect(screen.getByText('잔액')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '충전' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '새 캠페인' })).not.toBeInTheDocument();
  });
});

describe('광고주 콘솔 — 대시보드', () => {
  it('광고주 문자열은 텍스트로만 그린다 — HTML 로 해석하지 않는다', async () => {
    const { container } = renderConsole('dashboard');
    expect(await screen.findByText(HOSTILE_NAME, { selector: 'a' })).toBeInTheDocument();
    expect(await screen.findByText(HOSTILE_TITLE)).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    // 반려 사유는 그 줄 아래에 적는다
    expect(screen.getByText('허위·과장')).toBeInTheDocument();
  });

  it('금액 곁에는 늘 「가상 크레딧 — 실제 결제 없음」이 붙는다', async () => {
    renderConsole('dashboard');
    await screen.findByText('잔액');
    const kpis = screen.getByText('잔액').closest('.adc-kpis') as HTMLElement;
    expect(within(kpis).getAllByText(api.VIRTUAL_CREDIT_NOTE)).toHaveLength(3);
  });

  it('잔액 곁에 오늘 충전 가능 금액(하루 한도 − 오늘 충전)과 하루 한도를 보여 준다', async () => {
    renderConsole('dashboard');
    const balance = (await screen.findByText('잔액')).closest('.adc-kpi') as HTMLElement;
    expect(balance).toHaveTextContent('오늘 충전 가능 400.00 / 500.00 크레딧');
  });
});

describe('광고주 콘솔 — 충전', () => {
  it('성공한 뒤의 다음 충전은 새 멱등 키로, 마이크로 금액과 함께 보낸다', async () => {
    vi.mocked(api.topUp).mockResolvedValue({ transactionId: 1, balanceMicros: 432_400_000 });
    renderConsole('top-up', '/top-up');
    const input = await screen.findByLabelText('충전할 크레딧');

    await userEvent.type(input, '50');
    await userEvent.click(screen.getByRole('button', { name: '충전' }));
    expect(await screen.findByText(/충전했습니다/)).toBeInTheDocument();

    await userEvent.type(input, '50');
    await userEvent.click(screen.getByRole('button', { name: '충전' }));
    await waitFor(() => expect(api.topUp).toHaveBeenCalledTimes(2));

    const [[firstMicros, firstKey], [, secondKey]] = vi.mocked(api.topUp).mock.calls;
    expect(firstMicros).toBe(50_000_000);
    expect(firstKey).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(secondKey).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(secondKey).not.toBe(firstKey);
  });

  it('응답 없이 실패하면 다시 누를 때 같은 키·같은 금액으로 보내고, 성공한 뒤에야 새 키를 쓴다', async () => {
    vi.mocked(api.topUp)
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce({ transactionId: 1, balanceMicros: 432_400_000 })
      .mockResolvedValueOnce({ transactionId: 2, balanceMicros: 462_400_000 });
    renderConsole('top-up', '/top-up');
    const input = await screen.findByLabelText('충전할 크레딧');

    await userEvent.type(input, '50');
    await userEvent.click(screen.getByRole('button', { name: '충전' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('충전 결과를 확인하지 못했습니다');
    // 결과를 모르는 동안 금액은 바꿀 수 없다 — 같은 키에 다른 금액을 보내면 서버는 앞 거래를 돌려준다
    expect(input).toHaveAttribute('readonly');

    await userEvent.click(screen.getByRole('button', { name: '충전' }));
    expect(await screen.findByText(/충전했습니다/)).toBeInTheDocument();

    await userEvent.type(input, '30');
    await userEvent.click(screen.getByRole('button', { name: '충전' }));
    await waitFor(() => expect(api.topUp).toHaveBeenCalledTimes(3));

    const [[firstMicros, firstKey], [retryMicros, retryKey], [nextMicros, nextKey]] = vi.mocked(api.topUp).mock.calls;
    expect(retryKey).toBe(firstKey);
    expect(retryMicros).toBe(firstMicros);
    expect(nextMicros).toBe(30_000_000);
    expect(nextKey).not.toBe(firstKey);
  });

  it('확정 거절(4xx) 뒤에는 새 키로 보낸다', async () => {
    vi.mocked(api.topUp)
      .mockRejectedValueOnce(serverError('오늘 충전 한도(500 크레딧)를 넘습니다'))
      .mockResolvedValueOnce({ transactionId: 3, balanceMicros: 392_400_000 });
    renderConsole('top-up', '/top-up');
    const input = await screen.findByLabelText('충전할 크레딧');

    await userEvent.type(input, '100');
    await userEvent.click(screen.getByRole('button', { name: '충전' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('오늘 충전 한도(500 크레딧)를 넘습니다');
    expect(input).not.toHaveAttribute('readonly');

    await userEvent.clear(input);
    await userEvent.type(input, '10');
    await userEvent.click(screen.getByRole('button', { name: '충전' }));
    await waitFor(() => expect(api.topUp).toHaveBeenCalledTimes(2));
    const [[, firstKey], [secondMicros, secondKey]] = vi.mocked(api.topUp).mock.calls;
    expect(secondMicros).toBe(10_000_000);
    expect(secondKey).not.toBe(firstKey);
  });

  it('충전 화면에 오늘 충전 가능 금액과 1회 최대를 보여 준다', async () => {
    renderConsole('top-up', '/top-up');
    const hint = await screen.findByText(/오늘 충전 가능/);
    expect(hint).toHaveTextContent('오늘 충전 가능 400.00 / 500.00 크레딧 · 1회 최대 100.00 크레딧');
  });

  it('서버가 거절한 이유를 그대로 보여 준다', async () => {
    vi.mocked(api.topUp).mockRejectedValue(serverError('하루 충전 한도를 넘습니다'));
    renderConsole('top-up', '/top-up');
    await userEvent.type(await screen.findByLabelText('충전할 크레딧'), '600');
    await userEvent.click(screen.getByRole('button', { name: '충전' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('하루 충전 한도를 넘습니다');
  });
});

describe('광고주 콘솔 — 캠페인 편집', () => {
  it('저장 불변식 위반은 서버 문구로 보여 주고, 입력은 카탈로그에서 고른 지면과 마이크로 금액으로 보낸다', async () => {
    vi.mocked(api.createCampaign).mockRejectedValue(serverError('CPM 입찰가가 지면 최저가보다 낮습니다'));
    renderConsole('campaign-new', '/campaigns/new');

    await userEvent.type(await screen.findByLabelText('캠페인 이름'), '가을 모집');
    await userEvent.type(screen.getByLabelText('입찰가'), '1.5');
    await userEvent.type(screen.getByLabelText('일예산'), '20');
    await userEvent.click(await screen.findByRole('checkbox', { name: /블로그 글 끝/ }));
    await userEvent.click(screen.getByRole('button', { name: '만들기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('CPM 입찰가가 지면 최저가보다 낮습니다');
    const [input] = vi.mocked(api.createCampaign).mock.calls[0];
    expect(input).toMatchObject({
      name: '가을 모집',
      bidType: 'CPM',
      bidMicros: 1_500_000,
      dailyBudgetMicros: 20_000_000,
      placementKeys: ['blog-post-end'],
      frequencyCapPerDay: 3,
    });
  });
});
