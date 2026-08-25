-- 네온 드리프터 — **DRAFT 로 등록한다** (어드민에만 보인다).
--
-- 이 게임은 정식 신작이 아니라 **하네스 시험작**이다. 2026-08-24 G5 개편(모바일 1순위)이
-- 실제로 클린룸 세션에 전달되는지 보려고 만들었고, 게이트를 첫 시도에 통과했다
-- (lint --strict 경고 0 · 주인공 세로 43.3 / 가로 32.4 CSS px · 두 방향 콘솔 0).
--
-- 왜 DRAFT 인가
--   공개 목록은 PUBLISHED + BETA 만 싣는다(GameCatalogAdapters.PUBLIC_STATUSES).
--   DRAFT 는 공개 목록에서 빠지고 **상세도 NOT_FOUND** 로 존재 자체가 숨는다.
--   어드민 조회(`GET /api/v1/admin/games`)만 상태 무관이라 여기서만 보인다 — 요청대로
--   "내 권한만 보이는" 상태가 이것이다. 베타(V35 방식: PUBLISHED + beta 태그)와는 다르다:
--   베타는 피드백을 받으려고 **노출**하는 것이고, 여기는 아직 노출하지 않겠다는 뜻이다.
--
-- 승격하려면 status 를 BETA(+ beta 태그) 또는 PUBLISHED 로 올리는 UPDATE 를 새 버전으로 낸다.
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('neon-drifter', '네온 드리프터',
     '탄을 스쳐야 이긴다. 피하기만 하면 게이지가 안 차고, 게이지가 없으면 보스를 못 넘긴다. 적 탄이 몸 가까이 지나가면 게이지가 차고, 대시 무적으로 탄을 통과하면 그 탄을 빨아들여 더 크게 찬다. 절반이 차면 역류파로 화면의 탄을 지운다. 안전한 자리에 숨는 플레이가 손해인 세로 아케이드 액션. 0.5초에 바로 조준 사격이 시작되고 몸풀기 구간이 없다. 적 3종과 3단계로 변하는 보스 심장로까지 한 판 60~120초.',
     'Neon Drifter',
     'Grazing is how you win. Dodging alone never fills the gauge, and without the gauge the boss stays out of reach. Enemy shots that pass close to your hull charge it; dashing through them with i-frames absorbs the shot and charges more. At half a gauge the backwash wave erases every bullet on screen — so hiding in a safe corner is the losing play. A vertical arcade action run with no warm-up: aimed fire starts half a second in. Three enemy types and a three-phase boss, 60 to 120 seconds a run.',
     '/games/thumbs/shots/neon-drifter.png', NULL, 'CANVAS_TS',
     'IFRAME', '/games/neon-drifter/index.html', 'PORTRAIT', 1, 'kgd', 1, 'DRAFT',
     'ACTION', '["action","arcade","leaderboard"]', NULL, NULL, NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description),
    title_en = VALUES(title_en), description_en = VALUES(description_en),
    orientation = VALUES(orientation), supports_mobile = VALUES(supports_mobile),
    status = VALUES(status), content_updated_at = NOW(6);

-- orientation='PORTRAIT' 근거 (두 방향 CDP 실측)
--   세로 390x844 에서 캔버스 390x520(배율 0.361), 주인공 43.3 CSS px 로 전 항목 통과.
--   가로 844x390 에서는 배율이 0.270 으로 떨어져 **탄 지름이 12~13 CSS px** 로 하한 16 미달이다.
--   맞추려고 게임 좌표에서 탄을 키우면 세로에서 화면 폭의 1/18 짜리 탄이 되어 세로가 망가진다.
--   그래서 세로를 기준 방향으로 잡았고 **자동 가로 전환을 하지 않는다**(GameDetailPage 가
--   orientation='LANDSCAPE' 인 게임만 돌린다).
--
-- supports_mobile=1 근거
--   가상패드를 붙였다 — 기체를 연속 방향 입력으로 직접 움직이는 액션이라 탭으로 대체할 수 없다.
--   액션 3개(공격·대시·특수)로 5개 상한 안. 3부 한글 라벨. 터치 타깃 최소변 62 CSS px(하한 44).
--   정보 패널은 GameHud 접기를 따르고 모바일 기본 접힘 — 가리는 면적 세로 8.71%(상한 25%).

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'action' AS slug UNION ALL SELECT 'arcade' UNION ALL SELECT 'leaderboard') t
WHERE g.slug = 'neon-drifter'
  AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug = t.slug)
ON DUPLICATE KEY UPDATE tag_slug = VALUES(tag_slug);
