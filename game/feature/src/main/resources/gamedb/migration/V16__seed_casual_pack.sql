-- 인기 캐주얼 장르 4종 — 방치형/머지 퍼즐/원버튼 아케이드/벽돌깨기.
-- 전부 이어하기 코드 세이브 + 랭킹(game_score) + 모바일 네이티브 조작 내장.

INSERT INTO game_tag (slug, name, display_order) VALUES
    ('idle', 'Idle', 23),
    ('merge', 'Merge', 24),
    ('one-button', 'One Button', 25);

INSERT INTO game (slug, title, description, thumbnail_url, cover_url, engine_type, load_type, entry_url,
                  orientation, supports_mobile, developer_name, sdk_integrated, status, genre, tags,
                  released_at, content_updated_at, created_at, updated_at)
VALUES
    ('golden-forge', '황금 대장간',
     '모루를 두드려 금을 벼리는 방치형 클리커. 자동 망치·풀무 도제·화룡을 고용하고, 별의 담금질로 회차 영구 배수를 쌓는다. 잠든 사이에도 화로는 식지 않는다(오프라인 최대 8시간).',
     '/games/thumbs/shots/golden-forge.png', NULL, 'CANVAS_TS', 'IFRAME', '/games/golden-forge/index.html',
     'BOTH', 1, 'kgd', 1, 'PUBLISHED', 'CASUAL', '["idle","casual"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('rune-merge', '룬 합성',
     '같은 룬을 밀어 합쳐 고대의 문양을 완성하는 4×4 머지 퍼즐. 무르기 1회, 4096룬이 목표. 스와이프/방향키.',
     '/games/thumbs/shots/rune-merge.png', NULL, 'CANVAS_TS', 'IFRAME', '/games/rune-merge/index.html',
     'BOTH', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["merge","puzzle","casual"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('cave-glide', '동굴 활강',
     '누르면 날개짓, 놓으면 활강. 좁아지는 동굴을 멀리 나는 원버튼 아케이드 — 종유석을 피하고 수정을 모아라.',
     '/games/thumbs/shots/cave-glide.png', NULL, 'CANVAS_TS', 'IFRAME', '/games/cave-glide/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'ARCADE', '["one-button","arcade","casual"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('wall-breaker', '성벽 파쇄',
     '공성추 구슬로 성벽을 무너뜨리는 벽돌깨기. 내구도 3단 벽돌, 보급품 4종(확장/분열/관통/저속), 갈수록 좁아지는 발판.',
     '/games/thumbs/shots/wall-breaker.png', NULL, 'CANVAS_TS', 'IFRAME', '/games/wall-breaker/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'ARCADE', '["arcade","casual"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.tag_slug
FROM game g
         JOIN (SELECT 'golden-forge' AS slug, 'idle' AS tag_slug
               UNION ALL SELECT 'golden-forge', 'casual'
               UNION ALL SELECT 'rune-merge', 'merge'
               UNION ALL SELECT 'rune-merge', 'puzzle'
               UNION ALL SELECT 'cave-glide', 'one-button'
               UNION ALL SELECT 'cave-glide', 'arcade'
               UNION ALL SELECT 'wall-breaker', 'arcade'
               UNION ALL SELECT 'wall-breaker', 'casual') t ON t.slug = g.slug;

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug IN ('golden-forge', 'rune-merge', 'cave-glide', 'wall-breaker');
