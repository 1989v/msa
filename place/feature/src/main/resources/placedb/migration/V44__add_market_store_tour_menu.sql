-- Rebuildable matches to the Korean TourAPI restaurant source, never source payload fields.
ALTER TABLE market_store
    ADD COLUMN tour_content_id VARCHAR(30) NULL,
    ADD COLUMN tour_first_menu TEXT NULL,
    ADD COLUMN tour_treat_menu TEXT NULL,
    ADD COLUMN tour_matched_at DATETIME(6) NULL;
ALTER TABLE market_store_search MODIFY COLUMN menu_names TEXT NULL;
