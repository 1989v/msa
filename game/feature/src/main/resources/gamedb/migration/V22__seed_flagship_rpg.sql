-- 플래그십 오픈월드 RPG "표류 대륙" P1 수직 슬라이스 (2026-08-07).
-- 리서치 3장의 장기 트랙 첫 단계 — 손제작 코어(전투·마을·던전) + 성장 뼈대 + 청크 스트리밍 구조.
-- 다른 게임과 달리 다중 파일(js/*.js)이고 세이브는 IndexedDB (이어하기 코드는 64KB 상한이라 부적합).
-- 최종 목표는 30시간+ 지만 현 상태는 약 2시간 분량이므로 BETA 로 등록한다.

INSERT INTO game_tag (slug, name, display_order) VALUES
    ('open-world', 'Open World', 41),
    ('adventure', 'Adventure', 42);

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('drift-continent', '표류 대륙',
     '난파선에서 눈을 뜬 표류자가 되어 표착항 사람들을 만나고, 꺼진 등대의 비밀을 파헤친다. 3연타와 회피, 두 갈래 기술로 싸우고 기술의 나무를 키워라 — 가라앉은 등대 3층 끝에는 망령이 기다린다. (P1 — 계속 확장되는 장편)',
     'Drift Continent',
     'Wash ashore as a castaway, meet the people of Landfall Port, and uncover why the lighthouse went dark. Fight with three-hit combos, dodges and two branching skills, grow your skill tree, and face the keeper''s wraith at the bottom of the sunken lighthouse. (P1 — an ongoing long-form title)',
     '/games/thumbs/art/drift-continent.svg', NULL, 'HTML5', 'IFRAME', '/games/drift-continent/index.html',
     'LANDSCAPE', 1, 'kgd', 1, 'BETA', 'RPG', '["open-world","adventure","rpg"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, m.tag_slug
FROM game g
         JOIN (SELECT 'drift-continent' AS slug, 'open-world' AS tag_slug
               UNION ALL SELECT 'drift-continent', 'adventure'
               UNION ALL SELECT 'drift-continent', 'rpg') m ON m.slug = g.slug;

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'drift-continent';
