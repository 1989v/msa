-- ADR-0037 Phase 3 (실매매) 도메인 테이블.
-- 본 마이그레이션은 H5 (TG-P3-04 ~ TG-P3-08) 가 도입하는 6 테이블을 단일 파일로 묶었다.
-- (ADR-0037 spec.md §8.1 참조)
--
-- 주의: 이 마이그레이션은 ADR-0037 Accepted 전이라도 적용 가능하지만, 실제 데이터 입력은
-- Phase 3 코드(UseCase) 가 wire-up 된 시점부터다. 빈 테이블 상태 유지가 정상.

CREATE TABLE IF NOT EXISTS live_trading_state (
    tenant_id        BINARY(16) PRIMARY KEY,
    mode             VARCHAR(16) NOT NULL,
    activated_at     DATETIME(6),
    activated_by     BIGINT,
    suspend_reason   VARCHAR(32),
    suspended_at     DATETIME(6),
    two_fa_token_hash CHAR(64),
    updated_at       DATETIME(6) NOT NULL,
    INDEX idx_mode (mode)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS risk_limit (
    tenant_id              BINARY(16) PRIMARY KEY,
    daily_loss_limit_krw   DECIMAL(20,2) NOT NULL,
    daily_volume_limit_krw DECIMAL(20,2) NOT NULL,
    single_order_max_krw   DECIMAL(20,2) NOT NULL,
    updated_at             DATETIME(6) NOT NULL,
    updated_by             BIGINT NOT NULL
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS kill_switch_log (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    scope        VARCHAR(16) NOT NULL,
    target_id    BINARY(16),
    enabled      BOOLEAN NOT NULL,
    reason       VARCHAR(255),
    actor_id     BIGINT NOT NULL,
    occurred_at  DATETIME(6) NOT NULL,
    INDEX idx_scope_target (scope, target_id),
    INDEX idx_occurred_at (occurred_at)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS two_fa_secret (
    user_id           BIGINT PRIMARY KEY,
    encrypted_secret  VARBINARY(255) NOT NULL,
    encrypted_dek     VARBINARY(255) NOT NULL,
    backup_codes_hash JSON NOT NULL,
    registered_at     DATETIME(6) NOT NULL,
    last_verified_at  DATETIME(6)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS audit_event (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id     BINARY(16) NOT NULL,
    event_type    VARCHAR(32) NOT NULL,
    payload_json  LONGTEXT NOT NULL,
    occurred_at   DATETIME(6) NOT NULL,
    prev_hash     CHAR(64),
    current_hash  CHAR(64) NOT NULL,
    INDEX idx_tenant_time (tenant_id, occurred_at),
    UNIQUE KEY uq_current_hash (current_hash)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;

CREATE TABLE IF NOT EXISTS live_order_record (
    id                 BINARY(16) PRIMARY KEY,
    tenant_id          BINARY(16) NOT NULL,
    strategy_id        BINARY(16) NOT NULL,
    market_code        VARCHAR(16) NOT NULL,
    asset_code         VARCHAR(32) NOT NULL,
    side               VARCHAR(8) NOT NULL,
    type               VARCHAR(16) NOT NULL,
    price_krw          DECIMAL(28,8),
    quantity           DECIMAL(28,8) NOT NULL,
    status             VARCHAR(16) NOT NULL,
    exchange_order_id  VARCHAR(128),
    placed_at          DATETIME(6) NOT NULL,
    filled_at          DATETIME(6),
    cancelled_at       DATETIME(6),
    audit_hash_prev    CHAR(64),
    audit_hash_current CHAR(64) NOT NULL,
    INDEX idx_tenant_strategy_status (tenant_id, strategy_id, status),
    INDEX idx_status_placed_at (status, placed_at),
    UNIQUE KEY uq_audit_hash (audit_hash_current)
) ENGINE=InnoDB ROW_FORMAT=DYNAMIC;
