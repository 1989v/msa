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

import type { GraphData, SuggestItem, ConceptDetail } from '../types/graph';

export const suggestConcepts = async (
  query: string,
  size = 8
): Promise<SuggestItem[]> => {
  const params = new URLSearchParams({ q: query, size: String(size) });
  const res = await api.get<ApiResponse<SuggestItem[]>>(`/api/v1/search/suggest?${params}`);
  return res.data.data;
};

export const fetchGraphData = async (): Promise<GraphData> => {
  const res = await api.get<ApiResponse<GraphData>>('/api/v1/concepts/graph');
  return res.data.data;
};

export const fetchConceptDetail = async (conceptId: string): Promise<ConceptDetail> => {
  const res = await api.get<ApiResponse<ConceptDetail>>(`/api/v1/concepts/by-concept-id/${conceptId}`);
  return res.data.data;
};
