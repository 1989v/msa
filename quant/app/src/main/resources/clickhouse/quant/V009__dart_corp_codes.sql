-- ADR-0041 — DART (전자공시) corp_code 매핑.
--
-- DART API 의 list.json 호출에 corp_code 필수. stock_code(=우리 asset_code, KR 종목) → corp_code 매핑.
-- DART OpenDART 의 corpCode.xml zip 다운로드 + 파싱하여 적재 (~8000 row 정도, 주 1회 갱신).

CREATE TABLE IF NOT EXISTS quant.dart_corp_codes (
    corp_code     String,           -- DART 회사 고유번호 8자리
    corp_name     String,
    stock_code    String,           -- 거래소 종목코드 (없으면 빈 문자열, ETF/비상장 등)
    modify_date   Date,             -- DART 의 마지막 수정일
    ingested_at   DateTime64(3, 'UTC') DEFAULT now64()
)
ENGINE = ReplacingMergeTree(ingested_at)
ORDER BY (stock_code, corp_code);
