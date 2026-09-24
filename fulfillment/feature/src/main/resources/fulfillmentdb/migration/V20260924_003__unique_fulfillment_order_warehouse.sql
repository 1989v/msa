-- 한 주문 · 한 창고 = 이행 하나. 적용 전 운영 중복 조회: 2026-09-24 주문 0건이라 이행도 0행(key-decisions).
-- 중복이 있으면 ADD UNIQUE 가 Duplicate entry 로 실패하고 기동이 멈춘다 — 조용히 넘어가지 않는다.
-- 확인 쿼리: SELECT order_id, warehouse_id, COUNT(*) FROM fulfillment_order GROUP BY 1, 2 HAVING COUNT(*) > 1;
ALTER TABLE fulfillment_order
    ADD CONSTRAINT uk_fulfillment_order_warehouse UNIQUE (order_id, warehouse_id);
