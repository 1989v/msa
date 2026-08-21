-- wishlist Flyway baseline (ADR-0074 에서 뒤늦게 배선).
--
-- 지금까지 wishlist_db 스키마는 Hibernate ddl-auto 산물이었고 마이그레이션 이력이 없다.
-- 본 스크립트는 그 형태(회원×상품 전용)를 그대로 재현한다:
--   - 기존 운영 DB: baseline-on-migrate + baseline-version=1 로 skip → 데이터 무손실
--   - 신규/로컬/테스트 DB: 처음 실행되어 동일 스키마 생성 후 V2 가 이어서 변환
--
-- 컬럼 타입은 Hibernate 6 기본 매핑: Long -> BIGINT, LocalDateTime -> DATETIME(6)

CREATE TABLE IF NOT EXISTS wishlist_items (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    member_id   BIGINT      NOT NULL,
    product_id  BIGINT      NOT NULL,
    created_at  DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_member_product UNIQUE (member_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
