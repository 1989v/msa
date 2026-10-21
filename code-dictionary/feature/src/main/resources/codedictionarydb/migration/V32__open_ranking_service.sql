-- V20 seeded rank as PREOPEN. Public gas and cafe comparison are now available.
-- Preserve all other service publication states and the immutable V20 migration.
UPDATE display_service SET status = 'OPEN' WHERE code = 'rank' AND status = 'PREOPEN';
