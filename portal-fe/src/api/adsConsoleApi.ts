import axios, { type AxiosError } from 'axios';
import { apiClient } from '../shell/apiClient';

/**
 * 광고주 콘솔 API (ADR-0098). 신원은 Bearer 뿐이고 요청은 광고주 id 를 들고 가지 않는다 —
 * 서버가 회원 id 로 광고주를 찾는다. 금액은 전부 정수 마이크로 크레딧(1 크레딧 = 1,000,000)이다.
 */

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

const BASE = '/api/v1/ads/advertiser';

/** 콘솔의 모든 금액 옆에 붙는 고지. 크레딧은 가상 발행이고 돈이 오가지 않는다. */
export const VIRTUAL_CREDIT_NOTE = '가상 크레딧 — 실제 결제 없음';

export const MICROS_PER_CREDIT = 1_000_000;

export type AdvertiserStatus = 'ACTIVE' | 'SUSPENDED';
export type BidType = 'CPM' | 'CPC';
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED';
export type CampaignAction = 'START' | 'PAUSE' | 'RESUME' | 'END';
export type CreativeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
export type CreativeRejectReason =
  | 'REGULATED_INDUSTRY'
  | 'ADULT'
  | 'GAMBLING'
  | 'MISLEADING'
  | 'LANDING_MISMATCH'
  | 'IMAGE_QUALITY';

export interface AdvertiserDashboard {
  advertiserId: number;
  displayName: string;
  status: AdvertiserStatus;
  suspendReason: string | null;
  balanceMicros: number;
  todaySpendMicros: number;
  todayChargedMicros: number;
}

export interface Campaign {
  id: number;
  name: string;
  status: CampaignStatus;
  bidType: BidType | null;
  bidMicros: number | null;
  dailyBudgetMicros: number | null;
  totalBudgetMicros: number | null;
  startAt: string;
  endAt: string | null;
  frequencyCapPerDay: number | null;
  placementKeys: string[];
  categoryCodes: string[];
  /** 지금이 게재 기간 안인지 — 「기간 밖」은 상태가 아니라 파생 표시다 */
  inPeriod: boolean;
}

export interface CampaignInput {
  name: string;
  bidType: BidType;
  bidMicros: number;
  dailyBudgetMicros: number;
  totalBudgetMicros: number | null;
  startAt: string;
  endAt: string | null;
  frequencyCapPerDay: number | null;
  placementKeys: string[];
  categoryCodes: string[];
}

export interface Creative {
  id: number;
  campaignId: number;
  status: CreativeStatus;
  title: string;
  body: string;
  landingUrl: string;
  /** 본인만 볼 수 있는 미리보기 — 인증 경로라 `<img src>` 로 바로 걸 수 없다 */
  imageUrl: string | null;
  rejectReason: CreativeRejectReason | null;
  reviewedAt: string | null;
}

export interface CreativeInput {
  title: string;
  body: string;
  landingUrl: string;
  image: File | null;
}

export interface CatalogPlacement {
  key: string;
  host: string;
  format: 'CARD' | 'BANNER';
  aspectRatios: string[];
  floorMicros: number;
  description: string;
  averageDailyRequests: number;
}

export interface Catalog {
  placements: CatalogPlacement[];
  categories: { code: string; label: string }[];
}

export interface CampaignDay {
  campaignId: number;
  campaignName: string;
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spendMicros: number;
  /** 그 날 정산 안 된 시각이 있으면 비어 온다 */
  chargedMicros: number | null;
  unbilledOverBudget: boolean;
  creatives: { creativeId: number; impressions: number; clicks: number; ctr: number; spendMicros: number }[];
}

export const REJECT_REASON_LABEL: Record<CreativeRejectReason, string> = {
  REGULATED_INDUSTRY: '규제 업권(의료·금융)',
  ADULT: '성인',
  GAMBLING: '도박',
  MISLEADING: '허위·과장',
  LANDING_MISMATCH: '랜딩 불일치',
  IMAGE_QUALITY: '이미지 품질',
};

const unwrap = <T>(res: { data: ApiResponse<T> }): T => res.data.data;

/** 광고주가 아니면 404 가 온다 — 그때는 null 을 돌려 화면이 등록을 띄운다. */
export async function fetchAdvertiserMe(): Promise<AdvertiserDashboard | null> {
  try {
    return unwrap(await apiClient.get<ApiResponse<AdvertiserDashboard>>(`${BASE}/me`));
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}

export async function registerAdvertiser(displayName: string): Promise<{ advertiserId: number }> {
  return unwrap(await apiClient.post(`${BASE}/register`, { displayName }));
}

export async function topUp(amountMicros: number, idempotencyKey: string): Promise<{ transactionId: number; balanceMicros: number }> {
  return unwrap(await apiClient.post(`${BASE}/top-ups`, { amountMicros, idempotencyKey }));
}

export async function fetchCatalog(): Promise<Catalog> {
  return unwrap(await apiClient.get(`${BASE}/catalog`));
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  return unwrap(await apiClient.get(`${BASE}/campaigns`));
}

export async function fetchCampaign(id: number): Promise<Campaign> {
  return unwrap(await apiClient.get(`${BASE}/campaigns/${id}`));
}

export async function createCampaign(input: CampaignInput): Promise<Campaign> {
  return unwrap(await apiClient.post(`${BASE}/campaigns`, input));
}

export async function updateCampaign(id: number, input: CampaignInput): Promise<Campaign> {
  return unwrap(await apiClient.put(`${BASE}/campaigns/${id}`, input));
}

export async function changeCampaignStatus(id: number, action: CampaignAction): Promise<Campaign> {
  return unwrap(await apiClient.put(`${BASE}/campaigns/${id}/status`, { action }));
}

export async function fetchCreatives(campaignId: number): Promise<Creative[]> {
  return unwrap(await apiClient.get(`${BASE}/campaigns/${campaignId}/creatives`));
}

function creativeForm(input: CreativeInput): FormData {
  const form = new FormData();
  form.append('title', input.title);
  form.append('body', input.body);
  form.append('landingUrl', input.landingUrl);
  if (input.image) form.append('image', input.image);
  return form;
}

// 공용 클라이언트의 기본 Content-Type 이 JSON 이라 그대로 두면 axios 가 FormData 를 JSON 으로 바꾼다.
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

export async function submitCreative(campaignId: number, input: CreativeInput): Promise<Creative> {
  return unwrap(await apiClient.post(`${BASE}/campaigns/${campaignId}/creatives`, creativeForm(input), MULTIPART));
}

/** 이미지를 비우면 문구만 고친다. 어느 쪽이든 다시 심사 대기가 된다. */
export async function reviseCreative(creativeId: number, input: CreativeInput): Promise<Creative> {
  return unwrap(await apiClient.put(`${BASE}/creatives/${creativeId}`, creativeForm(input), MULTIPART));
}

export async function archiveCreative(creativeId: number): Promise<Creative> {
  return unwrap(await apiClient.delete(`${BASE}/creatives/${creativeId}`));
}

/** 미리보기는 인증 경로다 — Bearer 를 실어 받아 blob 으로 그린다. */
export async function fetchPreviewBlob(imageUrl: string): Promise<Blob> {
  const res = await apiClient.get<Blob>(imageUrl, { responseType: 'blob' });
  return res.data;
}

export async function fetchReport(from: string, to: string): Promise<CampaignDay[]> {
  return unwrap(await apiClient.get(`${BASE}/reports`, { params: { from, to } }));
}

/** 서버가 준 오류 문구를 그대로 보여 준다 — 저장 불변식(최저가·예산·지면)의 판정은 서버에 있다. */
export function adsErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const body = (err as AxiosError).response?.data as ApiResponse<unknown> | undefined;
    if (body?.error?.message) return body.error.message;
  }
  return fallback;
}

/** 충전 시도마다 새로 만드는 멱등 키. 서버 형식은 `[A-Za-z0-9_-]{1,64}` 다. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function formatCredits(micros: number | null | undefined): string {
  if (micros == null) return '—';
  return (micros / MICROS_PER_CREDIT).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 입력한 크레딧(소수 여섯 자리까지)을 마이크로로. 숫자가 아니면 null. */
export function creditsToMicros(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * MICROS_PER_CREDIT);
}

export function microsToCreditsInput(micros: number | null | undefined): string {
  if (micros == null) return '';
  return String(micros / MICROS_PER_CREDIT);
}

/** KST 달력일 — 서버의 「하루」와 같은 기준 */
export function kstDate(offsetDays = 0, now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(shifted);
}
