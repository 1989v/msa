import { apiClient } from './client';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

export interface FeatureBreakdown {
  popularityScore: number;
  ctr: number;
  ctrRaw: number;
  cvr: number;
  cvrRaw: number;
  gmv7d: number;
  gmv30d: number;
}

export interface WeightSnapshot {
  popularity: number;
  ctr: number;
  cvr: number;
  gmv7d: number;
  gmv30d: number;
  freshness: number;
}

export interface ScoredItem {
  rank: number;
  id: string;
  name: string;
  categoryId: string | null;
  esScore: number;
  finalScore: number;
  features: FeatureBreakdown;
  weights: WeightSnapshot | null;
  banditSample: number | null;
}

export interface DebugResponse {
  variant: string;
  query: string;
  totalElements: number;
  results: ScoredItem[];
  config: {
    ranking: Record<string, unknown>;
    bandit: { enabled: boolean; topN: number; hybridWeight: number; scopes: string[] };
    diversity: { enabled: boolean; maxPerSeller: number; topK: number };
  };
  explainEnabled: boolean;
}

export interface RawQueryResponse {
  totalElements: number;
  results: ScoredItem[];
}

export interface FunctionScoreSpec {
  type: 'fieldValueFactor' | 'gauss';
  field: string;
  weight: number;
  origin?: string;
  scale?: string;
  offset?: string;
  decay?: number;
}

export interface FieldMeta {
  name: string;
  type: string;
  supportedFunctions: string[];
}

export async function searchDebug(params: {
  query: string;
  variant?: string;
  topK?: number;
  explain?: boolean;
}): Promise<DebugResponse> {
  const search = new URLSearchParams({
    query: params.query,
    variant: params.variant ?? 'live',
    topK: String(params.topK ?? 20),
    explain: String(params.explain ?? false),
  });
  const res = await apiClient.get<ApiResponse<DebugResponse>>(
    `/api/v1/search/debug?${search}`
  );
  return res.data.data;
}

export async function searchRawQuery(body: {
  indexName?: string;
  query: string;
  topK?: number;
  functionScores: FunctionScoreSpec[];
}): Promise<RawQueryResponse> {
  const res = await apiClient.post<ApiResponse<RawQueryResponse>>(
    `/api/v1/search/debug/raw-query`,
    {
      indexName: body.indexName ?? 'products',
      query: body.query,
      topK: body.topK ?? 20,
      functionScores: body.functionScores,
    }
  );
  return res.data.data;
}

export async function searchDebugFields(): Promise<FieldMeta[]> {
  const res = await apiClient.get<ApiResponse<FieldMeta[]>>(
    `/api/v1/search/debug/fields`
  );
  return res.data.data;
}
