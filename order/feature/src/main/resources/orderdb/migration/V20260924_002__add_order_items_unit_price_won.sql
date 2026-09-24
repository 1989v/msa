-- 금액을 원 단위 정수로 (확장 단계). order_items.unit_price DECIMAL(19,2) 옆에 unit_price_won BIGINT 를 두고 백필한다.
-- 코드는 새 컬럼을 읽고, 롤백한 옛 코드를 위해 옛 컬럼에도 같은 값을 계속 쓴다. 옛 컬럼 삭제는 다음 단계(축소).
-- 확장 단계라 새 컬럼은 NULL 허용이다 — 옛 코드로 롤백한 동안 쓰인 행은 이 UPDATE 를 다시 돌려 채운다.

-- 소수부가 있는 행이 하나라도 있으면 DDL 전에 멈춘다. CHECK 위반으로 이 마이그레이션이 실패하고
-- 스키마는 그대로라, 데이터를 고친 뒤 다시 기동하면 처음부터 적용된다.
CREATE TEMPORARY TABLE order_items_won_guard (
    fractional_rows BIGINT NOT NULL,
    CONSTRAINT chk_order_items_whole_won CHECK (fractional_rows = 0)
);
INSERT INTO order_items_won_guard (fractional_rows)
SELECT COUNT(*) FROM order_items WHERE unit_price <> FLOOR(unit_price);
DROP TEMPORARY TABLE order_items_won_guard;

ALTER TABLE order_items ADD COLUMN unit_price_won BIGINT NULL;
UPDATE order_items SET unit_price_won = CAST(unit_price AS SIGNED) WHERE unit_price_won IS NULL;
