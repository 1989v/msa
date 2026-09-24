import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderSheetPage from '../OrderSheetPage';
import type { MyCoupon, OrderSheet } from '../../../api/shopApi';

vi.mock('../../../api/shopApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/shopApi')>();
  return {
    ...actual,
    fetchOrderSheet: vi.fn(),
    createOrderSheet: vi.fn(),
    fetchMyCoupons: vi.fn(),
    fetchMyPoints: vi.fn(),
    placeOrder: vi.fn(),
  };
});
vi.mock('../../../auth/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../auth/auth')>();
  return { ...actual, isLoggedIn: () => true };
});

import { AxiosError, AxiosHeaders } from 'axios';
import { createOrderSheet, fetchMyCoupons, fetchMyPoints, fetchOrderSheet, placeOrder } from '../../../api/shopApi';

const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

/**
 * 라인을 더하면 10,000 + 20,000 + 배송 3,000 = 33,000 이지만 서버 합계는 일부러 다르게 둔다 —
 * 화면이 합계를 스스로 계산하면 이 값들과 어긋난다.
 */
const sheet = (over: Partial<OrderSheet> = {}): OrderSheet => ({
  id: 41,
  status: 'ACTIVE',
  userCouponId: null,
  itemsAmount: 30_000,
  couponDiscount: 1_234,
  pointAmount: 500,
  shippingAmount: 3_000,
  payableAmount: 27_777,
  expiresAt: inMinutes(12),
  lines: [
    { lineNo: 1, productId: 11, productName: '한지 노트', sellerId: 7, unitPrice: 5_000, quantity: 2, amount: 10_000,
      couponDiscount: 400, couponBearer: 'PLATFORM', pointAmount: 100, payable: 9_500 },
    { lineNo: 2, productId: 12, productName: '먹 벼루', sellerId: 8, unitPrice: 20_000, quantity: 1, amount: 20_000,
      couponDiscount: 834, couponBearer: 'PLATFORM', pointAmount: 400, payable: 18_766 },
  ],
  shippingLines: [
    { sellerId: 7, fee: 3_000 },
    { sellerId: 8, fee: 0 },
  ],
  ...over,
});

const coupon: MyCoupon = {
  userCouponId: 91,
  status: 'AVAILABLE',
  usable: true,
  issuedAt: '2026-09-24T00:00:00Z',
  definition: {
    id: 5, name: '가을 맞이 3천원', type: 'FIXED', amount: 3_000, rateBp: null, maxDiscount: null, minOrderAmount: 10_000,
    validFrom: '2026-09-01T00:00:00Z', validUntil: '2026-12-01T00:00:00Z', issueLimit: 100, issuedCount: 3,
    bearer: 'PLATFORM', sellerId: null, status: 'ACTIVE',
  },
};

const renderPage = (id = '41') =>
  render(
    <MemoryRouter initialEntries={[`/shop/order-sheet/${id}`]}>
      <Routes>
        <Route path="/shop/order-sheet/:id" element={<OrderSheetPage />} />
        <Route path="/shop/orders/:id" element={<p>주문 진행 화면</p>} />
      </Routes>
    </MemoryRouter>,
  );

const PRICE_KEYS = ['price', 'unitPrice', 'amount', 'itemsAmount', 'couponDiscount', 'shippingAmount', 'payableAmount', 'payable', 'fee'];

function collectKeys(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => collectKeys(v, into));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.add(k);
      collectKeys(v, into);
    }
  }
  return into;
}

describe('주문서 화면', () => {
  beforeEach(() => {
    vi.mocked(fetchOrderSheet).mockReset();
    vi.mocked(createOrderSheet).mockReset();
    vi.mocked(placeOrder).mockReset();
    window.sessionStorage.clear();
    vi.mocked(fetchMyCoupons).mockReset().mockResolvedValue([coupon]);
    vi.mocked(fetchMyPoints).mockReset().mockResolvedValue({ memberId: 'm-1', balance: 50_000 });
  });

  it('금액 분해는 서버 값을 그대로 보여 준다 — 라인 합과 달라도 결제 금액은 payableAmount 다', async () => {
    vi.mocked(fetchOrderSheet).mockResolvedValue(sheet());
    renderPage();

    const breakdown = await screen.findByRole('group', { name: '결제 금액 분해' });
    const row = (label: string) => within(breakdown).getByText(label).closest('div') as HTMLElement;
    expect(within(row('상품 금액')).getByText('₩30,000')).toBeInTheDocument();
    expect(within(row('쿠폰 할인')).getByText('−₩1,234')).toBeInTheDocument();
    expect(within(row('포인트')).getByText('−₩500')).toBeInTheDocument();
    expect(within(row('배송비')).getByText('₩3,000')).toBeInTheDocument();
    expect(within(row('결제 금액')).getByText('₩27,777')).toBeInTheDocument();

    // 판매자별 묶음과 그 판매자 배송비
    expect(screen.getByRole('region', { name: '판매자 7' })).toHaveTextContent('배송비₩3,000');
    expect(screen.getByRole('region', { name: '판매자 8' })).toHaveTextContent('배송비무료');
    expect(screen.getByRole('button', { name: '결제하기' })).toBeEnabled();
  });

  it('만료된 주문서는 변경을 막고 같은 상품·쿠폰·포인트로 다시 만들기를 안내한다', async () => {
    vi.mocked(fetchOrderSheet).mockResolvedValue(sheet({ expiresAt: inMinutes(-1), userCouponId: 91 }));
    vi.mocked(createOrderSheet).mockResolvedValue(sheet({ id: 42, expiresAt: inMinutes(15) }));
    renderPage();

    expect(await screen.findByText('주문서가 만료되었습니다')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /가을 맞이 3천원/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '주문서 다시 만들기' }));
    await waitFor(() => expect(createOrderSheet).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createOrderSheet).mock.calls[0][0]).toEqual({
      items: [
        { productId: 11, quantity: 2 },
        { productId: 12, quantity: 1 },
      ],
      userCouponId: 91,
      pointAmount: 500,
    });
    expect(await screen.findByText(/남은 시간/)).toBeInTheDocument();
  });

  it('쿠폰을 바꾸면 주문서를 새로 요청하고 요청에는 금액 필드가 없다', async () => {
    vi.mocked(fetchOrderSheet).mockResolvedValue(sheet());
    vi.mocked(createOrderSheet).mockResolvedValue(
      sheet({ id: 43, userCouponId: 91, couponDiscount: 3_000, payableAmount: 26_500 }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole('radio', { name: /가을 맞이 3천원/ }));
    await waitFor(() => expect(createOrderSheet).toHaveBeenCalledTimes(1));
    const body = vi.mocked(createOrderSheet).mock.calls[0][0];
    expect(body).toMatchObject({ userCouponId: 91, pointAmount: 500 });
    const keys = collectKeys(body);
    for (const k of PRICE_KEYS) expect(keys.has(k), `요청에 ${k} 가 실렸다`).toBe(false);

    // 새 주문서의 서버 값으로 바뀐다
    const breakdown = screen.getByRole('group', { name: '결제 금액 분해' });
    await waitFor(() => expect(within(breakdown).getByText('₩26,500')).toBeInTheDocument());
  });

  it('결제하기 — 재시도와 새로고침 뒤에도 같은 Idempotency-Key 를 쓰고, 접수되면 진행 화면으로 간다', async () => {
    vi.mocked(fetchOrderSheet).mockResolvedValue(sheet());
    const inProgress = new AxiosError('conflict', '409', undefined, undefined, {
      status: 409, statusText: 'Conflict', headers: {}, config: { headers: new AxiosHeaders() }, data: {},
    });
    vi.mocked(placeOrder)
      .mockRejectedValueOnce(inProgress)
      .mockResolvedValueOnce({ orderId: 501, status: 'CREATED', sagaStep: 'INVENTORY_RESERVE' });

    const first = renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '결제하기' }));
    expect(await screen.findByText(/주문을 접수하고 있습니다/)).toBeInTheDocument();
    const firstKey = vi.mocked(placeOrder).mock.calls[0][1];
    expect(vi.mocked(placeOrder).mock.calls[0][0]).toBe(41);
    expect(firstKey).toMatch(/\S{8,}/);

    // 새로고침 — 화면을 새로 띄워도 sessionStorage 의 키를 그대로 쓴다
    first.unmount();
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: '결제하기' }));
    await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(2));
    expect(vi.mocked(placeOrder).mock.calls[1]).toEqual([41, firstKey]);
    expect(await screen.findByText('주문 진행 화면')).toBeInTheDocument();
  });

  it('다른 주문서(재생성)는 새 키 — sessionStorage 를 못 써도 한 화면 안의 재시도는 같은 키', async () => {
    vi.mocked(fetchOrderSheet).mockImplementation(async (id) => sheet({ id: Number(id) }));
    vi.mocked(placeOrder).mockRejectedValue(new Error('network'));
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    try {
      renderPage('77');
      const pay = await screen.findByRole('button', { name: '결제하기' });
      fireEvent.click(pay);
      await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(pay).toBeEnabled());
      fireEvent.click(pay);
      await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(2));
      const [a, b] = vi.mocked(placeOrder).mock.calls;
      expect(b[1]).toBe(a[1]);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
    // 다른 주문서는 다른 키
    const { submitKeyFor } = await import('../orderProgress');
    expect(submitKeyFor(78)).not.toBe(submitKeyFor(77));
  });
});
