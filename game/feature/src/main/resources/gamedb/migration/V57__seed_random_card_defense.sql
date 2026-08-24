-- 클린룸 산출물 등록: random-card-defense (랜덤 카드 디펜스).
-- 장르 프리셋 `coop-usemap-defense` 의 세 번째 산출물 — 카드를 뽑아 만든 포커 족보가
-- 세워지는 타워를 정한다. docs/standards/game-cleanroom-pipeline.md
--
-- genre='DEFENSE' — 포커는 타워를 정하는 수단이지 게임의 목적이 아니다. PUZZLE 로 두면
--   혼자 푸는 것을 기대하고 오는데 이 게임은 웨이브를 막는 디펜스다.
--
-- tags: leaderboard(도달 웨이브) · multiplayer(협동 최대 4인 화면 분할 / 대전 개인전) ·
--   deckbuilder(덱을 굴려 족보를 만든다)
--
-- 대전 공정성 — 「같은 시드」만으로는 같은 조건이 아니었다. 자리 간 공유 상태 5건을 찾아
--   전부 자리별로 쪼갰다: 난수 스트림(뽑는 순서만으로 결과가 갈렸다) · 보스 패턴 난수 ·
--   보스 효과(상대 전장까지 흔들었다) · 광장 터(먼저 집는 쪽이 가져갔다) · 수집물 장부.
--   광장 터는 자리마다 코어까지 150/251/251/426/426px 로 거울 대칭 지급한다.
--   검증: AI 대 AI 완전 동형(덱·소환 189건·타워·금·처치·손패 전부 일치).
--
-- supports_mobile=1 근거 (터치 에뮬레이션 실측):
--   · 탭만으로 완주 가능한 조작이라 **가상패드를 붙이지 않는다** — 조이스틱이 전장을 가린다
--     (인피니티 타워는 캐릭터를 직접 조작해서 반대로 붙였다)
--   · 캔버스가 16:9 고정이라 세로에서는 상단에 띠로 들어간다. orientation='LANDSCAPE' 로
--     가로를 기대값으로 둔다. 가로 844x390 에서 693x390 로 화면을 채운다
--
-- sdk_integrated=1 — platform.js 로 랭킹 + localStorage 세이브 서버 동기화.
--   세이브 키 'randomCardDefense.v1'. scene 을 세 곳에서 직접 대입하는 구조라 훅은
--   메인 루프에서 한 번만 감지한다(런당 1회 가드 실측 확인).
--   랭킹 스칼라는 도달 웨이브, detail 은 '협동 · 6웨이브 · 처치 38 · 코어 0/54' 형식.
--
-- 실측: 혼자 12:39(승리) · 협동 2인 11:37 · 협동 4인 12:26(승리) · 대전 2인 11:53 ·
--       월드 9,216² · 한 화면 4.34% · 죽은 입력 감사 840칸 0 · 120fps · 콘솔 0

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('random-card-defense', '랜덤 카드 디펜스',
     '패를 뽑아 족보를 만들면 그 족보가 타워가 된다 — 최대 4인 카드 타워 디펜스. 원페어부터 위로 열 단계, 무늬마다 관통·회복·광역·독으로 성격이 갈린다. 지금 만들 수 있는 조합은 손패 위에 실시간으로 뜨고, 한 장만 더 있으면 되는 것도 알려준다. 성문 → 성벽 균열 → 윗길로 단계마다 길이 달라져 배치를 다시 짜야 한다. 협동은 인원수만큼 전장을 나눠 함께 웨이브를 막고, 대전은 각자 자기 전장을 같은 패·같은 웨이브로 막아 누가 더 버티는지 겨룬다. 자리를 비우면 AI가 대신 뽑고 세운다.',
     'Random Card Defense',
     'Draw a hand, make a rank, and the rank becomes your tower. A card-driven tower defense for up to four. Ten tiers from one pair upward, with each suit carrying its own behaviour — pierce, heal, splash or poison. The hand overlay shows what you can build right now and what you are one card away from. Three stages reshape the route, so placement has to be rethought each time. Co-op splits the field by player count against shared waves; versus gives everyone their own field with the identical deck and wave order, so only play separates you. Step away and an AI keeps drawing and building.',
     '/games/thumbs/shots/random-card-defense.png', NULL, 'HTML5', 'IFRAME', '/games/random-card-defense/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'DEFENSE', '["leaderboard","multiplayer","deckbuilder"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'leaderboard' AS slug UNION ALL SELECT 'multiplayer' UNION ALL SELECT 'deckbuilder') t
WHERE g.slug = 'random-card-defense';

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'random-card-defense';
