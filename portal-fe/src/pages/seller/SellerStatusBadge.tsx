import type { SellerStatus } from '../../api/shopApi';
import { SELLER_STATUS_LABEL } from './sellerForm';

/** 판매자 상태 인장 — 네 상태가 색만이 아니라 낱말로도 갈린다 */
export default function SellerStatusBadge({ status }: { status: SellerStatus }) {
  return (
    <span className={`shop-badge seller-badge seller-badge--${status.toLowerCase()}`}>
      {SELLER_STATUS_LABEL[status]}
    </span>
  );
}
