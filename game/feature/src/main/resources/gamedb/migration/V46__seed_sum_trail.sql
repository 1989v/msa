-- 클린룸 산출물 등록: sum-trail (격자 숫자 퍼즐 — 경로 드래그형).
-- 장르 프리셋 `grid-number-puzzle` 의 첫 산출물 — docs/standards/game-cleanroom-pipeline.md
-- 통합은 lib/platform.js 어댑터 — 랭킹 제출(runEnd) + sumtrail.* 5키의 서버 동기화.
--
-- supports_mobile=1 근거 (터치 에뮬레이션 412x915 · pointer:coarse 실측):
--   · 터치로 타이틀 → 플레이 진입 확인
--   · 터치 드래그로 5장 경로를 그어 실제 클리어 확인
--   · 캔버스 412×549 · 가로 넘침 없음 · 셀 52.6 CSS px (터치 타깃 44px 상회,
--     관용 반경 0.62셀까지 치면 실질 판정 지름 65px)
--   · **가상패드(lib/touch.js)를 붙이지 않는다** — 이 장르는 네이티브 터치 드래그가
--     정답이고 조이스틱을 얹으면 격자를 가리고 조작도 나빠진다 (프리셋 7절)

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('sum-trail', '합이 딱',
     '숫자 카드를 이어 그어 제시된 합을 정확히 만드는 퍼즐. 넘치면 더 못 잇고, 딱 맞는 순간 확인 없이 바로 지워진다 — 그 지점이 유일한 정지점이다. 길게 이을수록 점수가 붙고 3.2초 안에 다음을 만들면 연속 배율이 쌓인다. 라운드마다 할당량을 채워야 넘어가고, 통과 못 하는 카드(돌)와 잠긴 카드(자물쇠)가 길을 막지만 옆칸을 지우면 부서지고 풀린다. 목표는 단순 합·금지 숫자·홀짝 세 종류. 마우스·터치 드래그와 키보드 양쪽으로 똑같이 그릴 수 있다. 목표는 난수가 아니라 지금 판에서 실제로 만들 수 있는 합에서만 뽑고 리필마다 다시 검사하므로 풀 수 없는 판이 나오지 않는다. 그래픽·사운드 전부 절차 생성(1080×1440).',
     'Sum Trail',
     'Trace a path through number cards to hit the given sum exactly. Overshoot and the path stops; land on it and the cards clear instantly — that moment is the only stopping point. Longer trails score more, and chaining within 3.2 seconds builds a streak multiplier. Each round has a quota to fill, while stone tiles block the way and locked tiles hide their value until you clear beside them. Three goal types: plain sum, banned digit, odds/evens only. Draw with mouse, touch or keyboard alike. Targets are never rolled at random — they are picked only from sums the current board can actually make, and rechecked after every refill, so the board never dead-ends. All art and audio are procedurally generated at 1080x1440.',
     '/games/thumbs/shots/sum-trail.png', NULL, 'HTML5', 'IFRAME', '/games/sum-trail/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'PUZZLE', '["leaderboard"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, 'leaderboard' FROM game g WHERE g.slug = 'sum-trail';

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'sum-trail';
