-- 사가 오케스트레이션 (스펙 SR-2 · SR-4 · SR-13). 확장만 한다: 기존 테이블의 새 컬럼은 NULL 허용이거나 기본값이 있다.
-- 상태값 전환(COMPLETED → CONFIRMED, PENDING → FAILED)은 컬럼이 VARCHAR 라 값 갱신만 한다.

-- 주문: 주문서 스냅샷 합계 · 실패 사유 · 환불 누계 · 낙관락
ALTER TABLE orders
    ADD COLUMN order_sheet_id   BIGINT       NULL,
    ADD COLUMN user_coupon_id   BIGINT       NULL,
    ADD COLUMN items_amount     BIGINT       NULL,
    ADD COLUMN coupon_discount  BIGINT       NULL,
    ADD COLUMN point_amount     BIGINT       NULL,
    ADD COLUMN shipping_amount  BIGINT       NULL,
    ADD COLUMN payable_amount   BIGINT       NULL,
    ADD COLUMN failure_reason   VARCHAR(40)  NULL,
    ADD COLUMN refunded_amount  BIGINT       NOT NULL DEFAULT 0,
    ADD COLUMN version          BIGINT       NOT NULL DEFAULT 0,
    ADD COLUMN updated_at       DATETIME(6)  NULL;

-- 주문서 1개 = 주문 1개. 새 컬럼이라 기존 행은 전부 NULL 이고(중복 조회: 0건) MySQL 유니크는 NULL 을 여럿 허용한다.
ALTER TABLE orders ADD UNIQUE KEY uk_orders_order_sheet (order_sheet_id);
CREATE INDEX idx_orders_user_status ON orders (user_id, status);

-- 주문 라인: 주문서 라인 스냅샷 + 라인 상태
ALTER TABLE order_items
    ADD COLUMN line_no             INT          NULL,
    ADD COLUMN product_name        VARCHAR(255) NULL,
    ADD COLUMN seller_id           BIGINT       NULL,
    ADD COLUMN coupon_discount     BIGINT       NULL,
    ADD COLUMN coupon_bearer       VARCHAR(10)  NULL,
    ADD COLUMN point_amount        BIGINT       NULL,
    ADD COLUMN commission_rate_bp  INT          NULL,
    ADD COLUMN status              VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE';

-- 판매자별 배송비 라인
CREATE TABLE IF NOT EXISTS order_shipping (
    id         BIGINT  NOT NULL AUTO_INCREMENT,
    order_id   BIGINT  NOT NULL,
    seller_id  BIGINT  NOT NULL,
    fee        BIGINT  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_order_shipping_seller (order_id, seller_id),
    CONSTRAINT fk_order_shipping_order FOREIGN KEY (order_id) REFERENCES orders (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 주문 상태 이력 — 추가만. from_status 는 옛 값(PENDING 등)도 담는다
CREATE TABLE IF NOT EXISTS order_status_history (
    id           BIGINT        NOT NULL AUTO_INCREMENT,
    order_id     BIGINT        NOT NULL,
    from_status  VARCHAR(20)   NULL,
    to_status    VARCHAR(20)   NOT NULL,
    reason       VARCHAR(100)  NULL,
    actor        VARCHAR(100)  NOT NULL,
    occurred_at  DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    KEY idx_order_status_history_order (order_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 상태값 전환 (SR-13) — 이력을 먼저 남기고 값을 바꾼다
INSERT INTO order_status_history (order_id, from_status, to_status, reason, actor, occurred_at)
SELECT id, 'COMPLETED', 'CONFIRMED', 'LEGACY_STATUS_RENAMED', 'MIGRATION', NOW(6) FROM orders WHERE status = 'COMPLETED';
UPDATE orders SET status = 'CONFIRMED' WHERE status = 'COMPLETED';

INSERT INTO order_status_history (order_id, from_status, to_status, reason, actor, occurred_at)
SELECT id, 'PENDING', 'FAILED', 'LEGACY_ABANDONED', 'MIGRATION', NOW(6) FROM orders WHERE status = 'PENDING';
UPDATE orders SET status = 'FAILED', failure_reason = 'LEGACY_ABANDONED' WHERE status = 'PENDING';

-- 사가 진행 — 주문당 한 행
CREATE TABLE IF NOT EXISTS order_saga (
    order_id               BIGINT        NOT NULL,
    order_no               VARCHAR(64)   NOT NULL,
    payment_required       BOOLEAN       NOT NULL,
    status                 VARCHAR(20)   NOT NULL,
    step                   VARCHAR(30)   NOT NULL,
    attempts               INT           NOT NULL,
    next_deadline_at       DATETIME(6)   NOT NULL,
    started_at             DATETIME(6)   NOT NULL,
    pre_pivot_deadline_at  DATETIME(6)   NOT NULL,
    pending_void           BOOLEAN       NOT NULL,
    holds_expired          BOOLEAN       NOT NULL,
    payment_unknown        BOOLEAN       NOT NULL,
    inventory_confirmed    BOOLEAN       NOT NULL,
    promotion_confirmed    BOOLEAN       NOT NULL,
    cancel_requested       BOOLEAN       NOT NULL,
    compensation_plan      VARCHAR(200)  NULL,
    failure_reason         VARCHAR(40)   NULL,
    reserved_lines         JSON          NULL,
    updated_at             DATETIME(6)   NOT NULL,
    version                BIGINT        NOT NULL DEFAULT 0,
    PRIMARY KEY (order_id),
    UNIQUE KEY uk_order_saga_order_no (order_no),
    KEY idx_order_saga_due (status, next_deadline_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 주문 접수 Idempotency-Key — (사용자, 키) 유니크, PROCESSING 리스 60초, 24시간 보관
CREATE TABLE IF NOT EXISTS idempotency_key (
    id           BIGINT         NOT NULL AUTO_INCREMENT,
    user_id      VARCHAR(100)   NOT NULL,
    idem_key     VARCHAR(100)   NOT NULL,
    status       VARCHAR(20)    NOT NULL,
    lease_until  DATETIME(6)    NOT NULL,
    response     VARCHAR(2000)  NULL,
    created_at   DATETIME(6)    NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_idempotency_key_user_key (user_id, idem_key),
    KEY idx_idempotency_key_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 운영 이슈 — payment 의 ops_issue 와 같은 모양
CREATE TABLE IF NOT EXISTS ops_issue (
    id          BIGINT         NOT NULL AUTO_INCREMENT,
    type        VARCHAR(30)    NOT NULL,
    target_id   VARCHAR(100)   NOT NULL,
    detail      VARCHAR(1000)  NOT NULL,
    status      VARCHAR(20)    NOT NULL,
    actor_id    VARCHAR(64)    NULL,
    reason      VARCHAR(500)   NULL,
    created_at  DATETIME(6)    NOT NULL,
    updated_at  DATETIME(6)    NOT NULL,
    PRIMARY KEY (id),
    KEY idx_ops_issue_status (status, id),
    KEY idx_ops_issue_target (type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
