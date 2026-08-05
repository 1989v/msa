-- 유즈맵 팩 2차 — 스타/워3 인기 유즈맵 시스템 차용(명칭·테마·아트는 전부 창작, IP 가드레일).
-- 오토배틀 라인전 / 탄막 회피 / 랜덤 머지 디펜스 / 미니 AoS. 전부 랭킹(game_score) + 한/영 i18n 내장.

INSERT INTO game_tag (slug, name, display_order) VALUES
    ('auto-battle', 'Auto Battle', 26),
    ('aos', 'AoS', 27);

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('crimson-ravine', '핏빛 협곡',
     '핏빛 협곡의 라인전 오토배틀. 이빨 망령·가시 궁사·골암 거인의 편성 비중을 바꾸고 혈정으로 강화하며, 스스로 싸우는 부대로 적 제단을 무너뜨려라.',
     'Crimson Ravine',
     'An auto-battle lane war in a blood-red ravine. Shift your spawn mix of wraiths, archers and golems, spend blood shards on upgrades, and let your self-fighting horde topple the enemy altar.',
     '/games/thumbs/shots/crimson-ravine.png', NULL, 'CANVAS_TS', 'IFRAME', '/games/crimson-ravine/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'STRATEGY', '["auto-battle","strategy","survival"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('storm-corridor', '뇌우 회랑',
     '번개가 몰아치는 회랑에서 탄막을 피해 버티는 생존 액션. 20초마다 페이즈가 오르고 패턴이 겹친다 — 실드 3개로 얼마나 오래 버틸까.',
     'Storm Corridor',
     'Dodge crackling barrages in a storm-lit corridor. Every 20 seconds the phase rises and patterns stack — how long can three shields last?',
     '/games/thumbs/shots/storm-corridor.png', NULL, 'CANVAS_TS', 'IFRAME', '/games/storm-corridor/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'ACTION', '["dodge","arcade-action"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('dice-citadel', '주사위 성채',
     '뽑기 운과 합성 전략의 랜덤 디펜스. 무작위 속성·자리에 소환되는 타워를 같은 등급끼리 합쳐 키우고, 성채를 도는 20웨이브를 막아라.',
     'Dice Citadel',
     'A random defense of dice luck and merge strategy. Fuse same-grade towers of fire, frost and venom, and hold 20 waves circling your citadel.',
     '/games/thumbs/shots/dice-citadel.png', NULL, 'CANVAS_TS', 'IFRAME', '/games/dice-citadel/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'DEFENSE', '["defense","strategy","merge"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('rift-front', '균열 전선',
     '단일 전선 미니 AoS. 크립 웨이브에 몸을 싣고 스킬로 전선을 밀어 올려, 수호탑을 넘어 적 균열 첨탑을 파괴하라. 죽음은 8초의 공백일 뿐.',
     'Rift Front',
     'A single-lane mini AoS. Ride the creep waves, push with your two skills, break the guard towers and bring down the enemy rift spire. Death costs you only eight seconds.',
     '/games/thumbs/shots/rift-front.png', NULL, 'CANVAS_TS', 'IFRAME', '/games/rift-front/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'STRATEGY', '["aos","strategy","action"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, m.tag_slug
FROM game g
         JOIN (SELECT 'crimson-ravine' AS slug, 'auto-battle' AS tag_slug
               UNION ALL SELECT 'crimson-ravine', 'strategy'
               UNION ALL SELECT 'crimson-ravine', 'survival'
               UNION ALL SELECT 'storm-corridor', 'dodge'
               UNION ALL SELECT 'storm-corridor', 'arcade-action'
               UNION ALL SELECT 'dice-citadel', 'defense'
               UNION ALL SELECT 'dice-citadel', 'strategy'
               UNION ALL SELECT 'rift-front', 'aos'
               UNION ALL SELECT 'rift-front', 'strategy') m ON m.slug = g.slug;

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug IN ('crimson-ravine', 'storm-corridor', 'dice-citadel', 'rift-front');
