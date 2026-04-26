-- TG-P2-08: paper_account — 페이퍼 트레이딩 가상 잔고 테이블.
-- INV-P2-09: PaperAccount 잔고는 ExchangeCredential 의 실거래소 잔고와 분리되어야 한다.
-- (tenant_id, strategy_id, base_asset) 조합당 1개의 가상 계좌. 기본 base_asset = KRW.
-- balance precision (28,8) — KRW 28자리 정수부 + 8자리 소수.

CREATE TABLE paper_account (
    paper_account_id BIGINT NOT NULL AUTO_INCREMENT,
    tenant_id VARCHAR(64) NOT NULL,
    strategy_id BINARY(16) NOT NULL,
    base_asset VARCHAR(16) NOT NULL DEFAULT 'KRW',
    balance DECIMAL(28,8) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (paper_account_id),
    KEY idx_paper_account_tenant (tenant_id, strategy_id),
    UNIQUE KEY uk_paper_account_strategy (tenant_id, strategy_id, base_asset)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
