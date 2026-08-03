-- 신규 게임 2종 — save/run 시스템(V5)과 배틀 sim 공식을 실사용하는 첫 게임들.
-- 둘 다 portal-fe 정적 자산(IFRAME)이라 서빙 파드 증가 0.

INSERT INTO game_tag (slug, name, display_order) VALUES
    ('roguelike', 'Roguelike', 10),
    ('monster', 'Monster', 11),
    ('turn-based', 'Turn-based', 12);

INSERT INTO game (slug, title, description, thumbnail_url, cover_url, engine_type, load_type, entry_url,
                  orientation, supports_mobile, developer_name, sdk_integrated, status, genre, tags,
                  released_at, content_updated_at, created_at, updated_at)
VALUES
    ('depth-delver', 'Depth Delver',
     '서버가 발급한 시드로 매 런 같은 던전이 열리는 로그라이크. 죽어도 골드는 남는다 — 영구 강화를 사서 지하 6층을 정복하자. 세이브스커밍은 통하지 않는다.',
     '/games/thumbs/depth-delver.svg', NULL, 'CANVAS_TS', 'IFRAME', '/games/depth-delver/index.html',
     'LANDSCAPE', 0, 'kgd', 1, 'PUBLISHED', 'RPG', '["roguelike","rpg","arcade","turn-based"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('monster-tamer', 'Monster Tamer',
     '풀숲에서 야생 몬스터를 만나 배틀하고 포획해 도감을 채우는 수집 RPG. 배틀은 서버 sim 코어와 동일한 타입 상성 공식으로 계산된다.',
     '/games/thumbs/monster-tamer.svg', NULL, 'CANVAS_TS', 'IFRAME', '/games/monster-tamer/index.html',
     'LANDSCAPE', 0, 'kgd', 1, 'PUBLISHED', 'RPG', '["monster","rpg","turn-based","casual"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.tag_slug
FROM game g
         JOIN (SELECT 'depth-delver' AS slug, 'roguelike' AS tag_slug
               UNION ALL SELECT 'depth-delver', 'rpg'
               UNION ALL SELECT 'depth-delver', 'arcade'
               UNION ALL SELECT 'depth-delver', 'turn-based'
               UNION ALL SELECT 'monster-tamer', 'monster'
               UNION ALL SELECT 'monster-tamer', 'rpg'
               UNION ALL SELECT 'monster-tamer', 'turn-based'
               UNION ALL SELECT 'monster-tamer', 'casual') t ON t.slug = g.slug;

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug IN ('depth-delver', 'monster-tamer');

UPDATE game_collection
SET game_ids = JSON_ARRAY_APPEND(
        JSON_ARRAY_APPEND(game_ids, '$', (SELECT id FROM game WHERE slug = 'depth-delver')),
        '$', (SELECT id FROM game WHERE slug = 'monster-tamer'))
WHERE slug = 'editors-pick';
