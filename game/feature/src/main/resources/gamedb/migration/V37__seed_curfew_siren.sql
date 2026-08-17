-- 클린룸 5호: 통금 사이렌 — 쿼터뷰 생존 파밍 + 아케이드 벨트스크롤 이원 구조.
--
-- 베타 표기는 V35(잿불 원정대)가 세운 방식을 그대로 따른다: status 는 PUBLISHED 로 두고
-- 'beta' 태그로 알린다. GameStatus.BETA 로 두면 PUBLIC_STATUSES = {PUBLISHED} 때문에
-- 공개 목록에서 빠져 아무도 못 찾고, 그러면 베타로 올리는 이유(피드백)가 사라진다.
-- 대신 sdk_integrated = 0 으로 두어 isMonetizable()(PUBLISHED + SDK)을 막는다 —
-- 완주 전이라 광고를 붙일 물건이 아니다. 완주 후 SDK 를 켜면서 'beta' 태그를 뗀다.
--
-- 통합은 lib/platform.js 어댑터 (랭킹 제출 + localStorage 세이브 서버 동기화).
-- 세이브 키: 'curfew-siren.save.v1' (단일 키 / JSON 문자열).
-- 랭킹 스칼라: 플레이어 score 합계, detail 은 "1인 · 스테이지 1 돌파 · 25킬 · 최대콤보 24 · Lv.4 · 생존자 1명" 형식.
-- 태그는 V25 생존 슬러그만 쓴다 ('2p' 는 V25 에서 'multiplayer' 로 통합됐다).

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('curfew-siren', '통금 사이렌',
     '낮에는 쿼터뷰로 폐허가 된 도시를 뒤지고, 사이렌이 울리면 벨트스크롤로 밤을 뚫는 좀비 아포칼립스 생존 액션. 낮 5분 동안 건물에 들어가 캐비닛과 차량 트렁크를 수색해 식량·무기 부품·의약품을 챙기고 생존자를 구출한다. 시야 원뿔 밖은 보이지 않고, 뛰거나 문을 부수면 소음이 쌓여 좀비가 몰려온다 — 조용히 오래 뒤질지 시끄럽게 빨리 털지 매 방마다 정해야 한다. 해가 지면 그 자리에서 밤 전투로 이어진다. 약공 4단 체인과 공중 저글, 모션 커맨드 기술, 직업마다 성격이 다른 방어기로 좀비 떼를 밀어낸다. 물린 부위별 감염 시계와 골절·허기가 계속 압박하고, 파이프와 청테이프로 무기를 만들어 버틴다. 한 키보드 2인 협동 지원. 스프라이트·배경·BGM 전부 코드 생성(2560×1440). **베타** — 1지역과 중간보스까지 플레이할 수 있고, 이후 지역은 피드백을 받으며 채워 나간다.',
     'CURFEW SIREN',
     'A zombie apocalypse survival action game split across two views. By day you scavenge a ruined city in isometric view; when the siren sounds, the camera drops into an arcade belt-scroll and you fight your way through the night. You get five minutes of daylight to enter buildings, search cabinets and car trunks for food, weapon parts and medicine, and pull survivors out. Nothing outside your vision cone is visible, and running or breaking down doors builds noise that draws the horde — every room is a choice between quiet and slow or loud and fast. When the sun sets you are pulled straight into the fight. Four-hit light chains, air juggles, motion-command arts and class-specific defences hold the swarm back. A per-limb infection clock, fractures and hunger keep pressing on you, and you craft weapons from pipe and duct tape to survive. Two-player co-op on one keyboard. Every sprite, backdrop and BGM is generated in code at 2560x1440. Beta — the first district and its midboss are playable; later districts are being built from player feedback.',
     '/games/thumbs/shots/curfew-siren.png', NULL, 'HTML5', 'IFRAME', '/games/curfew-siren/index.html',
     'LANDSCAPE', 0, 'kgd', 0, 'PUBLISHED', 'ACTION', '["beta","survival","multiplayer","leaderboard"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

-- 태그 매핑은 충돌을 흡수한다 — 마이그레이션 실패는 앱 기동 실패로 이어지는데
-- 여기서 얻는 것은 태그 몇 줄뿐이라 그 위험을 감수할 이유가 없다 (V35 와 같은 판단).
INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'beta' AS slug
                     UNION ALL SELECT 'survival'
                     UNION ALL SELECT 'multiplayer'
                     UNION ALL SELECT 'leaderboard') t
WHERE g.slug = 'curfew-siren';

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'curfew-siren';
