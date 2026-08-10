-- 역정규화된 game.tags 를 game_tag_map 과 다시 맞춘다.
--
-- V25 가 태그를 44→14 로 정리하면서 game_tag_map 만 고쳤다. 태그는 두 곳에 있다 —
-- 필터·검색은 map 을 쓰고, 카드/상세 화면에 찍히는 값은 game.tags(JSON 컬럼)다.
-- 그래서 목록 필터에는 새 태그가, 게임 카드에는 옛 태그(`micro`, `arcade-action` …)가
-- 남아 서로 어긋나 있었다. 같은 사실이 두 곳에 있으면 한 쪽만 고치는 실수가 난다.
--
-- 여기서는 map 을 단일 원본으로 보고 컬럼을 다시 만든다.
UPDATE game g
SET g.tags = COALESCE(
        (SELECT JSON_ARRAYAGG(m.tag_slug) FROM game_tag_map m WHERE m.game_id = g.id),
        JSON_ARRAY()
    );

-- 강철 결사대는 정리 과정에서 태그가 비었다. 병영(영구 강화)이 들어가 죽어도 누적되는
-- 구조가 됐으므로 로그라이크로 분류한다.
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT id, 'roguelike' FROM game WHERE slug = 'iron-vanguard';

UPDATE game g
SET g.tags = COALESCE(
        (SELECT JSON_ARRAYAGG(m.tag_slug) FROM game_tag_map m WHERE m.game_id = g.id),
        JSON_ARRAY()
    )
WHERE g.slug = 'iron-vanguard';
