import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import SellerClaimsPage from '../SellerClaimsPage';
import type { Claim } from '../../../api/shopApi';

vi.mock('../../../api/shopApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/shopApi')>();
  return { ...actual, fetchSellerClaims: vi.fn(), approveSellerClaim: vi.fn(), rejectSellerClaim: vi.fn() };
});
vi.mock('../../../auth/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../auth/auth')>();
  return { ...actual, isLoggedIn: () => true };
});

import { approveSellerClaim, fetchSellerClaims, rejectSellerClaim } from '../../../api/shopApi';

const claim = (over: Partial<Claim>): Claim => ({
  claimId: 9, orderId: 501, sellerId: 7, lineNos: [3], status: 'REQUESTED', step: 'SELLER_DECISION', goodsShipped: false,
  refundAmount: null, pointRestore: null, shippingRefund: null, fullCancel: null, rejectReason: null, stuck: false,
  requestedAt: '2026-09-24T12:00:00Z', ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <SellerClaimsPage />
    </MemoryRouter>,
  );

describe('판매자 취소 요청', () => {
  beforeEach(() => {
    vi.mocked(fetchSellerClaims).mockReset();
    vi.mocked(approveSellerClaim).mockReset();
    vi.mocked(rejectSellerClaim).mockReset();
  });

  it('출고 뒤 취소 요청만 승인·반려 버튼이 있고, 승인하면 그 클레임을 승인한 뒤 목록을 다시 부른다', async () => {
    vi.mocked(fetchSellerClaims).mockResolvedValue([
      claim({}),
      claim({ claimId: 8, status: 'REFUNDED', step: 'DONE', refundAmount: 7_000 }),
    ]);
    vi.mocked(approveSellerClaim).mockResolvedValue(claim({ status: 'APPROVED', step: 'PAYMENT_REFUND' }));
    renderPage();

    const approve = await screen.findAllByRole('button', { name: '반품 확인 · 승인' });
    expect(approve).toHaveLength(1);
    expect(screen.getByText('환불 ₩7,000')).toBeInTheDocument();
    fireEvent.click(approve[0]);
    await waitFor(() => expect(approveSellerClaim).toHaveBeenCalledWith(9));
    await waitFor(() => expect(fetchSellerClaims).toHaveBeenCalledTimes(2));
  });

  it('반려는 사유가 있어야 보낸다', async () => {
    vi.mocked(fetchSellerClaims).mockResolvedValue([claim({})]);
    vi.mocked(rejectSellerClaim).mockResolvedValue(claim({ status: 'REJECTED', step: 'DONE', rejectReason: '사용 흔적' }));
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '반려' }));
    const submit = screen.getByRole('button', { name: '반려하기' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('반려 사유'), { target: { value: '사용 흔적' } });
    fireEvent.click(submit);
    await waitFor(() => expect(rejectSellerClaim).toHaveBeenCalledWith(9, '사용 흔적'));
  });

  it('ACTIVE 판매자가 아니면(403) 안내한다', async () => {
    vi.mocked(fetchSellerClaims).mockRejectedValue(
      new AxiosError('forbidden', '403', undefined, undefined, {
        status: 403, statusText: 'Forbidden', data: {}, headers: {}, config: { headers: new AxiosHeaders() },
      }),
    );
    renderPage();
    expect(await screen.findByText('승인된(ACTIVE) 판매자만 취소 요청을 볼 수 있습니다.')).toBeInTheDocument();
  });
});
