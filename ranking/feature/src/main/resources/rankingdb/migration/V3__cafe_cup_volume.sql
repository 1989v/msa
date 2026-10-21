-- Re-submit each brand through cafe bulk after migration to derive values using ranking:domain.
-- Keep V2 and all source columns unchanged; do not duplicate brand rules in SQL.
ALTER TABLE cafe_drink
    ADD COLUMN cup_volume_ml DECIMAL(14,4) NULL,
    ADD COLUMN volume_source VARCHAR(30) NOT NULL DEFAULT 'NONE',
    ADD COLUMN kcal_per_100ml DECIMAL(14,4) NULL;

-- Existing source-based concentrations remain valid; carry their original volume alongside them.
UPDATE cafe_drink
SET cup_volume_ml = volume_ml, volume_source = 'ROW',
    kcal_per_100ml = CASE WHEN volume_ml > 0 THEN ROUND(kcal * 100 / volume_ml, 4) ELSE NULL END
WHERE volume_ml IS NOT NULL;
