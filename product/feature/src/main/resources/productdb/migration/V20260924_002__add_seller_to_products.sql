-- 상품 소유 판매자 + 판매자 읽기 모델 (ADR-0099 §8).
--
-- 기존 상품은 플랫폼 기본 판매자(seller_db 의 id 1)로 백필한다. 기본값은 백필에만 쓰고 바로 뗀다 —
-- 남겨 두면 소유자를 빠뜨린 INSERT 가 조용히 플랫폼 상품이 된다.
ALTER TABLE products ADD COLUMN seller_id BIGINT NOT NULL DEFAULT 1;
ALTER TABLE products ALTER COLUMN seller_id DROP DEFAULT;
CREATE INDEX idx_products_seller_id ON products (seller_id);

-- seller.seller.* 이벤트로 채운다. 한 회원이 반려 뒤 재신청하면 행이 둘일 수 있어 member_id 는 유일하지 않다.
CREATE TABLE IF NOT EXISTS product_seller (
    seller_id    BIGINT       NOT NULL,
    member_id    VARCHAR(64)  NOT NULL,
    status       VARCHAR(20)  NOT NULL,
    occurred_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (seller_id),
    KEY idx_product_seller_member_status (member_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 플랫폼 기본 판매자는 seller_db V1 시드라 이벤트가 없다 — 여기서도 시드한다.
-- occurred_at 을 과거로 둬 이후 실제 이벤트가 오면 그것이 이긴다.
INSERT INTO product_seller (seller_id, member_id, status, occurred_at)
VALUES (1, 'platform', 'ACTIVE', '2000-01-01 00:00:00.000000');
