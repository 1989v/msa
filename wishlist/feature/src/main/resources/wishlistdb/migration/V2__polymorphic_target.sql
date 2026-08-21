-- 찜 대상 다형화 (ADR-0074) — 회원×상품 전용 → 회원×(PRODUCT|GAME|ATTRACTION|BLOG_POST).
-- 신설이 아니라 ALTER: 기존 행(전부 상품 찜)은 PRODUCT/CAST(product_id) 로 백필해 보존한다.

ALTER TABLE wishlist_items
    ADD COLUMN target_type VARCHAR(30)  NOT NULL DEFAULT 'PRODUCT' AFTER member_id,
    ADD COLUMN target_key  VARCHAR(120) NOT NULL DEFAULT ''        AFTER target_type;

UPDATE wishlist_items SET target_key = CAST(product_id AS CHAR);

ALTER TABLE wishlist_items
    ALTER COLUMN target_type DROP DEFAULT,
    ALTER COLUMN target_key  DROP DEFAULT,
    DROP INDEX uk_member_product,
    DROP COLUMN product_id,
    ADD CONSTRAINT uk_member_target UNIQUE (member_id, target_type, target_key);
