-- ADR-0056 Part 1 — 상품 데이터 적재 파이프라인.
-- 검색 활용을 위한 description(검색 본문) + category(검색 facet/필터) 신설.
-- search products 인덱스의 description(text/nori), category(keyword) 와 대응한다.
-- description 은 ddl-auto=validate 와의 정합을 위해 VARCHAR(2000) 사용(brand VARCHAR(100) 패턴 일치).
ALTER TABLE products
    ADD COLUMN description VARCHAR(2000) NULL AFTER brand,
    ADD COLUMN category    VARCHAR(100)  NULL AFTER description;

-- 카테고리 facet/필터용 인덱스 (product GET 목록 필터 + 운영 조회 대비)
CREATE INDEX idx_products_category ON products (category);
