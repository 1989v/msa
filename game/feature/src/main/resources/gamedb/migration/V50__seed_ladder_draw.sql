-- 클린룸 산출물 등록: ladder-draw (여럿이서 정하는 도구 — 사다리타기).
-- 장르 프리셋 `party-decider` 의 두 번째 산출물 — docs/standards/game-cleanroom-pipeline.md
--
-- sdk_integrated=0, tags=[] 인 이유 (marble-race 와 같다):
--   · 참가자 이름과 나눌 항목은 실명·업무 내용이 섞이는 값이라 서버로 보내지 않는다
--   · 순위를 겨루는 게임이 아니라 여럿이 뭔가를 정하는 도구라 리더보드가 성립하지 않는다
--
-- 공정성 실측 (각 4,000판):
--   · 일대일 대응 깨짐 0 (12만 판)
--   · 섞기 전 사다리는 균등하지 않다 — n=2 chi2 21.9 / n=6 chi2 640.2
--   · 아래 항목을 같은 코드로 섞으면 균등해진다 — n=2 chi2 0.0 / n=6 chi2 3.1 (임계 3.84 / 11.07)
--
-- supports_mobile=1 근거 (터치 에뮬레이션 414x896 · 캔버스 500x666 CSS 실측):
--   · 터치로 준비 화면 → 이름표 탭(한 줄만 먼저) → 출발까지 확인
--   · 화면 버튼 157.4 x 44.4 CSS px (터치 타깃 44px 상회) · 이름표 칸 폭 75 CSS px
--   · 가상패드(lib/touch.js)를 붙이지 않는다 — 지켜보는 화면이라 조이스틱이 사다리를 가린다

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('ladder-draw', '사다리타기',
     '커피 사는 사람 정하기, 역할 나누기, 순서 정하기에 쓰는 사다리타기. 이름을 넣으면 사다리가 만들어지고, 가로줄은 처음부터 전부 화면에 보인다 — 가리는 것은 아래 결과뿐이다. 한 명이 걸린다 / 순서 정하기 / 항목 배정 세 가지로 쓸 수 있고, 이름표를 누르면 그 사람 줄만 먼저 내려가는 것도 볼 수 있다. 사다리는 구조상 항상 일대일 대응이라 두 사람이 같은 결과를 받는 일이 없다. 다만 사다리 자체는 균등하지 않아서, 사람별 확률을 고르게 만드는 장치는 아래 항목 배치를 같은 코드로 섞는 것이다(실측: 6명 기준 섞기 전 카이제곱 640, 섞은 뒤 3.1). 결과를 미리 정해 두고 영상만 재생하는 방식이 아니며, 판마다 다시 보기 코드를 띄우고 같은 같은 코드로 다시 만들면 똑같은 사다리가 나오는 것으로 확인할 수 있다. 이름과 항목은 이 기기에만 저장되고 어디로도 전송하지 않는다. 앱 안에 돈이나 포인트는 없다. 그래픽·사운드 전부 절차 생성(1080×1440).',
     'Ladder Draw',
     'A ladder lottery (amidakuji) for settling things in a group — who buys the coffee, who does which chore, what order to go in. Type the names and the ladder is drawn with every rung visible from the start; the only thing hidden is the result at the bottom. Three modes: one person is it, running order, or assigning a list of items. Tap a name to send just that line down first. A ladder is always a bijection, so two people can never land on the same result. The ladder alone is not uniform, though — with a limited number of rungs you tend to land near where you started — so the thing that makes each person equally likely is shuffling the bottom labels from the seed (measured: chi-square 640 before shuffling versus 3.1 after, for six people). Nothing is decided in advance and played back; every draw shows its seed, and rebuilding with the same seed gives the same ladder. Names and items never leave your device, and there is no money or points anywhere in the app. All art and audio are procedurally generated at 1080x1440.',
     '/games/thumbs/shots/ladder-draw.png', NULL, 'HTML5', 'IFRAME', '/games/ladder-draw/index.html',
     'PORTRAIT', 1, 'kgd', 0, 'PUBLISHED', 'CASUAL', '[]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'ladder-draw';
