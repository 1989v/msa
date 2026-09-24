import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }

export const SELLER_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const;
export type SellerStatus = (typeof SELLER_STATUSES)[number];

/** 계좌는 마스킹 값만 온다 — 관리 화면에도 평문이 실리는 경로가 없다 */
export interface Seller {
  id: number;
  memberId: string;
  status: SellerStatus;
  businessName: string;
  businessRegistrationNo: string | null;
  representativeName: string | null;
  bankName: string | null;
  accountMasked: string | null;
  shippingFee: number;
  settlementCycle: 'WEEKLY' | 'MONTHLY';
  commissionRateBp: number | null;
  rejectReason: string | null;
  appliedAt: string;
  updatedAt: string;
}

export interface SellerPage {
  items: Seller[];
  totalElements: number;
  page: number;
  size: number;
}

const BASE = '/api/v1/admin/sellers';

export async function listSellers(params: { status?: SellerStatus; page?: number; size?: number }): Promise<SellerPage> {
  const res = await apiClient.get<ApiResponse<SellerPage>>(BASE, { params });
  return res.data.data;
}

export async function approveSeller(id: number, commissionRateBp: number, reason?: string): Promise<Seller> {
  const res = await apiClient.post<ApiResponse<Seller>>(`${BASE}/${id}/approve`, { commissionRateBp, reason: reason || null });
  return res.data.data;
}

export async function rejectSeller(id: number, reason: string): Promise<Seller> {
  const res = await apiClient.post<ApiResponse<Seller>>(`${BASE}/${id}/reject`, { reason });
  return res.data.data;
}

export async function suspendSeller(id: number, reason: string): Promise<Seller> {
  const res = await apiClient.post<ApiResponse<Seller>>(`${BASE}/${id}/suspend`, { reason });
  return res.data.data;
}

export async function reactivateSeller(id: number, reason?: string): Promise<Seller> {
  const res = await apiClient.post<ApiResponse<Seller>>(`${BASE}/${id}/reactivate`, { reason: reason || null });
  return res.data.data;
}

export async function changeSellerCommission(id: number, commissionRateBp: number, reason: string): Promise<Seller> {
  const res = await apiClient.patch<ApiResponse<Seller>>(`${BASE}/${id}/commission`, { commissionRateBp, reason });
  return res.data.data;
}
