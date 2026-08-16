-- 클린룸 4호: 잿불 원정대 — 아케이드 벨트스크롤 액션 RPG.
-- 통합은 lib/platform.js 어댑터 (랭킹 제출 + localStorage 세이브 서버 동기화).
-- 세이브 키: 'ashen-warband.save' (단일 키 / JSON 문자열 / 약 400B).
-- 랭킹 스칼라: world.totalScore, detail 은 "2인 · 진엔딩 · 8층 · 히든 13/26 · …" 형식 문자열.

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('ashen-warband', '잿불 원정대',
     '2인 협동 아케이드 벨트스크롤 액션 RPG — 철벽 수호기사·쌍월 밀정·회색깃 사수·재의 술사 넷 중 하나를 골라 무너진 감옥부터 잿불 왕좌까지 8개 층을 돌파한다. 직업마다 성격이 다른 방어기(방패막기·패링·쳐내기·실드)와 모션 커맨드 기술, 금화로 사는 추가 기술, 공중 저글 콤보로 싸운다. 보스 8기는 패턴마다 정답이 달라 뛰어넘거나, 안으로 파고들거나, 막아내거나, 차지 중에 때려 무너뜨려야 한다. 4층에서 갈리는 분기 두 갈래와 엔딩 3종, 층마다 다른 기믹과 숨겨진 요소 26개. 층 경계에서 저장돼 이어서 즐길 수 있다. 스프라이트·배경·BGM 전부 코드 생성(2560×1440).',
     'ASHEN WARBAND',
     'A two-player co-op arcade belt-scroll action RPG. Pick one of four classes — bulwark knight, twin-moon rogue, greyfeather archer or ash sorcerer — and fight from a collapsed prison up to the ember throne across eight floors. Each class carries a defence of its own character (shield block, parry, deflect, barrier) alongside motion-command arts and extra techniques bought with gold, plus air-juggle combos. All eight bosses answer to different counterplay: leap the shockwave, close inside the ring, guard the thrust, or break them mid-charge. Two branching routes from the fourth floor, three endings, floor-specific hazards and 26 secrets. Progress saves at every floor boundary. Every sprite, backdrop and BGM is generated in code at 2560x1440.',
     '/games/thumbs/shots/ashen-warband.png', NULL, 'HTML5', 'IFRAME', '/games/ashen-warband/index.html',
     'LANDSCAPE', 0, 'kgd', 1, 'PUBLISHED', 'ACTION', '["leaderboard"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, 'leaderboard' FROM game g WHERE g.slug = 'ashen-warband';

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'ashen-warband';
