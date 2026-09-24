import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  confirmPurchase,
  extractErrorMessage,
  fetchClaims,
  previewClaim,
  requestClaim,
  type Claim,
  type ClaimPreview,
  type OrderDetail,
} from '../../api/shopApi';
import { formatWon } from '../shopFormat';
import { canConfirmPurchase, cancellableLineNos, claimStatusLabel, isClaimMoving } from './claimModel';

const won = (n: number) => formatWon(n);

/** 진행 중 클레임 상태를 다시 묻는 간격 */
export const CLAIM_POLL_MS = 2_000;

type Draft = { lineNos: number[] | null; preview: ClaimPreview | null; loading: boolean };

/**
 * 주문 상세의 취소 · 부분 취소 · 구매 확정. 환불 금액은 서버 미리보기가 준 값만 보인다(계산하지 않는다).
 * 클레임은 비동기(이행 취소 → 재입고 → 혜택 원복 → 환불)라 진행 중이면 2초마다 다시 묻고,
 * 환불이 끝나면 [onOrderChanged] 로 주문을 다시 불러오게 한다.
 */
export default function OrderClaimPanel({ order, onOrderChanged }: { order: OrderDetail; onOrderChanged: () => void }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refundedSeen = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await fetchClaims(order.orderId);
      setClaims(next);
      setLoaded(true);
      const refunded = next.filter((c) => c.status === 'REFUNDED').length;
      if (refundedSeen.current != null && refunded > refundedSeen.current) onOrderChanged();
      refundedSeen.current = refunded;
    } catch {
      setLoaded(true);
    }
  }, [order.orderId, onOrderChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  const moving = claims.some(isClaimMoving);
  useEffect(() => {
    if (!moving) return;
    const timer = window.setTimeout(() => void load(), CLAIM_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [moving, claims, load]);

  const cancellable = useMemo(() => cancellableLineNos(order, claims), [order, claims]);
  const lineName = (no: number) => order.lines.find((l) => l.lineNo === no)?.productName ?? `라인 ${no}`;

  const openPreview = async (lineNos: number[] | null) => {
    setError(null);
    setDraft({ lineNos, preview: null, loading: true });
    try {
      setDraft({ lineNos, preview: await previewClaim(order.orderId, lineNos), loading: false });
    } catch (e) {
      setDraft(null);
      setError(extractErrorMessage(e, '환불 금액을 불러오지 못했습니다.'));
    }
  };

  const submit = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await requestClaim(order.orderId, draft.lineNos);
      setDraft(null);
      setSelected([]);
      await load();
    } catch (e) {
      setError(extractErrorMessage(e, '취소를 요청하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const onConfirmPurchase = async () => {
    setBusy(true);
    setError(null);
    try {
      await confirmPurchase(order.orderId);
      onOrderChanged();
    } catch (e) {
      setError(extractErrorMessage(e, '구매 확정을 하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (no: number) => {
    setDraft(null);
    setSelected((prev) => (prev.includes(no) ? prev.filter((n) => n !== no) : [...prev, no].sort((a, b) => a - b)));
  };

  const showActions = cancellable.length > 0 || canConfirmPurchase(order, claims);
  if (!loaded || (!showActions && claims.length === 0)) return null;

  return (
    <section className="checkout-panel claim-panel" aria-labelledby="claim-title">
      <h2 id="claim-title" className="checkout-panel-title">
        취소 · 구매 확정
      </h2>

      {cancellable.length > 0 && (
        <fieldset className="checkout-choices" disabled={busy}>
          <legend className="checkout-hint">취소할 상품을 고르세요</legend>
          {order.lines
            .filter((l) => cancellable.includes(l.lineNo))
            .map((l) => (
              <label key={l.lineNo} className="checkout-choice">
                <input type="checkbox" checked={selected.includes(l.lineNo)} onChange={() => toggle(l.lineNo)} />
                <span className="checkout-choice-name">{l.productName}</span>
                <span className="checkout-choice-desc checkout-num">
                  {won(l.unitPrice)} × {l.quantity}
                  {l.shippedAt ? ' · 출고됨' : ''}
                </span>
              </label>
            ))}
        </fieldset>
      )}

      {showActions && (
        <div className="checkout-actions claim-actions">
          {cancellable.length > 0 && (
            <>
              <button
                type="button"
                className="kh-button kh-button-ghost"
                disabled={busy || selected.length === 0}
                onClick={() => void openPreview(selected)}
              >
                선택 상품 취소
              </button>
              <button type="button" className="kh-button kh-button-ghost" disabled={busy} onClick={() => void openPreview(null)}>
                전체 취소
              </button>
            </>
          )}
          {canConfirmPurchase(order, claims) && (
            <button type="button" className="kh-button" disabled={busy} onClick={() => void onConfirmPurchase()}>
              구매 확정
            </button>
          )}
        </div>
      )}

      {draft && (
        <div className="claim-preview" role="region" aria-label="환불 예상">
          {draft.loading || !draft.preview ? (
            <p className="checkout-hint">환불 금액을 계산하고 있습니다…</p>
          ) : (
            <PreviewBreakdown preview={draft.preview} />
          )}
          <div className="checkout-actions">
            <button type="button" className="kh-button" disabled={busy || draft.loading} onClick={() => void submit()}>
              {draft.lineNos ? '선택 상품 취소 요청' : '전체 취소 요청'}
            </button>
            <button type="button" className="kh-button kh-button-ghost" disabled={busy} onClick={() => setDraft(null)}>
              닫기
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="kh-status-error checkout-error" role="alert">
          {error}
        </div>
      )}

      {claims.length > 0 && (
        <ul className="claim-list" aria-label="취소 요청">
          {claims.map((c) => (
            <li key={c.claimId} className="claim-item">
              <div className="claim-item-head">
                <span className="claim-item-lines">{c.lineNos.map(lineName).join(', ')}</span>
                <span className={`shop-badge claim-badge claim-badge--${c.status.toLowerCase()}`}>{claimStatusLabel(c)}</span>
              </div>
              {c.status === 'REFUNDED' && (
                <p className="claim-item-meta checkout-num">
                  환불 {won(c.refundAmount ?? 0)}
                  {(c.pointRestore ?? 0) > 0 && ` · 포인트 ${won(c.pointRestore ?? 0)} 원복`}
                  {(c.shippingRefund ?? 0) > 0 && ` · 배송비 ${won(c.shippingRefund ?? 0)} 포함`}
                </p>
              )}
              {c.status === 'REJECTED' && c.rejectReason && <p className="claim-item-meta">사유: {c.rejectReason}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PreviewBreakdown({ preview }: { preview: ClaimPreview }) {
  return (
    <div role="group" aria-label="환불 금액 분해" className="checkout-breakdown">
      {preview.lines.map((l) => (
        <div key={l.lineNo} className="checkout-row">
          <span>{l.productName}</span>
          <span className="checkout-num">{won(l.payable)}</span>
        </div>
      ))}
      {preview.shippingRefund > 0 && (
        <div className="checkout-row">
          <span>배송비 환불</span>
          <span className="checkout-num">{won(preview.shippingRefund)}</span>
        </div>
      )}
      {preview.pointRestore > 0 && (
        <div className="checkout-row">
          <span>포인트로 돌려받음</span>
          <span className="checkout-num">{won(preview.pointRestore)}</span>
        </div>
      )}
      <div className="checkout-row">
        <span>쿠폰</span>
        <span>{preview.couponReturn ? '돌려받음(사용 기간 내)' : '할인 유지 · 돌려받지 않음'}</span>
      </div>
      <div className="checkout-row checkout-total">
        <span>결제 수단으로 환불</span>
        <span className="checkout-num">{won(preview.refundAmount)}</span>
      </div>
      {preview.needsSellerApproval && (
        <p className="checkout-hint">이미 출고된 상품이 있어 판매자가 반품을 확인한 뒤 환불됩니다. 출고된 판매자의 배송비는 돌려드리지 않습니다.</p>
      )}
    </div>
  );
}
