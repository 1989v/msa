-- 참여형 파티 게임 2종 (ADR-0092 TG13) — 7초를 맞춰라 · 원 그리기.
--
-- **이 파일을 고치지 마라** — 커밋한 마이그레이션은 이미 적용됐을 수 있고, 되고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).
--
-- ## 결정자 게임과 다른 점
-- 이 둘은 **겨루는 게임**이다. 각자 자기 기기로 하고 서버가 채점한다. 그래서 결정자 셋과 달리
-- 리더보드가 성립한다 — 혼자서는 기록 도전이고, 파티에서는 그 판의 순위가 결과다.
--
-- BETA 로 넣으므로 released_at 을 지금으로 찍는다. 노출 상태(BETA·PUBLISHED)인데 이 값이
-- 비어 있으면 chk_game_released_when_visible 이 INSERT 를 막고, 그러면 테스트 게이트가 죽어
-- **그 커밋의 모든 서비스 이미지가 안 만들어진다**(V75 가 그 사고로 생긴 제약이다).
--
-- 능력 태그는 V86 이 만든 셋을 쓴다: roster-ready(명부를 읽는다) · relay-ready(릴레이에 붙는다) ·
-- interactive-party(참여형). input-decides 는 안 붙인다 — 각자 자기 화면에서 하고 서버가
-- 채점하므로 남의 입력을 중계할 필요가 없다.

INSERT INTO game_tag (slug, name, display_order)
VALUES ('interactive-party', 'Interactive Party', 230)
ON DUPLICATE KEY UPDATE name = VALUES(name), display_order = VALUES(display_order);

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('seven-seconds', '7초를 맞춰라',
     '여럿이 모여 각자 자기 폰으로 하는 시간 감각 겨루기. 화면을 누르면 시작하고, 7초라고 생각될 때 다시 누른다. 7초에 가까운 순서가 그대로 결과가 되어 커피 사는 사람이나 벌칙 대상을 정한다. 3초가 지나면 숫자가 가려지기 때문에 화면을 보고 맞추는 것이 아니라 정말 감각으로 재게 된다. 시간은 각자의 기기가 아니라 서버가 잰다 — 판이 시작된 시각과 멈춤이 도착한 시각을 서버가 재므로, 기기 시계를 고치거나 개발자도구로 값을 바꿔서 이길 수 없다. 혼자서도 할 수 있고 그때는 기록 도전이 된다. 방을 열면 링크와 QR 이 나오고, 들어온 사람이 명부에서 자기 이름을 골라 앉는다. 앱 안에 돈이나 포인트는 없다.',
     'Seven Seconds',
     'A sense-of-time contest for a group, each on their own phone. Tap to start, then tap again when you think seven seconds have passed. Whoever lands closest wins, and the order settles who buys the coffee or takes the forfeit. The counter hides itself after three seconds, so you are measuring with your own sense of time rather than reading a number off the screen. The clock is the server''s, not your phone''s — the server stamps when the round opened and when your stop arrived, so changing your device clock or poking at devtools does not help. Playable alone as a personal best. Open a room and you get a link and a QR code; whoever joins picks their own name from the roster. There is no money or points anywhere in the app.',
     '/games/thumbs/shots/seven-seconds.png', NULL, 'HTML5', 'IFRAME', '/games/seven-seconds/index.html',
     'PORTRAIT', 1, 'kgd', 0, 'BETA', 'CASUAL',
     JSON_ARRAY('roster-ready', 'relay-ready', 'interactive-party'),
     NOW(6), NOW(6), NOW(6), NOW(6)),

    ('circle-trace', '원 그리기',
     '화면에 흐리게 그려진 원을 손가락으로 따라 그리는 게임. 여럿이 모여 각자 자기 폰으로 하고, 가장 고르게 따라 그린 사람이 이긴다. 채점은 목표 원에서 얼마나 벗어났는지로 하며, 각도를 120칸으로 나눠 칸마다 한 표씩 주기 때문에 빨리 그리든 천천히 그리든 점수가 같다 — 속도는 실력이 아니라서다. 덜 그린 구간은 최대 이탈로 잡히므로 어려운 부분을 건너뛰어도 이득이 없다. 목표 원은 서버가 내고 한 판의 전원이 같은 원을 받는다. 점수도 서버가 계산한다 — 궤적만 보내고 점수는 보내지 않는다. 혼자서도 할 수 있고 그때는 기록 도전이 된다. 앱 안에 돈이나 포인트는 없다.',
     'Trace the Circle',
     'Trace the faint circle on screen with your finger. Everyone plays on their own phone and the steadiest hand wins. Scoring measures how far you drifted from the target circle: the circle is split into 120 angular slots and each slot gets one vote, so drawing fast or slow gives the same score — speed is not skill. Any stretch you skip counts as the worst possible drift, so there is nothing to gain by leaving out the hard part. The target circle comes from the server and everyone in a round gets the same one. The score is computed server-side too — your device sends the path, never a score. Playable alone as a personal best. There is no money or points anywhere in the app.',
     '/games/thumbs/shots/circle-trace.png', NULL, 'HTML5', 'IFRAME', '/games/circle-trace/index.html',
     'PORTRAIT', 1, 'kgd', 0, 'BETA', 'CASUAL',
     JSON_ARRAY('roster-ready', 'relay-ready', 'interactive-party'),
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug IN ('seven-seconds', 'circle-trace');

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.tag_slug
  FROM game g
  JOIN (SELECT 'roster-ready' AS tag_slug
        UNION ALL SELECT 'relay-ready'
        UNION ALL SELECT 'interactive-party') t
 WHERE g.slug IN ('seven-seconds', 'circle-trace')
ON DUPLICATE KEY UPDATE game_id = game_tag_map.game_id;
