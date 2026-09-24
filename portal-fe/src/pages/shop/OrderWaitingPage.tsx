import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ShopHeader from '../../components/ShopHeader';
import {
  cancelOrder,
  createOrderSheet,
  extractErrorMessage,
  fetchOrder,
  type OrderDetail,
} from '../../api/shopApi';
import { buildLoginHref, isLoggedIn } from '../../auth/auth';
import { portalTitle, portalUrl } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { formatWon } from '../shopFormat';
import {
  PROGRESS_STEPS,
  SLOW_AFTER_MS,
  currentStepIndex,
  failureCopy,
  isTerminal,
  outcomeOf,
  pollDelay,
} from './orderProgress';
import OrderClaimPanel from './OrderClaimPanel';
import { lineProgressLabel } from './claimModel';
import '../Shop.css';
import './Checkout.css';

const won = (n: number) => formatWon(n);

/**
 * 주문 접수 뒤 결제 대기 · 결과 · 주문 상세. 주문은 비동기(사가)로 진행되므로 상태를 폴링한다 —
 * 1.5초마다, 60초가 지나면 5초마다. 성공(확정 이후)·실패·취소에 닿으면 멈춘다.
 */
export default function OrderWaitingPage() {
  useHeritageSurface();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useSeo({ title: portalTitle('주문 진행'), canonical: portalUrl('/shop/orders'), noindex: true });

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // 취소 요청 뒤 다시 폴링을 시작하기 위한 세대 값
  const [generation, setGeneration] = useState(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!isLoggedIn()) {
      window.location.replace(buildLoginHref());
      return;
    }
    if (!id) return;
    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      try {
        const next = await fetchOrder(id);
        if (cancelled) return;
        setOrder(next);
        setLoadError(null);
        if (isTerminal(next.status)) return;
      } catch (e) {
        if (cancelled) return;
        // 한 번 실패로 멈추지 않는다 — 처음 불러오기 실패만 화면에 알린다
        setLoadError((prev) => prev ?? extractErrorMessage(e, '주문 상태를 불러오지 못했습니다.'));
      }
      const elapsed = Date.now() - startedAt.current;
      if (elapsed >= SLOW_AFTER_MS) setSlow(true);
      timer = window.setTimeout(() => void tick(), pollDelay(elapsed));
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [id, generation]);

  const onCancel = useCallback(async () => {
    if (!order) return;
    setBusy(true);
    setActionError(null);
    try {
      setOrder(await cancelOrder(order.orderId));
      setGeneration((g) => g + 1);
    } catch (e) {
      setActionError(extractErrorMessage(e, '주문을 취소하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  }, [order]);

  const onRecreate = useCallback(async () => {
    if (!order) return;
    setBusy(true);
    setActionError(null);
    try {
      // 같은 상품·수량으로 새 주문서 — 혜택은 쓸 수 없게 된 것이라 비우고 주문서에서 다시 고른다
      const sheet = await createOrderSheet({
        items: order.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        userCouponId: null,
        pointAmount: 0,
      });
      navigate(`/shop/order-sheet/${sheet.id}`);
    } catch (e) {
      setActionError(extractErrorMessage(e, '주문서를 다시 만들지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  }, [order, navigate]);

  // 클레임 환불·구매 확정 뒤 주문을 한 번 다시 불러온다(끝난 상태라 폴링은 한 번으로 멈춘다)
  const reloadOrder = useCallback(() => setGeneration((g) => g + 1), []);

  if (!order) {
    return (
      <Shell>
        {loadError ? (
          <div className="kh-status kh-status-error" role="alert">
            <p className="kh-status-title">주문을 열 수 없습니다</p>
            <p>{loadError}</p>
            <div>
              <Link to="/shop/orders" className="kh-button kh-button-ghost">
                주문내역으로
              </Link>
            </div>
          </div>
        ) : (
          <div className="shop-skeleton-card kh-skeleton" aria-hidden="true" />
        )}
      </Shell>
    );
  }

  const outcome = outcomeOf(order.status);
  const stepIndex = currentStepIndex(order);
  const noPayment = order.payableAmount === 0;
  // 확정 뒤 클레임으로 전부 취소된 주문 — 사가는 끝까지 갔다
  const cancelledByClaim = order.status === 'CANCELLED' && order.sagaStatus === 'COMPLETED';

  return (
    <Shell>
      <header className="checkout-head">
        <span className="kh-section-label">Order {order.orderId}</span>
        <h1 className="shop-page-title">
          {outcome === 'success'
            ? '주문이 확정되었습니다'
            : cancelledByClaim
              ? '주문을 취소했습니다'
              : outcome === 'failure'
                ? '주문이 끝나지 않았습니다'
                : '주문을 처리하고 있습니다'}
        </h1>
      </header>

      <div className="checkout-layout">
        <div className="checkout-main">
          {outcome === 'progress' && (
            <section className="checkout-panel order-progress" aria-labelledby="order-progress-title">
              <h2 id="order-progress-title" className="checkout-panel-title">
                진행 상황
              </h2>
              <ol className="order-steps">
                {PROGRESS_STEPS.map((label, i) => {
                  const state = stepIndex == null ? 'idle' : i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'idle';
                  const skipped = i === 2 && noPayment;
                  return (
                    <li
                      key={label}
                      className={`order-step is-${skipped ? 'skipped' : state}`}
                      aria-current={state === 'current' && !skipped ? 'step' : undefined}
                    >
                      <span className="order-step-mark checkout-num" aria-hidden="true">
                        {state === 'done' || skipped ? '✓' : i + 1}
                      </span>
                      <span className="order-step-label">
                        {label}
                        {skipped && <span className="order-step-note"> · 결제 없음</span>}
                      </span>
                      <span className="checkout-sr">
                        {skipped ? '건너뜀' : state === 'done' ? '완료' : state === 'current' ? '진행 중' : '대기'}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="checkout-hint" role="status" aria-live="polite">
                {order.sagaStatus === 'COMPENSATING'
                  ? '주문을 마치지 못해 확보한 재고와 혜택을 되돌리고 있습니다.'
                  : order.status === 'PAYMENT_PENDING'
                    ? '결제 결과를 확인하고 있습니다. 이 화면을 닫아도 주문은 계속 처리됩니다.'
                    : '재고와 혜택을 확인하고 있습니다.'}
              </p>
              {slow && (
                <p className="checkout-hint">
                  평소보다 오래 걸리고 있습니다. 결제 결과가 확인되면 자동으로 바뀝니다 — 주문내역에서도 볼 수 있습니다.
                </p>
              )}
              {order.status === 'CREATED' && (
                <div>
                  <button type="button" className="kh-button kh-button-ghost" disabled={busy} onClick={() => void onCancel()}>
                    주문 취소
                  </button>
                </div>
              )}
            </section>
          )}

          {outcome === 'success' && (
            <section className="kh-status order-result is-success" role="status" aria-labelledby="order-success-title">
              <p id="order-success-title" className="kh-status-title">
                결제와 재고 확보가 끝났습니다
              </p>
              <p>
                {order.status === 'COMPLETED'
                  ? '구매 확정된 주문입니다.'
                  : order.status === 'FULFILLING'
                    ? '판매자가 출고를 준비하고 있습니다.'
                    : '곧 출고 준비가 시작됩니다.'}
              </p>
              <div className="order-result-actions">
                <Link to="/shop/orders" className="kh-button">
                  주문내역 보기
                </Link>
                <Link to="/shop" className="kh-button kh-button-ghost">
                  쇼핑 계속하기
                </Link>
              </div>
            </section>
          )}

          {outcome === 'failure' && <FailurePanel order={order} busy={busy} onRecreate={onRecreate} />}

          {(outcome === 'success' || cancelledByClaim) && <OrderClaimPanel order={order} onOrderChanged={reloadOrder} />}

          {actionError && (
            <div className="kh-status-error checkout-error" role="alert">
              {actionError}
            </div>
          )}

          <section className="checkout-panel" aria-labelledby="order-lines-title">
            <h2 id="order-lines-title" className="checkout-panel-title">
              주문 상품
            </h2>
            <ul className="checkout-lines">
              {order.lines.map((l) => {
                const progress = lineProgressLabel(l);
                return (
                  <li key={l.lineNo} className={`checkout-line${l.status === 'CANCELLED' ? ' is-cancelled' : ''}`}>
                    <div className="checkout-line-main">
                      <span className="checkout-line-name">{l.productName}</span>
                      <span className="checkout-line-meta checkout-num">
                        {won(l.unitPrice)} × {l.quantity}
                        {progress && <span className="order-line-progress"> · {progress}</span>}
                      </span>
                    </div>
                    <span className="checkout-line-amount checkout-num">{won(l.payable)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="checkout-summary checkout-panel" aria-labelledby="order-summary-title">
          <h2 id="order-summary-title" className="checkout-panel-title">
            결제 금액
          </h2>
          <div role="group" aria-label="결제 금액 분해" className="checkout-breakdown">
            <Row label="상품 금액" value={won(order.itemsAmount)} />
            <Row label="쿠폰 할인" value={order.couponDiscount > 0 ? `−${won(order.couponDiscount)}` : won(0)} />
            <Row label="포인트" value={order.pointAmount > 0 ? `−${won(order.pointAmount)}` : won(0)} />
            <Row label="배송비" value={won(order.shippingAmount)} />
            <div className="checkout-row checkout-total">
              <span>결제 금액</span>
              <span className="checkout-num">{won(order.payableAmount)}</span>
            </div>
            {order.refundedAmount > 0 && (
              <div className="checkout-row">
                <span>{order.refundedAmount < order.payableAmount ? '부분 환불' : '환불'}</span>
                <span className="checkout-num">−{won(order.refundedAmount)}</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function FailurePanel({
  order,
  busy,
  onRecreate,
}: {
  order: OrderDetail;
  busy: boolean;
  onRecreate: () => Promise<void>;
}) {
  const copy = failureCopy(order.status, order.failureReason, order.sagaStatus);
  return (
    <section className="kh-status kh-status-error order-result is-failure" role="alert" aria-labelledby="order-failure-title">
      <p id="order-failure-title" className="kh-status-title">
        {copy.title}
      </p>
      <p>{copy.body}</p>
      <div className="order-result-actions">
        {copy.action === 'recreate-sheet' && (
          <button type="button" className="kh-button" disabled={busy} onClick={() => void onRecreate()}>
            주문서 다시 만들기
          </button>
        )}
        {copy.action === 'cart' && (
          <Link to="/shop/cart" className="kh-button">
            장바구니로
          </Link>
        )}
        <Link to="/shop" className={`kh-button${copy.action === 'shop' ? '' : ' kh-button-ghost'}`}>
          상품 보러 가기
        </Link>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="checkout-row">
      <span>{label}</span>
      <span className="checkout-num">{value}</span>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="shop-page">
      <ShopHeader />
      <main className="shop-container checkout-container">{children}</main>
    </div>
  );
}
