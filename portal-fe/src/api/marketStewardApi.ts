import axios from 'axios';
import { attachRefreshRetry } from '../auth/refresh';
import type { ApiResponse } from './searchApi';

export type StewardStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
export interface Steward { id: number; marketId: number; memberId: number; orgName: string; contact: string; status: StewardStatus; createdAt: string }
export interface StoreInput { name: string; items: string | null; zoneId: number | null; membership: 'IN' | 'OUT' | 'UNKNOWN'; pinKind: 'EXACT' | 'REFERENCE'; latitude: number | null; longitude: number | null; referenceStoreId: number | null; relativePosition: string | null; positionNote: string | null }
export interface EditorZone { id: number; name: string; kind: 'ROAD' | 'BUILDING' | 'FLOOR' | 'CUSTOM'; parentId: number | null; polygonWkt: string | null; buildingName: string | null; dong: string | null; floor: string | null; sortOrder: number }
export interface EditorStore { source: Omit<StoreInput, 'membership'> & { id: number; source: 'MANUAL' | 'ONNURI' | 'SANGGA'; membership: { status: StoreInput['membership'] } }; display: { name: string; items: string | null; zoneId: number | null; membership: { status: StoreInput['membership'] }; coordinate: { latitude: number; longitude: number } | null; pinKind: StoreInput['pinKind'] } }
export interface MarketEditorDetail { market: { id: number; name: string }; stores: EditorStore[]; zones: EditorZone[] }
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '', timeout: 10_000 });
attachRefreshRetry(api);
const base = (id: number) => `/api/v1/place/markets/${id}`;
export async function currentSteward(id: number) { return (await api.get<ApiResponse<Steward | null>>(`${base(id)}/steward-applications/me`)).data.data; }
export async function applySteward(id: number, orgName: string, contact: string) { return (await api.post<ApiResponse<Steward>>(`${base(id)}/steward-applications`, { orgName: orgName.trim(), contact: contact.trim() })).data.data; }
export async function getManagedMarket(id: number) { return (await api.get<ApiResponse<MarketEditorDetail>>(`${base(id)}/manage`)).data.data; }
export async function overrideManagedStore(id: number, storeId: number, values: Record<string, string | null>, reason: string) { await api.put(`${base(id)}/manage/stores/${storeId}/override`, { values, clear: [], reason: reason.trim() }); }
export async function saveManagedStore(id: number, storeId: number | null, data: StoreInput) { if (storeId == null) await api.post(`${base(id)}/manage/stores`, data); else await api.put(`${base(id)}/manage/stores/${storeId}`, data); }
export async function deleteManagedStore(id: number, storeId: number) { await api.delete(`${base(id)}/manage/stores/${storeId}`); }
export async function renameManagedZone(id: number, zone: EditorZone, name: string) { const { id: zoneId, ...payload } = zone; await api.put(`${base(id)}/manage/zones/${zoneId}`, { ...payload, name: name.trim() }); }
