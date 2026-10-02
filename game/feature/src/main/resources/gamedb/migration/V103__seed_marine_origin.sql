-- 전초선: 활잡이 원정. Registration only; deployment/migration execution is separate.
INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url,
                  engine_type, load_type, entry_url, orientation, supports_mobile, developer_name,
                  sdk_integrated, status, genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES ('marine-command', '전초선: 활잡이 원정',
        '활잡이로 사냥해 목수를 고용하고, 채집과 주둔 탑으로 경제와 거점을 키우는 2D 부대 RPG. 다섯 거점과 두 던전의 수문장을 넘어 혈월 백작을 공략하세요.',
        'Frontline: Archer Expedition',
        'Hunt, hire carpenters, gather resources and garrison your archers in towers. Grow an army through five strongholds and two dungeons in a solo or cooperative expedition.',
        '/games/marine-command/assets/cover.png', NULL, 'HTML5', 'IFRAME', '/games/marine-command/index.html',
        'BOTH', 1, 'kgd', 1, 'BETA', 'RPG', '["rpg","strategy","defense"]', NULL,
        NOW(6), NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), title_en=VALUES(title_en),
    description_en=VALUES(description_en), thumbnail_url=VALUES(thumbnail_url), entry_url=VALUES(entry_url),
    orientation=VALUES(orientation), supports_mobile=VALUES(supports_mobile), sdk_integrated=VALUES(sdk_integrated),
    content_updated_at=NOW(6);

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id,0,0,0,0 FROM game WHERE slug='marine-command'
ON DUPLICATE KEY UPDATE play_count=play_count;

INSERT INTO game_tag_map (game_id,tag_slug)
SELECT g.id,t.slug FROM game g CROSS JOIN
    (SELECT 'rpg' AS slug UNION ALL SELECT 'strategy' UNION ALL SELECT 'defense') t
WHERE g.slug='marine-command' AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug=t.slug)
ON DUPLICATE KEY UPDATE tag_slug=VALUES(tag_slug);
