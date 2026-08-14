-- 클린룸 실험 산출물 2종 정식 등록 (docs/conventions/game-art-baseline.md 기준 상향 참조).
-- 별도 세션이 기존 게임·lib 열람 금지 조건으로 독립 구현 → 메인 세션이 플랫폼에 얹는 분업.
-- 통합은 lib/platform.js 어댑터 — 랭킹 제출 + localStorage 세이브의 서버 동기화(GameSaveData).

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('abyssal-crown', '심연의 왕관',
     '가라앉은 왕국의 마지막 창기사가 되어 심연의 세 지역을 돌파하는 하데스류 로그라이크 액션. 무적 대시로 예고된 공격을 흘리고, 26종 축복으로 빌드를 쌓고, 페이즈 3단 보스를 꺾어라. 죽어도 심연 결정과 영묘의 영구 강화는 남는다. 그래픽·사운드 전부 절차 생성(2560×1440).',
     'Abyssal Crown',
     'A Hades-like roguelike action game — the last lancer of a sunken kingdom cutting through three abyssal regions. Dash through telegraphed attacks, stack 26 blessings into a build, and break three multi-phase bosses. Death keeps your crystals and permanent upgrades. All art and audio are procedurally generated at 2560x1440.',
     '/games/thumbs/shots/abyssal-crown.png', NULL, 'HTML5', 'IFRAME', '/games/abyssal-crown/index.html',
     'LANDSCAPE', 0, 'kgd', 1, 'PUBLISHED', 'RPG', '["roguelike","leaderboard"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('raging-fist-saga', '레이징 피스트 사가',
     '벨트스크롤 난투에 킹오브파이터식 모션 커맨드를 얹었다 — ↓↘→ 파열탄, 승천각, 반원 폭쇄장, 기 게이지 초필까지 캔슬로 잇는 정통 커맨드 액션. 비 내리는 항만·제련소·설산 사원 3+1 스테이지, 비밀 통로와 봉인 두루마리, 히든 스테이지 분기. 스프라이트·배경·BGM 전부 코드 생성.',
     'Raging Fist Saga',
     'Belt-scroll brawling meets KOF-style motion commands — quarter-circle fireballs, invincible uppercuts, half-circle busters and meter supers, all chained through cancels. Four themed stages (rainy harbor, foundry, snow temple, hidden void), secret rooms, sealed scrolls and a true-ending branch. Every sprite, backdrop and BGM is generated in code.',
     '/games/thumbs/shots/raging-fist-saga.png', NULL, 'HTML5', 'IFRAME', '/games/raging-fist-saga/index.html',
     'LANDSCAPE', 0, 'kgd', 1, 'PUBLISHED', 'ACTION', '["leaderboard"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

-- V25 통합 이후 살아있는 태그만 매핑 (장르 축은 genre 컬럼 담당)
INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, m.tag_slug
FROM game g
         JOIN (SELECT 'abyssal-crown' AS slug, 'roguelike' AS tag_slug
               UNION ALL SELECT 'abyssal-crown', 'leaderboard'
               UNION ALL SELECT 'raging-fist-saga', 'leaderboard') m ON m.slug = g.slug;

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug IN ('abyssal-crown', 'raging-fist-saga');
