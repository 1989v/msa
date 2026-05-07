import { apiClient } from './client';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

export type AssetClass = 'CRYPTO' | 'STOCK_KR' | 'STOCK_US';
export type AssetSource = 'yfinance' | 'fdr';

export interface QuantAsset {
  id: string;
  assetCode: string;
  assetClass: AssetClass;
  source: AssetSource;
  displayName: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetCreateInput {
  assetCode: string;
  assetClass: AssetClass;
  source: AssetSource;
  displayName: string;
  active?: boolean;
  sortOrder?: number;
}

export interface AssetUpdateInput {
  displayName?: string;
  source?: AssetSource;
  active?: boolean;
  sortOrder?: number;
}

const BASE = '/api/v1/quant/assets';

export async function fetchQuantAssets(activeOnly = false): Promise<QuantAsset[]> {
  const res = await apiClient.get<ApiResponse<QuantAsset[]>>(`${BASE}?activeOnly=${activeOnly}`);
  return res.data.data ?? [];
}

export async function createQuantAsset(input: AssetCreateInput): Promise<QuantAsset> {
  const res = await apiClient.post<ApiResponse<QuantAsset>>(BASE, input);
  return res.data.data;
}

export async function updateQuantAsset(id: string, input: AssetUpdateInput): Promise<QuantAsset> {
  const res = await apiClient.patch<ApiResponse<QuantAsset>>(`${BASE}/${id}`, input);
  return res.data.data;
}

export async function deleteQuantAsset(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}
