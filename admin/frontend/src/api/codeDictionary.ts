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

export async function syncOpenSearch(): Promise<string> {
  const res = await apiClient.post<ApiResponse<string>>('/api/v1/index/sync');
  return res.data.data;
}
