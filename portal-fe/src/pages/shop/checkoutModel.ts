import type { MyCoupon, OrderSheet } from '../../api/shopApi';

/** 판매자별로 묶는다 — 처음 나온 순서를 지킨다. 판매자를 모르는 줄(null)은 따로 한 묶음이다 */
export function groupBySeller<T extends { sellerId: number | null }>(
  lines: T[],
): { sellerId: number | null; lines: T[] }[] {
  const groups = new Map<number | null, T[]>();
  for (const line of lines) {
    const list = groups.get(line.sellerId);
    if (list) list.push(line);
    else groups.set(line.sellerId, [line]);
  }
  return Array.from(groups, ([sellerId, grouped]) => ({ sellerId, lines: grouped }));
}

export function sellerLabel(sellerId: number | null): string {
  return sellerId == null ? '판매 정보 없음' : `판매자 ${sellerId}`;
}

/** 주문서를 다시 만들 때 보낼 상품·수량 — 금액은 싣지 않는다 */
export function sheetItems(sheet: OrderSheet): { productId: number; quantity: number }[] {
  return sheet.lines.map((l) => ({ productId: l.productId, quantity: l.quantity }));
}

/**
 * 포인트 상한 — 쿠폰 뒤 상품 금액(배송비 제외)과 잔액 중 작은 값. 입력 안내용이고,
 * 넘치면 서버가 422 로 거절한다.
 */
export function pointCap(sheet: OrderSheet, balance: number | null): number {
  const afterCoupon = Math.max(0, sheet.itemsAmount - sheet.couponDiscount);
  return balance == null ? afterCoupon : Math.max(0, Math.min(balance, afterCoupon));
}

export function remainingMs(expiresAt: string, now: number): number {
  const end = new Date(expiresAt).getTime();
  return Number.isNaN(end) ? 0 : Math.max(0, end - now);
}

export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 쿠폰 조건 한 줄 — 정액/정률(최대) · 최소 주문 금액 · 판매자 쿠폰 여부 */
export function describeCoupon(c: MyCoupon, won: (n: number) => string): string {
  const d = c.definition;
  const benefit =
    d.type === 'FIXED'
      ? `${won(d.amount ?? 0)} 할인`
      : `${((d.rateBp ?? 0) / 100).toLocaleString('ko-KR')}% 할인${d.maxDiscount != null ? ` · 최대 ${won(d.maxDiscount)}` : ''}`;
  const parts = [benefit];
  if (d.minOrderAmount > 0) parts.push(`${won(d.minOrderAmount)} 이상`);
  if (d.bearer === 'SELLER' && d.sellerId != null) parts.push(`${sellerLabel(d.sellerId)} 상품만`);
  return parts.join(' · ');
}
