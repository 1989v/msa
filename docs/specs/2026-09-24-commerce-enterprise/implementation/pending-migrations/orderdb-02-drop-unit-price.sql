-- 금액 축소 2단계 (order_db). 1단계가 배포되고 옛 파드가 모두 내려간 뒤의 배포에서.
-- 배치: orderdb/migration/V<배포일>_001__drop_order_items_unit_price.sql
ALTER TABLE order_items DROP COLUMN unit_price;
