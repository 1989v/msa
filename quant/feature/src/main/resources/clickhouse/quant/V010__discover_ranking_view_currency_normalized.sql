-- V010: discover_daily_ranking VIEW 의 turnover 계산을 asset_class 별 분기.
--
-- yfinance 의 CRYPTO 자산 (BTC-USD / ETH-USD …) volume 은 글로벌 24h USD turnover
-- (이미 거래대금 단위) — 그런데 V008 정의는 sum(volume * close) 라 CRYPTO 에 close 가
-- 한 번 더 곱해져 quadrillion 단위의 비현실 값 ($2,954T) 발생.
--
-- 주식 (STOCK_KR/STOCK_US) 의 volume 은 주식수이므로 그대로 close 곱하기 유지.

DROP VIEW IF EXISTS quant.discover_daily_ranking;

CREATE VIEW quant.discover_daily_ranking AS
SELECT
    asset_code,
    asset_class,
    market_code,
    toDate(ts) AS trade_date,
    argMax(close, ts) AS last_close,
    argMin(close, ts) AS first_close,
    CASE asset_class
        WHEN 'CRYPTO' THEN sum(volume)         -- yfinance USD turnover 자체
        ELSE sum(volume * close)               -- 주식: shares × price
    END AS turnover,
    sum(volume) AS volume_total
FROM quant.ohlcv
WHERE interval = '1d'
GROUP BY
    asset_code,
    asset_class,
    market_code,
    trade_date;
