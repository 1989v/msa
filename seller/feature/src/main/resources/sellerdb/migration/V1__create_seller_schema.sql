-- ADR-0099 — seller 도메인 스키마(seller_db). 처음부터 Flyway 로 만든다(baseline 없음).

-- 판매자 신청·등록. 반려된 신청은 종착이고 재신청은 새 행이다(이력 보존).
-- 계좌번호는 평문 컬럼이 없다: AES-GCM 암호문 + 키 버전 + 마스킹 표시값만 둔다.
-- 반려 후 30일이 지나면 사업자번호·대표자·은행·계좌 컬럼을 NULL 로 지운다(pii_purged_at 기록).
CREATE TABLE IF NOT EXISTS seller (
    id                        BIGINT       NOT NULL AUTO_INCREMENT,
    member_id                 VARCHAR(64)  NOT NULL,
    status                    VARCHAR(20)  NOT NULL,
    business_name             VARCHAR(100) NOT NULL,
    business_registration_no  VARCHAR(20)  NULL,
    representative_name       VARCHAR(50)  NULL,
    bank_name                 VARCHAR(50)  NULL,
    account_number_enc        VARCHAR(255) NULL,
    account_number_masked     VARCHAR(40)  NULL,
    account_key_version       INT          NULL,
    shipping_fee              BIGINT       NOT NULL,
    settlement_cycle          VARCHAR(20)  NOT NULL,
    commission_rate_bp        INT          NULL,
    reject_reason             VARCHAR(500) NULL,
    rejected_at               DATETIME(6)  NULL,
    pii_purged_at             DATETIME(6)  NULL,
    applied_at                DATETIME(6)  NOT NULL,
    updated_at                DATETIME(6)  NOT NULL,
    version                   BIGINT       NOT NULL DEFAULT 0,
    -- 1인 1판매자: 열린 상태(PENDING·ACTIVE·SUSPENDED)일 때만 member_id, 아니면 NULL.
    -- 유니크 인덱스는 NULL 을 여럿 허용하므로 반려 이력은 몇 건이든 남는다.
    -- 상태 이름을 바꾸면 이 식도 다음 번호 마이그레이션으로 고쳐야 한다(SellerStatus.occupiesMember 와 같은 집합).
    open_member_id            VARCHAR(64)  GENERATED ALWAYS AS (
        CASE WHEN status IN ('PENDING', 'ACTIVE', 'SUSPENDED') THEN member_id ELSE NULL END
    ) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uk_seller_open_member (open_member_id),
    KEY idx_seller_member (member_id),
    KEY idx_seller_status_rejected (status, rejected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 어드민 조치 이력 — 상태·수수료율 변경마다 행위자·사유·시각. 추가만 한다.
CREATE TABLE IF NOT EXISTS seller_admin_action (
    id                  BIGINT       NOT NULL AUTO_INCREMENT,
    seller_id           BIGINT       NOT NULL,
    action              VARCHAR(30)  NOT NULL,
    actor_id            VARCHAR(64)  NOT NULL,
    reason              VARCHAR(500) NULL,
    from_status         VARCHAR(20)  NOT NULL,
    to_status           VARCHAR(20)  NOT NULL,
    commission_rate_bp  INT          NULL,
    created_at          DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    KEY idx_seller_admin_action_seller (seller_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 아웃박스 — common OutboxEntity 와 1:1 (릴레이 보강 컬럼 포함, product_db 와 같은 정의).
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

-- 플랫폼 기본 판매자 — 기존 상품을 이 판매자로 백필한다(product.seller_id = 1). 수수료 0, 정산 계좌 없음.
INSERT INTO seller (id, member_id, status, business_name, shipping_fee, settlement_cycle, commission_rate_bp,
                    applied_at, updated_at)
VALUES (1, 'platform', 'ACTIVE', '플랫폼 기본 판매자', 0, 'MONTHLY', 0, NOW(6), NOW(6));
