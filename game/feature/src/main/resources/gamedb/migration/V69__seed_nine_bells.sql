-- 아홉 종 — 유니티 라인의 **두 번째** 게임. DRAFT 로 올린다.
--
-- 왜 DRAFT 인가
--   구조는 끝까지 돈다(챕터 셋 전환·폐갱도·메달·보스·저장). 그런데 **캐릭터가 아직
--   궁수 키우기의 것 그대로**라, 지금 공개하면 「궁수를 재탕한 것」으로 읽힌다.
--   전용 캐릭터 에셋이 들어오면 status 를 BETA 로 올리는 UPDATE 를 새 버전으로 낸다.
--   규격은 portal-fe/public/games/_src/nine-bells/CHARACTER-SPEC.md.
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('nine-bells', '아홉 종',
     '봉우리를 올라 정상의 범종을 울린다. 오르는 길은 층마다 반대편으로 돌아가는 비탈이라, 걸어서만 가면 두 바퀴를 돈다. 절벽에 붙어 오르면 지름길이지만 스태미나가 한 층을 겨우 넘긴다 — 어디서 쉴지를 읽는 것이 실력이다. 떨어지는 중에 활공막을 펴면 다음 층으로 건너뛴다. 절벽 사이에 청동을 캐던 폐갱도가 서 있고, 꼭대기의 메달을 거두면 스태미나 상한이 올라 더 높은 갱도에 닿는다. 지킴이는 때리기 전에 멈춰 서서 몸을 젖힌다 — 그때 구르면 맞지 않는다. 정상을 지키는 봉우리 지킴이를 넘겨야 종에 손이 닿고, 종을 울리면 다음 봉우리가 열린다.',
     'Nine Bells',
     'Climb the peak and ring the great bronze bell at its summit. The ramps turn ninety degrees on every terrace, so walking the whole way means circling the mountain twice. Climbing the cliff is the shortcut, but one full stamina bar barely clears a single terrace — reading where to rest is the skill. Open the glider on the way down and you cross to the next tier. Abandoned bronze shafts stand against the cliffs; take the medal on top and your stamina ceiling rises, which puts the next shaft in reach. Guardians stop and rear back before they strike, and a roll through that window takes nothing. Put down the peak keeper before the bell will answer, and ringing it opens the next summit.',
     '/games/thumbs/shots/nine-bells.png', NULL, 'UNITY_WEBGL',
     'IFRAME', '/games/nine-bells/index.html', 'BOTH', 1, 'kgd', 1, 'DRAFT',
     'ACTION', '["action","adventure","leaderboard"]', NULL, NULL, NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description),
    title_en = VALUES(title_en), description_en = VALUES(description_en),
    thumbnail_url = VALUES(thumbnail_url), engine_type = VALUES(engine_type),
    entry_url = VALUES(entry_url), genre = VALUES(genre), tags = VALUES(tags),
    orientation = VALUES(orientation), supports_mobile = VALUES(supports_mobile),
    status = VALUES(status), content_updated_at = NOW(6);

-- engine_type='UNITY_WEBGL' — 전송량 7.24MB(gzip, 상한 15MB) + 챕터 번들 180KB·187KB.
--   챕터 아트는 기본 빌드에 없고 노는 동안 미리 받는다 (ADR-0085). Build/ 는 해시 파일명이라
--   immutable 캐시, Chapters/ 는 같은 nginx 규칙을 탄다.
--
-- orientation='BOTH' 근거 (두 방향 CDP 실측 — 390x844 · 844x390)
--   세로: 첫 프레임 4.32초 · 중앙값 19.3ms(51.8fps)
--   가로: 첫 프레임 3.01초 · 중앙값 26.9ms(37.2fps)
--   3인칭 궤도 카메라라 시야각이 방향에 따라 갈리지 않는다. 세로가 더 빠른 것은
--   가로가 픽셀을 더 그리기 때문이고, 둘 다 도는 선 안이다.
--   ※ 소프트웨어 렌더러(swiftshader) 값이다 — 실기 GPU 는 이보다 높다.
--
-- supports_mobile=1 근거
--   가상패드다 — 연속 방향 입력으로 등반·활공을 조작해 탭으로 대체할 수 없다.
--   액션 5개(점프·구르기·공격·활공·달리기)로 상한 안. 전부 한글 라벨.
--   정보 패널은 GameHud 접기를 따르고 모바일 기본 접힘. 진단 줄은 #debug 에서만 나온다.

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'action' AS slug UNION ALL SELECT 'adventure'
                     UNION ALL SELECT 'leaderboard') t
WHERE g.slug = 'nine-bells'
  AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug = t.slug)
ON DUPLICATE KEY UPDATE tag_slug = VALUES(tag_slug);

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'nine-bells'
ON DUPLICATE KEY UPDATE play_count = play_count;
