-- ADR-0109: immutable upstream payloads + derived decisions + separate manual overrides.
-- IDs reference place aggregates / member identity without JPA associations or cross-service FKs.
-- Source reloads UPDATE by natural key; never truncate these tables or replace/delete MANUAL rows.

CREATE TABLE market (
    attraction_content_id VARCHAR(40) NOT NULL,
    name VARCHAR(300) NOT NULL,
    market_type VARCHAR(20) NOT NULL,
    source_key VARCHAR(191) NULL,
    market_info_matched BOOLEAN NOT NULL,
    latitude DOUBLE NULL,
    longitude DOUBLE NULL,
    road_address VARCHAR(500) NULL,
    jibun_address VARCHAR(500) NULL,
    source_market_type VARCHAR(100) NULL,
    store_count_raw VARCHAR(100) NULL,
    opening_cycle VARCHAR(300) NULL,
    facilities TEXT NULL,
    source_raw JSON NULL,
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_market_attraction (attraction_content_id),
    UNIQUE KEY uk_market_source (source_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE market_zone (
    market_id BIGINT NOT NULL,
    kind VARCHAR(20) NOT NULL,
    name VARCHAR(300) NOT NULL,
    source VARCHAR(20) NOT NULL,
    source_key VARCHAR(191) NULL,
    parent_id BIGINT NULL,
    road_name VARCHAR(300) NULL,
    building_name VARCHAR(300) NULL,
    dong VARCHAR(100) NULL,
    floor VARCHAR(100) NULL,
    polygon_wkt LONGTEXT NULL,
    sort_order INT NOT NULL,
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_market_zone_source (market_id, source, source_key),
    KEY idx_market_zone_parent (market_id, parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE market_store (
    market_id BIGINT NOT NULL,
    name VARCHAR(300) NOT NULL,
    source VARCHAR(20) NOT NULL,
    source_key VARCHAR(191) NULL,
    zone_id BIGINT NULL,
    items TEXT NULL,
    category_major VARCHAR(100) NULL,
    category_mid VARCHAR(100) NULL,
    category_sub VARCHAR(100) NULL,
    latitude DOUBLE NULL,
    longitude DOUBLE NULL,
    road_address VARCHAR(500) NULL,
    jibun_address VARCHAR(500) NULL,
    building_management_no VARCHAR(100) NULL,
    building_name VARCHAR(300) NULL,
    dong VARCHAR(100) NULL,
    floor VARCHAR(100) NULL,
    ho VARCHAR(100) NULL,
    road_name VARCHAR(300) NULL,
    onnuri_key VARCHAR(191) NULL,
    sangga_key VARCHAR(191) NULL,
    onnuri_raw JSON NULL,
    sangga_raw JSON NULL,
    membership VARCHAR(20) NOT NULL,
    pin_kind VARCHAR(20) NOT NULL,
    reference_store_id BIGINT NULL,
    relative_position VARCHAR(100) NULL,
    position_note TEXT NULL,
    actor_kind VARCHAR(20) NULL,
    created_by_member_id BIGINT NULL,
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_market_store_source (market_id, source, source_key),
    UNIQUE KEY uk_market_store_onnuri (market_id, onnuri_key),
    UNIQUE KEY uk_market_store_sangga (market_id, sangga_key),
    KEY idx_market_store_visible (market_id, membership, zone_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE market_store_override (
    store_id BIGINT NOT NULL,
    field VARCHAR(30) NOT NULL,
    value TEXT NULL,
    reason VARCHAR(1000) NOT NULL,
    member_id BIGINT NOT NULL,
    actor_kind VARCHAR(20) NOT NULL,
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_market_store_override (store_id, field)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE market_change_log (
    market_id BIGINT NOT NULL,
    target VARCHAR(20) NOT NULL,
    target_id BIGINT NOT NULL,
    action VARCHAR(20) NOT NULL,
    member_id BIGINT NOT NULL,
    actor_kind VARCHAR(20) NOT NULL,
    before_raw JSON NULL,
    after_raw JSON NULL,
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_market_change_log (market_id, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE market_steward (
    market_id BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    org_name VARCHAR(300) NOT NULL,
    contact VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL,
    approved_by_member_id BIGINT NULL,
    approved_at DATETIME(6) NULL,
    id BIGINT NOT NULL AUTO_INCREMENT,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_market_steward (market_id, member_id),
    KEY idx_market_steward_status (status, market_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
