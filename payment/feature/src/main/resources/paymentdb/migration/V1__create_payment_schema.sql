-- ADR-0099 — payment 도메인 스키마(payment_db). 처음부터 Flyway 로 만든다(baseline 없음).
-- 카드번호·CVC 컬럼은 없다 — 카드 정보는 PG 결제창에서만 오간다(PCI-DSS 범위 밖).

-- 결제 한 건 = 가맹점 주문번호(order_no) 하나. 같은 주문번호로 PG 승인을 두 번 만들지 않는다.
CREATE TABLE IF NOT EXISTS payment (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    order_id          BIGINT       NOT NULL,
    order_no          VARCHAR(64)  NOT NULL,
    amount            BIGINT       NOT NULL,
    payment_key       VARCHAR(200) NULL,
    status            VARCHAR(20)  NOT NULL,
    captured_amount   BIGINT       NOT NULL DEFAULT 0,
    refunded_amount   BIGINT       NOT NULL DEFAULT 0,
    -- 결과 미상 중 들어온 VOID 명령 — AUTHORIZED 로 결론 나면 그때 취소한다
    void_requested_at DATETIME(6)  NULL,
    failure_reason    VARCHAR(500) NULL,
    inquiry_attempts  INT          NOT NULL DEFAULT 0,
    next_inquiry_at   DATETIME(6)  NULL,
    authorized_at     DATETIME(6)  NULL,
    captured_at       DATETIME(6)  NULL,
    created_at        DATETIME(6)  NOT NULL,
    updated_at        DATETIME(6)  NOT NULL,
    version           BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_payment_order_no (order_no),
    KEY idx_payment_order (order_id),
    KEY idx_payment_inquiry (status, next_inquiry_at),
    KEY idx_payment_captured_at (captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 환불 — refund_key 가 멱등 키. 추가만 한다.
CREATE TABLE IF NOT EXISTS payment_refund (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    payment_id  BIGINT       NOT NULL,
    refund_key  VARCHAR(100) NOT NULL,
    amount      BIGINT       NOT NULL,
    reason      VARCHAR(500) NULL,
    created_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_payment_refund_key (refund_key),
    KEY idx_payment_refund_payment (payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PG 대사 판정 — (정산일, 주문번호)는 한 번만. 운영자 재시도는 행을 지워 다시 보게 한다.
CREATE TABLE IF NOT EXISTS payment_reconciliation (
    id            BIGINT      NOT NULL AUTO_INCREMENT,
    settle_date   DATE        NOT NULL,
    order_no      VARCHAR(64) NOT NULL,
    result        VARCHAR(20) NOT NULL,
    gross_amount  BIGINT      NULL,
    pg_fee        BIGINT      NULL,
    created_at    DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_payment_reconciliation (settle_date, order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 운영 이슈 — 사람이 봐야 하는 건(재조회 소진 · 대사 불일치). 상태 OPEN → RETRIED → CLOSED.
CREATE TABLE IF NOT EXISTS ops_issue (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    type           VARCHAR(30)   NOT NULL,
    target_id      VARCHAR(100)  NOT NULL,
    detail         VARCHAR(1000) NOT NULL,
    business_date  DATE          NULL,
    status         VARCHAR(20)   NOT NULL,
    actor_id       VARCHAR(64)   NULL,
    reason         VARCHAR(500)  NULL,
    created_at     DATETIME(6)   NOT NULL,
    updated_at     DATETIME(6)   NOT NULL,
    PRIMARY KEY (id),
    KEY idx_ops_issue_status (status, id),
    KEY idx_ops_issue_target (type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 모의 PG 의 거래 원장 — 실제 PG 라면 PG 사가 갖는 기록. 재조회·정산 파일이 읽는다.
-- 파드 재시작 뒤에도 대사가 어긋나지 않도록 메모리가 아니라 여기 둔다. 토스로 바꾸면 쓰이지 않는다.
CREATE TABLE IF NOT EXISTS mock_pg_transaction (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    order_no         VARCHAR(64)  NOT NULL,
    payment_key      VARCHAR(200) NOT NULL,
    amount           BIGINT       NOT NULL,
    status           VARCHAR(20)  NOT NULL,
    captured_amount  BIGINT       NOT NULL DEFAULT 0,
    refunded_amount  BIGINT       NOT NULL DEFAULT 0,
    captured_at      DATETIME(6)  NULL,
    created_at       DATETIME(6)  NOT NULL,
    updated_at       DATETIME(6)  NOT NULL,
    version          BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_mock_pg_order_no (order_no),
    UNIQUE KEY uk_mock_pg_payment_key (payment_key),
    KEY idx_mock_pg_captured (status, captured_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 아웃박스 — common OutboxEntity 와 1:1 (릴레이 보강 컬럼 포함, seller_db 와 같은 정의).
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
