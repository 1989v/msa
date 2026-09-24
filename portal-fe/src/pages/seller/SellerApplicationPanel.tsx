import { Link } from 'react-router-dom';
import type { SellerApplication, SellerStatus } from '../../api/shopApi';
import { formatWon } from '../shopFormat';
import SellerStatusBadge from './SellerStatusBadge';
import { SETTLEMENT_CYCLE_LABEL } from './sellerForm';

const GUIDE: Record<SellerStatus, string> = {
  PENDING: '신청을 심사하고 있습니다. 승인되면 판매자 메뉴에서 상품을 등록할 수 있습니다.',
  ACTIVE: '승인된 판매자입니다.',
  SUSPENDED: '판매가 정지되었습니다. 상품은 판매가 멈추고, 진행 중인 주문은 끝까지 이행·정산합니다.',
  REJECTED: '입점 신청이 반려되었습니다. 사유를 확인하고 다시 신청할 수 있습니다.',
};

/** 내 입점 신청 한 건 — 네 상태를 인장과 안내문으로, 반려·정지면 사유까지 보여 준다 */
export default function SellerApplicationPanel({
  application,
  showActions = true,
}: {
  application: SellerApplication;
  /** 폼 위에 사유만 보일 때는 행동 버튼을 숨긴다 */
  showActions?: boolean;
}) {
  const { status } = application;
  const reason =
    status === 'REJECTED' ? application.rejectReason : status === 'SUSPENDED' ? application.suspendReason : null;

  return (
    <section className="seller-panel" aria-live="polite" data-seller-status={status}>
      <div className="seller-panel-head">
        <span className="seller-panel-title">{application.businessName}</span>
        <SellerStatusBadge status={status} />
      </div>
      <p className="seller-lead">{GUIDE[status]}</p>
      {reason && (
        <div className="seller-reason">
          <span className="seller-reason-label">{status === 'REJECTED' ? '반려 사유' : '정지 사유'}</span>
          <p>{reason}</p>
        </div>
      )}
      {status !== 'REJECTED' && (
        <dl className="seller-summary">
          <div>
            <dt>정산 계좌</dt>
            <dd className="seller-num">
              {application.bankName ?? '—'} {application.accountMasked ?? ''}
            </dd>
          </div>
          <div>
            <dt>배송비</dt>
            <dd className="seller-num">{formatWon(application.shippingFee)}</dd>
          </div>
          <div>
            <dt>{application.commissionRateBp == null ? '정산 주기' : '수수료율'}</dt>
            <dd className="seller-num">
              {application.commissionRateBp == null
                ? SETTLEMENT_CYCLE_LABEL[application.settlementCycle]
                : `${(application.commissionRateBp / 100).toFixed(2)}%`}
            </dd>
          </div>
        </dl>
      )}
      {showActions && status === 'ACTIVE' && (
        <div>
          <Link to="/shop/seller/products" className="kh-button">
            내 상품 관리
          </Link>
        </div>
      )}
      {showActions && status === 'REJECTED' && (
        <div>
          <Link to="/shop/seller/apply" className="kh-button">
            다시 신청하기
          </Link>
        </div>
      )}
    </section>
  );
}
