-- 클린룸 산출물 등록: random-tower-defense (랜덤 타워 디펜스).
-- 한국 커스텀맵 상위권의 '랜덤/운빨 디펜스' 계열을 웹으로 옮긴 것 — 장르 프리셋
-- `coop-usemap-defense` 의 첫 산출물. docs/standards/game-cleanroom-pipeline.md 참조.
--
-- genre='DEFENSE' — 웨이브를 막는 것이 목적이고, 뽑기·조합은 그 수단이다.
--
-- tags: leaderboard(도달 판수 랭킹) · multiplayer(최대 4슬롯 협동) · roguelike 는 넣지 않는다
--   — 죽으면 처음부터가 아니라 판이 끝나는 구조라 로그라이크로 찾아온 사람의 기대와 어긋난다.
--
-- supports_mobile=1 근거 (터치 에뮬레이션 실측):
--   · 세로 390x844 · 가로 844x390 양쪽에서 캔버스가 뷰포트를 꽉 채우고 120fps
--   · 실제 터치 탭으로 타이틀 → 로비 → 플레이 진입 확인 (개발 훅 아님), 30초 구동 중 예외 0
--   · 가상패드(lib/touch.js)는 붙이지 않는다 — 탭 기반 전략 게임이라 조이스틱 오버레이가
--     맵을 가린다. 네이티브 포인터로 전 조작이 성립하는 것을 실측했다
--   · 플레이 화면에 `.panel` 클래스를 쓰지 않아, 패드를 붙였을 때 숨는 함정도 애초에 없다
--
-- sdk_integrated=1 — platform.js 로 랭킹 제출 + localStorage 세이브 서버 동기화를 배선했다.
--   세이브 키 'random-tower-defense.save.v1' (단일 키). 랭킹 스칼라는 **도달 판수**이고
--   detail 은 "3인 · 20판 · 방벽 19/26 · 11:36" 형식 문자열이다(어댑터가 String() 으로 감싼다).
--
-- 실측: 기본 20판 10.5~11.6분 · 확장 40판 44.3분 · GPU 동시 개체 531에서 120fps
--       (sim <=0.1ms / draw <=1.2ms) · 죽은 입력 감사 660/660 · 개체 스모크 54/54 · 콘솔 0

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('random-tower-defense', '랜덤 타워 디펜스',
     '뽑고, 합치고, 막는다 — 최대 4인 협동 랜덤 타워 디펜스. 매 판 무작위로 나오는 지킴이를 회로에 세우고, 같은 것끼리 합쳐 상위 등급으로 올리며 몰려오는 적을 막아라. 지킴이 37종 6등급(일반~신화)과 2단 조합 트리 8종, 우두머리 4기가 기다린다. 네 구역의 길이 전부 가운데 방벽으로 모이므로 한 곳만 뚫려도 모두의 손해다. 자리를 비우면 AI가 대신 뽑고 합쳐 판이 멈추지 않는다. 기본 20판 약 11분, 긴 40판은 약 44분. 스프라이트·배경·BGM 전부 코드 생성.',
     'Random Tower Defense',
     'Draw, merge, hold the line. A co-op random tower defense for up to four players. Each round hands you random guardians to place along the circuit; merge matching ones to climb six tiers and stop the waves. Thirty-seven guardians, an eight-branch merge tree and four bosses. Every lane funnels into one shared wall at the centre, so a single breach costs everyone. Step away and an AI keeps drawing and merging for you. A standard run takes about eleven minutes; the long forty-round mode runs about forty-four. Every sprite, backdrop and BGM is generated in code.',
     '/games/thumbs/shots/random-tower-defense.png', NULL, 'HTML5', 'IFRAME', '/games/random-tower-defense/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'DEFENSE', '["leaderboard","multiplayer"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'leaderboard' AS slug UNION ALL SELECT 'multiplayer') t
WHERE g.slug = 'random-tower-defense';

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'random-tower-defense';
