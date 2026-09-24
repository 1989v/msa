-- 장바구니 · 주문서 (SR-7). 금액은 전부 원 단위 BIGINT.

CREATE TABLE IF NOT EXISTS cart_item (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    member_id   VARCHAR(64)  NOT NULL,
    product_id  BIGINT       NOT NULL,
    quantity    INT          NOT NULL,
    created_at  DATETIME(6)  NOT NULL,
    updated_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_cart_item_member_product (member_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 주문서 = 서버가 계산한 견적 스냅샷. 합계는 라인에서 유도되지만 조회·대조용으로 함께 저장한다.
CREATE TABLE IF NOT EXISTS order_sheet (
    id                    BIGINT       NOT NULL AUTO_INCREMENT,
    member_id             VARCHAR(64)  NOT NULL,
    status                VARCHAR(20)  NOT NULL,
    user_coupon_id        BIGINT       NULL,
    coupon_definition_id  BIGINT       NULL,
    items_amount          BIGINT       NOT NULL,
    coupon_discount       BIGINT       NOT NULL,
    point_amount          BIGINT       NOT NULL,
    shipping_amount       BIGINT       NOT NULL,
    payable_amount        BIGINT       NOT NULL,
    used_order_id         BIGINT       NULL,
    expires_at            DATETIME(6)  NOT NULL,
    created_at            DATETIME(6)  NOT NULL,
    version               BIGINT       NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_order_sheet_member (member_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 라인 스냅샷: 상품명 · 판매가 · 수량 · 쿠폰/포인트 안분 · 쿠폰 부담 주체 · 수수료율 · 판매자 · 라인 결제액
CREATE TABLE IF NOT EXISTS order_sheet_line (
    id                  BIGINT       NOT NULL AUTO_INCREMENT,
    order_sheet_id      BIGINT       NOT NULL,
    line_no             INT          NOT NULL,
    product_id          BIGINT       NOT NULL,
    product_name        VARCHAR(255) NOT NULL,
    seller_id           BIGINT       NOT NULL,
    unit_price          BIGINT       NOT NULL,
    quantity            INT          NOT NULL,
    coupon_discount     BIGINT       NOT NULL,
    coupon_bearer       VARCHAR(10)  NULL,
    point_amount        BIGINT       NOT NULL,
    commission_rate_bp  INT          NOT NULL,
    payable_amount      BIGINT       NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_order_sheet_line_no (order_sheet_id, line_no),
    CONSTRAINT fk_order_sheet_line_sheet FOREIGN KEY (order_sheet_id) REFERENCES order_sheet (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 판매자별 배송비 라인 — 한 주문서에서 판매자마다 한 행
CREATE TABLE IF NOT EXISTS order_sheet_shipping (
    id              BIGINT  NOT NULL AUTO_INCREMENT,
    order_sheet_id  BIGINT  NOT NULL,
    seller_id       BIGINT  NOT NULL,
    fee             BIGINT  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_order_sheet_shipping_seller (order_sheet_id, seller_id),
    CONSTRAINT fk_order_sheet_shipping_sheet FOREIGN KEY (order_sheet_id) REFERENCES order_sheet (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
