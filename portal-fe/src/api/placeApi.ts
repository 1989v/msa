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
  /**
   * 원어 병기명 — title 이 정제된 표시명이고, 괄호로 붙어 있던 현지어 이름이 여기로 분리된다
   * (예: en title "Dosan Park" / titleLocal "도산공원"). 구 응답에는 없다 — 없으면 표시하지 않는다.
   * 두 이름을 다시 한 문자열로 합치지 않는다 (titleParts 로만 소비).
   */
  titleLocal?: string | null;
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

/**
 * 한국 행정구역 (ADR-0071). GeoNames 지명 계층(`/api/places/regions`)과 다른 축이다 —
 * 그쪽은 흥해읍·왜관읍이 CITY 로 섞인 지명 데이터셋이라 시군구로 쓸 수 없다.
 */
export interface AdminRegion {
  code: string;
  parentCode: string | null;
  level: 'SIDO' | 'SIGUNGU';
  name: string;
  nameEn: string | null;
  latitude: number | null;
  longitude: number | null;
  /** 관광 분류 건수. lang 을 안 주면 null — 0(관광지 없음)과 다른 뜻이다. */
  attractionCount: number | null;
}

export const fetchAdminRegions = async (
  params: { level?: 'SIDO' | 'SIGUNGU'; parent?: string; lang?: PlaceLang },
): Promise<AdminRegion[]> => {
  const qs = new URLSearchParams();
  if (params.level) qs.set('level', params.level);
  if (params.parent) qs.set('parent', params.parent);
  if (params.lang) qs.set('lang', params.lang);
  const res = await api.get<ApiResponse<{ regions: AdminRegion[] }>>(
    `/api/places/admin-regions?${qs}`,
  );
  return res.data.data.regions;
};

export interface AttractionQuery {
  keyword?: string;
  lang: PlaceLang;
  areaCode?: string;
  /** 법정동 축 (ADR-0071). areaCode 와 같이 보내지 않는다 — 어느 쪽이 이기는지 알 수 없다. */
  sidoCode?: string;
  sigunguCode?: string;
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
  if (query.sidoCode) params.set('sidoCode', query.sidoCode);
  if (query.sigunguCode) params.set('sigunguCode', query.sigunguCode);
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

export interface CollectedLink {
  source: 'YOUTUBE' | 'NAVER_BLOG';
  title: string;
  url: string;
  thumbnailUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  /** 영상 조회수. 인기순 정렬의 근거이자 카드에 보이는 값. */
  viewCount: number | null;
}

export interface AttractionLinks {
  collected: CollectedLink[];
  deepLinks: AttractionDeepLink[];
  /** 수집 대기 — 오류가 아니다. 조회가 큐를 채우고 CronJob 이 비운다. */
  pending: boolean;
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
  /** 원어 병기명 (Attraction.titleLocal 과 같은 계약) — 구 응답·지역 항목에는 없다 */
  titleLocal?: string | null;
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
