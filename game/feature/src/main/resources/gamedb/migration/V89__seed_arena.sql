-- AMP ARENA — 8인 실시간 3D 아레나 대전 액션. BETA 로 올린다.
--
-- 별도 서버 파드가 없다. 정적 클라이언트는 games 서브모듈 `arena/` 에서 나가고, 온라인 대전은 이 플랫폼의
-- 릴레이(`/ws/games/arena`, ADR-0088 N석)를 탄다 — 방장(가장 낮은 좌석) 클라이언트가 권위 시뮬을 돌리고
-- 스냅샷 10Hz(최대 약 2.3KB)를 뿌리며, 방장이 나가면 다음 좌석이 마지막 스냅샷에서 이어받는다.
-- 릴레이 상한(4KB · 40 msg/s) 안에 드는 것은 amp-arena 의 단위 테스트와 3탭 E2E 가 재고 있다.
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 여러 도메인이 함께 죽는다).

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('arena', 'AMP ARENA',
     '여덟 명이 한 판에 들어가는 3D 아레나 대전 액션. 맨손 3단 공격과 잡기·던지기, 가드와 가드 크러시, 다운과 링아웃이라는 고전 아레나 격투 문법 위에 스타일 5종(파이터·그래플러·스피드스타·헤비·마셜)과 악세서리 6종(대검·창·쌍권총·방패·부스터)이 얹혀 있다. 맵은 콜로세움·스카이독·옥상·얼음 호수. 빠른 대전은 사람이 모이거나 30초가 지나면 시작하고 빈 자리는 봇이 채우며, 코드 방을 만들어 친구를 부를 수 있다. 판정은 방장 화면이 맡고 방장이 나가면 다음 사람이 이어받는다.',
     'AMP ARENA',
     'Eight-player 3D arena brawler. Classic arena-fighter grammar — three-hit combos, grabs and throws, guard and guard crush, knockdowns and ring-outs — with five fighting styles and six accessories (greatsword, spear, twin pistols, shield, booster) on top. Four maps: colosseum, skydock, rooftop, frozen lake. Quick match starts when the room fills or after 30 seconds with bots filling empty seats; make a code room to invite friends. The host client adjudicates and hands over to the next player if it leaves.',
     '/games/thumbs/shots/arena.jpg', NULL, 'HTML5',
     'IFRAME', '/games/arena/index.html', 'LANDSCAPE', 1, 'kgd', 0, 'BETA',
     'VERSUS', '["versus","brawler","3d","multiplayer","online"]', NULL, NULL, NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description),
    title_en = VALUES(title_en), description_en = VALUES(description_en),
    thumbnail_url = VALUES(thumbnail_url), engine_type = VALUES(engine_type),
    entry_url = VALUES(entry_url), genre = VALUES(genre), tags = VALUES(tags),
    orientation = VALUES(orientation), supports_mobile = VALUES(supports_mobile),
    status = VALUES(status), content_updated_at = NOW(6);

-- orientation='LANDSCAPE' — 세로에서는 「가로로 돌려 주세요」 안내를 띄운다. 터치는 왼쪽 가상 스틱 + 오른쪽 버튼 넷.
-- supports_mobile=1 근거: 844×390 터치 레이아웃 E2E(tools/e2e-mobile.mjs) 오류 0. 실기기 프레임은 미측정.
-- sdk_integrated=0 — 플랫폼 기록·세이브 API 는 아직 안 쓴다(Phase 2).

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         -- game_tag 에 실재하는 슬러그만 넣는다. 없는 것은 EXISTS 에 걸러지고 자유 문자열은 위 tags JSON 이 갖는다
         CROSS JOIN (SELECT 'multiplayer' AS slug UNION ALL SELECT 'action' UNION ALL SELECT 'versus') t
WHERE g.slug = 'arena'
  AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug = t.slug)
ON DUPLICATE KEY UPDATE tag_slug = VALUES(tag_slug);

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'arena'
ON DUPLICATE KEY UPDATE play_count = play_count;
