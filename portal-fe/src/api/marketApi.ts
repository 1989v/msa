import axios from 'axios';
import type { ApiResponse } from './searchApi';
import type { PlaceLang } from './placeApi';

export interface MarketZone {
  id: number | null;
  parentId: number | null;
  kind: 'ROAD' | 'BUILDING' | 'FLOOR' | 'CUSTOM';
  name: string;
  dong: string | null;
  floor: string | null;
  children: MarketZone[];
}

export interface MarketStore {
  id: number | null;
  name: string;
  items: string | null;
  zoneId: number | null;
  pathId?: number | null;
  membership: 'IN' | 'OUT' | 'UNKNOWN';
  latitude: number | null;
  longitude: number | null;
  roadAddress: string | null;
  jibunAddress: string | null;
  buildingName: string | null;
  dong: string | null;
  floor: string | null;
  ho: string | null;
  categoryMajor: string | null;
  categoryMid: string | null;
  categorySub: string | null;
  sources: Array<'ONNURI' | 'SANGGA' | 'MANUAL'>;
  pinKind: 'EXACT' | 'REFERENCE';
  manual: boolean;
  actorKind: 'ADMIN' | 'STEWARD' | null;
  relativePosition: string | null;
  positionNote: string | null;
}

export type MarketCoordinate = [number, number]; // [latitude, longitude]
export interface MarketBoundary {
  polygon: MarketCoordinate[];
  source: 'OSM' | 'DERIVED' | 'MANUAL';
  osmId?: string | null;
}
export interface MarketPath {
  id: number;
  name: string | null;
  named: boolean;
  geometry: MarketCoordinate[];
  source: 'OSM' | 'MANUAL';
}
export interface MarketEntrance {
  id: number;
  lat: number;
  lng: number;
  pathId: number | null;
  label: string | null;
  source: 'OSM' | 'MANUAL';
}

export interface MarketResponse {
  boundary?: MarketBoundary | null;
  paths?: MarketPath[] | null;
  entrances?: MarketEntrance[] | null;
  attribution?: string[] | null;
  market: {
    id?: number | null;
    name: string;
    marketType: 'STREET' | 'BUILDING' | 'MIXED';
    sourceMarketType: string | null;
    storeCountRaw: string | null;
    openingCycle: string | null;
    facilities: string | null;
    attribution: { name: string; url: string; license: string } | null;
  };
  zones: MarketZone[];
  stores: MarketStore[];
}

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8089' });

export async function fetchMarket(contentId: string, includeOutside: boolean, lang: PlaceLang = 'ko'): Promise<MarketResponse | null> {
  const response = await api.get<ApiResponse<MarketResponse | null>>(
    `/api/v1/place/markets/${encodeURIComponent(contentId)}`,
    { params: { includeOutside, lang } },
  );
  return response.data.data;
}

export interface MarketSearchResult {
  query: string;
  markets: Array<{ contentId: string; name: string; region: string | null; marketType: string; storeCount: number }>;
  stores: {
    items: Array<{ storeId: number; name: string; items: string | null; category: string | null; marketContentId: string; marketName: string; zoneName: string | null; latitude: number | null; longitude: number | null }>;
    total: number; page: number; size: number;
  };
}

export async function searchMarkets(q: string, lang: PlaceLang = 'ko', page = 0, size = 20): Promise<MarketSearchResult> {
  const response = await api.get<ApiResponse<MarketSearchResult>>('/api/v1/place/markets/search', {
    params: { q: q.trim().slice(0, 50), lang, page: Math.max(0, page), size: Math.min(50, Math.max(1, size)) },
  });
  return response.data.data;
}

export async function fetchMarketContentIds(): Promise<string[]> {
  const response = await api.get<ApiResponse<string[]>>('/api/v1/place/markets/content-ids');
  return response.data.data;
}
