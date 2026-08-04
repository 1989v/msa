-- 황야의 무법자 — 스타 유즈맵 '마린키우기' 계열(부대 육성 + 합성 도박 + 전진 돌파)을
-- 서부극 테마의 원작 캐릭터/명칭으로 재구성. portal-fe 정적 자산(IFRAME).

INSERT INTO game_tag (slug, name, display_order) VALUES
    ('squad', 'Squad', 13),
    ('western', 'Western', 14);

INSERT INTO game (slug, title, description, thumbnail_url, cover_url, engine_type, load_type, entry_url,
                  orientation, supports_mobile, developer_name, sdk_integrated, status, genre, tags,
                  released_at, content_updated_at, created_at, updated_at)
VALUES
    ('outlaw-frontier', '황야의 무법자',
     '떠돌이 한 명으로 시작해 무법지대를 서쪽으로 밀고 나가는 부대 육성 게임. 현상금으로 동료를 모으고 둘을 갈아 넣어 상위 등급을 도박한다. 동료가 죽으면 사망 점수가 쌓이고, 한계를 넘으면 여정은 끝난다.',
     '/games/thumbs/outlaw-frontier.svg', NULL, 'CANVAS_TS', 'IFRAME', '/games/outlaw-frontier/index.html',
     'LANDSCAPE', 0, 'kgd', 1, 'PUBLISHED', 'STRATEGY', '["squad","western","roguelike","strategy"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.tag_slug
FROM game g
         JOIN (SELECT 'outlaw-frontier' AS slug, 'squad' AS tag_slug
               UNION ALL SELECT 'outlaw-frontier', 'western'
               UNION ALL SELECT 'outlaw-frontier', 'roguelike'
               UNION ALL SELECT 'outlaw-frontier', 'strategy') t ON t.slug = g.slug;

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'outlaw-frontier';
