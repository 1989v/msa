-- 궁수 키우기 — **유니티(WebGL) 라인의 첫 게임**. BETA 로 올린다.
--
-- 왜 BETA 인가
--   게임 자체는 게이트를 통과했지만(아래 근거), 유니티 라인 자체가 이 게임이 처음이다.
--   실기(iPhone·중급 안드로이드) fps 와 첫 로딩 시간은 아직 데스크톱 실측뿐이라,
--   공개는 하되 베타로 표시해 피드백을 받는다. DRAFT 로 숨기면 그 피드백을 못 받는다.
--   승격은 실기 실측 뒤 status 를 PUBLISHED 로 올리는 UPDATE 를 새 버전으로 낸다.
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('archer-outbreak', '궁수 키우기',
     '좀비가 뒤덮은 도시에 궁수 하나가 남았다. 사거리 안의 좀비는 알아서 쏘고, 잡으면 고철이 남는다. 고철은 기지 안에 있을 때만 보급품으로 바뀌고, 보급품으로 화살 위력을 끝없이 올린다. 몇 단계부터 한 방인지가 화면에 계속 떠 있어 다음 목표가 늘 분명하다. 작업대·의무소·훈련소·감시탑을 켜면 관통·다중 사격·동료 궁수가 열리고, 주차장에서 도심까지 구역 다섯 곳을 하나씩 연다. 92초마다 러시가 기지로 오고, 밖에 나가 있으면 기지가 털린다. 무전기를 켜면 변이체가 내려온다.',
     'Archer Outbreak',
     'One archer is left in a city the dead took. Anything in range gets shot automatically, and every kill drops scrap. Scrap only becomes supply while you stand inside the camp, and supply buys arrow power without a ceiling — the screen always shows which upgrade level one-shots which zombie, so the next goal is never vague. Light the workbench, clinic, barracks and watchtower to unlock piercing, multishot and hired archers, then open five districts from the parking lot to downtown. A rush hits the camp every 92 seconds, and it will loot you while you are away. Switch on the radio and the mutant comes down.',
     '/games/thumbs/shots/archer-outbreak.png', NULL, 'UNITY_WEBGL',
     'IFRAME', '/games/archer-outbreak/index.html', 'BOTH', 1, 'kgd', 1, 'BETA',
     'ACTION', '["action","survival","leaderboard","beta"]', NULL, NULL, NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description),
    title_en = VALUES(title_en), description_en = VALUES(description_en),
    thumbnail_url = VALUES(thumbnail_url), engine_type = VALUES(engine_type),
    entry_url = VALUES(entry_url), genre = VALUES(genre), tags = VALUES(tags),
    orientation = VALUES(orientation), supports_mobile = VALUES(supports_mobile),
    status = VALUES(status), content_updated_at = NOW(6);

-- engine_type='UNITY_WEBGL' — 이 값을 쓰는 첫 게임이다. 산출물은 Unity 6 WebGL 빌드이고
--   전송량 7.6MB(gzip, 상한 15MB). 캔버스 게임과 달리 Build/ 는 파일명이 해시라 immutable 캐시다.
--
-- orientation='BOTH' 근거 (두 방향 CDP 실측 — 390x844 · 844x390, DPR 3, pointer:coarse 확인)
--   세로: 캔버스 390x608(하단 236 은 가상패드 밴드) · 궁수 29.7 CSS px · 좀비 25.8 CSS px
--   가로: 캔버스 844x390(패드는 코너 오버레이) · 궁수 29.7 · 좀비 25.8
--   카메라가 `orthographicSize = max(9, 9/aspect)` 로 **짧은 변에 항상 18 월드 유닛**을 담아
--   두 방향에서 크기가 같다. 그래서 한쪽을 강제할 이유가 없다.
--
-- supports_mobile=1 근거
--   가상패드다 — 궁수를 연속 방향 입력으로 직접 움직이는 액션이라 탭으로 대체할 수 없다.
--   액션 5개(강궁·회피·폭발·의무·기지)로 상한 안. 3부 한글 라벨. 주 액션 76 CSS px(하한 44).
--   패드 입력은 KeyboardEvent 합성이 아니라 `GameTouch.axis()` 를 .jslib 로 직접 읽어
--   C# 에 넣는다 — 합성 키가 Unity 에 먹히는지에 기대지 않는다.
--   정보 패널은 GameHud 접기를 따르고 모바일 기본 접힘.

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'action' AS slug UNION ALL SELECT 'survival'
                     UNION ALL SELECT 'leaderboard' UNION ALL SELECT 'beta') t
WHERE g.slug = 'archer-outbreak'
  AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug = t.slug)
ON DUPLICATE KEY UPDATE tag_slug = VALUES(tag_slug);

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'archer-outbreak'
ON DUPLICATE KEY UPDATE play_count = play_count;
