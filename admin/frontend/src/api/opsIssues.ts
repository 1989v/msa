import { apiClient } from './client';

interface ApiResponse<T> { success: boolean; data: T; error: { code: string; message: string } | null; }

/** 운영 큐가 합치는 커머스 도메인 — 경로 조각은 `/api/v1/admin/{path}/ops-issues` */
export const OPS_DOMAINS = [
  { key: 'order', path: 'orders', label: '주문' },
  { key: 'inventory', path: 'inventories', label: '재고' },
  { key: 'fulfillment', path: 'fulfillments', label: '이행' },
  { key: 'product', path: 'products', label: '상품' },
  { key: 'payment', path: 'payments', label: '결제' },
  { key: 'seller', path: 'sellers', label: '판매자' },
  { key: 'promotion', path: 'promotions', label: '혜택' },
  { key: 'settlement', path: 'settlements', label: '정산' },
] as const;
export type OpsDomain = (typeof OPS_DOMAINS)[number];
export type OpsDomainKey = OpsDomain['key'];

export const OPS_STATUSES = ['OPEN', 'RETRIED', 'CLOSED'] as const;
export type OpsIssueStatus = (typeof OPS_STATUSES)[number];

/** 도메인마다 같은 모양 — 서버 응답 그대로 */
export interface OpsIssue {
  id: number;
  type: string;
  targetId: string;
  detail: string;
  businessDate: string | null;
  status: OpsIssueStatus;
  actorId: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpsIssuePage { items: OpsIssue[]; total: number; }

/** 합친 목록의 한 줄 — 어느 도메인 것인지 붙인다(같은 id 가 도메인마다 있다) */
export interface OpsQueueItem extends OpsIssue { domain: OpsDomain; }

export interface OpsQueue {
  items: OpsQueueItem[];
  /** 불러오지 못한 도메인 — 나머지는 그대로 보여 준다 */
  failed: OpsDomain[];
}

const base = (d: OpsDomain) => `/api/v1/admin/${d.path}/ops-issues`;

export async function listOpsIssues(d: OpsDomain, status?: OpsIssueStatus): Promise<OpsIssuePage> {
  const res = await apiClient.get<ApiResponse<OpsIssuePage>>(base(d), { params: { status, size: 100 } });
  return res.data.data;
}

/**
 * 도메인 목록을 동시에 불러 한 목록으로 — 한 도메인이 실패해도 나머지를 보여 주고 실패한 도메인을 알린다.
 * 정렬은 최근 생성 순.
 */
export async function mergeOpsQueue(
  domains: readonly OpsDomain[],
  fetchOne: (d: OpsDomain) => Promise<OpsIssuePage>,
): Promise<OpsQueue> {
  const results = await Promise.allSettled(domains.map((d) => fetchOne(d)));
  const items: OpsQueueItem[] = [];
  const failed: OpsDomain[] = [];
  results.forEach((r, i) => {
    const domain = domains[i];
    if (r.status === 'fulfilled') items.push(...r.value.items.map((it) => ({ ...it, domain })));
    else failed.push(domain);
  });
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items, failed };
}

/** 재시도 — DLT 는 원 토픽 재발행, 체류 사가·클레임은 재개. 사유는 선택 */
export async function retryOpsIssue(d: OpsDomain, id: number, reason?: string): Promise<OpsIssue> {
  const res = await apiClient.post<ApiResponse<OpsIssue>>(`${base(d)}/${id}/retry`, reason ? { reason } : undefined);
  return res.data.data;
}

/** 종결 — 사유 필수. 종결 뒤에는 재시도할 수 없다(409) */
export async function closeOpsIssue(d: OpsDomain, id: number, reason: string): Promise<OpsIssue> {
  const res = await apiClient.post<ApiResponse<OpsIssue>>(`${base(d)}/${id}/close`, { reason });
  return res.data.data;
}
