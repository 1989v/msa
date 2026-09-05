-- 좀비 레인 — 세 줄 중 하나를 골라 지나가면 그 문의 계산이 부대에 걸린다.
-- 조선 군사가 역병에 걸린 무리를 막는 군중 러너.
--
-- **이 파일을 고치지 마라** — 커밋한 마이그레이션은 이미 적용됐을 수 있고, 되고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).
-- 카피를 바꿔야 하면 새 버전으로 UPDATE 를 낸다.
--
-- 카드 그림은 **JPEG**(thumbs/shots), 공유 카드는 **PNG**(thumbs/og) — V77 이후의 규약이다.

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('zombie-lane', '좀비 레인',
     '조선 군사를 이끌고 역병에 걸린 무리를 막는다. 길은 세 줄로 갈려 있고 줄마다 숫자 문이 서 있다. 지나간 문의 계산이 부대에 그대로 걸린다 — ×3 과 +40 은 늘고 ÷2 와 −30 은 준다. 부대가 여덟이면 +40 이 다섯 배지만 오백이면 ×3 이 낫다. 그래서 매번 「지금 몇 명인가」를 보고 고르게 된다. 세 줄에 한 번은 곱셈 문이 하나만 나오고, 어떤 줄은 셋 다 나쁜 것 중 덜 나쁜 것을 고르는 자리다. 병종 문을 지나면 부대가 통째로 바뀐다: 창병은 무난하고, 궁수는 붙기 전에 화살로 미리 깎는 대신 붙으면 약하고, 방패병은 덜 죽는 대신 느리게 깎는다. 좀비 무리와 부딪히면 서로 깎이는데 수가 크면 뚫고 모자라면 거기서 끝난다. 열두 구간을 지나 궁궐 앞뜰까지 가고, 모은 엽전으로 출정 인원과 무예를 올린다.',
     'Zombie Lanes',
     'Lead a Joseon-era company against a plague-ridden horde. The road splits into three lanes and every lane carries a number gate. Whatever gate you pass applies its arithmetic to your company: ×3 and +40 grow it, ÷2 and −30 cut it. With eight soldiers a +40 is five times your strength, but with five hundred a ×3 is worth far more, so every row asks the same question — how many are you right now? Every third row carries exactly one multiply gate, and some rows offer nothing but bad choices, where the job is picking the least bad one. Troop gates convert the whole company: spearmen are the reliable default, archers thin the horde before contact but fold once it closes, and shield bearers lose fewer men while killing more slowly. When you hit a horde both sides shrink; a big company breaks through and a small one ends there. Twelve stages lead to the palace courtyard, and the coins you collect buy a larger starting company and better training.',
     '/games/thumbs/shots/zombie-lane.jpg', NULL, 'HTML5',
     'IFRAME', '/games/zombie-lane/index.html', 'BOTH', 1, 'kgd', 1, 'PUBLISHED',
     'ARCADE', '["arcade","runner","leaderboard"]', NULL, NOW(6), NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description),
    title_en = VALUES(title_en), description_en = VALUES(description_en),
    thumbnail_url = VALUES(thumbnail_url), engine_type = VALUES(engine_type),
    entry_url = VALUES(entry_url), genre = VALUES(genre), tags = VALUES(tags),
    orientation = VALUES(orientation), supports_mobile = VALUES(supports_mobile),
    status = VALUES(status), content_updated_at = NOW(6);

-- orientation='BOTH' · supports_mobile=1 — 두 방향 CDP 실측을 통과한 뒤에 켠다.
--   세로 390×844 · 가로 844×390 에서 부팅→달리기→줄 옮기기까지 탭·드래그만으로 도달.
--   조작은 **네이티브 터치**: 화면을 좌우로 끌거나 아래 세 칸을 탭한다. 가상패드를 붙이면 길을 가린다.
--
-- 보드를 나누지 않는다 — 모드가 하나뿐이고 점수는 구간·부대·연속으로 만든 단일 스칼라다.

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'leaderboard' AS slug) t
WHERE g.slug = 'zombie-lane'
  AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug = t.slug)
ON DUPLICATE KEY UPDATE tag_slug = VALUES(tag_slug);

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'zombie-lane'
ON DUPLICATE KEY UPDATE play_count = play_count;
