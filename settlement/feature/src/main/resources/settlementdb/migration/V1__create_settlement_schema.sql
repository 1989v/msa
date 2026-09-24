-- ADR-0099 — settlement 도메인 스키마(settlement_db). 처음부터 Flyway 로 만든다(baseline 없음).
-- 상태·계정·구분 컬럼은 전부 VARCHAR — MySQL ENUM 은 값이 늘면 운영에서만 INSERT 가 잘린다.

-- 원장 거래. 원천 키(주문·클레임·대사 건·정산서)당 한 건 — 수정·삭제하지 않고, 정정은 역분개 거래(reversal_of)로만 한다.
CREATE TABLE IF NOT EXISTS ledger_journal (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    type             VARCHAR(20)  NOT NULL,
    source_key       VARCHAR(120) NOT NULL,
    source_event_id  VARCHAR(36)  NULL,
    order_id         BIGINT       NULL,
    reversal_of      BIGINT       NULL,
    occurred_at      DATETIME(6)  NOT NULL,
    created_at       DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_ledger_journal_source (source_key),
    KEY idx_ledger_journal_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 분개 줄. 금액은 양수만, 차·대는 side 로. 판매자 미지급금만 seller_id 를 갖는다.
CREATE TABLE IF NOT EXISTS ledger_entry (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    journal_id  BIGINT      NOT NULL,
    account     VARCHAR(30) NOT NULL,
    side        VARCHAR(10) NOT NULL,
    amount      BIGINT      NOT NULL,
    seller_id   BIGINT      NULL,
    PRIMARY KEY (id),
    KEY idx_ledger_entry_journal (journal_id),
    KEY idx_ledger_entry_account_seller (account, seller_id),
    CONSTRAINT ck_ledger_entry_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- seller.seller.* 읽기 모델 — 정산 주기와 판매자 포털 본인 확인. 계좌는 없다.
CREATE TABLE IF NOT EXISTS settlement_seller (
    seller_id         BIGINT      NOT NULL,
    member_id         VARCHAR(64) NOT NULL,
    status            VARCHAR(20) NOT NULL,
    settlement_cycle  VARCHAR(20) NOT NULL,
    occurred_at       DATETIME(6) NOT NULL,
    PRIMARY KEY (seller_id),
    KEY idx_settlement_seller_member (member_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 플랫폼 기본 판매자는 seller_db V1 시드라 이벤트가 없다 — 여기서도 시드한다(월간).
-- occurred_at 을 과거로 둬 이후 실제 이벤트가 오면 그것이 이긴다.
INSERT INTO settlement_seller (seller_id, member_id, status, settlement_cycle, occurred_at)
VALUES (1, 'platform', 'ACTIVE', 'MONTHLY', '2000-01-01 00:00:00.000000');

-- 정산 대상 — 구매 확정 라인(LINE)과 판매자 배송비(SHIPPING). statement_id 가 비어 있으면 아직 정산 전.
CREATE TABLE IF NOT EXISTS settlement_item (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    item_key       VARCHAR(80) NOT NULL,
    kind           VARCHAR(10) NOT NULL,
    order_id       BIGINT      NOT NULL,
    order_item_id  BIGINT      NULL,
    seller_id      BIGINT      NOT NULL,
    net_sales      BIGINT      NOT NULL,
    commission     BIGINT      NOT NULL,
    shipping_fee   BIGINT      NOT NULL,
    confirmed_at   DATETIME(6) NOT NULL,
    statement_id   BIGINT      NULL,
    created_at     DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_settlement_item_key (item_key),
    KEY idx_settlement_item_pending (seller_id, statement_id, confirmed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 환불된 라인·배송비 키(order.claim.refunded) — 정산서가 거른다. 토픽이 달라 확정 이벤트와 도착 순서가 어긋나도 이중 차감이 없게.
CREATE TABLE IF NOT EXISTS settlement_refunded_item (
    item_key     VARCHAR(80) NOT NULL,
    claim_id     BIGINT      NOT NULL,
    refunded_at  DATETIME(6) NOT NULL,
    PRIMARY KEY (item_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 정산서. (판매자, 기간 시작)당 하나. 지급액 = 순매출 + 배송비 − 수수료.
CREATE TABLE IF NOT EXISTS settlement_statement (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    seller_id         BIGINT       NOT NULL,
    period_start      DATE         NOT NULL,
    period_end        DATE         NOT NULL,
    status            VARCHAR(20)  NOT NULL,
    net_sales         BIGINT       NOT NULL,
    shipping_fee      BIGINT       NOT NULL,
    commission        BIGINT       NOT NULL,
    payout            BIGINT       NOT NULL,
    payout_reference  VARCHAR(100) NULL,
    created_at        DATETIME(6)  NOT NULL,
    confirmed_at      DATETIME(6)  NULL,
    paid_at           DATETIME(6)  NULL,
    carried_over_at   DATETIME(6)  NULL,
    updated_at        DATETIME(6)  NOT NULL,
    version           BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_settlement_statement_period (seller_id, period_start),
    KEY idx_settlement_statement_status (status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 정산서에 들어간 항목의 사본(감사용). 이월된 정산서의 줄도 남는다.
CREATE TABLE IF NOT EXISTS settlement_statement_line (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    statement_id   BIGINT      NOT NULL,
    item_key       VARCHAR(80) NOT NULL,
    kind           VARCHAR(10) NOT NULL,
    order_id       BIGINT      NOT NULL,
    order_item_id  BIGINT      NULL,
    net_sales      BIGINT      NOT NULL,
    commission     BIGINT      NOT NULL,
    shipping_fee   BIGINT      NOT NULL,
    confirmed_at   DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_settlement_statement_line_statement (statement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 멱등 소비 원장 — ADR-0029 §6 표준(복합 PK + BINARY(16)).
CREATE TABLE IF NOT EXISTS processed_event (
    event_id        BINARY(16)   NOT NULL,
    consumer_group  VARCHAR(64)  NOT NULL,
    processed_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (event_id, consumer_group),
    KEY idx_processed_event_processed_at (processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
