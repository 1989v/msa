import { apiClient } from './client';
export type LatLng = [number, number];
export interface Boundary { polygon: LatLng[]; source: 'OSM' | 'DERIVED' | 'MANUAL'; osmId: string | null }
export interface MarketPath { id: number; name: string | null; named: boolean; geometry: LatLng[]; source: 'OSM' | 'MANUAL' }
export interface Entrance { id: number; lat: number; lng: number; pathId: number | null; label: string | null; source: 'OSM' | 'MANUAL' }
export interface RoadRule { id: number; roadName: string; buildingNoFrom: number | null; buildingNoTo: number | null; membership: 'IN' | 'OUT'; reason: string }
export interface Geo { centerLat: number; centerLng: number; radiusM: number; centerOverridden: boolean; radiusOverridden: boolean }
export interface Geometry { boundary: Boundary | null; paths: MarketPath[]; entrances: Entrance[]; roadRules: RoadRule[]; geo: Geo; background: { roads: { name: string | null; highway: string; geometry: LatLng[] }[] }; attribution: string[] }
export interface ReviewStore { storeId: number; name: string; roadAddress: string | null; lat: number; lng: number; pathId: number | null; suggestedPathId: number | null }
export interface Rejudged { rejudge: { changedStores: number } }
type Envelope<T> = { data: T };
const base = (id: number) => `/api/v1/admin/place/markets/${id}`;
export async function getGeometry(id: number) { return (await apiClient.get<Envelope<Geometry>>(`${base(id)}/geometry`)).data.data; }
export async function getNeedsReview(id: number) { return (await apiClient.get<Envelope<ReviewStore[]>>(`${base(id)}/needs-review`)).data.data; }
export async function saveBoundary(id: number, polygon: LatLng[], reason: string) { return (await apiClient.put<Envelope<Rejudged & { boundary: Boundary }>>(`${base(id)}/boundary`, { polygon, reason })).data.data; }
export async function resetBoundary(id: number, to: 'OSM' | 'DERIVED', reason: string) { return (await apiClient.post<Envelope<Rejudged & { boundary: Boundary }>>(`${base(id)}/boundary/reset`, { to, reason })).data.data; }
export async function savePath(id: number, pathId: number | null, payload: { name: string | null; geometry: LatLng[]; reason: string }) { const url = `${base(id)}/paths${pathId == null ? '' : `/${pathId}`}`; return (await (pathId == null ? apiClient.post<Envelope<Rejudged & { path: MarketPath }>>(url, payload) : apiClient.put<Envelope<Rejudged & { path: MarketPath }>>(url, payload))).data.data; }
export async function saveEntrance(id: number, entranceId: number | null, payload: { lat: number; lng: number; pathId: number | null; label: string | null; reason: string }) { const url = `${base(id)}/entrances${entranceId == null ? '' : `/${entranceId}`}`; return (await (entranceId == null ? apiClient.post<Envelope<{ entrance: Entrance }>>(url, payload) : apiClient.put<Envelope<{ entrance: Entrance }>>(url, payload))).data.data; }
export async function saveRoadRule(id: number, ruleId: number | null, payload: Omit<RoadRule, 'id'>) { const url = `${base(id)}/road-rules${ruleId == null ? '' : `/${ruleId}`}`; return (await (ruleId == null ? apiClient.post<Envelope<Rejudged & { roadRule: RoadRule }>>(url, payload) : apiClient.put<Envelope<Rejudged & { roadRule: RoadRule }>>(url, payload))).data.data; }
export async function deleteGeometryItem(id: number, kind: 'paths' | 'entrances' | 'road-rules', itemId: number, reason: string) { return (await apiClient.delete<Envelope<Partial<Rejudged>>>(`${base(id)}/${kind}/${itemId}`, { params: { reason } })).data.data; }
export async function saveGeo(id: number, payload: { centerLat: number | null; centerLng: number | null; radiusM: number | null; reason: string }) { return (await apiClient.put<Envelope<Rejudged & { geo: Geo }>>(`${base(id)}/geo`, payload)).data.data; }
export async function assignStorePath(id: number, storeId: number, pathId: number | null, reason: string) { return (await apiClient.put<Envelope<Rejudged>>(`${base(id)}/stores/${storeId}/path`, { pathId, reason })).data.data; }
