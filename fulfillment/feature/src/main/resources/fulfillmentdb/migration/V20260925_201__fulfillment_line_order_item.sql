-- 이행 라인을 주문 라인 id 로 식별한다 — 같은 상품이 두 라인이어도 따로 취소된다.
-- 확장: nullable 컬럼 추가. 이 식별 전에 만든 행은 NULL 로 남는다(클레임 취소 대상이 되려면 주문 라인 id 가 있어야 한다).
ALTER TABLE fulfillment_line ADD COLUMN order_item_id BIGINT NULL AFTER fulfillment_id;
-- 상품 기준 유니크는 같은 상품 두 라인을 막는다 — 주문 라인 기준으로 바꾼다(NULL 은 유니크에 걸리지 않는다)
ALTER TABLE fulfillment_line DROP INDEX uk_fulfillment_line_product;
ALTER TABLE fulfillment_line ADD UNIQUE KEY uk_fulfillment_line_item (fulfillment_id, order_item_id);
