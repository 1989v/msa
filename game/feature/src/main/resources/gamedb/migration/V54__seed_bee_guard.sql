-- 클린룸 산출물 등록: bee-guard (그려서 푸는 물리 퍼즐).
-- 장르 프리셋 `draw-to-solve` 의 첫 산출물 — docs/standards/game-cleanroom-pipeline.md
--
-- genre='PUZZLE' — 「순서 정하기(DECIDER)」가 아니다. 여럿이 뭔가를 정하는 도구가 아니라
-- 혼자 푸는 퍼즐이라, 허브의 랜덤 뽑기 대상에 들어가면 안 된다(참가자 인계도 못 받는다).
--
-- sdk_integrated=0, tags=[] 인 이유:
--   · 정해진 판을 푸는 퍼즐이라 점수를 겨루는 축이 없다. 억지로 만들면 잉크를 아끼는
--     대회가 되어 "어떻게 막을까" 가 "몇 픽셀 줄일까" 로 바뀐다
--   · 저장할 것이 '어디까지 깼는지' 뿐이라 서버 동기화가 필요 없다
--
-- 판 검사 실측 (dev.verify(), 10판 전수):
--   · 모범 답안대로 그리면 전부 성공 — 풀 수 없는 판 0
--   · 아무것도 안 그리면 전부 실패 — 거저 통과되는 판 0
--   · 죽은 입력 감사 105칸(5화면 x 21키) 전수 통과
--
-- supports_mobile=1 근거 (터치 에뮬레이션 414x896 실측):
--   · 화면 버튼 91.2 x 44.5 CSS px (터치 하한 44 상회) — 캔버스 좌표로는 116px 이다.
--     처음 78px 로 두었더니 0.383배 축소되어 29.9 CSS px 이 됐다
--   · 가상패드(lib/touch.js)를 붙이지 않는다 — 손으로 직접 그리는 게임이라 패드가 판을 가린다

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('bee-guard', '벌 막기',
     '선을 그으면 그대로 벽이 되는 물리 퍼즐. 벌이 아이에게 날아오기 전에 지붕을 씌우든 옆을 막든 꿀단지 쪽으로 흘려보내든, 잉크가 허락하는 만큼만 그려서 정해진 시간을 버텨야 한다. 그리는 동안 시간은 멈추고, 시작을 누르면 그린 선이 실제 물체가 되어 벌이 부딪히고 튕긴다. 실행은 항상 같은 결과라 실패했을 때 "왜 실패했는지" 를 알 수 있고, 실패해도 그림은 그대로 남아서 한 획만 고쳐 다시 돌릴 수 있다. 판 10개는 전부 자동 검사를 통과했다 — 모범 답안대로 그리면 반드시 풀리고, 아무것도 안 그리면 반드시 실패한다. 몸풀기 판은 없다: 1판부터 위와 옆에서 동시에 들어온다. 벌은 방향과 무게가 다르고, 어떤 판은 아이를 쫓아오며, 꿀단지가 있는 판은 막는 대신 꾀어내는 편이 싸다. 광고·결제·점수 경쟁이 없고 저장되는 것은 어디까지 깼는지뿐이다. 그래픽·사운드 전부 절차 생성(1080x1440).',
     'Bee Guard',
     'A physics puzzle where the line you draw becomes a real wall. Bees are coming for the kid, and you have a fixed amount of ink to stop them — build a roof, wall off the sides, or ramp them toward the honey pot instead. Time is frozen while you draw; press start and your strokes turn into solid bodies that bees hit and bounce off. Every run is deterministic, so a failure tells you exactly what went wrong, and your drawing stays on screen afterward so you can fix one stroke instead of starting over. All ten stages pass an automated check: drawing the reference solution always wins, and drawing nothing always loses. There is no warm-up stage — the first one already comes at you from above and from the side at once. Bees differ in direction and weight, some chase the kid, and on honey stages luring is cheaper than blocking. No ads, no purchases, no score chase; the only thing saved is how far you got. All art and audio are procedurally generated at 1080x1440.',
     '/games/thumbs/shots/bee-guard.png', NULL, 'HTML5', 'IFRAME', '/games/bee-guard/index.html',
     'PORTRAIT', 1, 'kgd', 0, 'PUBLISHED', 'PUZZLE', '[]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'bee-guard';
