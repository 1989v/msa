import { apiClient } from './client';
import type { Page } from './markets';
export type StewardStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';
export type StewardAction = 'APPROVE' | 'REJECT' | 'SUSPEND' | 'RESTORE';
export interface Steward { id: number; marketId: number; memberId: number; orgName: string; contact: string; status: StewardStatus; createdAt: string }
const base = '/api/v1/admin/place/stewards';
export async function listStewards(status: StewardStatus | '', page = 0) { return (await apiClient.get<{ data: Page<Steward> }>(base, { params: { ...(status ? { status } : {}), page, size: 20 } })).data.data; }
export async function decideSteward(id: number, action: StewardAction) { await apiClient.put(`${base}/${id}`, { action }); }
