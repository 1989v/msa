import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SellerProductsPage from '../SellerProductsPage';
import type { ProductSummary, SellerApplication, SellerProfile } from '../../../api/shopApi';

vi.mock('../../../api/shopApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/shopApi')>();
  return {
    ...actual,
    fetchMySellerApplication: vi.fn(),
    fetchMySeller: vi.fn(),
    fetchSellerProducts: vi.fn(),
  };
});
vi.mock('../../../auth/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../auth/auth')>();
  return { ...actual, isLoggedIn: () => true };
});

import { fetchMySeller, fetchMySellerApplication, fetchSellerProducts } from '../../../api/shopApi';

const application = (over: Partial<SellerApplication>): SellerApplication => ({
  id: 7,
  status: 'ACTIVE',
  businessName: '한지상회',
  businessRegistrationNo: '1234567890',
  representativeName: '홍길동',
  bankName: '국민은행',
  accountMasked: '******4567',
  shippingFee: 3000,
  settlementCycle: 'WEEKLY',
  commissionRateBp: 1000,
  rejectReason: null,
  suspendReason: null,
  appliedAt: '2026-09-24T00:00:00Z',
  updatedAt: '2026-09-24T00:00:00Z',
  ...over,
});

const me: SellerProfile = { ...application({}), memberId: 'm-7' };

const product = (id: number, name: string): ProductSummary => ({
  id,
  name,
  price: 1000,
  status: 'ACTIVE',
  stock: 3,
  createdAt: '2026-09-24T00:00:00',
  sellerId: 7,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <SellerProductsPage />
    </MemoryRouter>,
  );

describe('판매자 상품 화면', () => {
  beforeEach(() => {
    vi.mocked(fetchMySellerApplication).mockReset();
    vi.mocked(fetchMySeller).mockReset().mockResolvedValue(me);
    vi.mocked(fetchSellerProducts)
      .mockReset()
      .mockResolvedValue({ products: [product(1, '내 한지 노트'), product(4, '내 벼루')], totalElements: 2, totalPages: 1 });
  });

  it('ACTIVE 면 판매자 전용 내 상품 목록을 한 번 묻고 그 상품을 보여 준다', async () => {
    vi.mocked(fetchMySellerApplication).mockResolvedValue(application({}));
    renderPage();
    expect(await screen.findByText('내 한지 노트')).toBeInTheDocument();
    expect(screen.getByText('내 벼루')).toBeInTheDocument();
    expect(screen.getByText('승인됨')).toBeInTheDocument();
    expect(fetchSellerProducts).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchSellerProducts).mock.calls[0][0]).toBe(0);
  });

  it('판매 중지된 상품도 목록에 남고 상태 표시가 붙는다', async () => {
    vi.mocked(fetchMySellerApplication).mockResolvedValue(application({}));
    vi.mocked(fetchSellerProducts).mockResolvedValue({
      products: [product(4, '내 벼루'), { ...product(1, '중지된 붓'), status: 'INACTIVE' }],
      totalElements: 2,
      totalPages: 1,
    });
    renderPage();
    const stopped = (await screen.findByText('중지된 붓')).closest('li');
    expect(stopped).toHaveTextContent('판매 중지');
    expect(screen.getByText('내 벼루').closest('li')).toHaveTextContent('판매 중');
  });

  it('반려면 상태·반려 사유·재신청 링크를 보여 주고 판매자 포털과 상품 목록은 부르지 않는다', async () => {
    vi.mocked(fetchMySellerApplication).mockResolvedValue(
      application({ status: 'REJECTED', rejectReason: '사업자번호 불일치', commissionRateBp: null }),
    );
    renderPage();
    expect(await screen.findByText('반려됨')).toBeInTheDocument();
    expect(screen.getByText('사업자번호 불일치')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '다시 신청하기' })).toHaveAttribute('href', '/shop/seller/apply');
    expect(fetchMySeller).not.toHaveBeenCalled();
    expect(fetchSellerProducts).not.toHaveBeenCalled();
  });

  it('정지·심사 중·미신청도 각자의 상태로 갈린다', async () => {
    vi.mocked(fetchMySellerApplication).mockResolvedValue(
      application({ status: 'SUSPENDED', suspendReason: '허위 표시' }),
    );
    const { unmount } = renderPage();
    expect(await screen.findByText('정지됨')).toBeInTheDocument();
    expect(screen.getByText('허위 표시')).toBeInTheDocument();
    unmount();

    vi.mocked(fetchMySellerApplication).mockResolvedValue(application({ status: 'PENDING', commissionRateBp: null }));
    const second = renderPage();
    expect(await screen.findByText('심사 중')).toBeInTheDocument();
    second.unmount();

    vi.mocked(fetchMySellerApplication).mockResolvedValue(null);
    renderPage();
    expect(await screen.findByText('아직 입점 신청이 없습니다')).toBeInTheDocument();
    expect(fetchSellerProducts).not.toHaveBeenCalled();
  });
});
