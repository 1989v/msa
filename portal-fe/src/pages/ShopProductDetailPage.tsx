import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import ShopHeader from '../components/ShopHeader';
import {
  createOrder,
  fetchProduct,
  extractErrorMessage,
  type OrderCreateResponse,
  type ProductDetail,
} from '../api/shopApi';
import { isLoggedIn } from '../auth/auth';
import { formatWon } from './shopFormat';
import './Shop.css';

export default function ShopProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [quantity, setQuantity] = useState(1);
  const [ordering, setOrdering] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<OrderCreateResponse | null>(null);

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

  const handleOrder = async () => {
    if (!product || soldOut) return;
    if (!isLoggedIn()) {
      navigate(`/shop/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setOrdering(true);
    setOrderError(null);
    try {
      const result = await createOrder([
        { productId: product.id, quantity, unitPrice },
      ]);
      setOrderResult(result);
    } catch (e) {
      setOrderError(extractErrorMessage(e, '주문에 실패했습니다. 잠시 후 다시 시도해주세요.'));
    } finally {
      setOrdering(false);
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

        {!loading && !error && product && orderResult && (
          <section className="shop-order-result" aria-live="polite">
            <h2 className="shop-order-result-title">주문이 완료되었습니다</h2>
            <div className="shop-detail-row">
              <span className="shop-detail-label">주문번호</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{orderResult.orderId}</span>
            </div>
            <div className="shop-detail-row">
              <span className="shop-detail-label">총액</span>
              <span className="shop-detail-total">{formatWon(orderResult.totalAmount)}</span>
            </div>
            <div className="shop-detail-row">
              <span className="shop-detail-label">상태</span>
              <span className="shop-badge shop-badge-pending">{orderResult.status}</span>
            </div>
            <Link to="/shop/orders" className="shop-btn-primary">
              주문내역 보기
            </Link>
            <Link to="/shop" className="shop-btn-secondary">
              계속 쇼핑하기
            </Link>
          </section>
        )}

        {!loading && !error && product && !orderResult && (
          <section className="shop-detail-card">
            <h1 className="shop-detail-name">{product.name}</h1>
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

            <button
              type="button"
              className="shop-btn-primary"
              onClick={handleOrder}
              disabled={soldOut || ordering}
            >
              {soldOut ? '품절' : ordering ? '주문 처리 중...' : '구매하기'}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
