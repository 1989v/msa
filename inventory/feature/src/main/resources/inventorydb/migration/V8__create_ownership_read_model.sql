-- 재고 REST 소유 판정 읽기 모델 — 판매자는 자기 상품의 재고만 다룬다.
-- product_owner 는 product.item.* 로, owner_seller 는 seller.seller.* 로 채운다(product_db 의 product_seller 와 같은 규칙).
CREATE TABLE IF NOT EXISTS product_owner (
    product_id   BIGINT       NOT NULL,
    seller_id    BIGINT       NOT NULL,
    occurred_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 한 회원이 반려 뒤 재신청하면 행이 둘일 수 있어 member_id 는 유일하지 않다.
CREATE TABLE IF NOT EXISTS owner_seller (
    seller_id    BIGINT       NOT NULL,
    member_id    VARCHAR(64)  NOT NULL,
    status       VARCHAR(20)  NOT NULL,
    occurred_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (seller_id),
    KEY idx_owner_seller_member_status (member_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 플랫폼 기본 판매자는 seller_db V1 시드라 이벤트가 없다. occurred_at 을 과거로 둬 실제 이벤트가 오면 그것이 이긴다.
INSERT INTO owner_seller (seller_id, member_id, status, occurred_at)
VALUES (1, 'platform', 'ACTIVE', '2000-01-01 00:00:00.000000');
