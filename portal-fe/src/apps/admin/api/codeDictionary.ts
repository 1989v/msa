import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }
interface PageResponse<T> { content: T[]; totalElements: number; totalPages: number; number: number; size: number; }

export interface Concept {
  id: number;
  conceptId: string;
  name: string;
  category: string;
  level: string;
  description: string;
  synonyms: string[];
}

export interface ConceptIndex {
  id: number;
  conceptId: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  codeSnippet: string;
  gitUrl: string | null;
  description: string | null;
}

export async function fetchConcepts(page = 0, size = 20, category?: string, level?: string): Promise<PageResponse<Concept>> {
  try {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (category) params.set('category', category);
    if (level) params.set('level', level);
    const res = await apiClient.get<ApiResponse<PageResponse<Concept>>>(`/api/v1/concepts?${params}`);
    return res.data.data;
  } catch {
    return { content: [], totalElements: 0, totalPages: 0, number: 0, size };
  }
}

export async function createConcept(data: { conceptId: string; name: string; category: string; level: string; description: string; synonyms: string[] }): Promise<void> {
  await apiClient.post('/api/v1/concepts', data);
}

export async function updateConcept(id: number, data: Partial<Concept>): Promise<void> {
  await apiClient.put(`/api/v1/concepts/${id}`, data);
}

export async function deleteConcept(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/concepts/${id}`);
}

export type IndexSyncStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface IndexSyncJob {
  jobId: string;
  status: IndexSyncStatus;
  startedAt: string;
  finishedAt: string | null;
  newIndex: string | null;
  indexedCount: number;
  error: string | null;
}

export async function submitIndexSync(): Promise<IndexSyncJob> {
  const res = await apiClient.post<ApiResponse<IndexSyncJob>>('/api/v1/index/sync');
  return res.data.data;
}

export async function getIndexSyncJob(jobId: string): Promise<IndexSyncJob> {
  const res = await apiClient.get<ApiResponse<IndexSyncJob>>(`/api/v1/index/sync/${jobId}`);
  return res.data.data;
}

// ============================================================================
// Treemap stats — spec §5.1
// V2: extract to packages/treemap-shared/ — see spec.md R3
// ============================================================================

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
  const res = await apiClient.get<ApiResponse<TreemapDataDto>>(url);
  return res.data.data;
}

export async function fetchConceptByConceptId(conceptId: string): Promise<Concept | null> {
  // Admin reuses list endpoint; stats payload only carries conceptId (string),
  // while CRUD edit dialog needs numeric id. We resolve via list query.
  // V2: backend should expose GET /api/v1/concepts/{conceptId} returning full Concept.
  try {
    const res = await apiClient.get<ApiResponse<PageResponse<Concept>>>(
      `/api/v1/concepts?page=0&size=1&conceptId=${encodeURIComponent(conceptId)}`,
    );
    const found = res.data.data.content.find((c) => c.conceptId === conceptId);
    if (found) return found;
  } catch {
    // fall through to scan
  }
  // fallback: scan first 500 (admin list page is small)
  try {
    const res = await apiClient.get<ApiResponse<PageResponse<Concept>>>(
      `/api/v1/concepts?page=0&size=500`,
    );
    return res.data.data.content.find((c) => c.conceptId === conceptId) ?? null;
  } catch {
    return null;
  }
}
