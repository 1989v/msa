-- ADR-0033 / ADR-0034 Phase 1.5 — 자산 카탈로그 DB 화 (MySQL).
-- ingest scheduler 의 DEFAULT_TARGETS 하드코딩을 메인 DB 로 이전.
-- 운영 중 어드민이 신규 종목 추가 / 비활성화 가능.

CREATE TABLE IF NOT EXISTS quant_asset_catalog (
    asset_id      BINARY(16)   NOT NULL,
    asset_code    VARCHAR(64)  NOT NULL,
    asset_class   VARCHAR(32)  NOT NULL,           -- CRYPTO / STOCK_KR / STOCK_US
    source        VARCHAR(32)  NOT NULL,           -- yfinance / fdr
    display_name  VARCHAR(128) NOT NULL,
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order    INT          NOT NULL DEFAULT 0,
    created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (asset_id),
    UNIQUE KEY uk_asset_catalog_class_code (asset_class, asset_code),
    KEY idx_asset_catalog_active_sort (active, sort_order, asset_class)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Phase 1 시드 (FE SymbolSearch.POPULAR_SYMBOLS 와 정합).
-- MySQL 8 의 UUID_TO_BIN 으로 BINARY(16) 변환 (ORDER 보존 swap-flag=1).
INSERT IGNORE INTO quant_asset_catalog (asset_id, asset_code, asset_class, source, display_name, sort_order)
VALUES
    -- 코인 (yfinance USD pair)
    (UUID_TO_BIN(UUID(), 1), 'BTC-USD',  'CRYPTO',   'yfinance', '비트코인',         10),
    (UUID_TO_BIN(UUID(), 1), 'ETH-USD',  'CRYPTO',   'yfinance', '이더리움',         20),
    -- 한국 주식 (FDR)
    (UUID_TO_BIN(UUID(), 1), '005930',   'STOCK_KR', 'fdr',      '삼성전자',         100),
    (UUID_TO_BIN(UUID(), 1), '000660',   'STOCK_KR', 'fdr',      'SK하이닉스',       110),
    (UUID_TO_BIN(UUID(), 1), '035420',   'STOCK_KR', 'fdr',      'NAVER',           120),
    (UUID_TO_BIN(UUID(), 1), '035720',   'STOCK_KR', 'fdr',      '카카오',          130),
    (UUID_TO_BIN(UUID(), 1), '005380',   'STOCK_KR', 'fdr',      '현대차',          140),
    (UUID_TO_BIN(UUID(), 1), '207940',   'STOCK_KR', 'fdr',      '삼성바이오로직스', 150),
    -- 미국 주식 (yfinance)
    (UUID_TO_BIN(UUID(), 1), 'AAPL',     'STOCK_US', 'yfinance', 'Apple',           200),
    (UUID_TO_BIN(UUID(), 1), 'NVDA',     'STOCK_US', 'yfinance', 'NVIDIA',          210),
    (UUID_TO_BIN(UUID(), 1), 'TSLA',     'STOCK_US', 'yfinance', 'Tesla',           220),
    (UUID_TO_BIN(UUID(), 1), 'MSFT',     'STOCK_US', 'yfinance', 'Microsoft',       230),
    (UUID_TO_BIN(UUID(), 1), 'GOOGL',    'STOCK_US', 'yfinance', 'Alphabet',        240),
    (UUID_TO_BIN(UUID(), 1), 'META',     'STOCK_US', 'yfinance', 'Meta',            250);
