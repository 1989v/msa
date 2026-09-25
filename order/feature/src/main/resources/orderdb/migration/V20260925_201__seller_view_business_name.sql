-- 판매자 상호 — 장바구니·주문서·주문 화면이 「판매자 N」 대신 보인다. seller 가 승인된 판매자 이벤트에만 싣는다.
-- 확장만(nullable) — 옛 코드와 공존한다. 이미 승인된 판매자는 다음 seller 이벤트(또는 재발행)로 채워진다.
ALTER TABLE seller_view ADD COLUMN business_name VARCHAR(100) NULL;
-- 플랫폼 기본 판매자는 seller_db V1 시드라 이벤트가 없다 — 같은 상호로 시드한다.
UPDATE seller_view SET business_name = '플랫폼 기본 판매자' WHERE seller_id = 1 AND business_name IS NULL;
