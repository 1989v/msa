import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8089',
});

export interface SearchHit {
  conceptId: string;
  conceptName: string;
  category: string;
  level: string;
  filePath: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  codeSnippet: string | null;
  gitUrl: string | null;
  description: string | null;
  score: number;
}

export interface SearchResponse {
  hits: SearchHit[];
  totalHits: number;
  maxScore: number | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

export const searchConcepts = async (
  query: string,
  category?: string,
  level?: string,
  page = 0,
  size = 20
): Promise<SearchResponse> => {
  const params = new URLSearchParams({ q: query, page: String(page), size: String(size) });
  if (category) params.set('category', category);
  if (level) params.set('level', level);
  const res = await api.get<ApiResponse<SearchResponse>>(`/api/v1/search?${params}`);
  return res.data.data;
};
