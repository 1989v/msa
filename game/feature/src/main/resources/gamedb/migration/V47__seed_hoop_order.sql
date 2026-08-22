-- 클린룸 산출물 등록: hoop-order (정렬 퍼즐 — 턴제 · 되돌리기 필수).
-- 장르 프리셋 `sort-puzzle` 의 첫 산출물 — docs/standards/game-cleanroom-pipeline.md
-- 통합은 lib/platform.js 어댑터 — 랭킹 제출(runEnd) + hooporder.* 5키의 서버 동기화.
--
-- supports_mobile=1 근거 (터치 에뮬레이션 412x915 · pointer:coarse 실측):
--   · 터치로 타이틀 → 플레이 진입 확인
--   · 터치 2탭(집기 → 놓기)과 터치 드래그 양쪽으로 실제 이동 확인
--   · 기둥 히트 폭 49.8 CSS px (터치 타깃 44px 상회) · 고리 폭 40.2 CSS px
--   · 기둥 배치가 모바일에서도 한 줄 유지 · 가로 넘침 없음
--   · **가상패드(lib/touch.js)를 붙이지 않는다** — 탭으로 노는 퍼즐이라 조이스틱을
--     얹으면 기둥을 가리고 조작만 나빠진다 (프리셋 7절)
--   · 기둥 수를 9개로 상한 — 한 줄 배치라 기둥이 늘면 곧 터치 타깃이 좁아진다

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('hoop-order', '고리 맞추기',
     '섞인 색 고리를 기둥 사이로 옮겨 색깔별로 정리하는 퍼즐. 같은 색 위에만 놓을 수 있고 빈 기둥에는 아무 색이나 놓는다. 제한 시간이 없어 천천히 생각해도 되고, 대신 되돌리기가 판당 다섯 번뿐이다 — 유효한 수가 하나도 없어졌는데 되돌리기까지 다 썼으면 거기서 끝이다. 후반에는 기둥 받침에 목표 색이 정해지고 뒷면이 가려진 고리가 섞인다. 색맹도 구분할 수 있도록 고리마다 색과 함께 기호를 새겼다. 판은 완성 상태에서 역으로 섞어 만들기 때문에 풀 수 없는 배치가 나오지 않는다. 그래픽·사운드 전부 절차 생성(1080×1440).',
     'Hoop Order',
     'Sort scrambled colored rings across poles until each color sits together. A ring only goes onto a matching one, or onto an empty pole. There is no timer — think as long as you like — but undos are limited to five per board, and if you run out of legal moves with no undos left, that is the end. Later stages assign a target color to each pole base and mix in face-down rings. Every ring carries a shape as well as a color so it stays readable without color vision. Boards are built by scrambling a solved state backwards, so an unsolvable layout can never appear. All art and audio are procedurally generated at 1080x1440.',
     '/games/thumbs/shots/hoop-order.png', NULL, 'HTML5', 'IFRAME', '/games/hoop-order/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["leaderboard"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, 'leaderboard' FROM game g WHERE g.slug = 'hoop-order';

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'hoop-order';
