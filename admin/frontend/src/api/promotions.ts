import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }

export type CouponType = 'FIXED' | 'RATE';
export type CouponBearer = 'PLATFORM' | 'SELLER';

export interface CouponDefinition {
  id: number;
  name: string;
  type: CouponType;
  amount: number | null;
  rateBp: number | null;
  maxDiscount: number | null;
  minOrderAmount: number;
  validFrom: string;
  validUntil: string;
  issueLimit: number;
  issuedCount: number;
  bearer: CouponBearer;
  sellerId: number | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface CouponDefinitionPage {
  items: CouponDefinition[];
  total: number;
}

/** 정액은 amount, 정률은 rateBp(1~10000) + maxDiscount. 판매자 부담이면 sellerId */
export interface CreateCouponDefinition {
  name: string;
  type: CouponType;
  amount?: number | null;
  rateBp?: number | null;
  maxDiscount?: number | null;
  minOrderAmount: number;
  validFrom: string;
  validUntil: string;
  issueLimit: number;
  bearer: CouponBearer;
  sellerId?: number | null;
}

export interface PointBalance {
  memberId: string;
  balance: number;
}

const BASE = '/api/v1/admin/promotions';

export async function listCouponDefinitions(page: number, size: number): Promise<CouponDefinitionPage> {
  const res = await apiClient.get<ApiResponse<CouponDefinitionPage>>(`${BASE}/coupons`, { params: { page, size } });
  return res.data.data;
}

export async function createCouponDefinition(body: CreateCouponDefinition): Promise<CouponDefinition> {
  const res = await apiClient.post<ApiResponse<CouponDefinition>>(`${BASE}/coupons`, body);
  return res.data.data;
}

export async function grantPoints(memberId: string, amount: number, reason: string): Promise<PointBalance> {
  const res = await apiClient.post<ApiResponse<PointBalance>>(`${BASE}/points/grants`, { memberId, amount, reason });
  return res.data.data;
}
