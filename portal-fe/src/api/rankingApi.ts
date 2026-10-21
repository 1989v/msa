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
  brandSlug: string; brandName: string; menuName: string; menuNameEn: string | null;
  sourceCategory: string | null; temperature: string | null; sizeLabel: string | null;
  volumeMl: number | null; servingBasis: string | null; kcal: number | null; sugarG: number | null;
  sodiumMg: number | null; carbsG: number | null; fatG: number | null; satFatG: number | null;
  proteinG: number | null; caffeineMg: number | null; caffeineStatus: CaffeineStatus;
  rawNutrition: Record<string, string>; priceKrw: number | null; priceNote: string | null;
  allergens: string | null; sourceUrl: string; checkedAt: string; notes: string | null;
  cupVolumeMl: number | null; volumeSource: 'ROW' | 'BRAND_SIZE_TABLE' | 'NONE'; kcalPer100ml: number | null;
  drinkGroup: string; sugarPer100ml: number | null; caffeinePer100ml: number | null;
}
export interface CafeDrinkPage { content: CafeDrink[]; totalElements: number; page: number; size: number }
export interface CafeBrand { brandSlug: string; brandName: string; count: number; sourceUrls: string[]; checkedAt: string }
export interface CafeGroup { group: string; count: number }
export interface CafeFilters {
  q?: string; brand?: string[]; group?: string; temperature?: string;
  maxSugar?: number; maxCaffeine?: number; caffeine?: 'none' | 'zero' | 'decaf'; caffeineStatus?: CaffeineStatus[]; basis?: 'serving' | '100ml';
  sort?: 'sugar' | 'caffeine' | 'kcal' | 'sugarPer100ml'; page?: number; size?: number;
}
export const fetchCafeDrinks = async (filters: CafeFilters): Promise<CafeDrinkPage> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
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
