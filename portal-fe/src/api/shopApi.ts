import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import {
  buildLoginHref,
  getAccessToken,
  logout as clearAuth,
  type OAuthProvider,
} from '../auth/auth';
import { refreshAccessToken } from '../auth/refresh';

// VITE_API_URL 이 빈 문자열이면 same-origin relative path 사용 (운영 / K8s ingress 경유).
// nullish coalescing 으로 빈 문자열을 fallback 으로 보내지 않도록 — searchApi.ts 와 동일 컨벤션.
const BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8089';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

// ── Products ──────────────────────────────────────────────────────

export interface ProductSummary {
  id: number;
  name: string;
  price: string | number;
  status: string;
  stock: number;
  createdAt: string;
  sellerId: number;
  brand?: string | null;
  description?: string | null;
  category?: string | null;
}

export interface ProductListResponse {
  products: ProductSummary[];
  totalElements: number;
  totalPages: number;
}

export interface ProductDetail {
  id: number;
  name: string;
  price: string | number;
  stock: number;
  status: string;
}

// ── Search ────────────────────────────────────────────────────────

export interface SearchProduct {
  id: string;
  name: string;
  price: string | number;
  status: string;
  categoryId: string | null;
  position: number;
}

export interface ProductSearchResponse {
  searchId: string;
  products: SearchProduct[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
}

export interface ImpressionItem {
  categoryId?: string | null;
  productId: string;
  position: number;
}

export interface ImpressionsRequest {
  searchId: string;
  userId?: string;
  items: ImpressionItem[];
}

export interface ClickRequest {
  searchId: string;
  userId?: string;
  categoryId?: string | null;
  productId: string;
  position: number;
}

// ── Cart · Order sheet ────────────────────────────────────────────

/** 장바구니 한 줄 — 상품이 읽기 모델에 없으면 이름·가격·판매자가 비고 onSale 이 false 다 */
export interface CartLine {
  productId: number;
  quantity: number;
  productName: string | null;
  price: number | null;
  sellerId: number | null;
  onSale: boolean;
}

export interface Cart {
  items: CartLine[];
}

/**
 * 주문서 요청 — 가격·금액 필드를 두지 않는다. 금액은 서버가 읽기 모델로만 계산한다.
 * `items` 와 `fromCart` 중 하나만 준다.
 */
export type OrderSheetRequest = (
  | { items: { productId: number; quantity: number }[]; fromCart?: never }
  | { fromCart: true; items?: never }
) & {
  userCouponId?: number | null;
  pointAmount?: number;
};

export type OrderSheetStatus = 'ACTIVE' | 'USED';

export interface OrderSheetLine {
  lineNo: number;
  productId: number;
  productName: string;
  sellerId: number;
  unitPrice: number;
  quantity: number;
  amount: number;
  couponDiscount: number;
  couponBearer: 'PLATFORM' | 'SELLER' | null;
  pointAmount: number;
  payable: number;
}

/** 주문서 — 할인·포인트는 견적이다. 최종 판정은 주문 접수 뒤 혜택 예약이 한다 */
export interface OrderSheet {
  id: number;
  status: OrderSheetStatus;
  userCouponId: number | null;
  itemsAmount: number;
  couponDiscount: number;
  pointAmount: number;
  shippingAmount: number;
  payableAmount: number;
  expiresAt: string;
  lines: OrderSheetLine[];
  shippingLines: { sellerId: number; fee: number }[];
}

// ── Promotion ─────────────────────────────────────────────────────

export type UserCouponStatus = 'AVAILABLE' | 'RESERVED' | 'USED' | 'RETURNED' | 'EXPIRED';

export interface CouponDefinition {
  id: number;
  name: string;
  type: 'FIXED' | 'RATE';
  amount: number | null;
  rateBp: number | null;
  maxDiscount: number | null;
  minOrderAmount: number;
  validFrom: string;
  validUntil: string;
  issueLimit: number;
  issuedCount: number;
  bearer: 'PLATFORM' | 'SELLER';
  sellerId: number | null;
  status: 'ACTIVE' | 'INACTIVE';
}

/** 내 쿠폰 한 장 — usable 은 서버가 상태와 기간으로 판정한다 */
export interface MyCoupon {
  userCouponId: number;
  status: UserCouponStatus;
  usable: boolean;
  issuedAt: string;
  definition: CouponDefinition;
}

export interface MyPoints {
  memberId: string;
  balance: number;
}

// ── Orders ────────────────────────────────────────────────────────

/**
 * 주문 상태(서버 OrderStatus). CREATED·PAYMENT_PENDING·PAID 는 진행 중, CONFIRMED·FULFILLING·COMPLETED 는 성공
 * (COMPLETED = 구매 확정), FAILED·CANCELLED 는 끝.
 */
export type OrderStatus =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'CONFIRMED'
  | 'FULFILLING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

/** FAILED(또는 구매자 취소)의 이유 — 서버 enum 이름이 계약이다 */
export type OrderFailureReason =
  | 'INSUFFICIENT_STOCK'
  | 'BENEFIT_UNAVAILABLE'
  | 'PAYMENT_DECLINED'
  | 'HOLD_EXPIRED'
  | 'TIMEOUT'
  | 'BUYER_CANCELLED'
  | 'LEGACY_ABANDONED';

export type SagaStep =
  | 'INVENTORY_RESERVE'
  | 'PROMOTION_RESERVE'
  | 'PAYMENT_AUTHORIZE'
  | 'INVENTORY_CONFIRM'
  | 'PROMOTION_CONFIRM'
  | 'PAYMENT_CAPTURE'
  | 'FULFILLMENT_CREATE'
  | 'PAYMENT_VOID'
  | 'PROMOTION_CANCEL'
  | 'PROMOTION_RESTORE'
  | 'INVENTORY_RELEASE'
  | 'INVENTORY_RESTOCK';

export type SagaStatus = 'RUNNING' | 'COMPENSATING' | 'COMPLETED' | 'FAILED' | 'STUCK';

export interface MyOrderItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  status: string;
}

export interface MyOrder {
  orderId: number;
  totalAmount: number;
  status: OrderStatus;
  failureReason: OrderFailureReason | null;
  refundedAmount: number;
  createdAt: string;
  items: MyOrderItem[];
}

/** 202 본문 — 결과는 GET /api/v1/orders/{id} 폴링으로 본다 */
export interface OrderAccepted {
  orderId: number;
  status: OrderStatus;
  sagaStep: SagaStep;
}

export interface OrderLine {
  orderItemId: number | null;
  lineNo: number;
  productId: number;
  productName: string;
  sellerId: number;
  unitPrice: number;
  quantity: number;
  couponDiscount: number;
  pointAmount: number;
  payable: number;
  /** ACTIVE · CANCELLED · PURCHASE_CONFIRMED */
  status: string;
  /** 출고·배송 완료·구매 확정 시각 — 이행 이벤트로 채운다 */
  shippedAt?: string | null;
  deliveredAt?: string | null;
  purchaseConfirmedAt?: string | null;
}

export interface OrderDetail {
  orderId: number;
  status: OrderStatus;
  failureReason: OrderFailureReason | null;
  sagaStep: SagaStep | null;
  sagaStatus: SagaStatus | null;
  itemsAmount: number;
  couponDiscount: number;
  pointAmount: number;
  shippingAmount: number;
  payableAmount: number;
  refundedAmount: number;
  createdAt: string;
  lines: OrderLine[];
  shippingLines: { sellerId: number; fee: number }[];
}

// ── Claim (취소 · 부분 취소) ─────────────────────────────────────────

export type ClaimStatus = 'REQUESTED' | 'APPROVED' | 'REFUNDED' | 'REJECTED';
export type ClaimStep =
  | 'QUEUED'
  | 'FULFILLMENT_WAIT'
  | 'FULFILLMENT_CANCEL'
  | 'SELLER_DECISION'
  | 'INVENTORY_RESTOCK'
  | 'PROMOTION_RESTORE'
  | 'PAYMENT_REFUND'
  | 'DONE';

/** 클레임 — 판매자마다 한 건. 금액은 승인 뒤 환불 단계에 들어가면 채워진다 */
export interface Claim {
  claimId: number;
  orderId: number;
  sellerId: number;
  lineNos: number[];
  status: ClaimStatus;
  step: ClaimStep;
  goodsShipped: boolean;
  refundAmount: number | null;
  pointRestore: number | null;
  shippingRefund: number | null;
  fullCancel: boolean | null;
  rejectReason: string | null;
  stuck: boolean;
  requestedAt: string;
}

/** 환불 미리보기 — 서버가 클레임과 같은 계산으로 낸다. FE 는 금액을 계산하지 않는다 */
export interface ClaimPreview {
  orderId: number;
  lines: { lineNo: number; productName: string; sellerId: number; payable: number; pointAmount: number; shipped: boolean }[];
  pointRestore: number;
  shippingRefund: number;
  /** 결제 수단으로 돌아가는 금액 */
  refundAmount: number;
  fullCancel: boolean;
  couponReturn: boolean;
  needsSellerApproval: boolean;
}

// ── Seller ────────────────────────────────────────────────────────

export type SellerStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
export type SettlementCycle = 'WEEKLY' | 'MONTHLY';

export interface ApplySellerRequest {
  businessName: string;
  businessRegistrationNo: string;
  representativeName: string;
  bankName: string;
  accountNumber: string;
  shippingFee: number;
  settlementCycle: SettlementCycle;
}

/** 계좌는 마스킹 값만 온다 */
export interface SellerProfile {
  id: number;
  memberId: string;
  status: SellerStatus;
  businessName: string;
  businessRegistrationNo: string | null;
  representativeName: string | null;
  bankName: string | null;
  accountMasked: string | null;
  shippingFee: number;
  settlementCycle: SettlementCycle;
  commissionRateBp: number | null;
  rejectReason: string | null;
  appliedAt: string;
  updatedAt: string;
}

/** 내 가장 최근 입점 신청 — 상태 무관. 정지 사유는 지금 정지 상태일 때만 온다 */
export interface SellerApplication extends Omit<SellerProfile, 'memberId'> {
  suspendReason: string | null;
}

export interface SellerProductRequest {
  name: string;
  price: number;
  brand?: string | null;
  description?: string | null;
  category?: string | null;
}

// ── Auth ──────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  memberId: string;
  isNewMember: boolean;
}

// ── Axios instance + interceptors ────────────────────────────────

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    if (error.response?.status === 401 && config && !config._retry) {
      config._retry = true;
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return api(config); // 원 요청 재시도 (request 인터셉터가 새 토큰 부착)
      }
      clearAuth();
      window.location.href = buildLoginHref();
    }
    return Promise.reject(error);
  },
);

/** ApiResponse 의 error.message 또는 일반 에러 메시지 추출 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiResponse<unknown> | undefined;
    if (body?.error?.message) return body.error.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

// ── Endpoint functions ────────────────────────────────────────────

export const fetchProducts = async (page = 0, size = 20): Promise<ProductListResponse> => {
  const res = await api.get<ApiResponse<ProductListResponse>>('/api/v1/products', {
    params: { page, size },
  });
  return res.data.data;
};

export const fetchProduct = async (id: string | number): Promise<ProductDetail> => {
  const res = await api.get<ApiResponse<ProductDetail>>(`/api/v1/products/${id}`);
  return res.data.data;
};

export const searchProducts = async (
  keyword: string,
  page = 0,
  size = 20,
): Promise<ProductSearchResponse> => {
  const res = await api.get<ApiResponse<ProductSearchResponse>>('/api/search/products', {
    params: { keyword, page, size },
  });
  return res.data.data;
};

export interface ProductSuggestion {
  id: string;
  name: string;
}

export const suggestProducts = async (q: string, size = 8): Promise<ProductSuggestion[]> => {
  const res = await api.get<ApiResponse<ProductSuggestion[]>>('/api/search/products/suggest', {
    params: { q, size },
  });
  return res.data.data;
};

export const postImpressions = async (body: ImpressionsRequest): Promise<void> => {
  await api.post('/api/search/impressions', body);
};

export const postClick = async (body: ClickRequest): Promise<void> => {
  await api.post('/api/search/clicks', body);
};

export const fetchCart = async (): Promise<Cart> => {
  const res = await api.get<ApiResponse<Cart>>('/api/v1/cart');
  return res.data.data;
};

/** 수량을 그 값으로 **정한다**(더하지 않는다) */
export const putCartItem = async (productId: number, quantity: number): Promise<Cart> => {
  const res = await api.put<ApiResponse<Cart>>(`/api/v1/cart/items/${productId}`, { quantity });
  return res.data.data;
};

export const removeCartItem = async (productId: number): Promise<Cart> => {
  const res = await api.delete<ApiResponse<Cart>>(`/api/v1/cart/items/${productId}`);
  return res.data.data;
};

export const createOrderSheet = async (body: OrderSheetRequest): Promise<OrderSheet> => {
  const res = await api.post<ApiResponse<OrderSheet>>('/api/v1/order-sheets', body);
  return res.data.data;
};

export const fetchOrderSheet = async (id: string | number): Promise<OrderSheet> => {
  const res = await api.get<ApiResponse<OrderSheet>>(`/api/v1/order-sheets/${id}`);
  return res.data.data;
};

export const fetchMyCoupons = async (): Promise<MyCoupon[]> => {
  const res = await api.get<ApiResponse<MyCoupon[]>>('/api/v1/coupons/me');
  return res.data.data;
};

export const fetchMyPoints = async (): Promise<MyPoints> => {
  const res = await api.get<ApiResponse<MyPoints>>('/api/v1/points/me');
  return res.data.data;
};

export const fetchMyOrders = async (): Promise<MyOrder[]> => {
  const res = await api.get<ApiResponse<MyOrder[]>>('/api/v1/orders/my');
  return res.data.data;
};

/** 주문 접수 — 본문은 주문서 id 뿐(가격 없음). 같은 키로 다시 보내면 서버가 처음 응답을 돌려준다 */
export const placeOrder = async (orderSheetId: number, idempotencyKey: string): Promise<OrderAccepted> => {
  const res = await api.post<ApiResponse<OrderAccepted>>(
    '/api/v1/orders',
    { orderSheetId },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  );
  return res.data.data;
};

export const fetchOrder = async (id: string | number): Promise<OrderDetail> => {
  const res = await api.get<ApiResponse<OrderDetail>>(`/api/v1/orders/${id}`);
  return res.data.data;
};

/** 결제 전(CREATED)만 받는다 — 결제 확인 중·결제 뒤는 409 */
export const cancelOrder = async (id: string | number): Promise<OrderDetail> => {
  const res = await api.post<ApiResponse<OrderDetail>>(`/api/v1/orders/${id}/cancel`);
  return res.data.data;
};

// ── 클레임 · 구매 확정 ─────────────────────────────────────────────

/** [lineNos] 가 null 이면 전체 취소 */
export const previewClaim = async (orderId: number, lineNos: number[] | null): Promise<ClaimPreview> => {
  const res = await api.get<ApiResponse<ClaimPreview>>('/api/v1/claims/preview', {
    params: lineNos ? { orderId, lines: lineNos.join(',') } : { orderId },
  });
  return res.data.data;
};

export const requestClaim = async (orderId: number, lineNos: number[] | null): Promise<Claim[]> => {
  const res = await api.post<ApiResponse<Claim[]>>('/api/v1/claims', { orderId, lineNos });
  return res.data.data;
};

export const fetchClaims = async (orderId: number): Promise<Claim[]> => {
  const res = await api.get<ApiResponse<Claim[]>>('/api/v1/claims', { params: { orderId } });
  return res.data.data;
};

/** 이행 중 주문의 취소되지 않은 라인 전부 — 진행 중 클레임이 있으면 409 */
export const confirmPurchase = async (orderId: number): Promise<{ orderId: number; confirmedLineNos: number[] }> => {
  const res = await api.post<ApiResponse<{ orderId: number; confirmedLineNos: number[] }>>(
    `/api/v1/orders/${orderId}/purchase-confirm`,
  );
  return res.data.data;
};

/** 판매자 — 내 라인의 클레임(최신순) */
export const fetchSellerClaims = async (): Promise<Claim[]> => {
  const res = await api.get<ApiResponse<Claim[]>>('/api/v1/seller/claims');
  return res.data.data;
};

/** 이미 출고된 취소 요청 승인 — 반품을 따로 받았다는 뜻. 재입고 없이 환불된다 */
export const approveSellerClaim = async (claimId: number): Promise<Claim> => {
  const res = await api.post<ApiResponse<Claim>>(`/api/v1/seller/claims/${claimId}/approve`);
  return res.data.data;
};

export const rejectSellerClaim = async (claimId: number, reason: string): Promise<Claim> => {
  const res = await api.post<ApiResponse<Claim>>(`/api/v1/seller/claims/${claimId}/reject`, { reason });
  return res.data.data;
};

export const loginWithProvider = async (
  provider: OAuthProvider,
  authCode: string,
  redirectUri: string,
): Promise<LoginResponse> => {
  const res = await api.post<ApiResponse<LoginResponse>>(`/api/auth/login/${provider}`, {
    authCode,
    redirectUri,
  });
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.error?.message ?? '로그인에 실패했습니다.');
  }
  return res.data.data;
};

export const logoutApi = async (refreshToken: string): Promise<void> => {
  await api.post('/api/auth/logout', { refreshToken });
};

export const applySeller = async (body: ApplySellerRequest): Promise<SellerProfile> => {
  const res = await api.post<ApiResponse<SellerProfile>>('/api/v1/sellers/apply', body);
  return res.data.data;
};

/** 상태를 가리지 않고 가장 최근 신청을 준다(ROLE_USER). 신청한 적이 없으면 null */
export const fetchMySellerApplication = async (): Promise<SellerApplication | null> => {
  try {
    const res = await api.get<ApiResponse<SellerApplication>>('/api/v1/sellers/me');
    return res.data.data;
  } catch (err) {
    if (errorStatus(err) === 404) return null;
    throw err;
  }
};

/**
 * 판매자 포털의 나 — ACTIVE 판매자만 200.
 * 승인은 토큰 발급 뒤에 일어나므로 403 이면 한 번 재발급해 다시 묻는다 — 재발급이 역할을
 * 새로 읽어 오므로 승인된 판매자가 다시 로그인하지 않아도 된다.
 */
export const fetchMySeller = async (): Promise<SellerProfile> => {
  const get = () => api.get<ApiResponse<SellerProfile>>('/api/v1/seller/me');
  try {
    return (await get()).data.data;
  } catch (err) {
    if (errorStatus(err) !== 403 || !(await refreshAccessToken())) throw err;
    return (await get()).data.data;
  }
};

/** 그 판매자의 판매 중 상품 — 서버가 판매자로 거른다 */
export const fetchSellerProducts = async (
  sellerId: number,
  page = 0,
  size = 500,
): Promise<ProductListResponse> => {
  const res = await api.get<ApiResponse<ProductListResponse>>('/api/v1/products', {
    params: { sellerId, page, size },
  });
  return res.data.data;
};

/** 재고는 등록 때만 받는다 — 수정 API 에는 재고 필드가 없다 */
export const createSellerProduct = async (
  body: SellerProductRequest & { stock: number },
): Promise<ProductDetail> => {
  const res = await api.post<ApiResponse<ProductDetail>>('/api/v1/products', body);
  return res.data.data;
};

export const updateSellerProduct = async (
  id: number,
  body: SellerProductRequest,
): Promise<ProductDetail> => {
  const res = await api.put<ApiResponse<ProductDetail>>(`/api/v1/products/${id}`, body);
  return res.data.data;
};

/** HTTP 상태 — 403(판매자 아님)·409(이미 신청) 분기용 */
export function errorStatus(err: unknown): number | null {
  return axios.isAxiosError(err) ? (err.response?.status ?? null) : null;
}
