-- ADR-0029 PR-3a: inventory Flyway baseline (V1)
--
-- 본 스크립트는 Phase 2a 의 baseline 으로, 현재 Hibernate ddl-auto 가 운영/스테이징 DB 에
-- 이미 만든 테이블과 동일한 형태(컬럼/타입/PK)로 정의한다.
--   - 기존 운영 DB: spring.flyway.baseline-on-migrate=true, baseline-version=1 로
--     본 스크립트는 적용 skip → 기존 데이터 무손실
--   - 신규/로컬 DB: 본 스크립트가 처음 실행되어 동일한 스키마를 그대로 생성
--
-- 후속 PR-4 (ADR-0029 §2 신표준) 에서 processed_event 테이블 스키마를
--   (event_id BINARY(16), consumer_group VARCHAR(64)) 복합 PK 로 swap 한다.
--
-- 컬럼 타입은 Hibernate 6 기본 매핑을 따른다.
--   - Long       -> BIGINT
--   - Int        -> INT
--   - String     -> VARCHAR(255) (length 미지정 시) / VARCHAR(N) (지정 시)
--   - LocalDateTime -> DATETIME(6)

CREATE TABLE IF NOT EXISTS inventory (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    product_id     BIGINT      NOT NULL,
    warehouse_id   BIGINT      NOT NULL,
    available_qty  INT         NOT NULL,
    reserved_qty   INT         NOT NULL,
    version        BIGINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservation (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    order_id      BIGINT       NOT NULL,
    product_id    BIGINT       NOT NULL,
    warehouse_id  BIGINT       NOT NULL,
    qty           INT          NOT NULL,
    status        VARCHAR(20)  NOT NULL,
    expired_at    DATETIME(6)  NOT NULL,
    created_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS outbox_event (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    event_id        VARCHAR(36)  NOT NULL,
    aggregate_type  VARCHAR(50)  NOT NULL,
    aggregate_id    BIGINT       NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    payload         JSON         NOT NULL,
    status          VARCHAR(20)  NOT NULL,
    created_at      DATETIME(6)  NOT NULL,
    published_at    DATETIME(6)  NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ADR-0012 v0 스키마. PR-4 에서 (event_id BINARY(16), consumer_group VARCHAR(64)) 로 swap 예정.
CREATE TABLE IF NOT EXISTS processed_event (
    event_id      VARCHAR(36)  NOT NULL,
    topic         VARCHAR(100) NOT NULL,
    processed_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
