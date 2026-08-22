-- 클린룸 산출물 등록: coin-corgi (낙하물 받기·피하기 캐주얼 아케이드).
-- 장르 프리셋 `casual-catch` 의 첫 산출물 — docs/standards/game-cleanroom-pipeline.md
-- 통합은 lib/platform.js 어댑터 — 랭킹 제출(runEnd) + coincorgi.* 5키의 서버 동기화.
--
-- supports_mobile=1 근거 (터치 에뮬레이션 412x915 · pointer:coarse 실측):
--   · #vt-root 생성, 조이스틱 + 액션 버튼 2종(왈!/대시) 렌더
--   · 조이스틱 드래그 → 방향키 합성 → 최고속 ±880px/s, 실제 x 이동 ±363px
--   · 액션 버튼 포인터다운 → 짖기·대시 실발동 (stat.barks / stat.dashes 증가)
--   · 액션 버튼 터치로 타이틀 → 플레이 진입 확인
--   · 캔버스 411×549 상단 정렬, 가로 넘침 없음
--   · lib/platform.js 의 랭킹 버튼이 가상패드 액션 버튼과 겹쳐 게임 CSS 에서 위로 띄움

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('coin-corgi', '코인 코기',
     '하늘에서 돈이 쏟아진다. 똥도 같이 쏟아진다 — 한 판 1분짜리 낙하물 아케이드. 받는 판정은 넉넉하고 맞는 판정은 좁아서, 아슬아슬하게 파고드는 게 이득이다. 짖어서 벌을 쫓고 똥을 밀어내며 콤보 배율을 ×8까지 쌓아라. 금괴는 늘 똥 두 개를 끼고 내려오니 먹을지 말지는 매번 선택이다. 햇살 공원·노을 골목·네온 옥상 3개 존이 34초마다 배경과 BGM째 바뀌고, 돈벼락과 비둘기 습격이 리듬을 깬다. 누적 획득액으로 견종 3종과 시작 하트를 해금한다. 그래픽·사운드 전부 절차 생성(1080×1440).',
     'Coin Corgi',
     'Money rains from the sky. So does dog poop — a one-minute arcade catcher. The catch hitbox is generous and the damage hitbox is tight, so squeezing into the gap pays off. Bark to scare away bees and shove poop aside while stacking your combo multiplier up to x8. Gold bars never fall alone: two poops flank every one, making each a real choice. Three zones (sunny park, sunset alley, neon rooftop) swap backdrop and BGM every 34 seconds, and money-rain and pigeon-raid waves break the rhythm. Lifetime earnings unlock three dog breeds and an extra starting heart. All art and audio are procedurally generated at 1080x1440.',
     '/games/thumbs/shots/coin-corgi.png', NULL, 'HTML5', 'IFRAME', '/games/coin-corgi/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'ARCADE', '["leaderboard"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, 'leaderboard' FROM game g WHERE g.slug = 'coin-corgi';

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'coin-corgi';
