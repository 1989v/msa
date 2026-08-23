-- 클린룸 산출물 등록: marble-race (여럿이서 정하는 도구 — 구슬 경주).
-- 장르 프리셋 `party-decider` 의 첫 산출물 — docs/standards/game-cleanroom-pipeline.md
--
-- sdk_integrated=0, tags=[] 인 이유:
--   · 참가자 이름은 실명이 섞이는 값이라 서버로 보내지 않는다 → 플랫폼 저장 동기화 미사용
--   · 순위를 겨루는 게임이 아니라 여럿이 뭔가를 정하는 도구라 리더보드가 성립하지 않는다
--
-- 사행성 가드레일 (프리셋 1절):
--   · 앱 안에 돈·포인트·베팅 금액 입력란이 없다
--   · "당첨금·배당·베팅" 표현을 쓰지 않는다 — 걸린 사람 / 뽑힌 사람 / 순서
--   · 결과를 미리 정하고 애니메이션만 재생하지 않는다. 다시 보기 코드 공개 + 같은 다시 보기 코드 재현 제공
--
-- supports_mobile=1 근거 (터치 에뮬레이션 414x896 · 캔버스 500x666 CSS 실측):
--   · 터치로 준비 화면 → 출발 → 빨리 감기까지 확인 (시뮬레이션 시간 2.9s → 5.9s)
--   · 화면 버튼 135.2 x 44.4 CSS px (터치 타깃 44px 상회)
--   · 구슬 지름 20.4 CSS px — 번호가 읽힌다
--   · 가상패드(lib/touch.js)를 붙이지 않는다 — 지켜보는 화면이라 조이스틱이 판을 가린다

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('marble-race', '구슬 레이스',
     '커피 사는 사람 정하기처럼 여럿이서 뭔가 정할 때 쓰는 구슬 경주. 이름을 넣고 출발하면 구슬이 못밭과 범퍼, 회전 십자, 시소, 컨베이어를 지나 실제로 굴러 내려가고, 결승선을 넘는 순서가 그대로 결과가 된다. 꼴찌가 걸린다 / 1등이 뽑힌다 / 몇 등 지정 / 순서 정하기 네 가지로 쓸 수 있고, 이름 뒤에 x3 을 붙이면 그 사람 구슬이 세 개가 되어 그만큼 확률이 올라간다. 결과를 미리 정해 두고 영상만 재생하는 방식이 아니라 물리를 실제로 돌린 결과이며, 판마다 다시 보기 코드를 화면에 띄우고 같은 같은 코드로 다시 돌리면 똑같은 결과가 나오는 것으로 그 사실을 확인할 수 있다. 구슬은 반지름·질량·반발계수가 모두 같고 출발 자리는 매 판 무작위로 섞는다. 참가자 이름은 이 기기에만 저장되고 어디로도 전송하지 않는다. 앱 안에 돈이나 포인트는 없다. 맵 3종, 그래픽·사운드 전부 절차 생성(1080×1440).',
     'Marble Race',
     'A marble race for settling things in a group — who buys the coffee, what order to go in. Type the names, hit start, and the marbles actually roll down through peg fields, bumpers, spinning crosses, seesaws and conveyor belts; the order they cross the finish line is the result. Four modes: last place is it, first place is picked, a specific rank, or the full running order. Add x3 after a name and that person gets three marbles, raising their chance accordingly. Nothing is decided in advance and played back as an animation — the physics really runs, and every race shows its seed so you can replay the exact same result and see that for yourself. All marbles share the same radius, mass and bounce, and the starting positions are reshuffled every race. Names never leave your device, and there is no money or points anywhere in the app. Three maps; all art and audio are procedurally generated at 1080x1440.',
     '/games/thumbs/shots/marble-race.png', NULL, 'HTML5', 'IFRAME', '/games/marble-race/index.html',
     'PORTRAIT', 1, 'kgd', 0, 'PUBLISHED', 'CASUAL', '[]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'marble-race';
