import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ShopHeader from '../components/ShopHeader';
import {
  createOrderSheet,
  fetchCart,
  fetchProduct,
  extractErrorMessage,
  putCartItem,
  type ProductDetail,
} from '../api/shopApi';
import { isLoggedIn, buildLoginHref } from '../auth/auth';
import { formatWon } from './shopFormat';
import { portalTitle, portalUrl } from '../seo/copy.mjs';
import { useSeo } from '../seo/useSeo';
import './Shop.css';
import { useHeritageSurface } from '../hooks/useHeritageSurface';
import FavoriteButton from '../components/favorite/FavoriteButton';

/** 서버 장바구니 수량 상한(CartItem.MAX_QUANTITY) */
const CART_MAX_QUANTITY = 999;

export default function ShopProductDetailPage() {
  useHeritageSurface();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  useSeo({
    title: product ? portalTitle(`${product.name} — 스토어`) : '',
    description: product ? `${product.name} — ${formatWon(product.price)}. MSA 커머스 데모 스토어에서 주문 플로우를 확인해 보세요.` : undefined,
    canonical: id ? portalUrl(`/shop/products/${id}`) : undefined,
  });
  const [error, setError] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState<'cart' | 'buy' | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProduct(id)
      .then((p) => {
        if (!cancelled) setProduct(p);
      })
      .catch((e) => {
        if (!cancelled) setError(extractErrorMessage(e, '상품 정보를 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const stock = product?.stock ?? 0;
  const soldOut = stock <= 0;
  const unitPrice = product != null ? Number(product.price) : 0;

  /** 로그인해야 담고 살 수 있다 — 아니면 이 상품으로 돌아오는 로그인으로 보낸다 */
  const requireLogin = () => {
    if (isLoggedIn()) return true;
    window.location.href = buildLoginHref();
    return false;
  };

  /** 장바구니 수량은 「정하기」다 — 이미 담긴 수량에 더해 보낸다 */
  const handleAddToCart = async () => {
    if (!product || soldOut || !requireLogin()) return;
    setPending('cart');
    setOrderError(null);
    setAddedToCart(false);
    try {
      const cart = await fetchCart();
      const current = cart.items.find((i) => i.productId === product.id)?.quantity ?? 0;
      await putCartItem(product.id, Math.min(CART_MAX_QUANTITY, current + quantity));
      setAddedToCart(true);
    } catch (e) {
      setOrderError(extractErrorMessage(e, '장바구니에 담지 못했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setPending(null);
    }
  };

  /** 이 상품 하나로 주문서를 만든다 — 가격은 서버가 정한다 */
  const handleBuyNow = async () => {
    if (!product || soldOut || !requireLogin()) return;
    setPending('buy');
    setOrderError(null);
    try {
      const sheet = await createOrderSheet({ items: [{ productId: product.id, quantity }] });
      navigate(`/shop/order-sheet/${sheet.id}`);
    } catch (e) {
      setOrderError(extractErrorMessage(e, '주문서를 만들지 못했습니다. 잠시 후 다시 시도해주세요.'));
      setPending(null);
    }
  };

  return (
    <div className="shop-page">
      <ShopHeader />
      <main className="shop-container shop-container-narrow">
        {loading && <div className="shop-skeleton-card" aria-hidden="true" />}

        {!loading && error && (
          <div className="shop-status shop-status-error" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && product && (
          <section className="shop-detail-card">
            <div className="shop-detail-head">
              <h1 className="shop-detail-name">{product.name}</h1>
              {/* 찜 (ADR-0074) — 목록 카드는 <button> 이라 중첩이 안 돼 상세에만 둔다 */}
              {id && <FavoriteButton type="PRODUCT" targetKey={id} />}
            </div>
            <div className="shop-detail-price">{formatWon(product.price)}</div>
            <div className="shop-detail-row">
              <span className="shop-detail-label">재고</span>
              {soldOut ? (
                <span className="shop-badge shop-badge-soldout">품절</span>
              ) : (
                <span className="shop-badge shop-badge-stock">재고 {stock}</span>
              )}
            </div>

            <div className="shop-detail-row">
              <span className="shop-detail-label">수량</span>
              <div className="shop-stepper" role="group" aria-label="수량 선택">
                <button
                  type="button"
                  className="shop-stepper-btn"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={soldOut || quantity <= 1}
                  aria-label="수량 줄이기"
                >
                  −
                </button>
                <span className="shop-stepper-value" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  className="shop-stepper-btn"
                  onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                  disabled={soldOut || quantity >= stock}
                  aria-label="수량 늘리기"
                >
                  +
                </button>
              </div>
            </div>

            <div className="shop-detail-row">
              <span className="shop-detail-label">총 금액</span>
              <span className="shop-detail-total">{formatWon(unitPrice * quantity)}</span>
            </div>

            {orderError && (
              <div className="shop-inline-error" role="alert">
                {orderError}
              </div>
            )}

            {addedToCart && (
              <p className="shop-detail-row" role="status">
                <span className="shop-detail-label">장바구니에 담았습니다</span>
                <Link to="/shop/cart" className="shop-btn-secondary">
                  장바구니 보기
                </Link>
              </p>
            )}

            <div className="shop-detail-actions">
              <button
                type="button"
                className="shop-btn-secondary"
                onClick={handleAddToCart}
                disabled={soldOut || pending != null}
              >
                {pending === 'cart' ? '담는 중...' : '장바구니 담기'}
              </button>
              <button
                type="button"
                className="shop-btn-primary"
                onClick={handleBuyNow}
                disabled={soldOut || pending != null}
              >
                {soldOut ? '품절' : pending === 'buy' ? '주문서 만드는 중...' : '바로 구매'}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
