import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrderWaitingPage from '../OrderWaitingPage';
import type { OrderDetail, OrderFailureReason } from '../../../api/shopApi';
import { failureCopy, pollDelay } from '../orderProgress';

vi.mock('../../../api/shopApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/shopApi')>();
  // 확정 뒤 주문 상세는 클레임 판을 붙여 클레임 목록을 묻는다 — 네트워크로 나가지 않게 빈 목록
  return { ...actual, fetchOrder: vi.fn(), cancelOrder: vi.fn(), createOrderSheet: vi.fn(), fetchClaims: vi.fn().mockResolvedValue([]) };
});
vi.mock('../../../auth/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../auth/auth')>();
  return { ...actual, isLoggedIn: () => true };
});

import { cancelOrder, createOrderSheet, fetchOrder } from '../../../api/shopApi';

const order = (over: Partial<OrderDetail> = {}): OrderDetail => ({
  orderId: 501,
  status: 'PAYMENT_PENDING',
  failureReason: null,
  sagaStep: 'PAYMENT_AUTHORIZE',
  sagaStatus: 'RUNNING',
  itemsAmount: 24_000,
  couponDiscount: 2_000,
  pointAmount: 1_000,
  shippingAmount: 3_000,
  payableAmount: 24_000,
  refundedAmount: 0,
  createdAt: '2026-09-24T12:00:00',
  lines: [
    { orderItemId: 1, lineNo: 1, productId: 11, productName: '한지 노트', sellerId: 7, unitPrice: 12_000, quantity: 2,
      couponDiscount: 2_000, pointAmount: 1_000, payable: 21_000, status: 'ACTIVE' },
  ],
  shippingLines: [{ sellerId: 7, fee: 3_000 }],
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/shop/orders/501']}>
      <Routes>
        <Route path="/shop/orders/:id" element={<OrderWaitingPage />} />
        <Route path="/shop/order-sheet/:id" element={<p>새 주문서</p>} />
      </Routes>
    </MemoryRouter>,
  );

/** 폴링 한 주기(1.5초)를 넘기고 그 사이 약속이 풀리게 한다 */
async function nextPoll(ms = 1_500) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('결제 대기 화면', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.mocked(fetchOrder).mockReset();
    vi.mocked(cancelOrder).mockReset();
    vi.mocked(createOrderSheet).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('1.5초마다 조회하다 확정(CONFIRMED)에 닿으면 폴링을 멈추고 성공 판을 보인다', async () => {
    vi.mocked(fetchOrder)
      .mockResolvedValueOnce(order({ status: 'CREATED', sagaStep: 'INVENTORY_RESERVE' }))
      .mockResolvedValueOnce(order())
      .mockResolvedValueOnce(order({ status: 'CONFIRMED', sagaStep: 'FULFILLMENT_CREATE' }))
      .mockResolvedValue(order({ status: 'FULFILLING', sagaStep: 'FULFILLMENT_CREATE', sagaStatus: 'COMPLETED' }));
    renderPage();

    await nextPoll(0);
    expect(fetchOrder).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('재고 확보');
    // 결제 전(CREATED)에만 취소 버튼
    expect(screen.getByRole('button', { name: '주문 취소' })).toBeInTheDocument();

    await nextPoll();
    expect(fetchOrder).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('결제 승인');
    expect(screen.queryByRole('button', { name: '주문 취소' })).not.toBeInTheDocument();

    await nextPoll();
    expect(fetchOrder).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('주문이 확정되었습니다');

    await nextPoll(30_000);
    expect(fetchOrder).toHaveBeenCalledTimes(3);
  });

  it('60초가 지나면 5초 간격으로 늦추고 안내를 띄운다', async () => {
    expect(pollDelay(59_999)).toBe(1_500);
    expect(pollDelay(60_000)).toBe(5_000);
    vi.mocked(fetchOrder).mockResolvedValue(order());
    renderPage();
    await nextPoll(0);
    await nextPoll(61_500);
    const calls = vi.mocked(fetchOrder).mock.calls.length;
    expect(screen.getByText(/평소보다 오래 걸리고 있습니다/)).toBeInTheDocument();
    await nextPoll(1_500);
    expect(fetchOrder).toHaveBeenCalledTimes(calls); // 1.5초로는 더 부르지 않는다
    await nextPoll(3_500);
    expect(fetchOrder).toHaveBeenCalledTimes(calls + 1);
  });

  it('실패(BENEFIT_UNAVAILABLE)는 폴링을 멈추고 사유와 "주문서 다시 만들기" — 같은 상품·수량, 혜택은 비운다', async () => {
    vi.useRealTimers();
    vi.mocked(fetchOrder).mockResolvedValue(order({ status: 'FAILED', failureReason: 'BENEFIT_UNAVAILABLE', sagaStatus: 'FAILED' }));
    vi.mocked(createOrderSheet).mockResolvedValue({ id: 88 } as never);
    renderPage();

    expect(await screen.findByText('쿠폰이나 포인트를 쓸 수 없습니다')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '주문서 다시 만들기' }));
    await waitFor(() => expect(createOrderSheet).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createOrderSheet).mock.calls[0][0]).toEqual({
      items: [{ productId: 11, quantity: 2 }],
      userCouponId: null,
      pointAmount: 0,
    });
    expect(await screen.findByText('새 주문서')).toBeInTheDocument();
    expect(fetchOrder).toHaveBeenCalledTimes(1);
  });

  it('실패 사유마다 제목과 다음 행동이 정해져 있다 — 재생성은 BENEFIT_UNAVAILABLE 뿐', () => {
    const reasons: OrderFailureReason[] = [
      'INSUFFICIENT_STOCK', 'BENEFIT_UNAVAILABLE', 'PAYMENT_DECLINED', 'HOLD_EXPIRED', 'TIMEOUT', 'BUYER_CANCELLED',
    ];
    const copies = reasons.map((r) => failureCopy('FAILED', r));
    expect(new Set(copies.map((c) => c.title)).size).toBe(reasons.length);
    expect(reasons.filter((r) => failureCopy('FAILED', r).action === 'recreate-sheet')).toEqual(['BENEFIT_UNAVAILABLE']);
    expect(failureCopy('FAILED', 'HOLD_EXPIRED').body).toMatch(/청구되지 않습니다/);
    expect(failureCopy('CANCELLED', null).title).toBe('주문을 취소했습니다');
    expect(failureCopy('FAILED', null).title).toBe('주문을 완료하지 못했습니다');
  });

  it('주문 취소는 CREATED 에서만 — 누르면 취소 요청 뒤 결론까지 다시 폴링한다', async () => {
    vi.useRealTimers();
    vi.mocked(fetchOrder)
      .mockResolvedValueOnce(order({ status: 'CREATED', sagaStep: 'PROMOTION_RESERVE' }))
      .mockResolvedValue(order({ status: 'CANCELLED', failureReason: null, sagaStatus: 'FAILED' }));
    vi.mocked(cancelOrder).mockResolvedValue(order({ status: 'CREATED', sagaStatus: 'COMPENSATING', sagaStep: 'PROMOTION_CANCEL' }));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '주문 취소' }));
    await waitFor(() => expect(cancelOrder).toHaveBeenCalledWith(501));
    expect(await screen.findByText('주문을 취소했습니다')).toBeInTheDocument();
  });
});
