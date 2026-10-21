import { apiClient } from './client';
interface ApiResponse<T> { success: boolean; data: T }

export const RANKING_BASE = '/api/v1/admin/ranking';
export type CorrectionState = 'ACTIVE' | 'CONFLICT' | 'ORPHANED';
export type CorrectionAction = 'SET' | 'SET_UNKNOWN' | 'RESET';
export type FieldChange = { action: CorrectionAction; value?: string | null };
export interface Drink {
  brandSlug: string; brandName: string; menuName: string; displayName?: string | null;
  sourceCategory: string | null; temperature: string | null; sizeLabel: string | null; caffeineStatus: string;
  volumeMl: number | null; servingBasis: string | null; cupVolumeMl: number | null; volumeSource: string;
  kcal: number | null; sugarG: number | null; caffeineMg: number | null; sodiumMg: number | null;
  carbsG: number | null; fatG: number | null; satFatG: number | null; proteinG: number | null;
  sourceUrl: string; checkedAt: string; notes: string | null; rawNutrition: Record<string, string>;
  drinkGroup: string; drinkKey: string; sugarPer100ml: number | null; caffeinePer100ml: number | null; kcalPer100ml: number | null;
}
export interface Correction { evidenceUrl?: string | null; evidenceCheckedAt?: string | null; correctionReason?: string | null; sourceSnapshot?: Drink | null; dependencies?: Record<string, string | null>; action: CorrectionAction; value: string | null; baseline: string; state: CorrectionState; reason?: string | null; detectedAt?: string | null; runId?: string | null }
export interface DrinkDetail { drinkKey: string; source: Drink | null; sourceSnapshot?: Drink | null; derived: Drink | null; override: Record<string, Correction>; effective: Drink | null; adminNote: string | null; revision: number; generation: number }
export interface Page<T> { items: T[]; total: number; page: number; size: number; summary?: Record<string, number> }
export interface Evidence { reason: string; evidenceUrl: string; evidenceCheckedAt: string }
export interface Operation { operationId: string; actorId: number; at: string; changed: number; auditIds: string[]; revisions: Record<string, number>; generations: Record<string, number> }
export interface PreviewTarget { drinkKey: string; brandSlug: string; menuName: string | null; temperature: string | null; sizeLabel: string | null; caffeineStatus: string | null; sourceCategory: string | null; derivedGroup: string | null; before: string | null; after: string | null; outcome: string; blockedReason: string | null }
export interface Preview { targets?: PreviewTarget[]; previewToken: string; expiresAt: string; changed: string[]; unchanged: string[]; blocked: string[]; request: { keys: string[]; targetGroup: string }; revisions: Record<string, number>; generations: Record<string, number> }
export interface Group { group: string; derivedCount: number; effectiveCount: number; correctedCount: number; conflictCount: number }
export interface Groups { allowedGroups: string[]; items: Group[] }
export interface Verification { brandSlug: string; revision: number; generation: number; officialUrls: string[]; verifiedAt: string | null; verificationNote: string | null }
export interface Brand { brandSlug: string; brandName: string; count: number; sourceUrls: string[]; minCheckedAt: string; maxCheckedAt: string; unknownVolumeCount: number; verification: Verification; rights: string }
export interface Run { job: string; actor: string; generationBefore: Record<string, number>; generationAfter: Record<string, number>; checkedAtMin: string | null; checkedAtMax: string | null; elapsedMs: number | null; errorSummary: string | null; runId: string; parentRunId: string | null; brands: string[]; startedAt: string; finishedAt: string | null; status: string; attemptedRows: number; committedRows: number; removedRows: number; overrideReapplied: number; conflictFields: number; orphanedKeys: number; errorCode: string | null; stage: string | null }
export interface Conflict { sourceSnapshot?: Drink | null; currentSourceSnapshot?: Drink | null; baselineDependencies?: Record<string, string | null>; currentDependencies?: Record<string, string | null>; id: string; drinkKey: string; brandSlug: string; field: string; correction: Correction; state: CorrectionState; currentSource: string | null; currentEffective: string | null; revision: number; generation: number }
export interface CorrectionSet { revision: number; fields: Record<string, Correction> }
export interface Audit { id: string; operationId: string; actorId: string; at: string; targetKey: string; brandSlug: string; before: CorrectionSet | null; after: CorrectionSet | null; beforeBrand: Verification | null; afterBrand: Verification | null; sourceGeneration: number; reason: string; evidenceUrl: string | null; evidenceCheckedAt: string | null; source: Drink | null; beforeEffective: Drink | null; afterEffective: Drink | null }
export interface AuditRow { event: Audit; revertible: boolean; revertBlockedReason: string | null }
export interface GasBoard { id: number; slug: string; scope: string; fuel: string; title: string; status: string; health: string; latestSnapshotId: number | null; capturedAt: string | null; entryCount: number | null; actualCount: number }
export interface Snapshot { id: number; boardId: number; capturedAt: string; entryCount: number; actualCount: number; latest: boolean }
export interface SnapshotDetail extends Snapshot { consistent: boolean; entries: { rank: number; score: number; prevRank: number | null; subjectKey: string; subjectName: string; payload: string | null }[] }
export async function rankingGet<T>(path: string, params?: URLSearchParams): Promise<T> {
  return (await apiClient.get<ApiResponse<T>>(`${RANKING_BASE}/${path}`, { params })).data.data;
}
export async function rankingWrite<T>(method: 'post' | 'patch', path: string, payload: object): Promise<T> {
  return (await apiClient[method]<ApiResponse<T>>(`${RANKING_BASE}/${path}`, payload)).data.data;
}

export interface RevertPreview { operationId: string; reversible: boolean; targets: { targetKey: string; before: CorrectionSet | null; restored: CorrectionSet | null; beforeBrand: Verification | null; restoredBrand: Verification | null; reversible: boolean; blockedReason: string | null }[] }
