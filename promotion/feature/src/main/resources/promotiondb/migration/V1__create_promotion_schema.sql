-- ADR-0099 — promotion 도메인 스키마(promotion_db). 처음부터 Flyway 로 만든다(baseline 없음).
-- 금액·포인트는 원 단위 BIGINT.

-- 쿠폰 정의. 발행 수는 조건부 UPDATE(issued_count < issue_limit)로만 올린다 — CHECK 는 그 위의 둘째 겹.
CREATE TABLE IF NOT EXISTS coupon_definition (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    name              VARCHAR(100) NOT NULL,
    type              VARCHAR(10)  NOT NULL,
    amount            BIGINT       NULL,
    rate_bp           INT          NULL,
    max_discount      BIGINT       NULL,
    min_order_amount  BIGINT       NOT NULL,
    valid_from        DATETIME(6)  NOT NULL,
    valid_until       DATETIME(6)  NOT NULL,
    issue_limit       INT          NOT NULL,
    issued_count      INT          NOT NULL DEFAULT 0,
    bearer            VARCHAR(10)  NOT NULL,
    seller_id         BIGINT       NULL,
    status            VARCHAR(10)  NOT NULL,
    created_by        VARCHAR(64)  NOT NULL,
    created_at        DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_coupon_issued_within_limit CHECK (issued_count <= issue_limit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 사용자 쿠폰 — 한 회원은 한 정의를 한 번만 받는다(동시 요청도 이 유니크가 막는다).
CREATE TABLE IF NOT EXISTS user_coupon (
    id                    BIGINT      NOT NULL AUTO_INCREMENT,
    member_id             VARCHAR(64) NOT NULL,
    coupon_definition_id  BIGINT      NOT NULL,
    status                VARCHAR(20) NOT NULL,
    reserved_order_id     BIGINT      NULL,
    issued_at             DATETIME(6) NOT NULL,
    updated_at            DATETIME(6) NOT NULL,
    version               BIGINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_coupon_member_definition (member_id, coupon_definition_id),
    KEY idx_user_coupon_definition (coupon_definition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 포인트 잔액 — 회원당 한 행, @Version. 잔액은 0 아래로 내려가지 않는다(도메인 + CHECK).
CREATE TABLE IF NOT EXISTS point_balance (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    member_id   VARCHAR(64) NOT NULL,
    balance     BIGINT      NOT NULL,
    updated_at  DATETIME(6) NOT NULL,
    version     BIGINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_point_balance_member (member_id),
    CONSTRAINT ck_point_balance_non_negative CHECK (balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 포인트 원장 — 추가만 한다. 멱등 키로 같은 변경이 두 번 들어가지 않는다. 원장 합 = 잔액.
CREATE TABLE IF NOT EXISTS point_ledger (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    member_id        VARCHAR(64)  NOT NULL,
    delta            BIGINT       NOT NULL,
    type             VARCHAR(20)  NOT NULL,
    balance_after    BIGINT       NOT NULL,
    order_id         BIGINT       NULL,
    idempotency_key  VARCHAR(120) NOT NULL,
    actor_id         VARCHAR(64)  NULL,
    reason           VARCHAR(500) NULL,
    created_at       DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_point_ledger_idempotency_key (idempotency_key),
    KEY idx_point_ledger_member (member_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 주문별 혜택 보류(TCC). 주문당 한 행 — 판정 실패도 FAILED 행으로 남는다.
CREATE TABLE IF NOT EXISTS promotion_hold (
    id                     BIGINT      NOT NULL AUTO_INCREMENT,
    order_id               BIGINT      NOT NULL,
    member_id              VARCHAR(64) NOT NULL,
    user_coupon_id         BIGINT      NULL,
    coupon_definition_id   BIGINT      NULL,
    coupon_discount        BIGINT      NOT NULL,
    point_amount           BIGINT      NOT NULL,
    status                 VARCHAR(20) NOT NULL,
    failure_reason         VARCHAR(40) NULL,
    expires_at             DATETIME(6) NOT NULL,
    restored_point_amount  BIGINT      NOT NULL DEFAULT 0,
    coupon_returned        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at             DATETIME(6) NOT NULL,
    updated_at             DATETIME(6) NOT NULL,
    version                BIGINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_promotion_hold_order (order_id),
    KEY idx_promotion_hold_expiry (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 클레임 원복 기록 — restore_key(클레임 멱등 키)당 한 번.
CREATE TABLE IF NOT EXISTS promotion_hold_restoration (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    restore_key      VARCHAR(100) NOT NULL,
    order_id         BIGINT       NOT NULL,
    points           BIGINT       NOT NULL,
    coupon_returned  BOOLEAN      NOT NULL,
    created_at       DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_promotion_hold_restoration_key (restore_key),
    KEY idx_promotion_hold_restoration_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 아웃박스 — common OutboxEntity 와 1:1 (릴레이 보강 컬럼 포함, payment_db 와 같은 정의).
CREATE TABLE IF NOT EXISTS outbox_event (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    event_id        VARCHAR(36)  NOT NULL,
    aggregate_type  VARCHAR(50)  NOT NULL,
    aggregate_id    BIGINT       NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    payload         JSON         NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at      DATETIME(6)  NOT NULL,
    published_at    DATETIME(6)  NULL,
    partition_key   VARCHAR(100) NULL,
    headers         JSON         NULL,
    attempts        INT          NOT NULL DEFAULT 0,
    next_attempt_at DATETIME(6)  NULL,
    lease_until     DATETIME(6)  NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_outbox_event_id (event_id),
    KEY idx_outbox_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 멱등 소비 원장 — ADR-0029 §6 표준(복합 PK + BINARY(16)).
CREATE TABLE IF NOT EXISTS processed_event (
    event_id        BINARY(16)   NOT NULL,
    consumer_group  VARCHAR(64)  NOT NULL,
    processed_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (event_id, consumer_group),
    KEY idx_processed_event_processed_at (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
