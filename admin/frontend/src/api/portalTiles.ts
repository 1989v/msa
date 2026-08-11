import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }

/** LIVE 노출+진입 / SOON 딤드 / HIDDEN 비노출 (ADR-0066) */
export type TileStatus = 'LIVE' | 'SOON' | 'HIDDEN';

export interface PortalTile {
  id: number | null;
  code: string;
  label: string;
  tagline: string | null;
  href: string | null;
  status: TileStatus;
  orderNo: number;
}

const BASE = '/api/v1/admin/portal';

export async function listTiles(): Promise<PortalTile[]> {
  const res = await apiClient.get<ApiResponse<PortalTile[]>>(`${BASE}/tiles`);
  return res.data.data;
}

export async function upsertTile(payload: {
  id?: number;
  code: string;
  label: string;
  tagline: string | null;
  href: string | null;
  status: TileStatus;
  orderNo: number;
}): Promise<PortalTile> {
  const res = await apiClient.put<ApiResponse<PortalTile>>(`${BASE}/tiles`, payload);
  return res.data.data;
}

export async function deleteTile(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/tiles/${id}`);
}
