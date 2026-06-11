import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import {
  getAccessToken,
  getRefreshToken,
  logout as clearAuth,
  updateTokens,
  type OAuthProvider,
} from '../auth/auth';

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

// ── Orders ────────────────────────────────────────────────────────

export interface OrderItemRequest {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface OrderCreateResponse {
  orderId: number;
  userId: string;
  totalAmount: number;
  status: string;
}

export type OrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

export interface MyOrderItem {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface MyOrder {
  orderId: number;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  items: MyOrderItem[];
}

// ── Auth ──────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  memberId: string;
  isNewMember: boolean;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
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

/** 동시 401 발생 시 refresh 요청을 1회로 합치는 가드 (gifticon client.ts 패턴) */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      // 인터셉터 루프 방지를 위해 instance 가 아닌 bare axios 사용
      const res = await axios.post<ApiResponse<TokenResponse>>(
        `${BASE_URL}/api/auth/refresh`,
        { refreshToken },
      );
      if (res.data.success && res.data.data) {
        updateTokens(res.data.data.accessToken, res.data.data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    if (error.response?.status === 401 && config && !config._retry) {
      config._retry = true;
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        return api(config); // 원 요청 재시도 (request 인터셉터가 새 토큰 부착)
      }
      clearAuth();
      window.location.href = '/shop/login';
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
  const res = await api.get<ApiResponse<ProductListResponse>>('/api/products', {
    params: { page, size },
  });
  return res.data.data;
};

export const fetchProduct = async (id: string | number): Promise<ProductDetail> => {
  const res = await api.get<ApiResponse<ProductDetail>>(`/api/products/${id}`);
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

export const postImpressions = async (body: ImpressionsRequest): Promise<void> => {
  await api.post('/api/search/impressions', body);
};

export const postClick = async (body: ClickRequest): Promise<void> => {
  await api.post('/api/search/clicks', body);
};

export const createOrder = async (items: OrderItemRequest[]): Promise<OrderCreateResponse> => {
  const res = await api.post<ApiResponse<OrderCreateResponse>>('/api/orders', { items });
  return res.data.data;
};

export const fetchMyOrders = async (): Promise<MyOrder[]> => {
  const res = await api.get<ApiResponse<MyOrder[]>>('/api/orders/my');
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
