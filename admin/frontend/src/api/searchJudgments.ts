import { apiClient } from './client';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

export interface JudgmentRow {
  query: string;
  productId: string;
  relevance: number;
  source: string;
  weight: number;
  createdAt: string;
}

export async function listJudgments(params: {
  query?: string;
  limit?: number;
  offset?: number;
}): Promise<JudgmentRow[]> {
  const search = new URLSearchParams();
  if (params.query) search.set('query', params.query);
  search.set('limit', String(params.limit ?? 100));
  search.set('offset', String(params.offset ?? 0));
  const res = await apiClient.get<ApiResponse<JudgmentRow[]>>(
    `/api/v1/search/judgments?${search}`
  );
  return res.data.data;
}

export async function distinctQueries(prefix?: string): Promise<string[]> {
  const search = new URLSearchParams();
  if (prefix) search.set('prefix', prefix);
  search.set('limit', '50');
  const res = await apiClient.get<ApiResponse<string[]>>(
    `/api/v1/search/judgments/queries?${search}`
  );
  return res.data.data;
}

export async function upsertJudgment(body: {
  query: string;
  productId: string;
  relevance: number;
  weight?: number;
}): Promise<void> {
  await apiClient.post(`/api/v1/search/judgments`, body);
}
