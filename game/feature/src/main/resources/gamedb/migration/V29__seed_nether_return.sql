-- 황천 회귀 — 하데스류 로그라이크 액션 RPG (docs/specs/2026-08-13-nether-return-hades-like.md).
-- 플랫폼 최초의 본격 액션 로그라이크: 대시 무적·문 보상 예고·신격 문장 24종·3계층+보스 3종·
-- 런 이어하기(중단 저장). 에셋은 0x72 DungeonTilesetII(CC-0) + 네오둥근모(OFL) — assets/CREDITS.md.
-- 세이브는 GameSaveData(암호화 봉투), 시드는 GameRun, 랭킹은 BASE/MODDED 트랙 분리(V28).

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('nether-return', '황천 회귀',
     '저승에 떨어졌다 — 베어서 올라가라. 무적 질주로 예고된 공격을 빠져나가고, 방마다 문 위의 문양으로 다음 보상을 고르고, 염라·바리·강림·마고 네 신격의 문장으로 빌드를 쌓는 하데스류 로그라이크. 3계층 끝의 재의 군주를 꺾으면 이승이다. 쓰러져도 명전과 영구 강화, 뱃사공의 예언은 남는다.',
     'Nether Return',
     'You fell into the Netherworld — cut your way back up. Dash through telegraphed attacks with i-frames, pick your next reward from the sigil above each door, and stack boons from four Korean death-gods into a build. Three tiers, three bosses, one light of the living. Death keeps your coins, upgrades and prophecies.',
     '/games/thumbs/shots/nether-return.png', NULL, 'HTML5', 'IFRAME', '/games/nether-return/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'PUBLISHED', 'RPG', '["roguelike"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

-- V25 태그 통합 이후 살아있는 슬러그만 매핑한다 (장르 축은 genre 컬럼이 담당)
INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, 'roguelike' FROM game g WHERE g.slug = 'nether-return';

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'nether-return';
