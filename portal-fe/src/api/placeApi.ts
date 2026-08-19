import axios from 'axios';
import type { ApiResponse } from './searchApi';

// VITE_API_URL 이 빈 문자열이면 same-origin relative path 사용 (운영 / K8s ingress 경유).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8089',
});

export type PlaceLang = 'ko' | 'en';

export interface Attraction {
  id: string;
  contentId: string;
  lang: PlaceLang;
  title: string;
  category: string | null;
  areaCode: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  tel: string | null;
  overview: string | null;
  distanceKm: number | null;
  position: number;
}

export interface AttractionSearchResult {
  searchId: string;
  attractions: Attraction[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
}

export interface AttractionQuery {
  keyword?: string;
  lang: PlaceLang;
  areaCode?: string;
  category?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sort?: 'relevance' | 'distance';
  page?: number;
  size?: number;
}

export const searchAttractions = async (query: AttractionQuery): Promise<AttractionSearchResult> => {
  const params = new URLSearchParams({ lang: query.lang });
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.areaCode) params.set('areaCode', query.areaCode);
  if (query.category) params.set('category', query.category);
  if (query.lat != null && query.lng != null) {
    params.set('lat', String(query.lat));
    params.set('lng', String(query.lng));
    if (query.radiusKm != null) params.set('radiusKm', String(query.radiusKm));
  }
  if (query.sort) params.set('sort', query.sort);
  params.set('page', String(query.page ?? 0));
  params.set('size', String(query.size ?? 30));
  const res = await api.get<ApiResponse<AttractionSearchResult>>(`/api/search/attractions?${params}`);
  return res.data.data;
};

export const fetchAttraction = async (id: string): Promise<Attraction> => {
  const res = await api.get<ApiResponse<Attraction>>(`/api/search/attractions/${id}`);
  return res.data.data;
};

/**
 * 관광지 외부 링크 (ADR-0070). 검색이 아니라 place SSOT 에서 읽는다 — 링크는 검색 조건이
 * 아니라 상세 표시물이라 attractions 인덱스에 넣지 않았다. 문서 id 와 place PK 가 같은 값이라
 * 같은 id 로 부르면 된다.
 */
export type LinkRevenueType = 'PLAIN' | 'AFFILIATE';

export interface AttractionDeepLink {
  provider: string;
  kind: 'SOCIAL' | 'TOUR_PRODUCT';
  url: string;
  revenueType: LinkRevenueType;
}

export interface AttractionLinks {
  deepLinks: AttractionDeepLink[];
}

export const fetchAttractionLinks = async (id: string): Promise<AttractionLinks> => {
  const res = await api.get<ApiResponse<AttractionLinks>>(`/api/places/attractions/${id}/links`);
  return res.data.data;
};

// 통합 자동완성 — 지역(행정 계층, 인구 부스트 상단) + 관광지 prefix (ADR-0065)
export interface Suggestion {
  type: 'REGION' | 'ATTRACTION';
  id: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
  regionLevel: 'CONTINENT' | 'COUNTRY' | 'REGION' | 'CITY' | null;
  category: string | null;
}

export const suggestPlaces = async (q: string, lang: PlaceLang, size = 8): Promise<Suggestion[]> => {
  const params = new URLSearchParams({ q, lang, size: String(size) });
  const res = await api.get<ApiResponse<Suggestion[]>>(`/api/search/attractions/suggest?${params}`);
  return res.data.data;
};
