import axios from 'axios';

// VITE_API_URL 이 빈 문자열이면 same-origin relative path 사용 (운영 / K8s ingress 경유).
// nullish coalescing 으로 빈 문자열을 fallback 으로 보내지 않도록.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8089',
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

export interface ServiceItem {
  code: string;
  name: string;
  description: string;
  port: number | null;
  isPrivate: boolean;
  concepts: string[];
}

export const fetchServices = async (): Promise<ServiceItem[]> => {
  const res = await api.get<ApiResponse<ServiceItem[]>>('/api/v1/services');
  return res.data.data;
};

/** 개념 사전 목록 항목 — 상세(ConceptDetail)에서 스니펫·관계를 뺀 모양 */
export interface Concept {
  id: number;
  conceptId: string;
  name: string;
  category: string;
  level: string;
  description: string;
  synonyms: string[];
}

/**
 * 개념 전량. 162개라 한 번에 받는다 — 분류별 용어집이 묶음으로 쓰므로 페이지를 나누면 잘린다.
 * 프리렌더(`scripts/prerender-seo.mjs`)도 같은 엔드포인트를 같은 크기로 부른다.
 */
export const fetchConcepts = async (): Promise<Concept[]> => {
  const res = await api.get<ApiResponse<{ content: Concept[] }>>('/api/v1/concepts?size=500');
  return res.data.data.content ?? [];
};
