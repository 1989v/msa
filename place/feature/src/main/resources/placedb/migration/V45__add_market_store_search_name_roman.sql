-- Application startup rebuilds existing rows with a NULL romanization using KoreanRomanizer.
ALTER TABLE market_store_search ADD COLUMN name_roman TEXT NULL;
