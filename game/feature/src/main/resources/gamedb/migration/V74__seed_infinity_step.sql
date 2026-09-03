-- 인피니티 스탭 — 유니티(WebGL) 라인의 **네 번째** 게임(궁수 키우기 → 아홉 종 → 마지막 한 사람 → 이것).
-- 공용 프레임워크 `com.kgd.webgame` 위에서는 전투 없는 첫 게임이다. DRAFT 로 올린다.
--
-- 왜 DRAFT 인가
--   구조는 끝까지 돈다(7 구간 절차 생성·우주 위 무한·차지 점프·모서리 잡기·세이브·랭킹 2보드).
--   그런데 **캐릭터가 아홉 종의 리그 그대로**(틴트만 다르다)라 아홉 종(V69)과 같은 기준으로
--   숨긴다. 전용 캐릭터가 들어오면 status 를 BETA 로 올리는 UPDATE 를 새 버전으로 낸다.
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).
--
-- 번호 이력: V72 로 커밋했다가 **V74 로 옮겼다** (2026-09-03). 같은 워킹트리의 다른 세션이
--   V73(마지막 한 사람)을 먼저 붙였고, 그쪽이 먼저 배포되어 운영에 적용됐다. 우리 Flyway 는
--   `outOfOrder` 를 켜지 않으므로(common/ScopedFlywayMigrator) 이미 73 이 적용된 스키마에
--   미적용 72 가 나타나면 validate 가 막는다 — 조용히 건너뛰거나 기동이 실패한다.
--   옮겨도 되는 이유는 하나뿐이다: **운영 flyway_schema_history 를 조회해 72 가 아직 적용되지
--   않은 것을 확인했다**(70·71·73 만 있었다). 적용된 것을 옮기면 그때는 되돌릴 수 없다.

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('infinity-step', '인피니티 스탭',
     '점프 하나로 우주까지, 그 위로도 끝없이 오르는 탑. 점프를 누르는 시간이 힘이고 다섯 칸으로 차오른다 — 놓는 순간 그 칸의 힘으로 뛰고, 공중에서는 방향을 바꿀 수 없다. 떨어지면 받아 주는 발판이 나올 때까지 떨어진다. 상한이 없어서 성층권에서 미끄러지면 숲까지, 운이 나쁘면 지상까지 간다. 발판 가장자리에 손이 닿으면 저절로 매달려 올라서고, 벽에 뛰어 붙으면 스태미나가 다할 때까지 오른다. 지상·숲·폐허·구름·설산·성층권·우주 일곱 구간이 고도를 따라 이어지고 — 금이 간 발판은 무너지고, 구름 발판은 움직이고, 얼음은 미끄럽다. 같은 날은 모두 같은 탑이고, 탭을 닫아도 그 자리에서 이어진다. 되돌림은 없다.',
     'Infinity Step',
     'One jump carries you to space, and the tower keeps going above it. Holding jump charges five notches; release and you leap with exactly that much force, and nothing changes direction in the air. When you fall, you fall until something catches you — there is no floor under the fall, so a slip in the stratosphere can drop you to the forest, or all the way to the ground. Brush a ledge with your hands and you haul yourself up; leap at a wall and you climb until your stamina runs out. Seven bands stack by altitude — ground, forest, ruins, cloud, snowfield, stratosphere, space — with cracked platforms that crumble, cloud platforms that drift, and ice that slides. Everyone climbs the same tower on the same day, and closing the tab keeps your place. Nothing rewinds.',
     '/games/thumbs/shots/infinity-step.png', NULL, 'UNITY_WEBGL',
     'IFRAME', '/games/infinity-step/index.html', 'BOTH', 1, 'kgd', 1, 'DRAFT',
     'ACTION', '["adventure","physics","leaderboard","daily"]',
     JSON_ARRAY(
         JSON_OBJECT('key', 'height', 'name', '최고 고도', 'nameEn', 'Altitude'),
         JSON_OBJECT('key', 'summit', 'name', '우주 등정', 'nameEn', 'Summit')
     ),
     NULL, NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description),
    title_en = VALUES(title_en), description_en = VALUES(description_en),
    thumbnail_url = VALUES(thumbnail_url), engine_type = VALUES(engine_type),
    entry_url = VALUES(entry_url), genre = VALUES(genre), tags = VALUES(tags),
    score_boards = VALUES(score_boards),
    orientation = VALUES(orientation), supports_mobile = VALUES(supports_mobile),
    status = VALUES(status), content_updated_at = NOW(6);

-- score_boards — 보드 둘. `height` 는 최고 고도(정수 유닛, 50 넘게 갱신될 때 제출),
--   `summit` 은 우주(3,000) 도달 시 `43200 − 경과초`(12시간 상한, 클수록 빠름). 일일 보드는
--   플랫폼의 period=DAILY 가 이미 있다 — 시드가 KST 날짜라 그 날의 탑 기록이 그대로 일일 보드다.
--
-- engine_type='UNITY_WEBGL' — 전송량 7.06MB(gzip · 상한 15MB). 챕터 번들이 없다: 발판·소품·별이
--   전부 코드(MeshBuilder)라 번들에 담을 자산이 없고, 캐릭터 킷 하나만 기본 빌드에 든다.
--   Build/ 는 해시 파일명이라 immutable 캐시.
--
-- orientation='BOTH' 근거 (두 방향 CDP 실측 — 390x844 · 844x390, 소프트웨어 GL)
--   세로: 첫 프레임 4.10초 · 캔버스 390x608(하단 236 가상패드 띠) · 중앙값 16.7ms(59.9fps)
--   가로: 첫 프레임 3.99초 · 캔버스 844x390 · 중앙값 20.0ms(50.0fps)
--   3인칭 궤도 카메라라 시야각이 방향에 따라 갈리지 않는다. 콘솔 예외 0.
--
-- supports_mobile=1 근거
--   가상패드 스틱 + 버튼 2(점프 = 누르는 동안 차지 · 잡기), 전부 한글 라벨. 차지는 5칸 양자화라
--   손가락으로 잰다. 정보 패널은 GameHud 접기를 따르고 진단 줄은 #debug 에서만 나온다.
--   상세: portal-fe/public/games/_src/infinity-step/DESIGN.md §8-1.

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'adventure' AS slug UNION ALL SELECT 'physics'
                     UNION ALL SELECT 'leaderboard' UNION ALL SELECT 'daily') t
WHERE g.slug = 'infinity-step'
  AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug = t.slug)
ON DUPLICATE KEY UPDATE tag_slug = VALUES(tag_slug);

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'infinity-step'
ON DUPLICATE KEY UPDATE play_count = play_count;
