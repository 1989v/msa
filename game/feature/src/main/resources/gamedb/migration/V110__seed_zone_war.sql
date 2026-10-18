-- 영역 전쟁 · zone-war. Registration only; Flyway runs with the content rollout.
-- Keep the approved internal client/API/WebSocket territory paths unchanged.
INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url,
                  engine_type, load_type, entry_url, orientation, supports_mobile, developer_name,
                  sdk_integrated, status, genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES ('zone-war', '영역 전쟁',
        '같은 온라인 월드에서 선을 그어 땅을 넓히고 상대의 노출된 선을 자르는 영역 대전. 언제든 입장할 수 있고 사람이 30명보다 적으면 AI가 함께합니다. 서버가 다시 시작하면 월드가 초기화됩니다.',
        'zone-war',
        'Draw a trail and return to your land to capture territory in a shared online world. Cut exposed enemy trails and join at any time. AI fills the population below thirty; server restarts reset the world.',
        '/games/territory/cover.svg', NULL, 'HTML5', 'IFRAME', '/games/territory/index.html',
        'BOTH', 1, 'kgd', 0, 'BETA', 'VERSUS', '["action","strategy","multiplayer","beta"]', NULL,
        NOW(6), NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), title_en=VALUES(title_en),
    description_en=VALUES(description_en), thumbnail_url=VALUES(thumbnail_url), entry_url=VALUES(entry_url),
    engine_type=VALUES(engine_type), load_type=VALUES(load_type), orientation=VALUES(orientation),
    supports_mobile=VALUES(supports_mobile), sdk_integrated=VALUES(sdk_integrated), status=VALUES(status),
    genre=VALUES(genre), tags=VALUES(tags), released_at=COALESCE(released_at, VALUES(released_at)),
    content_updated_at=NOW(6), updated_at=NOW(6);

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id,0,0,0,0 FROM game WHERE slug='zone-war'
ON DUPLICATE KEY UPDATE play_count=play_count;

INSERT INTO game_tag_map (game_id,tag_slug)
SELECT g.id,t.slug FROM game g CROSS JOIN
    (SELECT 'action' AS slug UNION ALL SELECT 'strategy' UNION ALL SELECT 'multiplayer' UNION ALL SELECT 'beta') t
WHERE g.slug='zone-war' AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug=t.slug)
ON DUPLICATE KEY UPDATE tag_slug=VALUES(tag_slug);

-- NEW normally dedupes MANUAL picks. Pin explicitly in BOTH existing collections
-- so this requested double placement survives deduplication. Preserve prior picks.
UPDATE game_collection c JOIN game g ON g.slug='zone-war'
SET c.game_ids=JSON_ARRAY_INSERT(COALESCE(c.game_ids, JSON_ARRAY()), '$[0]', g.id)
WHERE c.slug IN ('editors-pick','new-games')
  AND NOT JSON_CONTAINS(COALESCE(c.game_ids, JSON_ARRAY()), CAST(g.id AS JSON), '$');
