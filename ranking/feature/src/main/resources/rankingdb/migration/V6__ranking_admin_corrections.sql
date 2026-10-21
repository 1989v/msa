-- Independent natural-key corrections survive brand delete/insert. No FK to cafe_drink.
CREATE TABLE ranking_admin_record (
    id VARCHAR(100) NOT NULL PRIMARY KEY,
    kind VARCHAR(24) NOT NULL,
    payload LONGTEXT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    INDEX idx_ranking_admin_kind_updated (kind, updated_at)
);
-- Serializes lock-row creation as well as operation-key acquisition across JVMs.
INSERT INTO ranking_admin_record(id,kind,payload,updated_at) VALUES ('control','LOCK','{}',CURRENT_TIMESTAMP(6));

-- Typed effective read model. Source remains cafe_drink, including all source/raw fields.
CREATE TABLE cafe_drink_effective LIKE cafe_drink;
ALTER TABLE cafe_drink_effective ADD COLUMN display_name VARCHAR(255) NULL;
ALTER TABLE cafe_drink_effective ADD COLUMN official_source_url VARCHAR(2048) NULL;
ALTER TABLE cafe_drink_effective ADD COLUMN official_checked_at DATE NULL;
ALTER TABLE cafe_drink_effective ADD COLUMN correction_evidence LONGTEXT NULL;
INSERT INTO cafe_drink_effective SELECT cafe_drink.*, NULL, source_url, checked_at, '{}' FROM cafe_drink;
