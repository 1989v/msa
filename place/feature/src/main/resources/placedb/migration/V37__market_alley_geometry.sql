-- ADR-0110: upstream evidence remains intact; rejudgment writes derived columns only.
CREATE TABLE market_boundary (
    market_id BIGINT NOT NULL,
    polygon JSON NOT NULL,
    source VARCHAR(20) NOT NULL,
    osm_type VARCHAR(20) NULL,
    osm_id BIGINT NULL,
    fetched_at DATETIME(6) NULL,
    PRIMARY KEY (market_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE market_path (
    id BIGINT NOT NULL AUTO_INCREMENT,
    market_id BIGINT NOT NULL,
    name VARCHAR(300) NULL,
    named BOOLEAN NOT NULL,
    geometry JSON NOT NULL,
    source VARCHAR(20) NOT NULL,
    osm_way_id BIGINT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_market_path_osm (market_id, osm_way_id),
    KEY idx_market_path_sort (market_id, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE market_entrance (
    id BIGINT NOT NULL AUTO_INCREMENT,
    market_id BIGINT NOT NULL,
    lat DOUBLE NOT NULL,
    lng DOUBLE NOT NULL,
    via_path_id BIGINT NULL,
    label VARCHAR(300) NULL,
    source VARCHAR(20) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_market_entrance (market_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE market_road_rule (
    id BIGINT NOT NULL AUTO_INCREMENT,
    market_id BIGINT NOT NULL,
    road_name VARCHAR(300) NOT NULL,
    building_no_from INT NULL,
    building_no_to INT NULL,
    membership VARCHAR(20) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_market_road_rule (market_id, road_name),
    CONSTRAINT chk_market_road_rule_membership CHECK (membership IN ('IN', 'OUT')),
    CONSTRAINT chk_market_road_rule_range CHECK (
        (building_no_from IS NULL OR building_no_from >= 0) AND
        (building_no_to IS NULL OR building_no_to >= 0) AND
        (building_no_from IS NULL OR building_no_to IS NULL OR building_no_from <= building_no_to))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE market_osm_raw (
    market_id BIGINT NOT NULL,
    kind VARCHAR(20) NOT NULL,
    payload JSON NOT NULL,
    fetched_at DATETIME(6) NOT NULL,
    PRIMARY KEY (market_id, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE market
    ADD COLUMN center_override_lat DOUBLE NULL,
    ADD COLUMN center_override_lng DOUBLE NULL,
    ADD COLUMN radius_override_m DOUBLE NULL;

ALTER TABLE market_store
    ADD COLUMN judged_membership VARCHAR(20) NULL,
    ADD COLUMN judged_by VARCHAR(20) NULL,
    ADD COLUMN path_id BIGINT NULL,
    ADD COLUMN needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    ADD KEY idx_market_store_judged (market_id, judged_membership, path_id),
    ADD KEY idx_market_store_review (market_id, needs_review);
-- market_change_log.target already VARCHAR(20); the application enum adds the five P4 targets.
