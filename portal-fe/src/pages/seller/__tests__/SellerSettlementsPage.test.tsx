import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import SellerSettlementsPage from '../SellerSettlementsPage';
import { formatPeriod } from '../settlementFormat';
import type { SettlementStatement } from '../../../api/shopApi';

vi.mock('../../../api/shopApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/shopApi')>();
  return { ...actual, fetchSellerSettlements: vi.fn(), fetchSellerSettlement: vi.fn() };
});
vi.mock('../../../auth/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../auth/auth')>();
  return { ...actual, isLoggedIn: () => true };
});

import { fetchSellerSettlement, fetchSellerSettlements } from '../../../api/shopApi';

const statement = (over: Partial<SettlementStatement>): SettlementStatement => ({
  id: 3, sellerId: 7, periodStart: '2026-09-21', periodEnd: '2026-09-27',
  includedFrom: '2026-09-24T03:00:00Z', includedTo: '2026-09-24T03:00:00Z', status: 'PAID',
  netSales: 24_000, shippingFee: 3_000, commission: 2_400, payout: 24_600, payoutReference: 'MOCK-PAYOUT-7-3',
  lineCount: 2, createdAt: '2026-09-27T20:30:00Z', confirmedAt: '2026-09-27T20:30:00Z', paidAt: '2026-09-27T20:30:00Z',
  carriedOverAt: null, lines: null, ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <SellerSettlementsPage />
    </MemoryRouter>,
  );

describe('판매자 정산서', () => {
  beforeEach(() => {
    vi.mocked(fetchSellerSettlements).mockReset();
    vi.mocked(fetchSellerSettlement).mockReset();
  });

  it('기간·상태·순매출·배송비·수수료·지급액을 서버 값 그대로 보이고, 이월은 이월이라고 쓴다', async () => {
    vi.mocked(fetchSellerSettlements).mockResolvedValue([
      statement({}),
      statement({ id: 2, periodStart: '2026-09-14', periodEnd: '2026-09-20', status: 'CARRIED_OVER', netSales: 0, shippingFee: 0, commission: 0, payout: 0, lineCount: 1 }),
    ]);
    renderPage();

    expect(await screen.findByText('2026.09.21 ~ 09.27')).toBeInTheDocument();
    expect(screen.getByText('지급 완료')).toBeInTheDocument();
    expect(screen.getByText('순매출 ₩24,000 · 배송비 ₩3,000 · 수수료 ₩2,400')).toBeInTheDocument();
    expect(screen.getByText('지급 ₩24,600')).toBeInTheDocument();
    expect(screen.getByText('다음 기간으로 이월')).toBeInTheDocument();
  });

  it('명세를 열면 그 정산서를 불러와 라인·배송비 줄을 보인다', async () => {
    vi.mocked(fetchSellerSettlements).mockResolvedValue([statement({})]);
    vi.mocked(fetchSellerSettlement).mockResolvedValue(
      statement({
        lines: [
          { kind: 'LINE', orderId: 501, orderItemId: 11, netSales: 24_000, commission: 2_400, shippingFee: 0, payout: 21_600, confirmedAt: '2026-09-24T03:00:00Z' },
          { kind: 'SHIPPING', orderId: 501, orderItemId: null, netSales: 0, commission: 0, shippingFee: 3_000, payout: 3_000, confirmedAt: '2026-09-24T03:00:00Z' },
        ],
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '명세 2건' }));
    await waitFor(() => expect(fetchSellerSettlement).toHaveBeenCalledWith(3));
    expect(await screen.findByText('주문 501 · 라인 11')).toBeInTheDocument();
    expect(screen.getByText('순매출 ₩24,000 − 수수료 ₩2,400')).toBeInTheDocument();
    expect(screen.getByText('주문 501 · 배송비')).toBeInTheDocument();
    expect(screen.getByText('배송비 ₩3,000 (수수료 없음)')).toBeInTheDocument();
  });

  it('ACTIVE 판매자가 아니면(403) 안내한다', async () => {
    vi.mocked(fetchSellerSettlements).mockRejectedValue(
      new AxiosError('forbidden', '403', undefined, undefined, {
        status: 403, statusText: 'Forbidden', data: {}, headers: {}, config: { headers: new AxiosHeaders() },
      }),
    );
    renderPage();
    expect(await screen.findByText('승인된(ACTIVE) 판매자만 정산서를 볼 수 있습니다.')).toBeInTheDocument();
  });

  it('이월·지각 항목이 있으면 명목 기간과 별개로 실제 포함 확정일(KST)을 보인다', async () => {
    vi.mocked(fetchSellerSettlements).mockResolvedValue([
      // 09-10 이월분 ~ 09-27 14:59Z(= 09-27 23:59 KST)
      statement({ includedFrom: '2026-09-10T00:00:00Z', includedTo: '2026-09-27T14:59:00Z' }),
    ]);
    renderPage();

    expect(await screen.findByText('2026.09.21 ~ 09.27')).toBeInTheDocument();
    expect(screen.getByText('실제 포함 확정일 2026.09.10 ~ 09.27')).toBeInTheDocument();
  });

  it('기간 표기 — 해가 바뀌면 끝 날짜에도 연도를 쓴다', () => {
    expect(formatPeriod('2026-12-01', '2026-12-31')).toBe('2026.12.01 ~ 12.31');
    expect(formatPeriod('2026-12-28', '2027-01-03')).toBe('2026.12.28 ~ 2027.01.03');
  });
});
