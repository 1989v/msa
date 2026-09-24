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

/** 통합 검색 (`GET /api/search/unified`) — 타입별 묶음. 관광지는 하이브리드, 나머지는 unified 인덱스 */
export type UnifiedType =
  | 'attraction'
  | 'blog_post'
  | 'game'
  | 'concept'
  | 'deal_offer'
  | 'service'
  | 'product';

export interface UnifiedHit {
  type: UnifiedType;
  id: string;
  /** type 과 함께 주소를 조립하는 열쇠 — 관광지·상품은 id, 나머지는 slug */
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  thumbnailUrl: string | null;
  facets: Record<string, string>;
  score: number;
}

export interface UnifiedGroup {
  type: UnifiedType;
  total: number;
  hits: UnifiedHit[];
}

export interface UnifiedResult {
  query: string;
  understood: { type: UnifiedType | null; residual: string | null };
  groups: UnifiedGroup[];
}

export const fetchUnifiedSearch = async (
  q: string,
  type?: string,
  lang?: string,
  size = 5,
): Promise<UnifiedResult> => {
  const params = new URLSearchParams({ q, size: String(size) });
  if (type) params.set('type', type);
  if (lang) params.set('lang', lang);
  const res = await api.get<ApiResponse<UnifiedResult>>(`/api/search/unified?${params}`);
  return res.data.data;
};

/**
 * /tech 개념 검색 — 통합 검색의 `type=concept` 묶음을 옛 응답 모양으로 되돌린다.
 * 옛 `/api/v1/search`(atlas 의 OpenSearch 색인)는 운영에서 500 이라 통합 인덱스로 갈아탔다 (플랜 §2 U5).
 * category·level 필터는 화면이 호출하지 않아 받지 않는다.
 */
export const searchConcepts = async (query: string, size = 20): Promise<SearchResponse> => {
  const result = await fetchUnifiedSearch(query, 'concept', undefined, size);
  const group = result.groups.find((g) => g.type === 'concept');
  const hits: SearchHit[] = (group?.hits ?? []).map((h) => ({
    conceptId: h.slug,
    conceptName: h.title,
    category: h.category ?? '',
    level: h.facets.level ?? '',
    filePath: null,
    lineStart: null,
    lineEnd: null,
    codeSnippet: null,
    gitUrl: null,
    description: h.summary,
    score: h.score,
  }));
  return { hits, totalHits: group?.total ?? 0, maxScore: hits[0]?.score ?? null };
};

import type { GraphData, SuggestItem, ConceptDetail, ConceptHierarchy, ConceptRelations } from '../types/graph';

/** 자동완성도 같은 이유로 통합 검색의 concept 묶음이다 — 접두사 매칭이 아니라 BM25 상위다 */
export const suggestConcepts = async (query: string, size = 8): Promise<SuggestItem[]> => {
  const result = await fetchUnifiedSearch(query, 'concept', undefined, size);
  const group = result.groups.find((g) => g.type === 'concept');
  return (group?.hits ?? []).map((h) => ({
    conceptId: h.slug,
    name: h.title,
    category: (h.category ?? 'BASICS') as SuggestItem['category'],
    level: (h.facets.level ?? 'BEGINNER') as SuggestItem['level'],
    description: h.summary ?? '',
  }));
};

export const fetchGraphData = async (): Promise<GraphData> => {
  const res = await api.get<ApiResponse<GraphData>>('/api/v1/concepts/graph');
  return res.data.data;
};

/** root 를 주면 그 아래만, 없으면 진입점 전부 */
export const fetchConceptHierarchy = async (root?: string): Promise<ConceptHierarchy> => {
  const query = root ? `?${new URLSearchParams({ root })}` : '';
  const res = await api.get<ApiResponse<ConceptHierarchy>>(`/api/v1/concepts/graph/hierarchy${query}`);
  return res.data.data;
};

/** 개념 하나의 이웃 — 계층 응답 밖(다른 루트)으로 가는 간선까지. 도메인 간 탐색은 이것으로 한 홉씩 */
export const fetchConceptRelations = async (conceptId: string): Promise<ConceptRelations> => {
  const res = await api.get<ApiResponse<ConceptRelations>>(`/api/v1/concepts/${encodeURIComponent(conceptId)}/relations`);
  return res.data.data;
};

/** `GET /api/v1/concepts/atlas` — 도메인(1차 노드) 목록과 도메인 사이 관계 수. 순서는 학습 순서 */
export interface AtlasDomain {
  domain: string;
  rootId: string;
  name: string;
  description?: string | null;
  conceptCount: number;
  kindCounts: Record<string, number>;
  codeRefCount: number;
  conceptIds: string[];
}

export interface ConceptAtlas {
  domains: AtlasDomain[];
  links: { from: string; to: string; count: number }[];
}

export const fetchAtlas = async (): Promise<ConceptAtlas> => {
  const res = await api.get<ApiResponse<ConceptAtlas>>('/api/v1/concepts/atlas');
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
