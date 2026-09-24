import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderClaimPanel from '../OrderClaimPanel';
import type { Claim, ClaimPreview, OrderDetail } from '../../../api/shopApi';

vi.mock('../../../api/shopApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/shopApi')>();
  return { ...actual, fetchClaims: vi.fn(), previewClaim: vi.fn(), requestClaim: vi.fn(), confirmPurchase: vi.fn() };
});

import { confirmPurchase, fetchClaims, previewClaim, requestClaim } from '../../../api/shopApi';

const order = (over: Partial<OrderDetail> = {}): OrderDetail => ({
  orderId: 501,
  status: 'FULFILLING',
  failureReason: null,
  sagaStep: 'FULFILLMENT_CREATE',
  sagaStatus: 'COMPLETED',
  itemsAmount: 33_000,
  couponDiscount: 3_000,
  pointAmount: 1_500,
  shippingAmount: 5_500,
  payableAmount: 34_000,
  refundedAmount: 0,
  createdAt: '2026-09-24T12:00:00',
  lines: [
    { orderItemId: 1, lineNo: 1, productId: 101, productName: '머그', sellerId: 7, unitPrice: 10_000, quantity: 2,
      couponDiscount: 2_000, pointAmount: 1_000, payable: 17_000, status: 'ACTIVE' },
    { orderItemId: 2, lineNo: 2, productId: 102, productName: '받침', sellerId: 7, unitPrice: 5_000, quantity: 1,
      couponDiscount: 0, pointAmount: 500, payable: 4_500, status: 'ACTIVE' },
  ],
  shippingLines: [{ sellerId: 7, fee: 3_000 }],
  ...over,
});

const claim = (over: Partial<Claim> = {}): Claim => ({
  claimId: 9, orderId: 501, sellerId: 7, lineNos: [1], status: 'REQUESTED', step: 'FULFILLMENT_CANCEL', goodsShipped: false,
  refundAmount: null, pointRestore: null, shippingRefund: null, fullCancel: null, rejectReason: null, stuck: false,
  requestedAt: '2026-09-24T12:00:00Z', ...over,
});

// 서버가 준 값 그대로 보이는지 — 라인 결제액 합과 일부러 다른 값을 둬서 FE 가 계산하면 드러나게 한다
const partialPreview: ClaimPreview = {
  orderId: 501,
  lines: [{ lineNo: 1, productName: '머그', sellerId: 7, payable: 17_000, pointAmount: 1_000, shipped: false }],
  pointRestore: 1_000, shippingRefund: 0, refundAmount: 16_990, fullCancel: false, couponReturn: false, needsSellerApproval: false,
};

describe('주문 상세 — 취소 · 구매 확정', () => {
  beforeEach(() => {
    vi.mocked(fetchClaims).mockReset().mockResolvedValue([]);
    vi.mocked(previewClaim).mockReset();
    vi.mocked(requestClaim).mockReset();
    vi.mocked(confirmPurchase).mockReset();
  });

  it('고른 라인만 서버 미리보기를 받아 그 금액을 보이고, 부분 취소는 쿠폰 할인 유지로 안내한 뒤 그 라인으로 요청한다', async () => {
    vi.mocked(previewClaim).mockResolvedValue(partialPreview);
    vi.mocked(requestClaim).mockResolvedValue([claim()]);
    render(<OrderClaimPanel order={order()} onOrderChanged={vi.fn()} />);

    const selectOne = await screen.findByRole('button', { name: '선택 상품 취소' });
    expect(selectOne).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /머그/ }));
    fireEvent.click(selectOne);

    const preview = await screen.findByRole('group', { name: '환불 금액 분해' });
    expect(previewClaim).toHaveBeenCalledWith(501, [1]);
    expect(within(preview).getByText('₩16,990')).toBeInTheDocument();
    expect(within(preview).getByText('할인 유지 · 돌려받지 않음')).toBeInTheDocument();
    expect(within(preview).getByText('포인트로 돌려받음')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '선택 상품 취소 요청' }));
    await waitFor(() => expect(requestClaim).toHaveBeenCalledWith(501, [1]));
  });

  it('전체 취소는 라인 없이(null) 미리보기·요청하고 쿠폰 반환을 안내한다', async () => {
    vi.mocked(previewClaim).mockResolvedValue({ ...partialPreview, fullCancel: true, couponReturn: true, refundAmount: 34_000 });
    vi.mocked(requestClaim).mockResolvedValue([claim({ lineNos: [1, 2] })]);
    render(<OrderClaimPanel order={order()} onOrderChanged={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: '전체 취소' }));
    const preview = await screen.findByRole('group', { name: '환불 금액 분해' });
    expect(previewClaim).toHaveBeenCalledWith(501, null);
    expect(within(preview).getByText('돌려받음(사용 기간 내)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '전체 취소 요청' }));
    await waitFor(() => expect(requestClaim).toHaveBeenCalledWith(501, null));
  });

  it('출고 뒤 취소는 판매자 확인 중으로 보이고, 진행 중 클레임이 있으면 그 라인은 고를 수 없고 구매 확정 버튼이 없다', async () => {
    vi.mocked(fetchClaims).mockResolvedValue([claim({ step: 'SELLER_DECISION' })]);
    render(<OrderClaimPanel order={order()} onOrderChanged={vi.fn()} />);

    expect(await screen.findByText('판매자 확인 중 · 이미 출고')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /머그/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /받침/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '구매 확정' })).not.toBeInTheDocument();
  });

  it('이행 중이고 진행 중 클레임이 없으면 구매 확정 — 끝나면 주문을 다시 불러오게 한다', async () => {
    vi.mocked(fetchClaims).mockResolvedValue([claim({ status: 'REFUNDED', step: 'DONE', refundAmount: 17_000, pointRestore: 1_000 })]);
    vi.mocked(confirmPurchase).mockResolvedValue({ orderId: 501, confirmedLineNos: [2] });
    const onOrderChanged = vi.fn();
    const partlyCancelled = order({
      refundedAmount: 17_000,
      lines: order().lines.map((l) => (l.lineNo === 1 ? { ...l, status: 'CANCELLED' } : l)),
    });
    render(<OrderClaimPanel order={partlyCancelled} onOrderChanged={onOrderChanged} />);

    expect(await screen.findByText('환불 ₩17,000 · 포인트 ₩1,000 원복')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '구매 확정' }));
    await waitFor(() => expect(confirmPurchase).toHaveBeenCalledWith(501));
    expect(onOrderChanged).toHaveBeenCalled();
  });
});
