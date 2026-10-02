import axios from 'axios';
import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }

/**
 * 광고 백오피스 API (ADR-0098) — `/api/v1/admin/ads/**`, ROLE_ADMIN.
 * 금액은 정수 마이크로 크레딧(1 크레딧 = 1,000,000). 광고주가 적은 문자열은 화면에서 텍스트로만 그린다.
 */
const BASE = '/api/v1/admin/ads';

export type CreativeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
export type CreativeRejectReason =
  | 'REGULATED_INDUSTRY'
  | 'ADULT'
  | 'GAMBLING'
  | 'MISLEADING'
  | 'LANDING_MISMATCH'
  | 'IMAGE_QUALITY';
export type AdvertiserStatus = 'ACTIVE' | 'SUSPENDED';
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED';
export type CampaignAction = 'START' | 'PAUSE' | 'RESUME' | 'END';
export type PlacementFormat = 'CARD' | 'BANNER';

export const REJECT_REASON_LABEL: Record<CreativeRejectReason, string> = {
  REGULATED_INDUSTRY: '규제 업권(의료·금융)',
  ADULT: '성인',
  GAMBLING: '도박',
  MISLEADING: '허위·과장',
  LANDING_MISMATCH: '랜딩 불일치',
  IMAGE_QUALITY: '이미지 품질',
};

export interface AdminCreative {
  id: number;
  campaignId: number;
  advertiserId: number;
  status: CreativeStatus;
  title: string;
  body: string;
  link: string;
  emoji: string | null;
  imageUrl: string | null;
  rejectReason: CreativeRejectReason | null;
  reviewedAt: string | null;
  /** 캠페인의 광고 형태. 싣기 전의 응답·HOUSE 는 없거나 null — 카드로 본다. 띠배너는 `title` 이 대체 텍스트다 */
  format?: PlacementFormat | null;
}

export interface AdminAdvertiser {
  id: number;
  kind: 'MEMBER' | 'SYSTEM';
  memberId: number | null;
  displayName: string;
  status: AdvertiserStatus;
  suspendReason: string | null;
  suspendedBy: number | null;
  suspendedAt: string | null;
}

/** 지면이 한 광고 형태에 대해 갖는 규격 — 허용 비율과 최저가(CPM 마이크로) */
export interface FormatSpec {
  format: PlacementFormat;
  aspectRatios: string[];
  floorMicros: number;
}

/** 지면 등록 입력 — 첫 형태 규격 하나. 요청은 `formats` 목록으로 보낸다(`createPlacement`). 다른 형태는 등록 뒤 규격 추가로 붙인다 */
export interface PlacementInput {
  key: string;
  host: string;
  format: PlacementFormat;
  aspectRatios: string[];
  floorMicros: number;
  active: boolean;
  paidAllowed: boolean;
  description: string;
}

/** 지면. `formats` 가 형태별 규격이다 */
export interface AdPlacement extends Omit<PlacementInput, keyof FormatSpec> {
  formats: FormatSpec[];
}

/** 형태별 최저가는 `updatePlacementFormatFloor` 로 바꾼다 */
export interface PlacementPatch {
  active?: boolean;
  paidAllowed?: boolean;
  description?: string;
}

export interface UnregisteredPlacement {
  placementKey: string;
  requests: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ContextMapping {
  contextKey: string;
  categoryCode: string;
  updatedBy: number | null;
  updatedAt: string;
}

export interface HostCategory {
  host: string;
  categoryCode: string;
  updatedBy: number | null;
  updatedAt: string;
}

export interface HouseCampaign {
  id: number;
  name: string;
  status: CampaignStatus;
  startAt: string;
  endAt: string | null;
  placementKeys: string[];
  categoryCodes: string[];
  inPeriod: boolean;
}

export interface HouseCampaignInput {
  name: string;
  startAt: string;
  endAt: string | null;
  placementKeys: string[];
  categoryCodes: string[];
}

export interface HouseCreativeInput {
  title: string;
  body: string;
  link: string;
  emoji: string;
  image: File | null;
}

export interface PublisherPlacementDay {
  placementKey: string;
  date: string;
  requests: number;
  paidFilled: number;
  paidFillRate: number;
  clientReportedFill: { paid: number; adsense: number; house: number; empty: number };
  impressions: number;
  clicks: number;
  publisherRevenueMicros: number;
  rpmMicros: number;
}

export interface PublisherReport {
  placements: PublisherPlacementDay[];
  ledgerTotal: { publisherPayableMicros: number; allocatedMicros: number };
}

export interface LedgerCheck {
  imbalanceMicros: number;
  balanced: boolean;
  checkedAt: string;
}

const unwrap = <T>(res: { data: ApiResponse<T> }): T => res.data.data;

// ─── 심사 ───

export async function listPendingCreatives(): Promise<AdminCreative[]> {
  return unwrap(await apiClient.get(`${BASE}/creatives/pending`));
}

export async function approveCreative(id: number): Promise<AdminCreative> {
  return unwrap(await apiClient.post(`${BASE}/creatives/${id}/approve`));
}

export async function rejectCreative(id: number, reason: CreativeRejectReason): Promise<AdminCreative> {
  return unwrap(await apiClient.post(`${BASE}/creatives/${id}/reject`, { reason }));
}

/** 미리보기는 인증 경로 — Bearer 를 실어 blob 으로 받는다. */
export async function fetchCreativeImage(imageUrl: string): Promise<Blob> {
  const res = await apiClient.get<Blob>(imageUrl, { responseType: 'blob' });
  return res.data;
}

// ─── 광고주 ───

export async function listAdvertisers(): Promise<AdminAdvertiser[]> {
  return unwrap(await apiClient.get(`${BASE}/advertisers`));
}

export async function suspendAdvertiser(id: number, reason: string): Promise<AdminAdvertiser> {
  return unwrap(await apiClient.post(`${BASE}/advertisers/${id}/suspend`, { reason }));
}

export async function unsuspendAdvertiser(id: number): Promise<AdminAdvertiser> {
  return unwrap(await apiClient.post(`${BASE}/advertisers/${id}/unsuspend`));
}

// ─── 지면 ───

export async function listPlacements(): Promise<AdPlacement[]> {
  return unwrap(await apiClient.get(`${BASE}/placements`));
}

export async function createPlacement(input: PlacementInput): Promise<AdPlacement> {
  const { format, aspectRatios, floorMicros, ...rest } = input;
  // 서버는 규격 목록으로만 받는다 — 첫 규격 하나를 목록에 담아 보낸다
  return unwrap(await apiClient.post(`${BASE}/placements`, { ...rest, formats: [{ format, aspectRatios, floorMicros }] }));
}

export async function updatePlacement(key: string, patch: PlacementPatch): Promise<AdPlacement> {
  return unwrap(await apiClient.patch(`${BASE}/placements/${encodeURIComponent(key)}`, patch));
}

const formatsPath = (key: string) => `${BASE}/placements/${encodeURIComponent(key)}/formats`;

/** 지면에 형태 규격을 더한다. 같은 형태가 이미 있으면 서버가 거절한다 */
export async function addPlacementFormat(key: string, spec: FormatSpec): Promise<AdPlacement> {
  return unwrap(await apiClient.post(formatsPath(key), spec));
}

/** 한 형태의 최저가를 바꾼다 — 올리면 그보다 낮게 입찰한 그 형태 캠페인이 이 지면에서 빠진다 */
export async function updatePlacementFormatFloor(key: string, format: PlacementFormat, floorMicros: number): Promise<AdPlacement> {
  return unwrap(await apiClient.patch(`${formatsPath(key)}/${format}`, { floorMicros }));
}

/** 형태 규격을 뺀다. 마지막 규격은 서버가 거절한다 */
export async function removePlacementFormat(key: string, format: PlacementFormat): Promise<AdPlacement> {
  return unwrap(await apiClient.delete(`${formatsPath(key)}/${format}`));
}

export async function listUnregisteredPlacements(): Promise<UnregisteredPlacement[]> {
  return unwrap(await apiClient.get(`${BASE}/placements/unregistered`));
}

// ─── 문맥 매핑 ───

export async function listContextMappings(): Promise<ContextMapping[]> {
  return unwrap(await apiClient.get(`${BASE}/context-mappings`));
}

/** 문맥 키에 `:` 가 들어가 경로 대신 본문으로 보낸다. */
export async function putContextMapping(contextKey: string, categoryCode: string): Promise<ContextMapping> {
  return unwrap(await apiClient.put(`${BASE}/context-mappings`, { contextKey, categoryCode }));
}

export async function deleteContextMapping(contextKey: string): Promise<void> {
  await apiClient.delete(`${BASE}/context-mappings`, { params: { contextKey } });
}

export async function listHostCategories(): Promise<HostCategory[]> {
  return unwrap(await apiClient.get(`${BASE}/host-categories`));
}

export async function putHostCategory(host: string, categoryCode: string): Promise<HostCategory> {
  return unwrap(await apiClient.put(`${BASE}/host-categories`, { host, categoryCode }));
}

// ─── HOUSE ───

export async function listHouseCampaigns(): Promise<HouseCampaign[]> {
  return unwrap(await apiClient.get(`${BASE}/house/campaigns`));
}

export async function createHouseCampaign(input: HouseCampaignInput): Promise<HouseCampaign> {
  return unwrap(await apiClient.post(`${BASE}/house/campaigns`, input));
}

export async function changeHouseCampaignStatus(id: number, action: CampaignAction): Promise<HouseCampaign> {
  return unwrap(await apiClient.put(`${BASE}/house/campaigns/${id}/status`, { action }));
}

export async function listHouseCreatives(campaignId: number): Promise<AdminCreative[]> {
  return unwrap(await apiClient.get(`${BASE}/house/campaigns/${campaignId}/creatives`));
}

export async function createHouseCreative(campaignId: number, input: HouseCreativeInput): Promise<AdminCreative> {
  const form = new FormData();
  form.append('title', input.title);
  form.append('body', input.body);
  form.append('link', input.link);
  if (input.emoji.trim()) form.append('emoji', input.emoji.trim());
  if (input.image) form.append('image', input.image);
  // 공용 클라이언트 기본 Content-Type 이 JSON 이라 그대로 두면 axios 가 FormData 를 JSON 으로 바꾼다
  return unwrap(
    await apiClient.post(`${BASE}/house/campaigns/${campaignId}/creatives`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  );
}

export async function archiveHouseCreative(creativeId: number): Promise<AdminCreative> {
  return unwrap(await apiClient.delete(`${BASE}/house/creatives/${creativeId}`));
}

// ─── 리포트·원장 ───

export async function fetchPublisherReport(from: string, to: string): Promise<PublisherReport> {
  return unwrap(await apiClient.get(`${BASE}/reports/publisher`, { params: { from, to } }));
}

export async function checkLedger(): Promise<LedgerCheck> {
  return unwrap(await apiClient.get(`${BASE}/ledger/check`));
}

// ─── 표시 ───

export function adsErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as ApiResponse<unknown> | undefined;
    if (body?.error?.message) return body.error.message;
  }
  return fallback;
}

export function formatCredits(micros: number): string {
  return (micros / 1_000_000).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

/** 크레딧 입력(소수 여섯 자리까지) → 마이크로. 숫자가 아니면 null */
export function creditsToMicros(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 1_000_000);
}

export function kstDate(offsetDays = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(Date.now() + offsetDays * 86_400_000));
}
