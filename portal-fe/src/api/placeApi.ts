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
  /**
   * 대표 이미지 썸네일(TourAPI firstimage2, 150×100·약 18KB). 원본(imageUrl)은 약 500KB 라 카드 얼굴처럼
   * 작은 자리에는 이것을 쓴다. 색인이 새로 돌기 전 문서에는 없다 — 그때는 imageUrl.
   */
  thumbnailUrl?: string | null;
  tel: string | null;
  overview: string | null;
  /**
   * 이용정보 (TourAPI detailIntro2). 원천은 유형마다 키가 다르고(usetime / usetimeculture /
   * usetimeleports …) 서버가 하나로 모아 준다. 점진 보강이라 없을 수 있다 — 없는 줄은 안 그린다.
   */
  useTime?: string | null;
  restDate?: string | null;
  /** 이용요금. 관광지(12)·레포츠(28)에는 원천에 아예 없고 문화시설(14) 등에만 있다. */
  useFee?: string | null;
  parking?: string | null;
  parkingFee?: string | null;
  infoCenter?: string | null;
  /**
   * Google Places place_id — 구글맵 딥링크(`query_place_id=`)가 장소 카드에 착지하게 한다.
   * 점진 보강이라 없을 수 있다 — 없으면 주소/좌표 검색 링크로 폴백 (googleMapsSearchUrl).
   */
  googlePlaceId?: string | null;
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

/**
 * 관광 성격의 분류 — 목록·주변목록에 올리는 것 (place `Attraction.SIGHT_CATEGORIES` 와 같다).
 *
 * 적재의 절반 이상이 음식·쇼핑이라 **분류를 안 걸면 상점 목록이 된다.** 실제로 상세 페이지
 * 주변목록이 이걸 안 보내서 명동에서 국문·영문 모두 7건 전부 쇼핑이 나왔다 (2026-09-03).
 * 화면마다 각자 배열을 들고 있던 게 원인이라 여기 한 곳에 둔다.
 */
export const SIGHT_CATEGORIES = ['nature', 'history', 'culture', 'leisure'] as const;

/** 지도 위 토글로만 켜는 편의·식음 — 목록에는 올리지 않는다. */
export const OVERLAY_CATEGORIES = ['food', 'shopping'] as const;

/**
 * 관광지 상세 아래 "주변 편의시설" 캐로셀에 올리는 분류.
 *
 * `etc` 는 **뺀다** — 그 안은 전량이 병원·성형외과·한의원(신 분류 `EX05` 의료관광)이라
 * 관광지 옆에 붙이면 목록에서 걷어낸 것을 캐로셀로 되돌려 놓는 셈이다.
 * 그래서 "관광 분류가 아닌 전부" 가 아니라 이 셋을 명시한다.
 */
export const AMENITY_CATEGORIES = ['shopping', 'food', 'stay'] as const;

export interface AttractionQuery {
  keyword?: string;
  lang: PlaceLang;
  areaCode?: string;
  /** 법정동 축 (ADR-0071). areaCode 와 같이 보내지 않는다 — 어느 쪽이 이기는지 알 수 없다. */
  sidoCode?: string;
  sigunguCode?: string;
  /**
   * **필수다.** 빼면 음식·쇼핑이 섞여 들어온다 — 적재의 절반 이상이 그쪽이라
   * "관광지 목록" 이 상점 목록이 된다. 실제로 상세 페이지 주변목록과 지역 페이지가
   * 이걸 빠뜨려 명동 주변 7/7 이 쇼핑, 부산 중구 영문 상위에 안과가 올라와 있었다.
   *
   * 전부 보고 싶으면 그 의도를 적어서 넘긴다 — 기본값으로 슬쩍 열리게 두지 않는다.
   */
  category: string;
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
