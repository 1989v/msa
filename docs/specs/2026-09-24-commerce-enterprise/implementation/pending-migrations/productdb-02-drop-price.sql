-- 금액 축소 2단계 (product_db). 1단계가 배포되고 옛 파드가 모두 내려간 뒤의 배포에서.
-- 배치: productdb/migration/V<배포일>_001__drop_products_price.sql
ALTER TABLE products DROP COLUMN price;
