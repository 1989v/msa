-- 금액 축소 1단계 (order_db). 배치: orderdb/migration/V<배포일>_001__order_items_unit_price_won_not_null.sql
-- 롤백 기간에 옛 코드가 쓴 행은 unit_price_won 이 비어 있다 — 먼저 다시 채운다.
UPDATE order_items SET unit_price_won = CAST(unit_price AS SIGNED) WHERE unit_price_won IS NULL;

CREATE TEMPORARY TABLE order_items_won_contract_guard (
    bad_rows BIGINT NOT NULL,
    CONSTRAINT chk_order_items_won_contract CHECK (bad_rows = 0)
);
INSERT INTO order_items_won_contract_guard (bad_rows)
SELECT COUNT(*) FROM order_items WHERE unit_price_won IS NULL OR unit_price <> FLOOR(unit_price);
DROP TEMPORARY TABLE order_items_won_contract_guard;

ALTER TABLE order_items MODIFY COLUMN unit_price_won BIGINT NOT NULL;
ALTER TABLE order_items MODIFY COLUMN unit_price DECIMAL(19, 2) NULL;
