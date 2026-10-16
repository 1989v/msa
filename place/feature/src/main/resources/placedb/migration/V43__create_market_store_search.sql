-- Derived effective-IN rows. Original source payloads remain untouched in market_store.
CREATE TABLE market_store_search (
    store_id BIGINT NOT NULL,
    market_id BIGINT NOT NULL,
    partner_id BIGINT NULL,
    -- Effective values may come from an override (TEXT), so they are not narrower than that.
    name TEXT NULL,
    items TEXT NULL,
    category_major VARCHAR(100) NULL,
    category_mid VARCHAR(100) NULL,
    category_sub VARCHAR(100) NULL,
    menu_names VARCHAR(500) NULL,
    PRIMARY KEY (store_id),
    KEY idx_market_store_search_market (market_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
