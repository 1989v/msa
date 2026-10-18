-- V108 repaired the normalized lookup only. The API/playerMode reads game.tags.
-- Preserve every existing tag; only append the verified mode to Landslide.
UPDATE game
SET tags = JSON_ARRAY_APPEND(COALESCE(tags, JSON_ARRAY()), '$', 'multiplayer')
WHERE slug = 'landslide'
  AND JSON_CONTAINS(COALESCE(tags, JSON_ARRAY()), JSON_QUOTE('multiplayer'), '$') = 0;

-- Keep the normalized lookup consistent, including databases missing the V108 row.
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
JOIN game_tag t ON t.slug = 'multiplayer'
WHERE g.slug = 'landslide';
