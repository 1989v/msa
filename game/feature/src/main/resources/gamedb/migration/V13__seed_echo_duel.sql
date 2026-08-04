-- 메아리 결투 — '시장에 가면' 방식의 교대 시퀀스 파티 게임 (2인 핫시트 + 1인 수련)

INSERT INTO game_tag (slug, name, display_order) VALUES
    ('party', 'Party', 21),
    ('2p', '2 Players', 22);

INSERT INTO game (slug, title, description, thumbnail_url, cover_url, engine_type, load_type, entry_url,
                  orientation, supports_mobile, developer_name, sdk_integrated, status, genre, tags,
                  released_at, content_updated_at, created_at, updated_at)
VALUES
    ('echo-duel', '메아리 결투',
     '"시장에 가면~" 놀이의 결투판. 앞사람의 방향 절차를 그대로 되풀이하고 끝에 하나를 더 얹는다 — 먼저 틀리는 쪽이 진다. 한 키보드 2인 결투와 혼자 수련 모드.',
     '/games/thumbs/shots/echo-duel.png', NULL, 'CANVAS_TS', 'IFRAME', '/games/echo-duel/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'CASUAL', '["party","2p","casual"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.tag_slug
FROM game g
         JOIN (SELECT 'echo-duel' AS slug, 'party' AS tag_slug
               UNION ALL SELECT 'echo-duel', '2p'
               UNION ALL SELECT 'echo-duel', 'casual') t ON t.slug = g.slug;

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'echo-duel';
