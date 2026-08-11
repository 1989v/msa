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
