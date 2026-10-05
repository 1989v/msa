-- 대전 디펜스: local AI opponent, 15 waves. Catalog registration only.
INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url,
                  engine_type, load_type, entry_url, orientation, supports_mobile, developer_name,
                  sdk_integrated, status, genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES ('duel-defense', '대전 디펜스',
        'AI 상대와 독립 성문을 지키는 15웨이브 전략 디펜스. 공용 군량을 수비 병사와 공격 부대에 배분하고, 수비 강화와 공격 연구로 편성을 성장시키세요.',
        'Duel Defense',
        'Defend your own gate against an AI opponent over 15 waves. Spend shared grain on defense or paid attacking troops, then improve your army with defense upgrades and attack research.',
        '/games/duel-defense/assets/battlefield.png', NULL, 'HTML5', 'IFRAME', '/games/duel-defense/index.html',
        'BOTH', 1, 'kgd', 0, 'BETA', 'STRATEGY', '["strategy","defense","beta"]', NULL,
        NOW(6), NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), title_en=VALUES(title_en),
    description_en=VALUES(description_en), thumbnail_url=VALUES(thumbnail_url), cover_url=VALUES(cover_url),
    engine_type=VALUES(engine_type), load_type=VALUES(load_type), entry_url=VALUES(entry_url),
    orientation=VALUES(orientation), supports_mobile=VALUES(supports_mobile), developer_name=VALUES(developer_name),
    sdk_integrated=VALUES(sdk_integrated), status=VALUES(status), genre=VALUES(genre), tags=VALUES(tags),
    score_boards=VALUES(score_boards), released_at=COALESCE(released_at,VALUES(released_at)),
    content_updated_at=NOW(6), updated_at=NOW(6);

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id,0,0,0,0 FROM game WHERE slug='duel-defense'
ON DUPLICATE KEY UPDATE play_count=play_count;

INSERT INTO game_tag_map (game_id,tag_slug)
SELECT g.id,t.slug FROM game g CROSS JOIN
    (SELECT 'strategy' AS slug UNION ALL SELECT 'defense' UNION ALL SELECT 'beta') t
WHERE g.slug='duel-defense' AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug=t.slug)
ON DUPLICATE KEY UPDATE tag_slug=VALUES(tag_slug);
