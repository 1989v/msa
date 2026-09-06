-- 전란 — 유니티 라인의 **세 번째** 게임. DRAFT 로 올린다.
--
-- 왜 DRAFT 인가
--   구조는 선다(길·3열 종대 130기·병종 셋·탭 이동·고지대·건설 슬롯 12). 그런데 아직
--   **수직 슬라이스가 아니다** — 전투 판정·건물 배치·바위 기믹·웨이브 보상·HUD 가 없다.
--   그리고 아래 실측대로 **프레임 예산을 못 맞춘다.** 둘 다 붙으면 BETA 로 올리는
--   UPDATE 를 새 버전으로 낸다.
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('age-of-siege', '전란',
     '고을로 들어오는 길은 하나뿐이고, 적은 그 위를 3열 종대로 밀려온다. 기병은 빠르게 앞장서고 방패병은 느리게 길을 막아 세워, 행렬은 성문에 가까워질수록 덩어리가 된다. 길 옆 열두 자리에 냥을 치러 건물을 놓고, 고지대 가장자리의 바위를 밀어 그 덩어리를 한 번에 쓸어버린다. 바닥을 짚으면 장수가 그 자리로 걸어간다 — 어디에 서느냐가 곧 어디를 지키느냐다. 장수는 김유신·을지문덕·양만춘·강감찬·이순신 다섯이고 시대로 잠겨 있지 않다. 다섯은 서 있는 자리가 서로 다르다: 양만춘은 성벽 가까이에서, 을지문덕은 성 밖에서만 힘을 낸다.',
     'Age of Siege',
     'One road leads into the town, and the enemy comes down it three files wide. Riders push ahead fast while shield-bearers hold the lane, so the column bunches up as it nears the gate. Buy buildings into the twelve fixed plots along the road, then shove a boulder off the high ground to sweep that bunch away in one pass. Tap the ground and your general walks there — where you stand is what you defend. Five generals from Korean history, none of them locked behind an era, and each one strongest somewhere different: Yang Manchun near the walls, Eulji Mundeok only outside them.',
     '/games/thumbs/shots/age-of-siege.jpg', NULL, 'UNITY_WEBGL',
     'IFRAME', '/games/age-of-siege/index.html', 'BOTH', 0, 'kgd', 1, 'DRAFT',
     'STRATEGY', '["strategy","defense","history"]', NULL, NULL, NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description),
    title_en = VALUES(title_en), description_en = VALUES(description_en),
    thumbnail_url = VALUES(thumbnail_url), engine_type = VALUES(engine_type),
    entry_url = VALUES(entry_url), genre = VALUES(genre), tags = VALUES(tags),
    orientation = VALUES(orientation), supports_mobile = VALUES(supports_mobile),
    status = VALUES(status), content_updated_at = NOW(6);

-- engine_type='UNITY_WEBGL' — 전송량 6.87MB(gzip, 상한 15MB). 챕터 번들 없음.
--
-- **supports_mobile=0 근거 (두 방향 CDP 실측 — 390x844 · 844x390, 소프트웨어 렌더러)**
--   세로: 첫 프레임 2.86초 · 중앙값 66.7ms(15.0fps)
--   가로: 첫 프레임 4.50초 · 중앙값 150.0ms(6.7fps)
--   폰 예산은 45fps 인데 한참 아래다. supports_mobile 은 약속이라 못 지킬 값에 1 을 넣지 않는다.
--
--   원인은 **화면에 든 리깅 캐릭터 수**다. 130기 × 1,604 삼각형 = 208,520 이고, 한 기에
--   렌더러 하나라 스키닝도 130벌이 돈다. 실측이 그것을 그대로 말한다 — 카메라가 길을
--   등지고 있어 무리가 화면 밖이던 판본은 같은 기기에서 59.9fps 였다.
--
--   깎아 본 것과 그 효과: 정점당 뼈 넷 → 하나, 26유닛 밖 걷기 정지, 무리 재질의
--   화면점당 해시 얼룩 제거. 세로가 6.7 → 15.0fps 로 올랐지만 예산에는 못 닿는다.
--   남은 수단은 **먼 것을 구운 자세의 정적 메시 하나로 합쳐 그리는 것**이고, 그건 별도 작업이다.
--
-- orientation='BOTH' — 두 방향 다 돌아가고 에러 0. 다만 **가로 구도가 아직 나쁘다** —
--   카메라를 길 쪽으로 당기는 값이 세로 기준으로 잡혀 있어 가로에서는 고지대가 화면을 덮는다.
--
-- 조작: **가상 스틱 없음**(`data-stick="off"`). 바닥을 짚으면 그 자리로 걸어간다.
--   액션 5개(일격·화계·바위·배치·줌) 전부 한글 라벨. 세로 하단 띠는 0.22 비율.

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         -- game_tag 에 실재하는 슬러그만 넣는다. 'strategy'·'defense'·'history' 는 대장에 없어서
         -- EXISTS 에 걸러진다 — 자유 문자열은 위 tags JSON 이 갖는다
         CROSS JOIN (SELECT 'survival' AS slug) t
WHERE g.slug = 'age-of-siege'
  AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug = t.slug)
ON DUPLICATE KEY UPDATE tag_slug = VALUES(tag_slug);

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'age-of-siege'
ON DUPLICATE KEY UPDATE play_count = play_count;
