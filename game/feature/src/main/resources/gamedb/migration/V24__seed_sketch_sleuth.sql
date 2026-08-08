-- 그림 탐정단 — 온라인 대전 릴레이(ADR-0059 후속)를 쓰는 두 번째 게임.
-- 릴레이는 규칙을 모르므로(불투명 중계) 판정은 매 라운드 그리는 쪽이 맡는다.
-- 좌표를 정수 격자로 양자화 + 델타 인코딩 + 120ms 배칭으로 상한(4KB·20msg/s) 안에서 붓질을 전송한다.

INSERT INTO game_tag (slug, name, display_order) VALUES
    ('drawing', 'Drawing', 43),
    ('online', 'Online', 44);

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('sketch-sleuth', '그림 탐정단',
     '한 명이 그리고 한 명이 맞히는 온라인 6라운드. 붓질이 실시간으로 상대 화면에 그려지고, 90초가 흐르는 동안 글자 수·첫 글자 순으로 힌트가 열린다. 빠른 매칭이나 방 코드로 친구와 바로.',
     'Sketch Sleuth',
     'One draws, one guesses — six rounds online. Every stroke appears on your partner''s screen in real time, and over ninety seconds the hints open up from letter count to first letter. Quick match, or share a room code with a friend.',
     '/games/thumbs/art/sketch-sleuth.svg', NULL, 'HTML5', 'IFRAME', '/games/sketch-sleuth/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'VERSUS', '["online","drawing","party"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, m.tag_slug
FROM game g
         JOIN (SELECT 'sketch-sleuth' AS slug, 'online' AS tag_slug
               UNION ALL SELECT 'sketch-sleuth', 'drawing'
               UNION ALL SELECT 'sketch-sleuth', 'party') m ON m.slug = g.slug;

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'sketch-sleuth';

-- 메아리 결투는 V7 시드 이후 온라인 모드가 붙었다 — 태그로 드러내 온라인 게임이 함께 묶이게 한다.
INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, 'online' FROM game g WHERE g.slug = 'echo-duel';
UPDATE game SET tags = JSON_ARRAY('versus', '2p', 'party', 'online'), content_updated_at = NOW(6)
WHERE slug = 'echo-duel';
