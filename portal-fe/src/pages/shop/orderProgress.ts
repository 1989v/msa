import type { OrderDetail, OrderFailureReason, OrderStatus, SagaStatus, SagaStep } from '../../api/shopApi';

/** 결제 대기 화면의 네 단계 — 사가 단계를 사용자가 알아볼 묶음으로 접는다 */
export const PROGRESS_STEPS = ['재고 확보', '혜택 적용', '결제 승인', '확정'] as const;

export type Outcome = 'progress' | 'success' | 'failure';

const SUCCESS: ReadonlySet<OrderStatus> = new Set(['CONFIRMED', 'FULFILLING', 'COMPLETED']);
const FAILURE: ReadonlySet<OrderStatus> = new Set(['FAILED', 'CANCELLED']);

export function outcomeOf(status: OrderStatus): Outcome {
  if (SUCCESS.has(status)) return 'success';
  if (FAILURE.has(status)) return 'failure';
  return 'progress';
}

/** 폴링을 멈추는 상태 — 성공(확정 이후)과 실패·취소 */
export function isTerminal(status: OrderStatus): boolean {
  return outcomeOf(status) !== 'progress';
}

const STEP_INDEX: Partial<Record<SagaStep, number>> = {
  INVENTORY_RESERVE: 0,
  PROMOTION_RESERVE: 1,
  PAYMENT_AUTHORIZE: 2,
  INVENTORY_CONFIRM: 3,
  PROMOTION_CONFIRM: 3,
  PAYMENT_CAPTURE: 3,
  FULFILLMENT_CREATE: 3,
};

/** 지금 진행 중인 단계 번호(0~3). 성공이면 4(전부 끝), 되돌리는 중이면 마지막으로 닿은 곳을 모르므로 null */
export function currentStepIndex(order: Pick<OrderDetail, 'status' | 'sagaStep' | 'sagaStatus'>): number | null {
  if (outcomeOf(order.status) === 'success') return PROGRESS_STEPS.length;
  if (order.sagaStatus === 'COMPENSATING') return null;
  if (order.sagaStep && STEP_INDEX[order.sagaStep] != null) return STEP_INDEX[order.sagaStep] ?? 0;
  // 사가 정보가 없으면 주문 상태로 짐작한다
  if (order.status === 'PAID') return 3;
  if (order.status === 'PAYMENT_PENDING') return 2;
  return 0;
}

export interface FailureCopy {
  title: string;
  body: string;
  /** 다음 행동 — 주문서 재생성 · 장바구니 · 상품 목록 */
  action: 'recreate-sheet' | 'cart' | 'shop';
}

const FAILURE_COPY: Record<OrderFailureReason, FailureCopy> = {
  INSUFFICIENT_STOCK: {
    title: '재고가 부족합니다',
    body: '주문하신 수량만큼 재고를 확보하지 못했습니다. 결제는 진행되지 않았습니다.',
    action: 'cart',
  },
  BENEFIT_UNAVAILABLE: {
    title: '쿠폰이나 포인트를 쓸 수 없습니다',
    body: '주문서를 만든 뒤 혜택을 쓸 수 없게 되었습니다. 결제는 진행되지 않았습니다. 주문서를 다시 만들어 금액을 확인해 주세요.',
    action: 'recreate-sheet',
  },
  PAYMENT_DECLINED: {
    title: '결제가 승인되지 않았습니다',
    body: '카드사가 결제를 거절했습니다. 확보한 재고와 쓴 혜택은 되돌렸습니다.',
    action: 'cart',
  },
  HOLD_EXPIRED: {
    title: '확인 시간이 지났습니다',
    body: '결제 확인이 늦어져 재고·혜택 보류 시간이 지났습니다. 승인된 결제는 취소했고 청구되지 않습니다.',
    action: 'cart',
  },
  TIMEOUT: {
    title: '주문 처리가 지연되어 중단했습니다',
    body: '정해진 시간 안에 주문을 끝내지 못해 중단했습니다. 승인된 결제가 있었다면 취소되어 청구되지 않습니다.',
    action: 'cart',
  },
  BUYER_CANCELLED: {
    title: '주문을 취소했습니다',
    body: '결제 전에 취소한 주문입니다. 확보한 재고와 혜택은 되돌렸습니다.',
    action: 'shop',
  },
};

const UNKNOWN_FAILURE: FailureCopy = {
  title: '주문을 완료하지 못했습니다',
  body: '주문을 처리하지 못했습니다. 결제가 승인되었다면 자동으로 취소됩니다.',
  action: 'cart',
};

/** 확정 뒤 클레임으로 모든 라인이 취소된 주문 */
const CLAIM_CANCELLED: FailureCopy = {
  title: '주문 전체를 취소했습니다',
  body: '결제 금액은 결제 수단으로, 쓴 포인트는 포인트로 돌려드렸습니다. 아래에서 환불 내역을 볼 수 있습니다.',
  action: 'shop',
};

export function failureCopy(status: OrderStatus, reason: OrderFailureReason | null, sagaStatus?: SagaStatus | null): FailureCopy {
  // 사가가 끝까지 간(확정된) 주문의 취소는 결제 전 취소가 아니라 클레임 환불이다
  if (status === 'CANCELLED' && sagaStatus === 'COMPLETED') return CLAIM_CANCELLED;
  if (status === 'CANCELLED') return FAILURE_COPY.BUYER_CANCELLED;
  return (reason && FAILURE_COPY[reason]) || UNKNOWN_FAILURE;
}

/** 폴링 간격 — 처음 60초는 1.5초, 그 뒤로는 5초 */
export const POLL_INTERVAL_MS = 1_500;
export const SLOW_POLL_INTERVAL_MS = 5_000;
export const SLOW_AFTER_MS = 60_000;

export function pollDelay(elapsedMs: number): number {
  return elapsedMs < SLOW_AFTER_MS ? POLL_INTERVAL_MS : SLOW_POLL_INTERVAL_MS;
}

// ── Idempotency-Key ────────────────────────────────────────────────

const KEY_PREFIX = 'shop.order-submit-key:';

/** sessionStorage 를 못 쓰는 환경(사생활 모드 등)에서도 한 화면 안의 재시도는 같은 키를 쓴다 */
const memoryKeys = new Map<number, string>();

function newKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 주문서 하나의 접수 키. 같은 주문서를 다시 누르거나 새로고침 뒤 다시 눌러도 같은 키 — 서버가 주문을 하나만 만든다.
 * 주문서가 바뀌면(재생성) 새 키다.
 */
export function submitKeyFor(orderSheetId: number): string {
  const storageKey = `${KEY_PREFIX}${orderSheetId}`;
  try {
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored) return stored;
  } catch {
    // 저장소를 못 읽으면 메모리 키로
  }
  const key = memoryKeys.get(orderSheetId) ?? newKey();
  memoryKeys.set(orderSheetId, key);
  try {
    window.sessionStorage.setItem(storageKey, key);
  } catch {
    // 저장 실패 — 이 화면 안에서는 메모리 키가 같은 값을 준다
  }
  return key;
}
