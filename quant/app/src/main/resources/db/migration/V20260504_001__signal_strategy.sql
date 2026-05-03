-- ADR-0033 Phase 1 — SignalStrategy 신규 테이블.
-- 기존 split_strategy / strategy_run 등은 그대로 유지 (TrancheStrategy 와 별도 테이블).
-- 단일 strategy 테이블 통합은 Phase 2 마이그레이션 ADR 에서 검토.

CREATE TABLE signal_strategy (
    strategy_id BINARY(16) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    asset_code VARCHAR(32) NOT NULL,
    asset_class VARCHAR(16) NOT NULL,
    market_code VARCHAR(32) NOT NULL,
    entry_signal_json JSON NOT NULL,
    exit_signal_json JSON NULL,
    sizing_json JSON NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (strategy_id),
    KEY idx_signal_strategy_tenant (tenant_id, created_at),
    KEY idx_signal_strategy_asset (tenant_id, asset_code, market_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE signal_strategy_run (
    run_id BINARY(16) NOT NULL,
    strategy_id BINARY(16) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    period_start DATETIME(6) NOT NULL,
    period_end DATETIME(6) NOT NULL,
    status VARCHAR(16) NOT NULL,                  -- RUNNING / COMPLETED / FAILED
    summary_json JSON NULL,                       -- realized_pnl, fill_count, ...
    started_at DATETIME(6) NOT NULL,
    ended_at DATETIME(6) NULL,
    PRIMARY KEY (run_id),
    KEY idx_signal_run_tenant_strategy (tenant_id, strategy_id, started_at),
    KEY idx_signal_run_period (tenant_id, period_start, period_end),
    CONSTRAINT fk_signal_run_strategy
        FOREIGN KEY (strategy_id) REFERENCES signal_strategy(strategy_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
