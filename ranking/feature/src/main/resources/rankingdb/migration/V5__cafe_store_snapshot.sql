-- Ranking-owned public-source projection. No user locations are persisted.
CREATE TABLE cafe_store_snapshot (
 id BIGINT PRIMARY KEY, version VARCHAR(80) NOT NULL, source_as_of DATE NULL,
 fetched_at TIMESTAMP(6) NOT NULL, projection_as_of TIMESTAMP(6) NOT NULL,
 mapping_rule_version VARCHAR(80) NOT NULL
);
CREATE TABLE cafe_store (
 store_key VARCHAR(80) PRIMARY KEY, brand_slug VARCHAR(40), brand_name VARCHAR(255),
 store_name VARCHAR(255) NOT NULL, branch_name VARCHAR(255), address VARCHAR(1024) NOT NULL,
 latitude DOUBLE NOT NULL, longitude DOUBLE NOT NULL, area_code VARCHAR(10),
 mapping_status VARCHAR(20) NOT NULL, raw_json LONGTEXT NOT NULL, missing_rounds INT NOT NULL,
 INDEX idx_cafe_store_bbox (mapping_status, latitude, longitude),
 INDEX idx_cafe_store_brand_area (brand_slug, area_code)
);
CREATE TABLE cafe_store_area (
 code VARCHAR(10) PRIMARY KEY, name VARCHAR(255) NOT NULL, level VARCHAR(20) NOT NULL,
 parent_code VARCHAR(10), latitude DOUBLE, longitude DOUBLE, center_source VARCHAR(2048) NOT NULL,
 source_as_of DATE, INDEX idx_cafe_area_parent (parent_code)
);
