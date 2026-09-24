import type { SettlementStatus } from '../../api/shopApi';

export const SETTLEMENT_STATUS_LABEL: Record<SettlementStatus, string> = {
  DRAFT: '작성 중',
  CONFIRMED: '지급 대기',
  PAID: '지급 완료',
  CARRIED_OVER: '다음 기간으로 이월',
};

/** 2026-09-21 ~ 2026-09-27 → 2026.09.21 ~ 09.27 (같은 해면 끝 날짜의 연도를 줄인다) */
export function formatPeriod(start: string, end: string): string {
  const dot = (d: string) => d.replace(/-/g, '.');
  return start.slice(0, 4) === end.slice(0, 4) ? `${dot(start)} ~ ${dot(end.slice(5))}` : `${dot(start)} ~ ${dot(end)}`;
}
