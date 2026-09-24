-- 이행 라인 — 클레임이 출고 전에 라인 단위로 취소한다. 확장만 한다(새 테이블).
-- 루트(fulfillment_order)는 id 로만 가리킨다(FK 제약 없음 — 다른 도메인 테이블과 같은 정책).
CREATE TABLE IF NOT EXISTS fulfillment_line (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    fulfillment_id  BIGINT       NOT NULL,
    product_id      BIGINT       NOT NULL,
    quantity        INT          NOT NULL,
    status          VARCHAR(20)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_fulfillment_line_product (fulfillment_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
