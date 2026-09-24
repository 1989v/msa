import { useEffect, useState } from 'react';
import { fetchMyCoupons, fetchMyPoints, type MyCoupon } from '../../api/shopApi';
import { formatWon } from '../shopFormat';
import { describeCoupon } from './checkoutModel';

type Benefits = { coupons: MyCoupon[]; balance: number } | { error: true } | null;

/** 내 쿠폰(지금 쓸 수 있는 것) · 포인트 잔액 — 주문서에서 고를 수 있는 것을 미리 보여 준다 */
export default function MyBenefitsPanel() {
  const [benefits, setBenefits] = useState<Benefits>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMyCoupons(), fetchMyPoints()])
      .then(([coupons, points]) => {
        if (!cancelled) {
          setBenefits({ coupons: coupons.filter((c) => c.usable && c.status === 'AVAILABLE'), balance: points.balance });
        }
      })
      .catch(() => {
        if (!cancelled) setBenefits({ error: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="checkout-panel" aria-labelledby="my-benefits-title">
      <h2 id="my-benefits-title" className="checkout-panel-title">
        내 쿠폰 · 포인트
      </h2>
      {benefits == null && <p className="checkout-hint">불러오는 중…</p>}
      {benefits && 'error' in benefits && <p className="checkout-hint">혜택 정보를 불러오지 못했습니다.</p>}
      {benefits && 'coupons' in benefits && (
        <>
          <div className="checkout-row">
            <span>포인트</span>
            <span className="checkout-num">{formatWon(benefits.balance)}</span>
          </div>
          {benefits.coupons.length === 0 ? (
            <p className="checkout-hint">쓸 수 있는 쿠폰이 없습니다.</p>
          ) : (
            <ul className="checkout-benefits">
              {benefits.coupons.map((c) => (
                <li key={c.userCouponId}>
                  <span className="checkout-choice-name">{c.definition.name}</span>
                  <span className="checkout-choice-desc">{describeCoupon(c, formatWon)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
