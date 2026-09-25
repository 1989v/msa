-- 주문·라인 스냅샷을 필수로 바꾸고 옛 DECIMAL 단가를 지운다.
-- 사가 이전 주문은 운영에 없다(2026-09-26 확인) — 모든 주문은 주문서에서 만들어져 이 값들을 갖는다.
ALTER TABLE order_items
    DROP COLUMN unit_price,
    MODIFY COLUMN line_no            INT          NOT NULL,
    MODIFY COLUMN product_name       VARCHAR(255) NOT NULL,
    MODIFY COLUMN seller_id          BIGINT       NOT NULL,
    MODIFY COLUMN coupon_discount    BIGINT       NOT NULL,
    MODIFY COLUMN point_amount       BIGINT       NOT NULL,
    MODIFY COLUMN commission_rate_bp INT          NOT NULL;

ALTER TABLE orders
    MODIFY COLUMN order_sheet_id  BIGINT NOT NULL,
    MODIFY COLUMN items_amount    BIGINT NOT NULL,
    MODIFY COLUMN coupon_discount BIGINT NOT NULL,
    MODIFY COLUMN point_amount    BIGINT NOT NULL,
    MODIFY COLUMN shipping_amount BIGINT NOT NULL,
    MODIFY COLUMN payable_amount  BIGINT NOT NULL;
