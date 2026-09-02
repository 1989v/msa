-- 마지막 한 사람 — 유니티 라인의 **세 번째** 게임, 플랫폼의 **첫 실시간 20인 대전**. BETA 로 올린다.
--
-- 왜 BETA 인가
--   봇 20명 판 100회 게이트(PaceGate·BalanceGate·StormGate·NetGate)는 통과했지만,
--   사람이 섞인 판의 체감(호스트 권위 지연·승계·모바일 실기 fps)은 실기에서만 알 수 있다.
--   실측이 쌓이면 PUBLISHED 로 올리는 UPDATE 를 새 버전으로 낸다.
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('last-one', '마지막 한 사람',
     '아홉 종의 산 하나에 스무 명이 떨어져, 마지막 한 사람이 남을 때까지 싸운다. 사람이 모자라면 AI 가 스무 자리를 채우고, 넘치면 줄을 선다 — 30초가 지나면 무조건 시작한다. 산 위에서 활공으로 내릴 곳을 고른다: 정상 근처는 좋은 무기, 기슭은 안전. 무기 다섯(맨손·검·도끼·창·활)과 방패는 지도에 흩어져 있어 위에 잠깐 서면 바꿔 든다. 공격 버튼을 톡 치면 약공, 누르고 있으면 강공 — 강공은 막기를 뚫는 대신 몸이 부풀어 예고가 크다. 시간이 지나면 낮은 층부터 안개가 차올라 그 안에서는 초당 피해를 입고, 결국 정상 테라스에서 만난다. 절벽에 붙어 오르면 지름길이지만 스태미나가 한 층을 겨우 넘긴다. 죽으면 관전으로 넘어가고, 순위가 랭킹에 오른다.',
     'Last One Standing',
     'Twenty fighters drop onto a single mountain and fight until one remains. Empty seats are filled by AI and the lobby starts after thirty seconds no matter what. Glide down from above and choose where to land: the summit hides the best weapons, the foothills are safe. Five weapons and a shield are scattered across the map — stand on one for a moment to swap. Tap the attack button for a light strike or hold it for a heavy one that breaks through guards, at the cost of a big, readable wind-up. As time passes the fog rises from the lowest terraces, dealing damage per second to anyone inside, until only the summit is left. Climbing a cliff is the shortcut, but one stamina bar barely clears a single terrace. When you fall you spectate, and your placement goes to the leaderboard.',
     '/games/thumbs/shots/last-one.png', NULL, 'UNITY_WEBGL',
     'IFRAME', '/games/last-one/index.html', 'BOTH', 1, 'kgd', 1, 'BETA',
     'ACTION', '["action","multiplayer","battle-royale","leaderboard","beta"]', NULL, NULL, NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description),
    title_en = VALUES(title_en), description_en = VALUES(description_en),
    thumbnail_url = VALUES(thumbnail_url), engine_type = VALUES(engine_type),
    entry_url = VALUES(entry_url), genre = VALUES(genre), tags = VALUES(tags),
    orientation = VALUES(orientation), supports_mobile = VALUES(supports_mobile),
    status = VALUES(status), content_updated_at = NOW(6);

-- engine_type='UNITY_WEBGL' — 아홉 종과 같은 킷·같은 산이라 전송량이 거의 같다(gzip, 상한 15MB).
--   Build/ 는 해시 파일명이라 immutable 캐시.
--
-- 네트워크 — ADR-0088 호스트 권위. 릴레이 /ws/games/last-one 에 seats=20 으로 붙는다.
--   좌석 최저 번호의 사람이 시뮬(봇 포함)을 돌리고 10Hz 스냅샷(≤ 4KB, NetGate 실측 1,037B)을 뿌린다.
--   릴레이에 못 붙으면 그 자리에서 혼자 + 봇 19 로 판이 선다 — 사람 1 도 정상 판이다 (PRD §9).
--
-- orientation='BOTH' · supports_mobile=1 — 아홉 종 패드 그대로(버튼 5 + 스틱), 이모트 6은 화면 버튼.
--   두 방향 CDP 실측값은 portal-fe/public/games/_src/last-one/DESIGN.md §7.

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'action' AS slug UNION ALL SELECT 'multiplayer'
                     UNION ALL SELECT 'leaderboard' UNION ALL SELECT 'beta') t
WHERE g.slug = 'last-one'
  AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug = t.slug)
ON DUPLICATE KEY UPDATE tag_slug = VALUES(tag_slug);

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'last-one'
ON DUPLICATE KEY UPDATE play_count = play_count;
