import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ShopHeader from '../../components/ShopHeader';
import { portalTitle, portalUrl } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import {
  approveSellerClaim,
  errorStatus,
  extractErrorMessage,
  fetchSellerClaims,
  rejectSellerClaim,
  type Claim,
} from '../../api/shopApi';
import { buildLoginHref, isLoggedIn } from '../../auth/auth';
import { formatWon } from '../shopFormat';
import { claimStatusLabel } from '../shop/claimModel';
import '../Shop.css';
import '../shop/Checkout.css';
import './Seller.css';

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; claims: Claim[] };

async function loadClaims(): Promise<Load> {
  try {
    return { kind: 'ready', claims: await fetchSellerClaims() };
  } catch (err) {
    return {
      kind: 'error',
      message:
        errorStatus(err) === 403
          ? '승인된(ACTIVE) 판매자만 취소 요청을 볼 수 있습니다.'
          : extractErrorMessage(err, '취소 요청을 불러오지 못했습니다.'),
    };
  }
}

/**
 * 판매자 포털 — 내 상품 주문의 취소 요청. 출고 전 취소는 자동으로 환불되고, 이미 출고된 상품의 취소만
 * 여기서 결정한다: 승인(반품을 받았다 — 재입고 없이 환불) 또는 반려(사유 필수).
 */
export default function SellerClaimsPage() {
  useHeritageSurface();
  useSeo({ title: portalTitle('취소 요청'), canonical: portalUrl('/shop/seller/claims'), noindex: true });

  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => setLoad(await loadClaims()), []);

  useEffect(() => {
    if (!isLoggedIn()) {
      window.location.replace(buildLoginHref('/shop/seller/claims'));
      return;
    }
    void reload();
  }, [reload]);

  const act = async (run: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await run();
      setRejecting(null);
      setReason('');
      await reload();
    } catch (e) {
      setError(extractErrorMessage(e, '처리하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shop-page">
      <ShopHeader />
      <main className="shop-container seller-container">
        <header className="seller-head">
          <span className="kh-section-label">Seller</span>
          <h1 className="shop-page-title">취소 요청</h1>
          <p className="seller-lead">
            출고 전 취소는 자동으로 환불됩니다. 이미 출고된 상품의 취소만 반품을 확인한 뒤 승인하거나 반려합니다.
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

        {error && (
          <div className="kh-status-error checkout-error" role="alert">
            {error}
          </div>
        )}

        {load.kind === 'ready' &&
          (load.claims.length === 0 ? (
            <p className="seller-gate">들어온 취소 요청이 없습니다.</p>
          ) : (
            <ul className="seller-product-list" aria-label="취소 요청 목록">
              {load.claims.map((c) => {
                const deciding = c.step === 'SELLER_DECISION' && c.status === 'REQUESTED';
                return (
                  <li key={c.claimId} className="seller-product-row seller-claim-row">
                    <div className="seller-product-main">
                      <span className="checkout-line-name">
                        주문 {c.orderId} · 라인 {c.lineNos.join(', ')}
                      </span>
                      <span className="seller-product-meta">
                        <span className={`shop-badge claim-badge claim-badge--${c.status.toLowerCase()}`}>{claimStatusLabel(c)}</span>
                        {c.refundAmount != null && <span className="checkout-num">환불 {formatWon(c.refundAmount)}</span>}
                        {c.rejectReason && <span>사유: {c.rejectReason}</span>}
                      </span>
                    </div>
                    {deciding && rejecting !== c.claimId && (
                      <div className="seller-claim-actions">
                        <button type="button" className="kh-button" disabled={busy} onClick={() => void act(() => approveSellerClaim(c.claimId))}>
                          반품 확인 · 승인
                        </button>
                        <button
                          type="button"
                          className="kh-button kh-button-ghost"
                          disabled={busy}
                          onClick={() => {
                            setRejecting(c.claimId);
                            setReason('');
                          }}
                        >
                          반려
                        </button>
                      </div>
                    )}
                    {deciding && rejecting === c.claimId && (
                      <form
                        className="seller-claim-reject"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (reason.trim()) void act(() => rejectSellerClaim(c.claimId, reason.trim()));
                        }}
                      >
                        <label className="seller-label" htmlFor={`reject-${c.claimId}`}>
                          반려 사유
                        </label>
                        <input
                          id={`reject-${c.claimId}`}
                          className="kh-field"
                          value={reason}
                          maxLength={500}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <div className="seller-claim-actions">
                          <button type="submit" className="kh-button" disabled={busy || !reason.trim()}>
                            반려하기
                          </button>
                          <button type="button" className="kh-button kh-button-ghost" disabled={busy} onClick={() => setRejecting(null)}>
                            취소
                          </button>
                        </div>
                      </form>
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
