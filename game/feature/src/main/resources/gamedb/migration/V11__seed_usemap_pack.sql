-- 유즈맵 클래식 5종 — 스타 유즈맵 인기 장르(입구막기/터렛D/컨트롤/바운드/살아남기)를
-- 원작 캐릭터·명칭으로 재구성. 전부 portal-fe 정적 자산(IFRAME), 서빙 파드 증가 0.

INSERT INTO game_tag (slug, name, display_order) VALUES
    ('defense', 'Defense', 15),
    ('micro', 'Micro', 16),
    ('dodge', 'Dodge', 17),
    ('survival', 'Survival', 18),
    ('strategy', 'Strategy', 19),   -- V10 tag_map 이 참조하지만 실체가 없던 태그 보충
    ('action', 'Action', 20);

INSERT INTO game (slug, title, description, thumbnail_url, cover_url, engine_type, load_type, entry_url,
                  orientation, supports_mobile, developer_name, sdk_integrated, status, genre, tags,
                  released_at, content_updated_at, created_at, updated_at)
VALUES
    ('gate-holdout', '성문 사수',
     '길목에 망루를 세우고 궁수를 채워 야만족 20라운드를 막는 방어전. 망루는 부서진다 — 수리공 운용이 승부를 가른다.',
     '/games/thumbs/gate-holdout.svg', NULL, 'CANVAS_TS', 'IFRAME', '/games/gate-holdout/index.html',
     'LANDSCAPE', 0, 'kgd', 1, 'PUBLISHED', 'STRATEGY', '["defense","strategy"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('gear-bastion', '태엽 포탑',
     '골렘 군단이 정해진 길로 행진한다. 포탑 4종을 조합해 25웨이브를 막아라 — 비행 골렘은 길을 무시하니 대공을 섞어야 한다.',
     '/games/thumbs/gear-bastion.svg', NULL, 'CANVAS_TS', 'IFRAME', '/games/gear-bastion/index.html',
     'LANDSCAPE', 0, 'kgd', 1, 'PUBLISHED', 'STRATEGY', '["defense","strategy"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('iron-vanguard', '강철 결사대',
     '주어진 넷으로 몰려오는 무리를 컨트롤로 잡아내는 마이크로 게임. 궁수는 치고 빠지고, 기사가 막고, 사제가 살린다. 죽은 대원은 돌아오지 않는다.',
     '/games/thumbs/iron-vanguard.svg', NULL, 'CANVAS_TS', 'IFRAME', '/games/iron-vanguard/index.html',
     'LANDSCAPE', 0, 'kgd', 1, 'PUBLISHED', 'ACTION', '["micro","action"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('ember-temple', '화염 신전',
     '바닥이 불을 뿜는 신전을 건너는 회피 게임. 붉게 달아오르는 칸을 읽고 8개의 방을 통과하라 — 죽음은 세되 끝은 없다.',
     '/games/thumbs/ember-temple.svg', NULL, 'CANVAS_TS', 'IFRAME', '/games/ember-temple/index.html',
     'LANDSCAPE', 0, 'kgd', 1, 'PUBLISHED', 'ARCADE', '["dodge","arcade"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('frost-outpost', '혹한 전초기지',
     '광부가 수정을 캐고, 협곡 입구를 방벽·포탑으로 틀어막고 12분을 버티는 생존 RTS. 수정은 유한하다 — 아껴 쓰고 버텨라.',
     '/games/thumbs/frost-outpost.svg', NULL, 'CANVAS_TS', 'IFRAME', '/games/frost-outpost/index.html',
     'LANDSCAPE', 0, 'kgd', 1, 'PUBLISHED', 'STRATEGY', '["survival","defense","strategy"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.tag_slug
FROM game g
         JOIN (SELECT 'gate-holdout' AS slug, 'defense' AS tag_slug
               UNION ALL SELECT 'gate-holdout', 'strategy'
               UNION ALL SELECT 'gear-bastion', 'defense'
               UNION ALL SELECT 'gear-bastion', 'strategy'
               UNION ALL SELECT 'iron-vanguard', 'micro'
               UNION ALL SELECT 'ember-temple', 'dodge'
               UNION ALL SELECT 'ember-temple', 'arcade'
               UNION ALL SELECT 'frost-outpost', 'survival'
               UNION ALL SELECT 'frost-outpost', 'defense') t ON t.slug = g.slug;

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game
WHERE slug IN ('gate-holdout', 'gear-bastion', 'iron-vanguard', 'ember-temple', 'frost-outpost');
