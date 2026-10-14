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

export interface MarketResponse {
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
