ALTER TABLE market_store
    ADD COLUMN good_price_key VARCHAR(64) NULL,
    ADD COLUMN good_price_raw TEXT NULL,
    ADD COLUMN good_price_matched_by VARCHAR(16) NULL,
    ADD COLUMN good_price_menu_names VARCHAR(500) NULL;
