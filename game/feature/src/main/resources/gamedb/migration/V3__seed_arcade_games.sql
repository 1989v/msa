-- #23 아케이드 흡수 — 캔버스 게임 2종을 카탈로그에 등록.
-- 두 게임 모두 portal-fe 정적 자산(/games/{slug}/index.html)이라 서빙 파드가 늘지 않는다.
-- Overworld Quest 는 원본 파일명(zeld)이 상표를 연상시켜 중립 명칭으로 등록한다.

INSERT INTO game_tag (slug, name, display_order) VALUES
    ('arcade-action', 'Action', 7),
    ('rpg', 'RPG', 8),
    ('leaderboard', 'Leaderboard', 9);

INSERT INTO game (slug, title, description, thumbnail_url, cover_url, engine_type, load_type, entry_url,
                  orientation, supports_mobile, developer_name, sdk_integrated, status, tags,
                  released_at, content_updated_at, created_at, updated_at)
VALUES
    ('snake', 'Snake Arcade',
     '먹이를 먹을수록 길어지는 클래식 스네이크. 입력 기록을 서버가 재실행해 점수를 검증하므로 랭킹 위조가 통하지 않는다.',
     '/games/thumbs/snake.svg', NULL, 'CANVAS_TS', 'IFRAME', '/games/snake/index.html',
     'BOTH', 1, 'kgd', 0, 'PUBLISHED', '["arcade","leaderboard","casual","arcade-action"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('overworld-quest', 'Overworld Quest',
     '오픈월드를 돌아다니며 던전을 정복하는 액션 RPG. 검을 강화하고 골드를 모아 모든 던전을 클리어한다.',
     '/games/thumbs/overworld-quest.svg', NULL, 'CANVAS_TS', 'IFRAME', '/games/overworld-quest/index.html',
     'LANDSCAPE', 0, 'kgd', 0, 'PUBLISHED', '["rpg","arcade-action","arcade"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.tag_slug
FROM game g
         JOIN (SELECT 'snake' AS slug, 'arcade' AS tag_slug
               UNION ALL SELECT 'snake', 'leaderboard'
               UNION ALL SELECT 'snake', 'casual'
               UNION ALL SELECT 'snake', 'arcade-action'
               UNION ALL SELECT 'overworld-quest', 'rpg'
               UNION ALL SELECT 'overworld-quest', 'arcade-action'
               UNION ALL SELECT 'overworld-quest', 'arcade') t ON t.slug = g.slug;

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug IN ('snake', 'overworld-quest');

-- Editor's Pick 큐레이션에 두 게임 추가 (기존 목록 뒤에 append)
UPDATE game_collection
SET game_ids = JSON_ARRAY_APPEND(
        JSON_ARRAY_APPEND(game_ids, '$', (SELECT id FROM game WHERE slug = 'snake')),
        '$', (SELECT id FROM game WHERE slug = 'overworld-quest'))
WHERE slug = 'editors-pick';
