import axios from 'axios';

/**
 * Treemap stats API client.
 *
 * Backend contract: GET /api/v1/concepts/stats/treemap
 * Spec: docs/specs/2026-05-05-code-dictionary-treemap/planning/spec.md §5.1
 */

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8089',
});

export type TreemapLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export interface TreemapConceptDto {
  conceptId: string;
  name: string;
  level: TreemapLevel;
  indexCount: number;
}

export interface TreemapCategoryDto {
  name: string;
  totalConcepts: number;
  totalIndexCount: number;
  concepts: TreemapConceptDto[];
}

export interface TreemapTotalsDto {
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  totalConcepts: number;
  totalIndexCount: number;
}

export interface TreemapDataDto {
  categories: TreemapCategoryDto[];
  totals: TreemapTotalsDto;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

export interface FetchTreemapStatsParams {
  categories?: string[];
  includeZeroIndex?: boolean;
}

export async function fetchTreemapStats(
  params: FetchTreemapStatsParams = {},
): Promise<TreemapDataDto> {
  const search = new URLSearchParams();
  if (params.categories && params.categories.length > 0) {
    search.set('categories', params.categories.join(','));
  }
  if (params.includeZeroIndex !== undefined) {
    search.set('includeZeroIndex', String(params.includeZeroIndex));
  }
  const qs = search.toString();
  const url = qs.length > 0
    ? `/api/v1/concepts/stats/treemap?${qs}`
    : '/api/v1/concepts/stats/treemap';
  const res = await api.get<ApiResponse<TreemapDataDto>>(url);
  return res.data.data;
}
