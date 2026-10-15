import { apiClient } from './client';
export type GeometryKind = 'BOUNDARY' | 'PATH' | 'ENTRANCE' | 'NOTE';
export type GeometryStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface GeometryRequest { id: number; marketId: number; kind: GeometryKind; geometry: [number, number][] | null; description: string; status: GeometryStatus; createdAt: string; decisionReason: string | null }
const base = '/api/v1/admin/place/markets/geometry-requests';
export async function listGeometryRequests(status: GeometryStatus | '') { return (await apiClient.get<{ data: GeometryRequest[] }>(base, { params: status ? { status } : {} })).data.data; }
export async function decideGeometryRequest(id: number, action: 'APPROVE' | 'REJECT', reason: string) { await apiClient.put(`${base}/${id}`, { action, reason: reason.trim() }); }
