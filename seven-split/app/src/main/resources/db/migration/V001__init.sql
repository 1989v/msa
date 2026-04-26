-- TG-08.1: seven_split MySQL schema V001
-- 모든 테이블에 tenant_id VARCHAR(64) NOT NULL + 인덱스(tenant_id, ...) 포함 (INV-05).
-- Phase 1 MVP 는 split_strategy / strategy_run / round_slot / order / outbox 5개를 사용한다.
-- 나머지 테이블(exchange_credential, notification_target, processed_event, audit_log)은
-- Phase 2/3 에서 Entity/Adapter 가 추가될 때까지 스키마만 사전 마련한다.

CREATE TABLE split_strategy (
    strategy_id BINARY(16) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    target_symbol VARCHAR(32) NOT NULL,
    round_count INT NOT NULL,
    entry_gap_percent DECIMAL(18,8) NOT NULL,
    take_profit_per_round TEXT NOT NULL,
    initial_order_amount DECIMAL(38,8) NOT NULL,
    execution_mode VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (strategy_id),
    KEY idx_strategy_tenant (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE strategy_run (
    run_id BINARY(16) NOT NULL,
    strategy_id BINARY(16) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    execution_mode VARCHAR(16) NOT NULL,
    seed BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL,
    end_reason VARCHAR(32) NULL,
    started_at DATETIME(6) NOT NULL,
    ended_at DATETIME(6) NULL,
    PRIMARY KEY (run_id),
    KEY idx_run_tenant (tenant_id, started_at),
    KEY idx_run_strategy (strategy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE round_slot (
    slot_id BINARY(16) NOT NULL,
    run_id BINARY(16) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    round_index INT NOT NULL,
    state VARCHAR(32) NOT NULL,
    entry_price DECIMAL(38,8) NULL,
    target_qty DECIMAL(38,8) NOT NULL,
    filled_qty DECIMAL(38,8) NOT NULL,
    take_profit_percent DECIMAL(18,8) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (slot_id),
    KEY idx_slot_run (run_id, round_index),
    KEY idx_slot_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `order` (
    order_id BINARY(16) NOT NULL,
    slot_id BINARY(16) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    side VARCHAR(8) NOT NULL,
    type_name VARCHAR(16) NOT NULL,
    quantity DECIMAL(38,8) NOT NULL,
    price DECIMAL(38,8) NULL,
    status VARCHAR(32) NOT NULL,
    exchange_order_id VARCHAR(128) NULL,
    filled_quantity DECIMAL(38,8) NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (order_id),
    KEY idx_order_tenant (tenant_id, created_at),
    KEY idx_order_slot (slot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE exchange_credential (
    credential_id BINARY(16) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    exchange VARCHAR(32) NOT NULL,
    api_key_cipher VARBINARY(1024) NOT NULL,
    api_secret_cipher VARBINARY(1024) NOT NULL,
    passphrase_cipher VARBINARY(1024) NULL,
    ip_whitelist TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (credential_id),
    UNIQUE KEY uq_cred_tenant_exchange (tenant_id, exchange)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notification_target (
    target_id BINARY(16) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    channel VARCHAR(32) NOT NULL,
    bot_token_cipher VARBINARY(1024) NOT NULL,
    chat_id VARCHAR(128) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (target_id),
    KEY idx_notif_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE outbox (
    id BIGINT AUTO_INCREMENT NOT NULL,
    event_id BINARY(16) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    payload JSON NOT NULL,
    occurred_at DATETIME(6) NOT NULL,
    published_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_outbox_event (event_id),
    KEY idx_outbox_unpublished (published_at, occurred_at),
    KEY idx_outbox_tenant (tenant_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE processed_event (
    event_id BINARY(16) NOT NULL,
    consumer_group VARCHAR(64) NOT NULL,
    processed_at DATETIME(6) NOT NULL,
    PRIMARY KEY (event_id, consumer_group)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_log (
    id BIGINT AUTO_INCREMENT NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    action VARCHAR(64) NOT NULL,
    target VARCHAR(128) NOT NULL,
    detail JSON NOT NULL,
    at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_audit_tenant_time (tenant_id, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
