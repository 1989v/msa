-- Landslide supports bot practice and online 1v1 (V93).
-- playerMode and multiplayer filtering both derive from these tags.
-- Idempotent; restricted to Landslide. Do not rewrite applied migrations.
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
JOIN game_tag t ON t.slug = 'multiplayer'
WHERE g.slug = 'landslide';
