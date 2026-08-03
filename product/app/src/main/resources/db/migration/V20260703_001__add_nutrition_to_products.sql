-- ADR-0060 — 식품 영양성분/원재료/원산지 enrichment.
-- 영양 수치는 전국통합식품영양성분(가공식품) 표준데이터(#15100066, 100g 기준) 를
-- 품목제조보고번호(item_report_no) exact join 으로 부착한다. 매칭 실패 시 NULL(추정 채움 금지).
-- 원재료(ingredients)는 식약처 C002 텍스트, 원산지(origin_country)는 영양DB 원산지국명 best-effort.
ALTER TABLE products
    ADD COLUMN energy_kcal     DOUBLE        NULL AFTER category,   -- 에너지 kcal/100g
    ADD COLUMN carbohydrate_g  DOUBLE        NULL AFTER energy_kcal,
    ADD COLUMN protein_g       DOUBLE        NULL AFTER carbohydrate_g,
    ADD COLUMN fat_g           DOUBLE        NULL AFTER protein_g,
    ADD COLUMN sugar_g         DOUBLE        NULL AFTER fat_g,
    ADD COLUMN sodium_mg       DOUBLE        NULL AFTER sugar_g,
    ADD COLUMN ingredients     VARCHAR(2000) NULL AFTER sodium_mg,  -- 원재료명 텍스트 (함량% 미제공)
    ADD COLUMN origin_country  VARCHAR(64)   NULL AFTER ingredients,
    ADD COLUMN item_report_no  VARCHAR(30)   NULL AFTER origin_country;  -- 품목제조보고번호 (영양 조인키)

-- 영양 재적재/보강(join) 및 중복 검사용
CREATE INDEX idx_products_item_report_no ON products (item_report_no);
