-- 잿불 원정대를 베타로 표기한다. 상태는 PUBLISHED 로 유지한다 —
-- GameStatus.BETA 는 공개 목록에서 빠지므로(PUBLIC_STATUSES = {PUBLISHED}) 피드백을 받을 수 없다.
-- 노출은 그대로 두고 카드/상세에 배지로만 알린다.
-- 함께: 2인 로컬 협동인데 V34 에서 '2p' 태그가 빠져 있었다.
--
-- 두 INSERT 모두 충돌을 흡수한다. 마이그레이션 실패는 앱 기동 실패(= 운영 장애)로 이어지는데,
-- 여기서 얻는 것은 태그 두 줄뿐이라 그 위험을 감수할 이유가 없다.
-- (game_tag.slug 와 game_tag_map(game_id, tag_slug) 이 각각 UNIQUE)

INSERT INTO game_tag (slug, name, display_order)
VALUES ('beta', 'Beta', 1) -- 상태 배지이므로 장르 태그들보다 앞에 온다 (10 은 multiplayer·roguelike 가 쓴다)
ON DUPLICATE KEY UPDATE name = VALUES(name), display_order = VALUES(display_order);

INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'beta' AS slug UNION ALL SELECT '2p') t
WHERE g.slug = 'ashen-warband';

UPDATE game
SET tags               = '["beta","2p","leaderboard"]',
    content_updated_at = NOW(6)
WHERE slug = 'ashen-warband';
