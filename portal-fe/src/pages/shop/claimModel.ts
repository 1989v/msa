import type { Claim, OrderDetail, OrderLine } from '../../api/shopApi';

/** 취소·구매 확정을 받는 주문 상태 — 결제·확정이 끝나고 구매 확정 전 */
const CLAIMABLE_STATUS = new Set(['CONFIRMED', 'FULFILLING']);

export const isOpenClaim = (c: Claim) => c.status === 'REQUESTED' || c.status === 'APPROVED';

/** 판매자 결정을 기다리는 클레임은 답을 기다리지 않는다 — 폴링하지 않는다 */
export const isClaimMoving = (c: Claim) => isOpenClaim(c) && c.step !== 'SELLER_DECISION' && !c.stuck;

/** 지금 취소 요청을 넣을 수 있는 라인 — ACTIVE 이고 진행 중 클레임에 들어 있지 않은 것 */
export function cancellableLineNos(order: OrderDetail, claims: Claim[]): number[] {
  if (!CLAIMABLE_STATUS.has(order.status)) return [];
  const inClaim = new Set(claims.filter(isOpenClaim).flatMap((c) => c.lineNos));
  return order.lines.filter((l) => l.status === 'ACTIVE' && !inClaim.has(l.lineNo)).map((l) => l.lineNo);
}

/** 구매 확정 버튼 — 이행 중이고, 남은 ACTIVE 라인이 있고, 진행 중 클레임이 없을 때(서버도 같은 조건으로 409) */
export function canConfirmPurchase(order: OrderDetail, claims: Claim[]): boolean {
  return (
    order.status === 'FULFILLING' && order.lines.some((l) => l.status === 'ACTIVE') && !claims.some(isOpenClaim)
  );
}

export function claimStatusLabel(c: Claim): string {
  if (c.status === 'REFUNDED') return '환불 완료';
  if (c.status === 'REJECTED') return '취소 반려';
  if (c.stuck) return '처리 지연 — 확인 중';
  if (c.step === 'SELLER_DECISION') return '판매자 확인 중 · 이미 출고';
  if (c.status === 'APPROVED') return '환불 처리 중';
  return '취소 처리 중';
}

/** 라인 진행 표시 — 상태가 먼저, 그다음 배송 */
export function lineProgressLabel(l: OrderLine): string | null {
  if (l.status === 'CANCELLED') return '취소됨';
  if (l.status === 'PURCHASE_CONFIRMED') return '구매 확정';
  if (l.deliveredAt) return '배송 완료';
  if (l.shippedAt) return '배송 중';
  return null;
}
