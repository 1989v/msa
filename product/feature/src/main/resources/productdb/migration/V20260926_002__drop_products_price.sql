-- 가격은 원 단위 price_won 하나로 둔다 — 옛 DECIMAL 컬럼을 지운다
ALTER TABLE products DROP COLUMN price;
