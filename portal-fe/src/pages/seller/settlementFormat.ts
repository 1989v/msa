import type { SettlementStatus } from '../../api/shopApi';

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  DRAFT: '작성 중',
  CONFIRMED: '지급 대기',
  PAID: '지급 완료',
  CARRIED_OVER: '다음 기간으로 이월',
  PLATFORM_RETAINED: '플랫폼 자기 매출(지급 없음)',
};

/** 2026-09-21 ~ 2026-09-27 → 2026.09.21 ~ 09.27 (같은 해면 끝 날짜의 연도를 줄인다) */
export function formatPeriod(start: string, end: string): string {
  const dot = (d: string) => d.replace(/-/g, '.');
  return start.slice(0, 4) === end.slice(0, 4) ? `${dot(start)} ~ ${dot(end.slice(5))}` : `${dot(start)} ~ ${dot(end)}`;
}

/** 서버 시각(UTC ISO) → KST 날짜 2026-09-24. 정산 기간이 KST 기준이라 같은 기준으로 맞춘다 */
export function kstDate(iso: string): string {
  return new Date(Date.parse(iso) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 실제 포함 범위 — 담긴 항목의 최소~최대 확정일(KST) */
export function formatIncluded(from: string, to: string): string {
  return formatPeriod(kstDate(from), kstDate(to));
}
