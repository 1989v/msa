-- 클린룸 산출물 등록: pixel-logic (그림 논리 퍼즐 — 네모로직형).
-- 장르 프리셋 `picture-logic` 의 첫 산출물 — docs/standards/game-cleanroom-pipeline.md
-- 통합은 lib/platform.js 어댑터 — 랭킹 제출(runEnd) + pixellogic.* 6키의 서버 동기화.
--
-- supports_mobile=1 근거 (터치 에뮬레이션 414x896 · 캔버스 500x666 CSS 실측):
--   · 터치로 난이도 선택 → 같은 버튼 재탭으로 시작까지 확인
--   · 터치 드래그 칠하기 · 도구 전환(칠하기/엑스) 실제 반영 확인
--   · 도구 버튼 124.1 x 44.4 CSS px (터치 타깃 44px 상회)
--   · 칸 크기 보통(15x15) 28.7 CSS px / 어려움(16x25) 18.1 CSS px
--     → 큰 판은 큰 화면이 유리하다는 안내를 타이틀에 명시
--   · **가상패드(lib/touch.js)를 붙이지 않는다** — 칸을 눌러 칠하는 퍼즐이라
--     조이스틱을 얹으면 격자를 가리고 조작만 나빠진다 (프리셋 7절)

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('pixel-logic', '그림 로직',
     '가로세로에 붙은 숫자 힌트만 보고 칸을 칠하면 그림이 드러나는 논리 퍼즐. 숫자는 그 줄에 연속으로 칠해진 칸의 길이라, 확실히 빈 칸을 엑스로 지워 나가면 찍지 않고도 끝까지 풀린다. 모든 판은 추측 없이 논리만으로 유일한 답이 나오는지 검사를 통과한 것만 낸다. 난이도는 판 크기로 고른다 — 보통 15×15, 어려움 20×20, 전문가 25×25 이고 두 판마다 한 단계씩 커진다. 틀린 칸은 즉시 알려주지만 허용 횟수를 넘기면 거기서 끝이다. 완성한 그림은 이름과 함께 도감에 남고, 아직 못 푼 그림은 물음표로만 보인다 — 무엇이 나올지는 다 풀어야 안다. 그래픽·사운드 전부 절차 생성(1080×1440).',
     'Pixel Logic',
     'A nonogram-style logic puzzle: read the number clues along each row and column, fill the right cells, and a picture appears. Each number is the length of a run of filled cells, so marking the definitely-empty squares with an X carries you to the end without guessing. Every board is checked to have a single solution reachable by line logic alone before it is served. Difficulty is chosen by board size — 15x15, 20x20 or 25x25 — and grows one step every two stages. Wrong cells are flagged immediately, but run out of allowed mistakes and the run ends. Finished pictures join a named collection; the ones you have not solved show only a question mark, so what appears is the reward for solving it. All art and audio are procedurally generated at 1080x1440.',
     '/games/thumbs/shots/pixel-logic.png', NULL, 'HTML5', 'IFRAME', '/games/pixel-logic/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["leaderboard"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, 'leaderboard' FROM game g WHERE g.slug = 'pixel-logic';

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'pixel-logic';
