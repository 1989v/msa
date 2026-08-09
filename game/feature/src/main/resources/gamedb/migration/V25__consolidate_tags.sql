-- 태그 체계 정리: 44종 → 14종.
--
-- 문제: 태그의 절반이 genre 와 중복이었다(ARCADE 게임에 'arcade', PUZZLE 게임에 'puzzle' …).
-- 나머지 절반은 1~2개짜리 파편이라 필터로서 의미가 없었고, 목록 상단이 칩 44개로 3줄을 차지했다.
-- 'action' 과 'arcade-action'(표시명도 둘 다 "Action") 같은 중복,
-- game_tag 행이 없는 채 매핑만 존재하는 'card' 같은 유령 태그도 있었다.
--
-- 정리 원칙 — 축을 분리한다:
--   genre  = 대분류 9종. 이미 SEO URL(/games/genre/*)로 승격돼 있으므로 손대지 않는다.
--   tag    = **플레이 속성**만. genre 로 알 수 있는 것은 태그로 반복하지 않는다.
-- Steam 의 Categories(멀티플레이 등) + 상위 태그 어휘를 참고했다.
-- 'education' 은 장르가 아닌 축으로 살린다 — 코드 사전 연계 학습 게임 표식이라
-- ARCADE/PUZZLE 게임에도 붙는다.

-- 1) 목표 태그 보장 (display_order = 목록 노출 순서)
INSERT INTO game_tag (slug, name, display_order)
VALUES ('multiplayer', 'Multiplayer', 10),
       ('roguelike', 'Roguelike', 20),
       ('idle', 'Idle', 30),
       ('daily', 'Daily', 40),
       ('turn-based', 'Turn-based', 50),
       ('survival', 'Survival', 60),
       ('word', 'Word & Quiz', 70),
       ('physics', 'Physics', 80),
       ('one-button', 'One Button', 90),
       ('leaderboard', 'Leaderboard', 100),
       ('party', 'Party', 110),
       ('sports', 'Sports', 120),
       ('open-world', 'Open World', 130),
       ('education', 'Education', 140)
ON DUPLICATE KEY UPDATE name          = VALUES(name),
                        display_order = VALUES(display_order);

-- 2) 흡수 매핑. uk_game_tag(game_id, tag_slug) 충돌은 무시한다 — 이미 목표 태그를 가진 게임.
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT game_id, 'multiplayer' FROM game_tag_map WHERE tag_slug IN ('online', '2p', 'aos');
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT game_id, 'roguelike' FROM game_tag_map WHERE tag_slug IN ('survivors');
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT game_id, 'idle' FROM game_tag_map WHERE tag_slug IN ('merge', 'collection', 'auto-battle', 'factory');
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT game_id, 'turn-based' FROM game_tag_map WHERE tag_slug IN ('board', 'card', 'deckbuilder');
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT game_id, 'survival' FROM game_tag_map WHERE tag_slug IN ('monster');
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT game_id, 'word' FROM game_tag_map WHERE tag_slug IN ('typing', 'quiz');
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT game_id, 'one-button' FROM game_tag_map WHERE tag_slug IN ('dodge', 'rhythm');
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT game_id, 'leaderboard' FROM game_tag_map WHERE tag_slug IN ('io');
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT game_id, 'party' FROM game_tag_map WHERE tag_slug IN ('drawing');
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT game_id, 'open-world' FROM game_tag_map WHERE tag_slug IN ('adventure');

-- 3) 최종 세트 밖 매핑 제거 (genre 중복분 + 파편 + 유령 태그)
DELETE
FROM game_tag_map
WHERE tag_slug NOT IN ('multiplayer', 'roguelike', 'idle', 'daily', 'turn-based', 'survival', 'word',
                       'physics', 'one-button', 'leaderboard', 'party', 'sports', 'open-world', 'education');

-- 4) 최종 세트 밖 태그 제거
DELETE
FROM game_tag
WHERE slug NOT IN ('multiplayer', 'roguelike', 'idle', 'daily', 'turn-based', 'survival', 'word',
                   'physics', 'one-button', 'leaderboard', 'party', 'sports', 'open-world', 'education');
