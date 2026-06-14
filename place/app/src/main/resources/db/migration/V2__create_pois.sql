-- ADR-0056 Part 2 — POI(음식점/카페/상점 등). MySQL SSOT, OpenSearch poi 인덱스는 read model.
-- 출처: 소상공인시장진흥공단 상가정보(data.go.kr #15083033, 제한없음) / Foursquare OS Places(Apache-2.0).
-- region_id 는 regions(id) 논리 참조 (서비스 내 동일 DB 이나 FK 제약은 두지 않음 — 적재 유연성).
CREATE TABLE pois (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    source         VARCHAR(32)  NOT NULL,             -- SANGGA / FOURSQUARE
    source_key     VARCHAR(128) NOT NULL,             -- 상가 관리번호 / fsq_place_id
    name           VARCHAR(300) NOT NULL,
    category_major VARCHAR(100) NULL,                 -- 대분류 (음식/소매/숙박...)
    category_mid   VARCHAR(100) NULL,                 -- 중분류 (한식/카페...)
    category_sub   VARCHAR(100) NULL,
    region_id      BIGINT       NULL,
    road_address   VARCHAR(300) NULL,
    jibun_address  VARCHAR(300) NULL,
    latitude       DOUBLE       NOT NULL,
    longitude      DOUBLE       NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_pois_source (source, source_key),
    KEY idx_pois_region (region_id),
    KEY idx_pois_category (category_major, category_mid)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
