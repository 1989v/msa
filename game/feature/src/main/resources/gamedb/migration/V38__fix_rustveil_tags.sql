-- V36 이 '2p' 를 태그로 썼다. V13 에서 만들어졌다가 **V25 에서 'multiplayer' 로 통합되며
-- game_tag / game_tag_map 양쪽에서 삭제된 슬러그**다 (V25 3~4단계의 DELETE).
-- 죽은 슬러그를 다시 쓰면 카드에는 칩이 뜨는데 태그 목록·필터에는 없는 유령 태그가 된다.
-- V25 가 정한 흡수 규칙(2p → multiplayer)을 그대로 따른다. 2인 로컬 협동이므로 의미도 맞다.
--
-- V36 을 고치지 않고 새 마이그레이션으로 정정하는 이유: 이미 푸시된 마이그레이션을 수정하면
-- 적용된 환경에서 Flyway 체크섬 검증이 깨지고, 그건 앱 기동 실패로 이어진다.

UPDATE game
SET tags               = '["beta","multiplayer","survival","open-world","leaderboard"]',
    content_updated_at = NOW(6)
WHERE slug = 'rustveil-holdout';

INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT g.id, 'multiplayer'
FROM game g
WHERE g.slug = 'rustveil-holdout';
