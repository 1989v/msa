-- 유니크 제약. 적용 전 운영 중복 조회: 2026-09-24 inventory 0행 · reservation 0행(key-decisions).
-- 중복이 있으면 ADD UNIQUE 가 Duplicate entry 로 실패하고 기동이 멈춘다 — 조용히 넘어가지 않는다.
-- 확인 쿼리:
--   SELECT product_id, warehouse_id, COUNT(*) FROM inventory GROUP BY 1, 2 HAVING COUNT(*) > 1;
--   SELECT order_id, product_id, warehouse_id, COUNT(*) FROM reservation GROUP BY 1, 2, 3 HAVING COUNT(*) > 1;

ALTER TABLE inventory
    ADD CONSTRAINT uk_inventory_product_warehouse UNIQUE (product_id, warehouse_id);

-- 한 주문의 상품은 한 창고에서 한 행으로 예약된다(주문 예약이 같은 상품 라인을 합친다)
ALTER TABLE reservation
    ADD CONSTRAINT uk_reservation_order_product_warehouse UNIQUE (order_id, product_id, warehouse_id);
