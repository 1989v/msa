import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }

export const STATEMENT_STATUSES = ['DRAFT', 'CONFIRMED', 'PAID', 'CARRIED_OVER', 'PLATFORM_RETAINED'] as const;
export type StatementStatus = (typeof STATEMENT_STATUSES)[number];

/**
 * 정산서 — periodEnd 는 마지막 날(포함). 지급액 = 순매출 + 배송비 − 수수료.
 * includedFrom~includedTo 는 실제로 담긴 항목의 확정 시각 범위 — 이월·지각 항목이 있으면 명목 기간보다 앞선다.
 */
export interface Statement {
  id: number;
  sellerId: number;
  periodStart: string;
  periodEnd: string;
  includedFrom: string;
  includedTo: string;
  status: StatementStatus;
  netSales: number;
  shippingFee: number;
  commission: number;
  payout: number;
  payoutReference: string | null;
  lineCount: number;
  createdAt: string;
  confirmedAt: string | null;
  paidAt: string | null;
  carriedOverAt: string | null;
}

/** 시산표 — 계정은 영문 코드 + 한글 이름, balance = 차 − 대. net 이 0 이 아니면 원장이 깨졌다 */
export interface TrialBalance {
  accounts: { code: string; name: string; debit: number; credit: number; balance: number }[];
  sellerPayables: { sellerId: number; balance: number }[];
  totalDebit: number;
  totalCredit: number;
  net: number;
}

export interface BatchRunResult { opened: number; paid: number; carriedOver: number; failed: number; platformRetained: number; }

const BASE = '/api/v1/admin/settlements';

export async function listStatements(params: { status?: StatementStatus; sellerId?: number }): Promise<Statement[]> {
  const res = await apiClient.get<ApiResponse<Statement[]>>(`${BASE}/statements`, { params });
  return res.data.data;
}

/** CONFIRMED(지급 대기) 정산서만 — 그 밖은 409 */
export async function retryPayout(id: number): Promise<Statement> {
  const res = await apiClient.post<ApiResponse<Statement>>(`${BASE}/statements/${id}/retry-payout`);
  return res.data.data;
}

/** 오늘 날짜로 배치 — 닫힌 기간만 정산한다 */
export async function runSettlementBatch(): Promise<BatchRunResult> {
  const res = await apiClient.post<ApiResponse<BatchRunResult>>(`${BASE}/batch/run`);
  return res.data.data;
}

export async function getTrialBalance(): Promise<TrialBalance> {
  const res = await apiClient.get<ApiResponse<TrialBalance>>(`${BASE}/ledger/trial-balance`);
  return res.data.data;
}
