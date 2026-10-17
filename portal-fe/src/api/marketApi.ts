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

export interface GoodPriceMenu { nameEn?: string | null; name: string; price: number | null }
export interface GoodPriceShop { category: string; menus: GoodPriceMenu[] }
export interface GoodPriceSummary {
  storeCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  attribution: { name: string; url: string; license: string };
}

export interface MarketEnglishFields {
  nameEn?: string | null; categoryEn?: string | null; itemsEn?: string | null;
}
export interface MarketDish { dish: string; categorySub: string; dishEn: string }
export interface MarketTourMenu {
  firstMenu: string | null; treatMenu: string | null; firstMenuEn?: string | null; treatMenuEn?: string | null;
  attraction: MarketAttractionRef;
}
export interface MarketRestaurant extends MarketTourMenu { title: string; nameEn?: string | null; latitude: number; longitude: number }
export type MarketMatchedBy = MatchedBy | 'RELATED_CATEGORY';

export interface MarketStore extends MarketEnglishFields {
  tourMenu?: MarketTourMenu | null;
  id: number | null;
  name: string;
  items: string | null;
  zoneId: number | null;
  pathId?: number | null;
  membership: 'IN' | 'OUT' | 'UNKNOWN';
  nearby?: boolean;
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
  goodPrice?: (GoodPriceShop & { matchedBy: 'NAME' | 'ROAD' }) | null;
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
  restaurants?: MarketRestaurant[] | null;
  nearbyRadiusMetres?: number | null;
  boundary?: MarketBoundary | null;
  paths?: MarketPath[] | null;
  entrances?: MarketEntrance[] | null;
  attribution?: string[] | null;
  market: {
    contentId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    id?: number | null;
    name: string;
    marketType: 'STREET' | 'BUILDING' | 'MIXED';
    goodPrice?: GoodPriceSummary | null;
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

/** Detail pages are keyed by attraction id per language; Korean when the requested language has none. */
export interface MarketAttractionRef { id: number; lang: PlaceLang }

export interface MarketSearchResult {
  query: string;
  markets: Array<{ contentId: string; name: string; region: string | null; marketType: string; storeCount: number; attraction: MarketAttractionRef | null }>;
  stores: {
    items: Array<MarketEnglishFields & { matchedBy?: MarketMatchedBy; relatedCategory?: string | null; tourMenu?: MarketTourMenu | null; goodPrice?: GoodPriceShop | null; storeId: number; name: string; items: string | null; category: string | null; marketContentId: string; marketName: string; zoneName: string | null; latitude: number | null; longitude: number | null; attraction: MarketAttractionRef | null }>;
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

export async function fetchMarketDishes(): Promise<MarketDish[]> {
  const response = await api.get<ApiResponse<MarketDish[]>>('/api/v1/place/markets/dishes');
  return response.data.data;
}

export type MatchedBy = 'NAME' | 'ITEMS' | 'MENU' | 'CATEGORY' | 'DISH' | 'ROMAN';
export interface MarketStoreSearchDisplay {
  name?: string | null; nameEn?: string | null; categorySub?: string | null; categorySubEn?: string | null;
  address?: string | null; buildingName?: string | null; dong?: string | null; floor?: string | null; ho?: string | null;
  goodPrice?: boolean | null; goodPriceMenus?: string[] | null; sources?: string[] | null;
  membership?: string | null; nearby?: boolean | null; marketName?: string | null; attraction?: MarketAttractionRef | null;
}
export interface MarketStoreSearchResult {
  items: Array<MarketStoreSearchDisplay & { storeId: number; contentId: string; matchedBy: MatchedBy; score: number }>;
  total: number;
  markets: Array<{ contentId: string; marketName: string; count: number; marketNameEn?: string | null; region?: string | null; marketType?: string | null; attraction?: MarketAttractionRef | null }>;
}
export async function searchMarketStores(q: string, options: { contentId?: string; lang: PlaceLang; page?: number; size?: number }): Promise<MarketStoreSearchResult | null> {
  try {
    const response = await api.get<ApiResponse<MarketStoreSearchResult>>('/api/v1/search/market-stores', {
      params: { q: q.trim().slice(0, 200), ...options },
    });
    const data = response.data?.data;
    const fields: MatchedBy[] = ['NAME', 'ITEMS', 'MENU', 'CATEGORY', 'DISH', 'ROMAN'];
    const optionalText = (value: unknown) => value == null || typeof value === 'string';
    const optionalBoolean = (value: unknown) => value == null || typeof value === 'boolean';
    const optionalStrings = (value: unknown) => value == null || (Array.isArray(value) && value.every(v => typeof v === 'string'));
    const attractionValid = (value: unknown) => value == null || (typeof value === 'object' && 'id' in value && Number.isSafeInteger(value.id) && Number(value.id) > 0 && 'lang' in value && (value.lang === 'ko' || value.lang === 'en'));
    // Search returns all matching named clauses; the existing section badge displays the first.
    if (data && Array.isArray(data.items)) data.items = data.items.map(item => item && ({ ...item, matchedBy: Array.isArray(item.matchedBy) ? item.matchedBy[0] : item.matchedBy }));
    if (response.data?.success === false || response.data?.error != null || !data || !Array.isArray(data.items) || !Number.isFinite(data.total) || !Array.isArray(data.markets)
      || !data.items.every(item => item && Number.isFinite(item.storeId) && typeof item.contentId === 'string' && fields.includes(item.matchedBy) && Number.isFinite(item.score)
        && [item.name, item.nameEn, item.categorySub, item.categorySubEn, item.address, item.buildingName, item.dong, item.floor, item.ho, item.membership, item.marketName].every(optionalText)
        && optionalBoolean(item.goodPrice) && optionalBoolean(item.nearby) && optionalStrings(item.goodPriceMenus) && optionalStrings(item.sources) && attractionValid(item.attraction))
      || !data.markets.every(market => market && typeof market.contentId === 'string' && typeof market.marketName === 'string' && Number.isFinite(market.count) && [market.marketNameEn, market.region, market.marketType].every(optionalText) && attractionValid(market.attraction))) return null;
    return data;
  } catch { return null; }
}
