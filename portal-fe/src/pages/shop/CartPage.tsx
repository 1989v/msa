import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ShopHeader from '../../components/ShopHeader';
import {
  createOrderSheet,
  extractErrorMessage,
  fetchCart,
  putCartItem,
  removeCartItem,
  type Cart,
} from '../../api/shopApi';
import { buildLoginHref, isLoggedIn } from '../../auth/auth';
import { portalTitle, portalUrl } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { formatWon } from '../shopFormat';
import { groupBySeller, sellerLabel } from './checkoutModel';
import MyBenefitsPanel from './MyBenefitsPanel';
import '../Shop.css';
import './Checkout.css';

/** 서버 수량 상한(CartItem.MAX_QUANTITY) */
const MAX_QUANTITY = 999;

/**
 * 장바구니 — 판매자별로 묶어 보여 준다. 합계는 여기서 계산하지 않는다 —
 * 가격·할인·배송비는 주문서가 서버에서 한 번에 정한다.
 */
export default function CartPage() {
  useHeritageSurface();
  useSeo({ title: portalTitle('장바구니'), canonical: portalUrl('/shop/cart'), noindex: true });
  const navigate = useNavigate();

  const [cart, setCart] = useState<Cart | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<number | 'sheet' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      window.location.replace(buildLoginHref('/shop/cart'));
      return;
    }
    let cancelled = false;
    fetchCart()
      .then((c) => {
        if (!cancelled) setCart(c);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(extractErrorMessage(e, '장바구니를 불러오지 못했습니다.'));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = async (key: number | 'sheet', action: () => Promise<void>, fallback: string) => {
    setPending(key);
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(extractErrorMessage(e, fallback));
    } finally {
      setPending(null);
    }
  };

  const changeQuantity = (productId: number, quantity: number) =>
    run(productId, async () => setCart(await putCartItem(productId, quantity)), '수량을 바꾸지 못했습니다.');

  const remove = (productId: number) =>
    run(productId, async () => setCart(await removeCartItem(productId)), '상품을 빼지 못했습니다.');

  const toSheet = () =>
    run(
      'sheet',
      async () => {
        const sheet = await createOrderSheet({ fromCart: true });
        navigate(`/shop/order-sheet/${sheet.id}`);
      },
      '주문서를 만들지 못했습니다.',
    );

  const items = cart?.items ?? [];
  const unavailable = items.filter((i) => !i.onSale).length;

  return (
    <div className="shop-page">
      <ShopHeader />
      <main className="shop-container checkout-container">
        <header className="checkout-head">
          <span className="kh-section-label">Cart</span>
          <h1 className="shop-page-title">장바구니</h1>
        </header>

        {loadError && (
          <div className="kh-status kh-status-error" role="alert">
            <p className="kh-status-title">불러오지 못했습니다</p>
            <p>{loadError}</p>
          </div>
        )}

        {!loadError && cart == null && <div className="shop-skeleton-card kh-skeleton" aria-hidden="true" />}

        {cart && items.length === 0 && (
          <section className="kh-status" role="status">
            <p className="kh-status-title">장바구니가 비었습니다</p>
            <div>
              <Link to="/shop" className="kh-button kh-button-ghost">
                상품 보러 가기
              </Link>
            </div>
          </section>
        )}

        {cart && items.length > 0 && (
          <div className="checkout-layout">
            <div className="checkout-main">
              {groupBySeller(items).map((group) => {
                const label = sellerLabel(group.sellerId, group.sellerName);
                return (
                  <section key={String(group.sellerId)} className="checkout-panel" aria-label={label}>
                    <h2 className="checkout-panel-title">{label}</h2>
                    <ul className="checkout-lines">
                      {group.lines.map((line) => {
                        const busy = pending === line.productId;
                        return (
                          <li key={line.productId} className="checkout-line checkout-cart-line">
                            <div className="checkout-cart-line-head">
                              <div className="checkout-line-main">
                                <Link to={`/shop/products/${line.productId}`} className="checkout-line-name">
                                  {line.productName ?? `상품 ${line.productId}`}
                                </Link>
                                <span className="checkout-line-meta checkout-num">
                                  {line.price != null ? formatWon(line.price) : '가격 정보 없음'}
                                </span>
                              </div>
                              {!line.onSale && <span className="shop-badge shop-badge-soldout checkout-unavailable">판매 불가</span>}
                            </div>
                            <div className="checkout-stepper-row">
                              <div className="shop-stepper" role="group" aria-label={`${line.productName ?? '상품'} 수량`}>
                                <button
                                  type="button"
                                  className="shop-stepper-btn"
                                  aria-label="수량 줄이기"
                                  disabled={busy || line.quantity <= 1}
                                  onClick={() => void changeQuantity(line.productId, line.quantity - 1)}
                                >
                                  −
                                </button>
                                <span className="shop-stepper-value">{line.quantity}</span>
                                <button
                                  type="button"
                                  className="shop-stepper-btn"
                                  aria-label="수량 늘리기"
                                  disabled={busy || line.quantity >= MAX_QUANTITY}
                                  onClick={() => void changeQuantity(line.productId, line.quantity + 1)}
                                >
                                  +
                                </button>
                              </div>
                              <button
                                type="button"
                                className="checkout-remove"
                                disabled={busy}
                                onClick={() => void remove(line.productId)}
                              >
                                빼기
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
              {actionError && (
                <div className="kh-status-error checkout-error" role="alert">
                  {actionError}
                </div>
              )}
            </div>

            <aside className="checkout-actions">
              <section className="checkout-panel checkout-summary" aria-label="주문서로">
                <p className="checkout-hint">
                  상품 {items.length}종 · 배송비는 판매자별로 붙습니다. 결제 금액은 주문서에서 쿠폰·포인트와 함께 확정됩니다.
                </p>
                {unavailable > 0 && (
                  <p className="checkout-hint" role="status">
                    판매 불가 상품 {unavailable}개를 빼야 주문서를 만들 수 있습니다.
                  </p>
                )}
                <button
                  type="button"
                  className="kh-button"
                  disabled={pending != null || unavailable > 0}
                  onClick={() => void toSheet()}
                >
                  {pending === 'sheet' ? '주문서 만드는 중…' : '주문서 만들기'}
                </button>
              </section>
              <MyBenefitsPanel />
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
