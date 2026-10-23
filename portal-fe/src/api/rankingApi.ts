import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8089',
  timeout: 15_000,
});

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

/** 등락 — 서버가 종류와 칸 수로 나눠 준다. NEW 는 SAME 과 다른 것이다 (ADR-0081). */
export interface Movement {
  type: 'NEW' | 'SAME' | 'UP' | 'DOWN';
  places: number | null;
}

export interface RankingEntry {
  rank: number;
  subjectKey: string;
  subjectName: string;
  score: number;
  movement: Movement;
  payload: Record<string, unknown>;
}

export interface RankingBoardSummary {
  slug: string;
  title: string;
  subtitle: string | null;
  scopeKey: string;
  scopeName: string;
  unit: string;
  sourceLabel: string;
  capturedAt: string | null;
  entryCount: number;
  topName: string | null;
  topScore: number | null;
}

export interface RankingBoardDetail {
  slug: string;
  title: string;
  subtitle: string | null;
  scopeKey: string;
  scopeName: string;
  unit: string;
  sourceLabel: string;
  capturedAt: string | null;
  entries: RankingEntry[];
}

export interface RankingScope {
  code: string;
  name: string;
}

export const fetchRankingBoards = async (scope?: string): Promise<RankingBoardSummary[]> => {
  const res = await api.get<ApiResponse<RankingBoardSummary[]>>('/api/v1/ranking/boards', {
    params: scope ? { domain: 'GAS_STATION', scope } : undefined,
  });
  return res.data.data;
};

export const fetchRankingBoard = async (slug: string): Promise<RankingBoardDetail> => {
  const res = await api.get<ApiResponse<RankingBoardDetail>>(`/api/v1/ranking/boards/${slug}`);
  return res.data.data;
};

export const fetchGasAreas = async (): Promise<RankingScope[]> => {
  const res = await api.get<ApiResponse<RankingScope[]>>('/api/v1/ranking/gas/areas');
  return res.data.data;
};


export type CaffeineStatus = 'DISCLOSED' | 'ZERO' | 'DECAF' | 'UNDISCLOSED';
export interface CafeDrink {
  drinkKey: string;
  drinkName?: string;
  brandSlug: string; brandName: string; menuName: string; menuNameEn: string | null;
  sourceCategory: string | null; temperature: string | null; sizeLabel: string | null;
  volumeMl: number | null; servingBasis: string | null; kcal: number | null; sugarG: number | null;
  sodiumMg: number | null; carbsG: number | null; fatG: number | null; satFatG: number | null;
  proteinG: number | null; caffeineMg: number | null; caffeineStatus: CaffeineStatus;
  /** Raw source is admin-only; optional for cached legacy responses. */
  rawNutrition?: Record<string, string>;
  officialSourceUrl?: string; officialCheckedAt?: string;
  correctionEvidence?: Record<string, { evidenceUrl: string; evidenceCheckedAt: string; reason: string }>; priceKrw: number | null; priceNote: string | null;
  allergens: string | null; sourceUrl: string; checkedAt: string; notes: string | null;
  cupVolumeMl: number | null; volumeSource: 'ROW' | 'BRAND_SIZE_TABLE' | 'NONE' | 'ADMIN_VERIFIED'; kcalPer100ml: number | null;
  drinkGroup: string; sugarPer100ml: number | null; caffeinePer100ml: number | null;
}
export interface CafeDrinkPage { content: CafeDrink[]; totalElements: number; page: number; size: number; sizeLabels?: string[]; brandGroups?: CafeSearchBrand[]; menuCount?: number; brandCounts?: CafeBrandFacet[] }
export interface CafeBrand { brandSlug: string; brandName: string; count: number; sourceUrls: string[]; checkedAt: string }
export interface CafeGroup { group: string; count: number }
export interface CafeFilters {
  grouped?: boolean;
  category?: string; // UI category slug; API queries use the expanded group/caffeine fields.
  q?: string; brand?: string[]; group?: string | string[]; temperature?: string;
  maxSugar?: number; maxCaffeine?: number; maxKcal?: number; sizeLabel?: string; caffeine?: 'none' | 'zero' | 'decaf'; caffeineStatus?: CaffeineStatus[]; basis?: 'serving' | '100ml';
  direction?: 'asc' | 'desc';
  sort?: 'sugar' | 'caffeine' | 'kcal' | 'sugarPer100ml'; page?: number; size?: number;
}
export const fetchCafeDrinks = async (filters: CafeFilters): Promise<CafeDrinkPage> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (key === 'category') return;
    if (Array.isArray(value)) value.forEach(item => params.append(key, item));
    else if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return (await api.get<ApiResponse<CafeDrinkPage>>('/api/v1/ranking/cafe/drinks', { params })).data.data;
};
export const fetchCafeBrands = async (): Promise<CafeBrand[]> =>
  (await api.get<ApiResponse<CafeBrand[]>>('/api/v1/ranking/cafe/brands')).data.data;
export const fetchCafeGroups = async (): Promise<CafeGroup[]> =>
  (await api.get<ApiResponse<CafeGroup[]>>('/api/v1/ranking/cafe/groups')).data.data;

export const fetchCafeDrink = async (drinkKey: string): Promise<CafeDrink> =>
  (await api.get<ApiResponse<CafeDrink>>(`/api/v1/ranking/cafe/drinks/${encodeURIComponent(drinkKey)}`)).data.data;

export interface CafeSearchBrand { brandSlug: string; brandName: string; menus: CafeBrandVariants[] }
export interface CafeBrandFacet { brandSlug: string; brandName: string; count: number }
export interface CafeDrinkName { drinkName: string; brandCount: number; rowCount: number }
export interface CafeBrandVariants { brandSlug: string; brandName: string; representative: CafeDrink; variants: CafeDrink[] }
export const fetchCafeDrinkNames = async (q: string): Promise<CafeDrinkName[]> =>
  (await api.get<ApiResponse<CafeDrinkName[]>>('/api/v1/ranking/cafe/drink-names', { params: { q } })).data.data;
export const fetchCafeComparison = async (name: string, filters: CafeFilters): Promise<CafeBrandVariants[]> => {
  const params = new URLSearchParams({ name });
  Object.entries(filters).forEach(([key, value]) => {
    if (key === 'category') return;
    if (Array.isArray(value)) value.forEach(item => params.append(key, item));
    else if (value !== undefined) params.set(key, String(value));
  });
  return (await api.get<ApiResponse<CafeBrandVariants[]>>('/api/v1/ranking/cafe/drink-names/compare', { params })).data.data;
};

export interface CafeNearbyCapability { nearbyEnabled: boolean; reason: string; sourceAsOf: string | null; fetchedAt: string | null }
export interface CafeArea { code: string; name: string; level: 'PROVINCE' | 'DISTRICT'; parentCode: string | null; centerSource: string; sourceAsOf: string | null }
export interface CafeStore {
  storeKey: string; brandSlug: string; brandName: string; storeName: string; branchName: string | null; displayName?: string;
  address: string; latitude: number; longitude: number; distanceM: number; mappingStatus: string;
  selectedDrink: CafeDrink | null; variants: CafeDrink[]; selectionRequired: boolean; autoSelected: boolean;
  sourceAsOf: string | null; menuAvailability: 'UNVERIFIED';
}
export interface CafeNearbyResult {
  basis: 'serving' | '100ml'; sort: string; radiusKm: number; locationKind: string; areaLabel: string | null;
  coverage: { status: string; reason: string; brands: string[] }; storeSource: string;
  storeSourceAsOf: string | null; storeFetchedAt: string; projectionAsOf: string; mappingRuleVersion: string;
  brandCounts?: CafeBrandFacet[];
  nearbyStoresWithoutNutrition?: number; totalStores: number | null; matchedBrands: number; page: number; size: number; hasNext: boolean; items: CafeStore[];
}
export type CafeLocation = { kind: 'CURRENT'; lat: number; lng: number } | { kind: 'AREA'; areaCode: string };
export const fetchCafeNearbyCapability = async (): Promise<CafeNearbyCapability> =>
  (await api.get<ApiResponse<CafeNearbyCapability>>('/api/v1/ranking/cafe/capability')).data.data;
export const fetchCafeAreas = async (parent?: string): Promise<CafeArea[]> =>
  (await api.get<ApiResponse<CafeArea[]>>('/api/v1/ranking/cafe/areas', { params: { parent } })).data.data;

/** No Axios error/config, query cache or URL may retain the position body. */
export async function searchCafeNearby(body: object, signal: AbortSignal): Promise<CafeNearbyResult> {
  try {
    const response = await fetch(`${api.defaults.baseURL}/api/v1/ranking/cafe/nearby-search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal, cache: 'no-store', credentials: 'omit',
    });
    if (!response.ok) throw new Error('Nearby request unavailable');
    const envelope = await response.json() as ApiResponse<CafeNearbyResult>;
    if (!envelope.success) throw new Error('Nearby request unavailable');
    return envelope.data;
  } catch { throw new Error('주변 검색을 완료하지 못했습니다'); }
}
