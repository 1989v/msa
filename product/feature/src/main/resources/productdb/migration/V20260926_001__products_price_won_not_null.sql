-- 금액 축소 1단계 (product_db) — 코드는 이제 price_won 만 쓴다
-- 롤백 기간에 옛 코드가 쓴 행은 price_won 이 비어 있다 — 먼저 다시 채운다.
UPDATE products SET price_won = CAST(price AS SIGNED) WHERE price_won IS NULL;

-- 채운 뒤에도 비어 있거나 소수부가 있는 행이 있으면 DDL 전에 멈춘다(확장 단계와 같은 임시 테이블 CHECK).
CREATE TEMPORARY TABLE products_won_contract_guard (
    bad_rows BIGINT NOT NULL,
    CONSTRAINT chk_products_won_contract CHECK (bad_rows = 0)
);
INSERT INTO products_won_contract_guard (bad_rows)
SELECT COUNT(*) FROM products WHERE price_won IS NULL OR price <> FLOOR(price);
DROP TEMPORARY TABLE products_won_contract_guard;

ALTER TABLE products MODIFY COLUMN price_won BIGINT NOT NULL;
-- 옛 컬럼은 이 배포의 코드가 더 이상 쓰지 않는다. 겹쳐 도는 옛 파드는 계속 쓰므로 지우지 않고 NULL 만 허용한다.
ALTER TABLE products MODIFY COLUMN price DECIMAL(19, 2) NULL;
