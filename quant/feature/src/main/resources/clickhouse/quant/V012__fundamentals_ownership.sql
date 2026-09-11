-- V012: fundamentals 외국인/기관/임직원 보유율 + 공매도 비율 + 유통주식수.
-- yfinance Ticker.info 에서 추가 추출 (heldPercentInstitutions/Insiders, shortRatio, floatShares).

ALTER TABLE quant.fundamentals
    ADD COLUMN IF NOT EXISTS held_pct_institutions Nullable(Float64);

ALTER TABLE quant.fundamentals
    ADD COLUMN IF NOT EXISTS held_pct_insiders Nullable(Float64);

ALTER TABLE quant.fundamentals
    ADD COLUMN IF NOT EXISTS short_ratio Nullable(Float64);

ALTER TABLE quant.fundamentals
    ADD COLUMN IF NOT EXISTS float_shares Nullable(Float64);
