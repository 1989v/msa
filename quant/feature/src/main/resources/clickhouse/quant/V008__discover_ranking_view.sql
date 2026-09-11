-- ADR-0042 — RankingQuery N+1 효율화.
--
-- 일별 자산별 (last_close, first_close, turnover, volume_total) 집계 view.
-- RankingQuery 가 자산별 ohlcv query → in-memory 정렬을 단일 ClickHouse 쿼리로 대체 가능.
--
-- 단순 VIEW (실시간 집계, 일봉 데이터 양 적어 빠름).
-- 후속에 데이터 양 증가 시 AggregatingMergeTree 기반 MaterializedView 로 격상.

CREATE OR REPLACE VIEW quant.discover_daily_ranking AS
SELECT
    asset_code,
    asset_class,
    market_code,
    toDate(ts) AS trade_date,
    argMax(close, ts) AS last_close,
    argMin(close, ts) AS first_close,
    sum(volume * close) AS turnover,
    sum(volume) AS volume_total
FROM quant.ohlcv
WHERE interval = '1d'
GROUP BY asset_code, asset_class, market_code, trade_date;
