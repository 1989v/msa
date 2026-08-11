import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }

/** OPEN 전시+진입 / PREOPEN 전시하되 진입 불가 / HOLD 전시 안 함 (ADR-0066) */
export type DisplayStatus = 'OPEN' | 'PREOPEN' | 'HOLD';

export interface DisplayService {
  id: number | null;
  code: string;
  label: string;
  tagline: string | null;
  href: string | null;
  status: DisplayStatus;
  orderNo: number;
}

const BASE = '/api/v1/admin/display';

export async function listDisplayServices(): Promise<DisplayService[]> {
  const res = await apiClient.get<ApiResponse<DisplayService[]>>(`${BASE}/services`);
  return res.data.data;
}

export async function upsertDisplayService(payload: {
  id?: number;
  code: string;
  label: string;
  tagline: string | null;
  href: string | null;
  status: DisplayStatus;
  orderNo: number;
}): Promise<DisplayService> {
  const res = await apiClient.put<ApiResponse<DisplayService>>(`${BASE}/services`, payload);
  return res.data.data;
}

export async function deleteDisplayService(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/services/${id}`);
}
