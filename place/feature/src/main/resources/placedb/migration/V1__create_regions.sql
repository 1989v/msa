-- ADR-0056 Part 2 — 행정 지리 계층 (continent → country → region → city).
-- 출처: GeoNames (CC BY 4.0). self-FK(parent_id)로 계층 표현, geonames_id 로 멱등 upsert.
CREATE TABLE regions (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    parent_id     BIGINT       NULL,
    level         VARCHAR(16)  NOT NULL,            -- CONTINENT/COUNTRY/REGION/CITY
    name          VARCHAR(200) NOT NULL,
    name_ko       VARCHAR(200) NULL,                -- GeoNames alternateNames (ko)
    country_code  VARCHAR(2)   NULL,                -- ISO 3166-1 alpha-2
    admin1_code   VARCHAR(20)  NULL,
    admin2_code   VARCHAR(20)  NULL,
    geonames_id   BIGINT       NULL,
    latitude      DOUBLE       NULL,
    longitude     DOUBLE       NULL,
    population     BIGINT       NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_regions_geonames (geonames_id),
    KEY idx_regions_parent (parent_id),
    KEY idx_regions_level (level),
    KEY idx_regions_country (country_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
