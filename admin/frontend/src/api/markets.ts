import { apiClient } from './client';

export type Membership = 'IN' | 'OUT' | 'UNKNOWN';
export type PinKind = 'EXACT' | 'REFERENCE';
export type ZoneKind = 'ROAD' | 'BUILDING' | 'FLOOR' | 'CUSTOM';
export interface Coordinate { latitude: number; longitude: number }
export interface Market { id: number; name: string; marketType: 'STREET' | 'BUILDING' | 'MIXED'; latitude: number | null; longitude: number | null }
export interface ZonePayload { name: string; kind: ZoneKind; parentId: number | null; polygonWkt: string | null; buildingName: string | null; dong: string | null; floor: string | null; sortOrder: number }
export interface Zone extends ZonePayload { id: number; source: 'AUTO' | 'MANUAL' }
export interface ManualStorePayload { name: string; items: string | null; zoneId: number | null; membership: Membership; pinKind: PinKind; latitude: number | null; longitude: number | null; referenceStoreId: number | null; relativePosition: string | null; positionNote: string | null }
export interface StoreSource extends Omit<ManualStorePayload, 'membership'> { id: number; marketId: number; membership: { status: Membership }; source: 'ONNURI' | 'SANGGA' | 'MANUAL'; actorKind: 'ADMIN' | 'STEWARD' | null }
export type OverrideField = 'name' | 'items' | 'zoneId' | 'membership' | 'latitude' | 'longitude';
export interface StoreRow { source: StoreSource; display: { name: string; items: string | null; zoneId: number | null; membership: { status: Membership }; coordinate: Coordinate | null; pinKind: PinKind }; overrides: { field: string; value: string | null; reason: string; memberId: number }[] }
export interface Detail { market: Market; zones: Zone[]; stores: StoreRow[] }
export interface Page<T> { items: T[]; total: number; page: number; size: number }
export interface Change { id: number; target: string; targetId: number; action: string; memberId: number; actorKind: string; beforeRaw: string | null; afterRaw: string | null; createdAt: string }
export interface OverridePayload { values: Partial<Record<OverrideField, string | null>>; clear: OverrideField[]; reason: string }
interface Envelope<T> { data: T }
const base = '/api/v1/admin/place/markets';
export async function listMarkets(name: string, page = 0) { return (await apiClient.get<Envelope<Page<Market>>>(base, { params: { name, page, size: 20 } })).data.data; }
export async function getMarket(id: number) { return (await apiClient.get<Envelope<Detail>>(`${base}/${id}`)).data.data; }
export async function overrideStore(id: number, storeId: number, payload: OverridePayload) { await apiClient.put(`${base}/${id}/stores/${storeId}/override`, payload); }
export async function saveManualStore(id: number, storeId: number | null, payload: ManualStorePayload) { if (storeId == null) await apiClient.post(`${base}/${id}/stores`, payload); else await apiClient.put(`${base}/${id}/stores/${storeId}`, payload); }
export async function deleteManualStore(id: number, storeId: number) { await apiClient.delete(`${base}/${id}/stores/${storeId}`); }
export async function saveZone(id: number, zoneId: number | null, payload: ZonePayload) { await apiClient.put(`${base}/${id}/zones${zoneId == null ? '' : `/${zoneId}`}`, payload); }
export async function deleteZone(id: number, zoneId: number) { await apiClient.delete(`${base}/${id}/zones/${zoneId}`); }
export async function orderZones(id: number, ids: number[]) { await apiClient.put(`${base}/${id}/zones/order`, ids); }
export async function getChanges(id: number, page = 0) { return (await apiClient.get<Envelope<Page<Change>>>(`${base}/${id}/changes`, { params: { page, size: 20 } })).data.data; }
export async function revertChange(id: number, changeId: number) { await apiClient.post(`${base}/${id}/changes/${changeId}/revert`); }
