-- 클레임 · 구매 확정 (스펙 SR-2 · SR-8). 확장만 한다: 기존 테이블의 새 컬럼은 전부 NULL 허용.

-- 주문 라인 진행 표시 — 출고·배송 완료(fulfillment.order.shipped/delivered)와 구매 확정 시각. 자동 구매 확정이 배송 완료 시각을 본다
ALTER TABLE order_items
    ADD COLUMN shipped_at             DATETIME(6)  NULL,
    ADD COLUMN delivered_at           DATETIME(6)  NULL,
    ADD COLUMN purchase_confirmed_at  DATETIME(6)  NULL;
CREATE INDEX idx_order_items_auto_confirm ON order_items (status, delivered_at);

-- 판매자 읽기 모델의 회원 id — 판매자 포털 클레임 API 가 X-User-Id 로 ACTIVE 판매자 행을 찾는다.
-- 기존 행은 다음 seller.seller.* 이벤트가 채운다. 플랫폼 기본 판매자는 seller_db 시드와 같은 값.
ALTER TABLE seller_view ADD COLUMN member_id VARCHAR(64) NULL;
CREATE INDEX idx_seller_view_member_status ON seller_view (member_id, status);
UPDATE seller_view SET member_id = 'platform' WHERE seller_id = 1 AND member_id IS NULL;

-- 클레임 — 주문 한 건 · 판매자 한 명의 라인 묶음. 금액 컬럼은 승인 뒤 환불 단계에 들어갈 때 채운다
CREATE TABLE IF NOT EXISTS order_claim (
    id                 BIGINT        NOT NULL AUTO_INCREMENT,
    order_id           BIGINT        NOT NULL,
    user_id            VARCHAR(100)  NOT NULL,
    seller_id          BIGINT        NOT NULL,
    line_nos           VARCHAR(500)  NOT NULL,
    status             VARCHAR(20)   NOT NULL,
    step               VARCHAR(30)   NOT NULL,
    goods_shipped      BOOLEAN       NOT NULL,
    refund_amount      BIGINT        NULL,
    point_restore      BIGINT        NULL,
    shipping_refund    BIGINT        NULL,
    full_cancel        BOOLEAN       NULL,
    restore_promotion  BOOLEAN       NULL,
    reject_reason      VARCHAR(500)  NULL,
    decided_by         VARCHAR(150)  NULL,
    attempts           INT           NOT NULL,
    next_deadline_at   DATETIME(6)   NULL,
    stuck              BOOLEAN       NOT NULL,
    requested_at       DATETIME(6)   NOT NULL,
    updated_at         DATETIME(6)   NOT NULL,
    version            BIGINT        NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_order_claim_order (order_id, id),
    KEY idx_order_claim_seller (seller_id, id),
    KEY idx_order_claim_due (next_deadline_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
