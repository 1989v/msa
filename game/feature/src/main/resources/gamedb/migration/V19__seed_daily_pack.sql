-- 데일리 퍼즐 팩 1차 — 리텐션 엔진 5종 (2026-08-06 확장 리서치, docs/product/2026-08-06-game-expansion-research.md).
-- 한글 워들 / Connections형 / 노노그램 / 퀸 배치 / 스도쿠. KST 자정 롤오버 날짜 시드(서버 불필요),
-- 스트릭 + 이모지 공유 + 클리어 시간 랭킹(game_score). 퍼즐 생성은 전부 클라이언트 결정적 시드.

INSERT INTO game_tag (slug, name, display_order) VALUES
    ('daily', 'Daily', 28),
    ('word', 'Word', 29),
    ('logic', 'Logic', 30);

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('word-warden', '낱말 파수꾼',
     '매일 한 단어 — 두 글자 우리말을 여섯 번 안에 맞혀라. 글자마다 초성·중성·종성이 따로 채점된다. 연속 출석 스트릭과 이모지 결과 공유, 무한 연습 모드까지.',
     'Word Warden',
     'One Korean word a day — guess the two-syllable word in six tries. Each syllable is scored by its jamo parts. Daily streaks, emoji sharing, and an endless practice mode.',
     '/games/thumbs/daily/word-warden.svg', NULL, 'HTML5', 'IFRAME', '/games/word-warden/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["daily","word","puzzle"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('quad-weave', '넉 줄 묶기',
     '열여섯 단어에 숨은 네 가지 공통점을 찾아 네 개씩 묶어라. 실수는 네 번까지 — 노랑이 가장 쉽고 보라가 가장 짓궂다. 매일 자정에 새 묶음.',
     'Quad Weave',
     'Sixteen Korean words hide four common threads — bundle them four by four with only four mistakes allowed. Yellow is easiest, purple is the trickster. A fresh weave every midnight.',
     '/games/thumbs/daily/quad-weave.svg', NULL, 'HTML5', 'IFRAME', '/games/quad-weave/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["daily","word","puzzle"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('pixel-mine', '네모 채굴',
     '숫자 단서만으로 숨은 광맥 그림을 캐내는 10×10 노노그램. 가로·세로 단서를 모두 만족하면 발굴 완료 — 클리어 시간으로 랭킹을 겨룬다.',
     'Pixel Mine',
     'A daily 10×10 nonogram — dig out the hidden vein using only the number clues. Satisfy every row and column to excavate, and race the clock for the leaderboard.',
     '/games/thumbs/daily/pixel-mine.svg', NULL, 'HTML5', 'IFRAME', '/games/pixel-mine/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["daily","logic","puzzle"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('royal-grid', '하루 한 판',
     '여덟 색 영역에 여왕을 한 명씩 — 같은 행·열 금지, 대각선 맞닿기 금지. 답이 하나뿐인 판이 매일 생성된다. 논리만으로 풀린다.',
     'Royal Grid',
     'Seat one queen in each color region — no shared rows or columns, no diagonal touch. A uniquely solvable board is generated daily. Pure logic wins.',
     '/games/thumbs/daily/royal-grid.svg', NULL, 'HTML5', 'IFRAME', '/games/royal-grid/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["daily","logic","puzzle"]',
     NOW(6), NOW(6), NOW(6), NOW(6)),
    ('number-garden', '숫자 정원',
     '매일 한 판, 답이 하나뿐인 스도쿠. 메모(연필) 모드와 실수 카운트, 같은 숫자 하이라이트까지 — 클리어 시간과 정확도로 겨룬다.',
     'Number Garden',
     'One sudoku a day with exactly one solution. Pencil notes, mistake counting and same-digit highlighting — compete on time and accuracy.',
     '/games/thumbs/daily/number-garden.svg', NULL, 'HTML5', 'IFRAME', '/games/number-garden/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["daily","logic","puzzle"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, m.tag_slug
FROM game g
         JOIN (SELECT 'word-warden' AS slug, 'daily' AS tag_slug
               UNION ALL SELECT 'word-warden', 'word'
               UNION ALL SELECT 'word-warden', 'puzzle'
               UNION ALL SELECT 'quad-weave', 'daily'
               UNION ALL SELECT 'quad-weave', 'word'
               UNION ALL SELECT 'quad-weave', 'puzzle'
               UNION ALL SELECT 'pixel-mine', 'daily'
               UNION ALL SELECT 'pixel-mine', 'logic'
               UNION ALL SELECT 'pixel-mine', 'puzzle'
               UNION ALL SELECT 'royal-grid', 'daily'
               UNION ALL SELECT 'royal-grid', 'logic'
               UNION ALL SELECT 'royal-grid', 'puzzle'
               UNION ALL SELECT 'number-garden', 'daily'
               UNION ALL SELECT 'number-garden', 'logic'
               UNION ALL SELECT 'number-garden', 'puzzle') m ON m.slug = g.slug;

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug IN ('word-warden', 'quad-weave', 'pixel-mine', 'royal-grid', 'number-garden');
