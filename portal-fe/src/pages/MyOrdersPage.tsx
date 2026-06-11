import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ShopHeader from '../components/ShopHeader';
import {
  fetchMyOrders,
  extractErrorMessage,
  type MyOrder,
  type OrderStatus,
} from '../api/shopApi';
import { isLoggedIn } from '../auth/auth';
import { formatDateTime, formatWon } from './shopFormat';
import './Shop.css';

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: '결제 대기',
  COMPLETED: '주문 완료',
  CANCELLED: '주문 취소',
};

// 상태 톤: PENDING=warning / COMPLETED=secondary(positive) / CANCELLED=muted.
// P/L(profit/loss) 색상은 전략 성과 전용이므로 미사용 (DESIGN.md §8).
const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  PENDING: 'shop-badge-pending',
  COMPLETED: 'shop-badge-completed',
  CANCELLED: 'shop-badge-cancelled',
};

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate(`/shop/login?next=${encodeURIComponent('/shop/orders')}`, { replace: true });
      return;
    }
    let cancelled = false;
    fetchMyOrders()
      .then((list) => {
        if (cancelled) return;
        // 최신순 정렬
        const sorted = [...list].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setOrders(sorted);
      })
      .catch((e) => {
        if (!cancelled) setError(extractErrorMessage(e, '주문 내역을 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="shop-page">
      <ShopHeader />
      <main className="shop-container shop-container-narrow">
        <h1 className="shop-page-title">주문내역</h1>

        {loading && (
          <div className="shop-order-list" aria-hidden="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="shop-skeleton-card" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="shop-status shop-status-error" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && orders && orders.length === 0 && (
          <div className="shop-status">
            <p style={{ marginBottom: 'var(--ko-space-4)' }}>아직 주문 내역이 없습니다.</p>
            <Link to="/shop" className="shop-btn-primary">
              상품 보러 가기
            </Link>
          </div>
        )}

        {!loading && !error && orders && orders.length > 0 && (
          <div className="shop-order-list">
            {orders.map((order) => {
              const badgeClass = STATUS_BADGE_CLASS[order.status] ?? 'shop-badge-cancelled';
              const label = STATUS_LABEL[order.status] ?? order.status;
              return (
                <article key={order.orderId} className="shop-order-card">
                  <div className="shop-order-card-head">
                    <time className="shop-order-date" dateTime={order.createdAt}>
                      {formatDateTime(order.createdAt)}
                    </time>
                    <span className={`shop-badge ${badgeClass}`}>{label}</span>
                  </div>
                  <div className="shop-order-items">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="shop-order-item-row">
                        <span>상품 #{item.productId}</span>
                        <span>
                          {formatWon(item.unitPrice)} × {item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="shop-order-total">
                    <span className="shop-detail-label">총 결제금액</span>
                    <span className="shop-order-total-value">{formatWon(order.totalAmount)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
