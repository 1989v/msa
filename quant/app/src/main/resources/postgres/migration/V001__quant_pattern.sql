-- ADR-0033/0035 Phase 1 — 차트 패턴 임베딩 테이블.
-- 기존 charting 의 `pattern` 테이블 흡수 시 INSERT SELECT 로 데이터 복사.
-- pgvector extension 필요 — k8s/infra/local/postgres 에서 사전 설치 가정.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS quant_pattern (
    id              BIGSERIAL PRIMARY KEY,
    asset_code      VARCHAR(32) NOT NULL,
    market_code     VARCHAR(32) NOT NULL,
    asset_class     VARCHAR(16) NOT NULL,
    ts_window_end   TIMESTAMPTZ NOT NULL,
    embedding       VECTOR(32) NOT NULL,
    return_5d       NUMERIC(10, 6) NULL,
    return_20d      NUMERIC(10, 6) NULL,
    return_60d      NUMERIC(10, 6) NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW 인덱스 (cosine)
CREATE INDEX IF NOT EXISTS idx_quant_pattern_hnsw
    ON quant_pattern
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_quant_pattern_asset
    ON quant_pattern (asset_class, asset_code, market_code, ts_window_end DESC);
