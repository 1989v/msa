-- 클린룸 산출물 등록: card-flip (여럿이서 정하는 도구 — 카드 뒤집기).
-- 장르 프리셋 `party-decider` 의 세 번째 산출물 — docs/standards/game-cleanroom-pipeline.md
--
-- genre='DECIDER' 로 바로 넣는다(V52 처럼 나중에 갱신하지 않는다) — 이 장르는 분류가 아니라
-- 기능이라, 등록되는 순간 게임 허브의 「랜덤으로 돌리기」 대상에 들어가야 한다.
-- 그 대가로 두 계약을 지킨다: lib/party.js 인계를 읽고, 출발 위치가 결과를 정하지 않는다.
--
-- sdk_integrated=0, tags=[] 인 이유 (marble-race·ladder-draw 와 같다):
--   · 참가자 이름은 실명이 섞이는 값이라 서버로 보내지 않는다
--   · 순위를 겨루는 게임이 아니라 여럿이 뭔가를 정하는 도구라 리더보드가 성립하지 않는다
--
-- 공정성 실측:
--   · 재현 불일치 0 (10판)
--   · 차례별 걸림 분포 chi2 = 4.18(왼쪽부터 고르기) / 2.68(아무거나 고르기) — 임계 11.07 @n=6
--   · 출발 위치(뽑는 차례) ↔ 결과 스피어만 rho = -0.011(순서 정하기) / -0.008(한 명이 걸린다)
--   · 죽은 입력 감사 57칸(3씬 x 19키) 전수 통과
--
-- supports_mobile=1 근거 (터치 에뮬레이션 414x896 실측):
--   · 카드 한 장이 108.3 x 153.7 CSS px — 터치 타깃 하한 44px 을 크게 넘는다
--   · 가상패드(lib/touch.js)를 붙이지 않는다 — 카드를 직접 눌러야 하는데 패드가 판을 가린다

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('card-flip', '카드 뒤집기',
     '커피 사는 사람 정하기, 순서 정하기에 쓰는 카드 뽑기. 참가자 수만큼 카드를 엎어 놓고 한 명씩 뒤집는다. 남은 카드가 줄수록 걸릴 확률이 오르고 화면이 그 숫자를 계속 보여 주기 때문에, 마지막 두 장에서 가장 조마조마하다. 심장 박동 소리도 확률을 따라 빨라진다. 먼저 뽑는 게 불리하다고들 하지만 실제로는 누구나 정확히 같은 확률이다 — 남은 카드가 줄어 확률이 오르는 것과 자기 차례까지 갈 확률이 줄어드는 것이 정확히 상쇄되기 때문이고, 4천 판을 돌려 차례별 분포를 카이제곱으로 확인했다(4.18, 임계 11.07). 왼쪽부터 고르든 아무거나 고르든 같다. 판이 끝나면 아무도 안 뒤집은 카드까지 전부 까서 보여 준다 — 걸림이 정말 한 장뿐이었는지 눈으로 확인시키기 위해서다. 한 명이 걸린다 / 순서 정하기 / 여러 명 뽑기 세 가지로 쓸 수 있고 2~12명까지 된다. 결과를 미리 정해 두고 영상만 재생하는 방식이 아니며, 판마다 다시 보기 코드가 나오고 같은 코드로 다시 깔면 카드 배치가 똑같다. 이름은 이 기기에만 저장되고 어디로도 전송하지 않는다. 앱 안에 돈이나 포인트는 없다. 그래픽·사운드 전부 절차 생성(1080x1440).',
     'Card Flip',
     'A card draw for settling things in a group — who buys the coffee, what order to go in. One face-down card per person; you take turns flipping. The fewer cards left, the higher the odds of being the one, and the screen keeps that number in front of you the whole time, so the last two cards are where everyone holds their breath. The heartbeat under it speeds up with the odds. People assume going first is worse, but every position is exactly equally likely — the rising odds and the falling chance of even reaching your turn cancel out exactly — and that was checked over four thousand draws with a chi-square test (4.18 against a 11.07 threshold). Picking left-to-right or picking at random makes no difference either. When a draw ends, every card nobody turned over is revealed too, so you can see for yourself there was only ever one. Three modes: one person is it, running order, or pick several. Two to twelve players. Nothing is decided in advance and played back; every draw shows a code, and rebuilding with the same code lays out the same cards. Names never leave your device, and there is no money or points anywhere in the app. All art and audio are procedurally generated at 1080x1440.',
     '/games/thumbs/shots/card-flip.png', NULL, 'HTML5', 'IFRAME', '/games/card-flip/index.html',
     'PORTRAIT', 1, 'kgd', 0, 'PUBLISHED', 'DECIDER', '[]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'card-flip';
