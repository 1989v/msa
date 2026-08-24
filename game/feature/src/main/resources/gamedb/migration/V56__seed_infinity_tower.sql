-- 클린룸 산출물 등록: infinity-tower (인피니티 타워).
-- 장르 프리셋 `coop-usemap-defense` 의 두 번째 산출물 — docs/standards/game-cleanroom-pipeline.md
--
-- genre='DEFENSE' — 모드 두 개(첨탑 방어 / 타워 등반) 중 방어가 원형이고, 등반은 같은 조작·
--   같은 직업으로 목표만 뒤집은 것이다. STRATEGY 로 두면 건설·운영을 기대하고 오는데 이 게임은
--   직접 조작해 싸우는 쪽이다.
--
-- tags: beta 를 붙인다 — 타워 등반이 1~10층까지만 열려 있다(999층은 콘텐츠 확장 대기).
--   상태는 PUBLISHED 로 둔다. GameStatus.BETA 는 공개 목록에서 빠져(PUBLIC_STATUSES={PUBLISHED})
--   아무도 못 찾고, 그러면 피드백을 받을 수 없다 — 노출은 두고 배지로만 알린다.
--   multiplayer: 최대 4슬롯 협동. leaderboard: 점수 랭킹.
--
-- supports_mobile=1 근거 (터치 에뮬레이션 실측):
--   · 가상패드(lib/touch.js)를 배선했다 — 방향 + 액션 5개(공격 Z / 스킬 X·C / 가드 V / 상호작용 Space).
--     탭만으로는 안 되는 캐릭터 조작 게임이라 패드가 필요하다(랜덤 타워 디펜스와 반대 판단)
--   · 세로 390x844 에서 패드 영역 236px 확보 후 캔버스 상단 정렬, 가로 844x390 에서는 패드 영역 0
--   · 액션 버튼 5개 생성 확인, 예외 0
--
-- sdk_integrated=1 — platform.js 로 랭킹 + localStorage 세이브 서버 동기화.
--   세이브 키 'infinity-tower.save.v1'. 랭킹 스칼라는 두 모드 공통인 world.score,
--   detail 은 '타워 등반 · 7층 · 2인 · 처치 143' 형식. setScene 한 곳에 훅을 걸고 런당 1회 가드
--   (중복 호출 실측에서 1건 유지).
--
-- 실측: 방어전 14:06 · 타워 등반 한 층 60~90초(층지기 120초) · 월드 10,240² ·
--       한 화면이 보는 면적 5.88% · 주인공 1/19.4 · GPU 120fps 0.70ms ·
--       사람 조작 31/31 · 실패 경로 15/15 · 죽은 입력 646칸 dead 0 · 콘솔 0

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('infinity-tower', '인피니티 타워',
     '넷이서 지키고, 넷이서 오른다 — 최대 4인 협동 액션. 철벽 수호기사·쌍월 밀정·회색깃 사수·재의 술사 중 하나를 골라 두 가지 판을 즐긴다. 「첨탑 방어」는 사방 여섯 갈래로 몰려오는 적을 막는 방어전이라 뭉쳐 서면 뚫린다. 「타워 등반」은 한 층씩 격파하며 오르는 무한 등반으로, 층이 오를수록 적이 강해지고 열 층마다 층지기와 체크포인트가 기다린다. 레벨과 성장은 층을 넘어 이어지고, 그만두어도 최고 층은 남는다. 자리를 비우면 AI가 이어받아 판이 멈추지 않는다.',
     'Infinity Tower',
     'Hold the spire, then climb it. A co-op action game for up to four. Pick one of four classes and play two ways: Spire Defense sends enemies down six lanes from every side, so bunching up gets you breached; Tower Climb is an endless ascent where each floor is one fight, enemies grow with the floor number, and every tenth floor brings a warden and a checkpoint. Levels and upgrades carry between floors, and your best floor is kept even if you stop. Step away and an AI takes your character so the run never stalls.',
     '/games/thumbs/shots/infinity-tower.png', NULL, 'HTML5', 'IFRAME', '/games/infinity-tower/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'DEFENSE', '["beta","multiplayer","leaderboard"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'beta' AS slug UNION ALL SELECT 'multiplayer' UNION ALL SELECT 'leaderboard') t
WHERE g.slug = 'infinity-tower';

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'infinity-tower';
