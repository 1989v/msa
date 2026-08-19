import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }

/** OPEN 전시+진입 / PREOPEN 전시하되 진입 불가 / HOLD 전시 안 함 (ADR-0066 전시 상태 관례) */
export type DisplayStatus = 'OPEN' | 'PREOPEN' | 'HOLD';

/** AFFILIATE 만 공정위 고지 대상이다 (ADR-0069) */
export type RevenueType = 'AFFILIATE' | 'PLAIN';

/** UNKNOWN 은 "죽었다"가 아니라 "판단 보류"다 — 봇 차단 오탐이 압도적이라 분리해 둔다 */
export type LinkStatus = 'OK' | 'BROKEN' | 'UNKNOWN';

export interface DealCategory {
  id: number;
  code: string;
  label: string;
  tagline: string | null;
  status: DisplayStatus;
  orderNo: number;
  offerCount: number;
}

export interface DealOffer {
  id: number;
  slug: string;
  categoryId: number;
  categoryCode: string;
  merchant: string;
  title: string;
  benefit: string;
  summary: string | null;
  targetUrl: string;
  revenueType: RevenueType;
  network: string | null;
  status: DisplayStatus;
  validFrom: string | null;
  validUntil: string | null;
  orderNo: number;
  clickCount: number;
  linkStatus: LinkStatus;
  linkStatusCode: number | null;
  linkCheckedAt: string | null;
  updatedAt: string | null;
}

export interface DealAttention {
  expiringSoon: DealOffer[];
  stale: DealOffer[];
  broken: DealOffer[];
}

export interface DealCategoryPayload {
  code: string;
  label: string;
  tagline: string | null;
  status: DisplayStatus;
  orderNo: number;
}

export interface DealOfferPayload {
  slug: string;
  categoryId: number;
  merchant: string;
  title: string;
  benefit: string;
  summary: string | null;
  targetUrl: string;
  revenueType: RevenueType;
  network: string | null;
  status: DisplayStatus;
  validFrom: string | null;
  validUntil: string | null;
  orderNo: number;
}

const BASE = '/api/v1/admin/deal';

export async function listDealCategories(): Promise<DealCategory[]> {
  const res = await apiClient.get<ApiResponse<DealCategory[]>>(`${BASE}/categories`);
  return res.data.data;
}

export async function createDealCategory(payload: DealCategoryPayload): Promise<DealCategory> {
  const res = await apiClient.post<ApiResponse<DealCategory>>(`${BASE}/categories`, payload);
  return res.data.data;
}

export async function updateDealCategory(id: number, payload: DealCategoryPayload): Promise<DealCategory> {
  const res = await apiClient.put<ApiResponse<DealCategory>>(`${BASE}/categories/${id}`, payload);
  return res.data.data;
}

export async function deleteDealCategory(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/categories/${id}`);
}

export async function listDealOffers(params?: { categoryId?: number; linkStatus?: LinkStatus }): Promise<DealOffer[]> {
  const res = await apiClient.get<ApiResponse<DealOffer[]>>(`${BASE}/offers`, { params });
  return res.data.data;
}

export async function createDealOffer(payload: DealOfferPayload): Promise<DealOffer> {
  const res = await apiClient.post<ApiResponse<DealOffer>>(`${BASE}/offers`, payload);
  return res.data.data;
}

export async function updateDealOffer(id: number, payload: DealOfferPayload): Promise<DealOffer> {
  const res = await apiClient.put<ApiResponse<DealOffer>>(`${BASE}/offers/${id}`, payload);
  return res.data.data;
}

export async function deleteDealOffer(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/offers/${id}`);
}

export async function fetchDealAttention(): Promise<DealAttention> {
  const res = await apiClient.get<ApiResponse<DealAttention>>(`${BASE}/offers/attention`);
  return res.data.data;
}
