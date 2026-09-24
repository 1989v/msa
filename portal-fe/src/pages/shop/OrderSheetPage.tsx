import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ShopHeader from '../../components/ShopHeader';
import {
  createOrderSheet,
  extractErrorMessage,
  fetchMyCoupons,
  fetchMyPoints,
  fetchOrderSheet,
  type MyCoupon,
  type OrderSheet,
} from '../../api/shopApi';
import { buildLoginHref, isLoggedIn } from '../../auth/auth';
import { portalTitle, portalUrl } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { formatWon } from '../shopFormat';
import {
  describeCoupon,
  formatCountdown,
  groupBySeller,
  pointCap,
  remainingMs,
  sellerLabel,
  sheetItems,
} from './checkoutModel';
import '../Shop.css';
import './Checkout.css';

const won = (n: number) => formatWon(n);
const minus = (n: number) => (n > 0 ? `−${won(n)}` : won(0));

/**
 * 주문서 — 금액은 전부 서버가 계산한 값을 그대로 보여 준다. 쿠폰·포인트를 바꾸면 새 주문서를
 * 요청하고(가격은 보내지 않는다) 그 응답으로 갈아 끼운다. 할인은 견적이라 주문 접수 때 다시 판정된다.
 */
export default function OrderSheetPage() {
  useHeritageSurface();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useSeo({ title: portalTitle('주문서'), canonical: portalUrl('/shop/cart'), noindex: true });

  const [sheet, setSheet] = useState<OrderSheet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<MyCoupon[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [pointInput, setPointInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isLoggedIn()) {
      window.location.replace(buildLoginHref());
      return;
    }
    if (!id) return;
    // 방금 만든 주문서로 주소만 바뀐 경우는 다시 부르지 않는다
    if (sheet && String(sheet.id) === id) return;
    let cancelled = false;
    setLoadError(null);
    fetchOrderSheet(id)
      .then((s) => {
        if (cancelled) return;
        setSheet(s);
        setPointInput(s.pointAmount > 0 ? String(s.pointAmount) : '');
      })
      .catch((e) => {
        if (!cancelled) setLoadError(extractErrorMessage(e, '주문서를 불러오지 못했습니다.'));
      });
    return () => {
      cancelled = true;
    };
    // sheet 는 주소가 바뀌었을 때 건너뛸지만 판단한다 — 넣으면 갈아 끼울 때마다 다시 부른다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!isLoggedIn()) return;
    // 쿠폰·포인트를 못 불러와도 주문서는 보인다 — 고르는 칸만 비운다
    fetchMyCoupons()
      .then((list) => setCoupons(list.filter((c) => c.usable && c.status === 'AVAILABLE')))
      .catch(() => setCoupons([]));
    fetchMyPoints()
      .then((p) => setBalance(p.balance))
      .catch(() => setBalance(null));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const recreate = useCallback(
    async (userCouponId: number | null, pointAmount: number) => {
      if (!sheet) return;
      setBusy(true);
      setActionError(null);
      try {
        const next = await createOrderSheet({ items: sheetItems(sheet), userCouponId, pointAmount });
        setSheet(next);
        setPointInput(next.pointAmount > 0 ? String(next.pointAmount) : '');
        navigate(`/shop/order-sheet/${next.id}`, { replace: true });
      } catch (e) {
        setActionError(extractErrorMessage(e, '주문서를 다시 만들지 못했습니다.'));
      } finally {
        setBusy(false);
      }
    },
    [sheet, navigate],
  );

  if (loadError) {
    return (
      <Shell>
        <div className="kh-status kh-status-error" role="alert">
          <p className="kh-status-title">주문서를 열 수 없습니다</p>
          <p>{loadError}</p>
          <div>
            <Link to="/shop/cart" className="kh-button kh-button-ghost">
              장바구니로
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (!sheet) {
    return (
      <Shell>
        <div className="shop-skeleton-card kh-skeleton" aria-hidden="true" />
      </Shell>
    );
  }

  const left = remainingMs(sheet.expiresAt, now);
  const expired = left <= 0;
  const used = sheet.status === 'USED';
  const locked = expired || used || busy;
  const cap = pointCap(sheet, balance);
  const pointValue = pointInput.trim() === '' ? 0 : Number(pointInput);
  const pointInvalid = !/^\d*$/.test(pointInput.trim()) || pointValue > cap;
  const shippingBySeller = new Map(sheet.shippingLines.map((s) => [s.sellerId, s.fee]));
  // 지금 쿠폰이 목록에 없으면(예약 중 등) 선택 표시를 위해 자리만 남긴다
  const selectedCoupon = sheet.userCouponId;

  return (
    <Shell>
      <header className="checkout-head">
        <span className="kh-section-label">Order sheet</span>
        <h1 className="shop-page-title">주문서</h1>
        <p className={`checkout-timer${expired ? ' is-expired' : ''}`} role="timer" aria-live="off">
          {used ? (
            '이미 주문에 쓰인 주문서입니다'
          ) : expired ? (
            '주문서가 만료되었습니다'
          ) : (
            <>
              남은 시간 <span className="checkout-num">{formatCountdown(left)}</span>
            </>
          )}
        </p>
      </header>

      {(expired || used) && (
        <div className="kh-status kh-status-error checkout-expired" role="alert">
          <p>가격과 혜택을 다시 확인해 새 주문서를 만듭니다. 상품·쿠폰·포인트는 그대로 둡니다.</p>
          <div>
            <button
              type="button"
              className="kh-button"
              disabled={busy}
              onClick={() => void recreate(sheet.userCouponId, sheet.pointAmount)}
            >
              주문서 다시 만들기
            </button>
          </div>
        </div>
      )}

      <div className="checkout-layout">
        <div className="checkout-main">
          {groupBySeller(sheet.lines).map((group) => {
            const label = sellerLabel(group.sellerId);
            const fee = group.sellerId == null ? 0 : (shippingBySeller.get(group.sellerId) ?? 0);
            return (
              <section key={String(group.sellerId)} className="checkout-panel" aria-label={label}>
                <h2 className="checkout-panel-title">{label}</h2>
                <ul className="checkout-lines">
                  {group.lines.map((l) => (
                    <li key={l.lineNo} className="checkout-line">
                      <div className="checkout-line-main">
                        <span className="checkout-line-name">{l.productName}</span>
                        <span className="checkout-line-meta checkout-num">
                          {won(l.unitPrice)} × {l.quantity}
                        </span>
                        {(l.couponDiscount > 0 || l.pointAmount > 0) && (
                          <span className="checkout-line-meta checkout-num">
                            {l.couponDiscount > 0 && `쿠폰 ${minus(l.couponDiscount)}`}
                            {l.couponDiscount > 0 && l.pointAmount > 0 && ' · '}
                            {l.pointAmount > 0 && `포인트 ${minus(l.pointAmount)}`}
                          </span>
                        )}
                      </div>
                      <span className="checkout-line-amount checkout-num">{won(l.payable)}</span>
                    </li>
                  ))}
                </ul>
                <div className="checkout-row checkout-shipping">
                  <span>배송비</span>
                  <span className="checkout-num">{fee > 0 ? won(fee) : '무료'}</span>
                </div>
              </section>
            );
          })}

          <section className="checkout-panel" aria-labelledby="checkout-coupon-title">
            <h2 id="checkout-coupon-title" className="checkout-panel-title">
              쿠폰
            </h2>
            <fieldset className="checkout-choices" disabled={locked}>
              <legend className="checkout-sr">쿠폰 선택</legend>
              <label className="checkout-choice">
                <input
                  type="radio"
                  name="coupon"
                  checked={selectedCoupon == null}
                  onChange={() => void recreate(null, sheet.pointAmount)}
                />
                <span className="checkout-choice-name">쿠폰 사용 안 함</span>
              </label>
              {coupons.map((c) => (
                <label key={c.userCouponId} className="checkout-choice">
                  <input
                    type="radio"
                    name="coupon"
                    checked={selectedCoupon === c.userCouponId}
                    onChange={() => void recreate(c.userCouponId, sheet.pointAmount)}
                  />
                  <span className="checkout-choice-name">{c.definition.name}</span>
                  <span className="checkout-choice-desc">{describeCoupon(c, won)}</span>
                </label>
              ))}
            </fieldset>
            {coupons.length === 0 && <p className="checkout-hint">쓸 수 있는 쿠폰이 없습니다.</p>}
          </section>

          <section className="checkout-panel" aria-labelledby="checkout-point-title">
            <h2 id="checkout-point-title" className="checkout-panel-title">
              포인트
            </h2>
            <form
              className="checkout-point"
              onSubmit={(e) => {
                e.preventDefault();
                if (!pointInvalid) void recreate(sheet.userCouponId, pointValue);
              }}
            >
              <label className="checkout-sr" htmlFor="checkout-point-input">
                사용할 포인트
              </label>
              <input
                id="checkout-point-input"
                className="kh-field checkout-num"
                inputMode="numeric"
                placeholder="0"
                value={pointInput}
                disabled={locked}
                aria-invalid={pointInvalid}
                aria-describedby="checkout-point-hint"
                onChange={(e) => setPointInput(e.target.value.replace(/[^\d]/g, ''))}
              />
              <button
                type="button"
                className="kh-button kh-button-ghost"
                disabled={locked || cap === 0}
                onClick={() => setPointInput(String(cap))}
              >
                최대
              </button>
              <button type="submit" className="kh-button" disabled={locked || pointInvalid || pointValue === sheet.pointAmount}>
                적용
              </button>
            </form>
            <p id="checkout-point-hint" className="checkout-hint">
              보유 <span className="checkout-num">{balance == null ? '—' : won(balance)}</span> · 이번 주문 최대{' '}
              <span className="checkout-num">{won(cap)}</span> (쿠폰 적용 뒤 상품 금액까지, 배송비 제외)
            </p>
          </section>

          {actionError && (
            <div className="kh-status-error checkout-error" role="alert">
              {actionError}
            </div>
          )}
        </div>

        <aside className="checkout-summary checkout-panel" aria-labelledby="checkout-summary-title">
          <h2 id="checkout-summary-title" className="checkout-panel-title">
            결제 금액
          </h2>
          <div role="group" aria-label="결제 금액 분해" className="checkout-breakdown">
            <div className="checkout-row">
              <span>상품 금액</span>
              <span className="checkout-num">{won(sheet.itemsAmount)}</span>
            </div>
            <div className="checkout-row">
              <span>쿠폰 할인</span>
              <span className="checkout-num">{minus(sheet.couponDiscount)}</span>
            </div>
            <div className="checkout-row">
              <span>포인트</span>
              <span className="checkout-num">{minus(sheet.pointAmount)}</span>
            </div>
            <div className="checkout-row">
              <span>배송비</span>
              <span className="checkout-num">{won(sheet.shippingAmount)}</span>
            </div>
            <div className="checkout-row checkout-total">
              <span>결제 금액</span>
              <span className="checkout-num">{won(sheet.payableAmount)}</span>
            </div>
          </div>
          <p className="checkout-hint">
            할인과 포인트는 견적입니다. 주문을 접수할 때 다시 확인하고, 그 사이 쓸 수 없게 되면 주문서를 다시 만들어야
            합니다.
          </p>
          <button type="button" className="kh-button checkout-pay" disabled>
            결제하기
          </button>
          <p className="checkout-hint">주문 접수는 다음 단계에서 열립니다</p>
        </aside>
      </div>
    </Shell>
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
