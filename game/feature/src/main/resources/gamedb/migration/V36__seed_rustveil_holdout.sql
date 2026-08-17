-- 클린룸 6호 '녹빛 봉쇄구역' 등록. 상태는 BETA 로 넣는다.
-- V35(ashen-warband)는 PUBLISHED + 'beta' 태그로 배지를 붙였는데, 그건 PUBLIC_STATUSES 가
-- {PUBLISHED} 뿐이라 BETA 로 두면 목록에서 사라졌기 때문이다. 그 제약을 이번에 풀었다 —
-- 공개 목록은 이제 '플레이 가능한 상태'(PUBLISHED, BETA)를 싣는다. 그래서 상태값이 실제와 맞고,
-- 광고/수익화는 Game.isMonetizable()(PUBLISHED 전용)이 계속 막는다.
-- FE 는 두 신호(status=BETA · 'beta' 태그)를 모두 배지로 렌더하므로 두 게임이 같게 보인다.

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('rustveil-holdout', '녹빛 봉쇄구역',
     '쿼터뷰 좀비 아포칼립스 생존·건설·디펜스. 11×11 = 121구역짜리 도시를 돌며 파밍하고, 낮에 방어선을 세워 밤의 습격을 막는다. 감염체 23종은 행동 축이 전부 다르고, 총을 쏘고 도망치고 창고를 터는 강도 7종이 제3세력으로 끼어든다. 무전 중계탑을 켜면 지도가 열리고 그 사이를 오갈 수 있다. 2인 로컬 협동 지원. 그래픽·사운드 전부 절차 생성.',
     'Rustveil Holdout',
     'A quarter-view zombie survival, base-building and defense game. Scavenge a 121-district city across five quarantine rings, raise your walls by day and hold the line at night. Twenty-three infected types each behave differently, while seven bandit classes shoot, flee and loot your storage as a third faction. Power up radio masts to unlock fast travel across the map. Two-player local co-op. All art and audio generated in code.',
     '/games/thumbs/shots/rustveil-holdout.png', NULL, 'HTML5', 'IFRAME', '/games/rustveil-holdout/index.html',
     'LANDSCAPE', 0, 'kgd', 1, 'BETA',
     'ACTION', '["beta","2p","survival","open-world","leaderboard"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

-- 태그 매핑. 'beta' 는 V35 에서 신설됐지만 순서 의존을 만들지 않도록 여기서도 흡수형으로 보장한다.
INSERT INTO game_tag (slug, name, display_order)
VALUES ('beta', 'Beta', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), display_order = VALUES(display_order);

-- 매핑에는 game_tag 에 실재하는 슬러그만 넣는다. tag_slug 에 FK 가 없어 아무 문자열이나 들어가지만,
-- 없는 슬러그를 넣으면 태그 목록(`/tags`)에 없는데 필터로는 걸리는 유령 태그가 된다.
-- '2p' 는 카드 칩 표기용이라 JSON tags 컬럼에만 둔다 (칩은 그 컬럼을 렌더한다).
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'beta' AS slug
                     UNION ALL SELECT 'survival'
                     UNION ALL SELECT 'open-world'
                     UNION ALL SELECT 'leaderboard') t
WHERE g.slug = 'rustveil-holdout';

INSERT IGNORE INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'rustveil-holdout';
