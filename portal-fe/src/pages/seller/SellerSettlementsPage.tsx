import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ShopHeader from '../../components/ShopHeader';
import { portalTitle, portalUrl } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import {
  errorStatus,
  extractErrorMessage,
  fetchSellerSettlement,
  fetchSellerSettlements,
  type SettlementLine,
  type SettlementStatement,
} from '../../api/shopApi';
import { buildLoginHref, isLoggedIn } from '../../auth/auth';
import { formatWon } from '../shopFormat';
import { formatPeriod, SETTLEMENT_STATUS_LABEL } from './settlementFormat';
import '../Shop.css';
import '../shop/Checkout.css';
import './Seller.css';

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; statements: SettlementStatement[] };

type Detail = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; lines: SettlementLine[] };

async function loadStatements(): Promise<Load> {
  try {
    return { kind: 'ready', statements: await fetchSellerSettlements() };
  } catch (err) {
    return {
      kind: 'error',
      message:
        errorStatus(err) === 403
          ? '승인된(ACTIVE) 판매자만 정산서를 볼 수 있습니다.'
          : extractErrorMessage(err, '정산서를 불러오지 못했습니다.'),
    };
  }
}

/**
 * 판매자 포털 — 내 정산서. 정산 주기(주간 월~일 · 월간)가 닫힌 뒤 새벽 배치가 구매 확정분을 모아 만든다.
 * 지급액 = 순매출 + 배송비 − 수수료. 환불된 라인은 정산서에 들어오지 않는다.
 */
export default function SellerSettlementsPage() {
  useHeritageSurface();
  useSeo({ title: portalTitle('정산서'), canonical: portalUrl('/shop/seller/settlements'), noindex: true });

  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [openId, setOpenId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, Detail>>({});

  useEffect(() => {
    if (!isLoggedIn()) {
      window.location.replace(buildLoginHref('/shop/seller/settlements'));
      return;
    }
    void loadStatements().then(setLoad);
  }, []);

  const toggle = async (id: number) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (details[id]?.kind === 'ready') return;
    setDetails((d) => ({ ...d, [id]: { kind: 'loading' } }));
    try {
      const statement = await fetchSellerSettlement(id);
      setDetails((d) => ({ ...d, [id]: { kind: 'ready', lines: statement.lines ?? [] } }));
    } catch (err) {
      setDetails((d) => ({ ...d, [id]: { kind: 'error', message: extractErrorMessage(err, '명세를 불러오지 못했습니다.') } }));
    }
  };

  return (
    <div className="shop-page">
      <ShopHeader />
      <main className="shop-container seller-container">
        <header className="seller-head">
          <span className="kh-section-label">Seller</span>
          <h1 className="shop-page-title">정산서</h1>
          <p className="seller-lead">
            정산 기간이 끝나면 다음 날 새벽에 구매 확정된 판매분을 모아 정산합니다. 지급액은 순매출과 배송비를 더하고 수수료를 뺀 금액입니다.
          </p>
        </header>

        {load.kind === 'loading' && <div className="shop-skeleton-card kh-skeleton" aria-hidden="true" />}

        {load.kind === 'error' && (
          <section className="kh-status seller-gate" role="alert">
            <p className="kh-status-title">볼 수 없습니다</p>
            <p>{load.message}</p>
            <div>
              <Link to="/shop/seller/products" className="kh-button kh-button-ghost">
                내 상품으로
              </Link>
            </div>
          </section>
        )}

        {load.kind === 'ready' &&
          (load.statements.length === 0 ? (
            <p className="seller-gate">아직 정산서가 없습니다. 구매 확정된 판매분은 정산 기간이 끝난 뒤 여기에 나타납니다.</p>
          ) : (
            <ul className="seller-product-list" aria-label="정산서 목록">
              {load.statements.map((s) => {
                const detail = details[s.id];
                return (
                  <li key={s.id}>
                    <div className="seller-product-row">
                      <div className="seller-product-main">
                        <span className="checkout-line-name">{formatPeriod(s.periodStart, s.periodEnd)}</span>
                        <span className="seller-product-meta">
                          <span className={`shop-badge seller-badge seller-badge--${s.status === 'PAID' ? 'active' : 'pending'}`}>
                            {SETTLEMENT_STATUS_LABEL[s.status]}
                          </span>
                          <span className="checkout-num">
                            순매출 {formatWon(s.netSales)} · 배송비 {formatWon(s.shippingFee)} · 수수료 {formatWon(s.commission)}
                          </span>
                        </span>
                      </div>
                      <div className="seller-claim-actions">
                        <span className="checkout-line-amount checkout-num">지급 {formatWon(s.payout)}</span>
                        <button
                          type="button"
                          className="kh-button kh-button-ghost"
                          aria-expanded={openId === s.id}
                          onClick={() => void toggle(s.id)}
                        >
                          {openId === s.id ? '명세 닫기' : `명세 ${s.lineCount}건`}
                        </button>
                      </div>
                    </div>
                    {openId === s.id && detail?.kind === 'loading' && <div className="shop-skeleton-card kh-skeleton" aria-hidden="true" />}
                    {openId === s.id && detail?.kind === 'error' && (
                      <div className="kh-status-error checkout-error" role="alert">
                        {detail.message}
                      </div>
                    )}
                    {openId === s.id && detail?.kind === 'ready' && (
                      <ul className="checkout-lines" aria-label={`${formatPeriod(s.periodStart, s.periodEnd)} 명세`}>
                        {detail.lines.map((l) => (
                          <li key={`${l.kind}-${l.orderId}-${l.orderItemId ?? 'ship'}`} className="checkout-line">
                            <div className="checkout-line-main">
                              <span className="checkout-line-name">
                                주문 {l.orderId} · {l.kind === 'SHIPPING' ? '배송비' : `라인 ${l.orderItemId}`}
                              </span>
                              <span className="checkout-line-meta checkout-num">
                                {l.kind === 'SHIPPING'
                                  ? `배송비 ${formatWon(l.shippingFee)} (수수료 없음)`
                                  : `순매출 ${formatWon(l.netSales)} − 수수료 ${formatWon(l.commission)}`}
                              </span>
                            </div>
                            <span className="checkout-line-amount checkout-num">{formatWon(l.payout)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          ))}
      </main>
    </div>
  );
}
