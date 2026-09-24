-- order 가 이벤트로 유지하는 읽기 모델 (SR-3). 주문서 가격·판매 가능·쿠폰·포인트는 여기서만 온다 — HTTP 자기 호출 없음.
-- 각 행의 occurred_at 은 원천 이벤트 시각이다. 늦게 도착한 옛 이벤트는 이것으로 거른다.

-- product.item.{created,updated}
CREATE TABLE IF NOT EXISTS product_view (
    product_id   BIGINT       NOT NULL,
    name         VARCHAR(255) NOT NULL,
    price        BIGINT       NOT NULL,
    status       VARCHAR(20)  NOT NULL,
    seller_id    BIGINT       NOT NULL,
    occurred_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- seller.seller.*
CREATE TABLE IF NOT EXISTS seller_view (
    seller_id           BIGINT       NOT NULL,
    status              VARCHAR(20)  NOT NULL,
    commission_rate_bp  INT          NULL,
    shipping_fee        BIGINT       NOT NULL,
    occurred_at         DATETIME(6)  NOT NULL,
    PRIMARY KEY (seller_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 플랫폼 기본 판매자는 seller_db V1 시드라 이벤트가 없다 — 여기서도 시드한다(수수료 0, 배송비 0).
-- occurred_at 을 과거로 둬 이후 실제 이벤트가 오면 그것이 이긴다.
INSERT INTO seller_view (seller_id, status, commission_rate_bp, shipping_fee, occurred_at)
VALUES (1, 'ACTIVE', 0, 0, '2000-01-01 00:00:00.000000');

-- promotion.coupon.defined
CREATE TABLE IF NOT EXISTS coupon_definition_view (
    coupon_definition_id  BIGINT       NOT NULL,
    type                  VARCHAR(10)  NOT NULL,
    amount                BIGINT       NULL,
    rate_bp               INT          NULL,
    max_discount          BIGINT       NULL,
    min_order_amount      BIGINT       NOT NULL,
    valid_from            DATETIME(6)  NOT NULL,
    valid_until           DATETIME(6)  NOT NULL,
    bearer                VARCHAR(10)  NOT NULL,
    seller_id             BIGINT       NULL,
    status                VARCHAR(20)  NOT NULL,
    occurred_at           DATETIME(6)  NOT NULL,
    PRIMARY KEY (coupon_definition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- promotion.coupon.issued + promotion.hold.* 의 userCouponStatus
CREATE TABLE IF NOT EXISTS user_coupon_view (
    user_coupon_id        BIGINT       NOT NULL,
    member_id             VARCHAR(64)  NOT NULL,
    coupon_definition_id  BIGINT       NOT NULL,
    status                VARCHAR(20)  NOT NULL,
    occurred_at           DATETIME(6)  NOT NULL,
    PRIMARY KEY (user_coupon_id),
    KEY idx_user_coupon_view_member (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- promotion.point.changed
CREATE TABLE IF NOT EXISTS point_balance_view (
    member_id    VARCHAR(64)  NOT NULL,
    balance      BIGINT       NOT NULL,
    occurred_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
