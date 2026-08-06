-- 확장 팩 2차 — 7종 (2026-08-06 확장 리서치의 B 클러스터 "히트 장르" 중심).
-- 서바이버류 2종 · 카드 로그라이크 2종 · 인크리멘탈 로그라이트 1종 · 물리 1종 · 수집 1종.
-- V20 과 동일 규약: 단일 HTML 자기완결 + 랭킹(game_score) + 한/영 i18n + 모바일 입력.

INSERT INTO game_tag (slug, name, display_order) VALUES
    ('deckbuilder', 'Deckbuilder', 39),
    ('collection', 'Collection', 40);

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('midnight-tide', '심야 파도',
     '심해 괴수가 밀려오는 20분을 버텨라. 무기는 알아서 쏘고 당신은 피하기만 한다 — 진주를 모아 여섯 무기와 여섯 특성을 키우고, 조건이 맞으면 무기가 진화한다. 5분마다 보스.',
     'Midnight Tide',
     'Survive twenty minutes as the deep swarms in. Your weapons fire themselves — you only dodge. Collect pearls to grow six weapons and six passives, and evolve a weapon once its passive matches. A boss every five minutes.',
     '/games/thumbs/art/midnight-tide.svg', NULL, 'HTML5', 'IFRAME', '/games/midnight-tide/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'ACTION', '["survivors","action","roguelike"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('spud-arena', '감자 투기장',
     '감자 전사 셋 중 하나로 열두 웨이브를 버틴다. 무기 여섯 종은 같은 것끼리 합쳐 4티어까지 오르고, 상점 아이템 서른 종에는 대가가 붙은 것도 있다 — 마지막은 매셔 킹.',
     'Spud Arena',
     'Pick one of three potato fighters and hold twelve waves. Six weapon types fuse with their own kind up to tier four, and some of the thirty shop items charge you a stat to give one — the Masher King closes the run.',
     '/games/thumbs/art/spud-arena.svg', NULL, 'HTML5', 'IFRAME', '/games/spud-arena/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'ACTION', '["survivors","action","strategy"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('hand-alchemy', '족보 연성소',
     '포커 족보를 연성해 안테 여덟 관문을 돌파하는 로그라이크. 시약 스무 종이 배수와 점수를 뒤틀고, 폐기를 아끼는 빌드와 폐기로 먹고사는 빌드가 정면으로 충돌한다.',
     'Hand Alchemy',
     'Transmute poker hands through eight antes of escalating targets. Twenty elixirs bend multipliers and chips, pitting builds that hoard discards against builds that feed on them.',
     '/games/thumbs/art/hand-alchemy.svg', NULL, 'HTML5', 'IFRAME', '/games/hand-alchemy/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'STRATEGY', '["card","roguelike","strategy"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('element-pilgrim', '원소 순례자',
     '화염·서리·대지·공허 마흔 장으로 3막을 오르는 덱빌딩. 한 턴에 서로 다른 원소를 겹칠수록 공명이 터진다 — 네 원소를 모두 쓰면 에너지가 돌아온다.',
     'Element Pilgrim',
     'Climb three acts with forty cards of flame, frost, earth and void. Resonance triggers when a single turn mixes elements — use all four and the energy comes back to you.',
     '/games/thumbs/art/element-pilgrim.svg', NULL, 'HTML5', 'IFRAME', '/games/element-pilgrim/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'STRATEGY', '["deckbuilder","card","roguelike"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('relic-heir', '유물 계승자',
     '한 번의 탐사가 한 세대다. 유적은 깊어질수록 대원을 잡아먹고, 전멸하면 수확의 절반이 사라진다 — 언제 철수할지가 가문의 명운이다. 유산은 다음 계승자에게 남는다.',
     'Relic Heir',
     'One expedition is one generation. The ruin grows hungrier with depth and a wipe costs half your haul — knowing when to withdraw is the family fortune. What you inherit passes to the next heir.',
     '/games/thumbs/art/relic-heir.svg', NULL, 'HTML5', 'IFRAME', '/games/relic-heir/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'CASUAL', '["idle","roguelike","collection"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('cliff-climber', '절벽 등반가',
     '피켈 하나로 300m 절벽을 오른다. 체크포인트는 없다 — 처마에서 손이 미끄러지면 초입까지 떨어진다. 빙벽과 굴뚝을 지나 폭풍의 마루에 서라.',
     'Cliff Climber',
     'One pickaxe, three hundred meters of rock. There are no checkpoints — slip on the overhang and you fall back to the foot. Past the ice wall and the chimney waits the storm ridge.',
     '/games/thumbs/art/cliff-climber.svg', NULL, 'HTML5', 'IFRAME', '/games/cliff-climber/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'ARCADE', '["physics","arcade","survival"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('moon-angler', '달빛 낚시터',
     '던지고, 기다리고, 챔질하고, 릴을 감는다. 물고기마다 성격이 달라 온순한 놈은 따라오고 교활한 놈은 멈췄다 튄다 — 달이 뜬 시간에는 귀한 놈이 문다.',
     'Moon Angler',
     'Cast, wait, strike, reel. Every fish fights its own way — the gentle ones drift, the cunning ones freeze then bolt — and the rarest bite only while the moon is up.',
     '/games/thumbs/art/moon-angler.svg', NULL, 'HTML5', 'IFRAME', '/games/moon-angler/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'CASUAL', '["collection","casual","idle"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, m.tag_slug
FROM game g
         JOIN (SELECT 'midnight-tide' AS slug, 'survivors' AS tag_slug
               UNION ALL SELECT 'midnight-tide', 'action'
               UNION ALL SELECT 'midnight-tide', 'roguelike'
               UNION ALL SELECT 'spud-arena', 'survivors'
               UNION ALL SELECT 'spud-arena', 'action'
               UNION ALL SELECT 'spud-arena', 'strategy'
               UNION ALL SELECT 'hand-alchemy', 'card'
               UNION ALL SELECT 'hand-alchemy', 'roguelike'
               UNION ALL SELECT 'hand-alchemy', 'strategy'
               UNION ALL SELECT 'element-pilgrim', 'deckbuilder'
               UNION ALL SELECT 'element-pilgrim', 'card'
               UNION ALL SELECT 'element-pilgrim', 'roguelike'
               UNION ALL SELECT 'relic-heir', 'idle'
               UNION ALL SELECT 'relic-heir', 'roguelike'
               UNION ALL SELECT 'relic-heir', 'collection'
               UNION ALL SELECT 'cliff-climber', 'physics'
               UNION ALL SELECT 'cliff-climber', 'arcade'
               UNION ALL SELECT 'cliff-climber', 'survival'
               UNION ALL SELECT 'moon-angler', 'collection'
               UNION ALL SELECT 'moon-angler', 'casual'
               UNION ALL SELECT 'moon-angler', 'idle') m ON m.slug = g.slug;

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0
FROM game
WHERE slug IN ('midnight-tide', 'spud-arena', 'hand-alchemy', 'element-pilgrim',
               'relic-heir', 'cliff-climber', 'moon-angler');
