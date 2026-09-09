-- 파티 게임 분류 신호 (ADR-0092) — **셋으로 갈린다.**
--
-- **이 파일을 고치지 마라** — 커밋한 마이그레이션은 이미 적용됐을 수 있고, 되고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).
--
-- ## 왜 장르가 아니라 태그인가
-- 장르는 게임당 하나다(`Genre.kt` — "다중 성격은 tags 가 담당하고 genre 는 항상 단일이다").
-- 참여형을 장르로 만들면 결정자 장르와 배타가 되어 `[게임 픽]` 의 합집합이 깨진다.
-- 결정자 장르는 「출발 위치가 결과를 정하지 않는다」를 계약에 포함하는데 그 조건이
-- 7초 맞추기에는 적용되지 않는다는 점에서도 같은 축에 둘 수 없다.
--
-- ## 왜 신호가 셋인가
-- 「릴레이에 붙는가」 하나로는 `[랜덤]`(비참여형만)과 입력 중계 대상의 목록을 만들 수 없다 —
-- 입력형 비참여형(카드 뽑기)과 참여형이 그 축에서 똑같이 참이기 때문이다.
--
-- ## 이름에 `party` 를 쓰지 않는다
-- 이미 카테고리 태그로 존재하고 echo-duel·bracket-battle·sketch-sleuth 와 그림 계열에
-- 붙어 있다. 재사용하면 파티에서 못 쓰는 게임이 목록에 나타난다.

INSERT INTO game_tag (slug, name, display_order)
VALUES ('roster-ready', 'Roster Ready', 200),   -- ① 명부 규약을 읽는다
       ('relay-ready', 'Relay Ready', 210),     -- ② 릴레이에 붙는다
       ('input-decides', 'Input Decides', 220)  -- ③ 사람 입력이 결과를 바꾼다
ON DUPLICATE KEY UPDATE name          = VALUES(name),
                        display_order = VALUES(display_order);

-- 결정자 3종 — 명부를 읽는다. 카드 뽑기만 입력이 결과를 바꾼다.
INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, m.tag_slug
  FROM game g
  JOIN (SELECT 'marble-race' AS slug, 'roster-ready' AS tag_slug
        UNION ALL SELECT 'ladder-draw', 'roster-ready'
        UNION ALL SELECT 'card-flip', 'roster-ready'
        UNION ALL SELECT 'card-flip', 'relay-ready'
        UNION ALL SELECT 'card-flip', 'input-decides') m ON m.slug = g.slug
ON DUPLICATE KEY UPDATE game_id = game_tag_map.game_id;

-- 화면이 읽는 tags JSON 도 함께 맞춘다 — 한쪽만 고치면 목록과 상세가 갈린다.
--
-- 이 셋의 `tags` 는 비어 있었고 그 이유가 시드에 적혀 있다(리더보드·저장 동기화 미사용).
-- 그 판단은 그대로 두고 **능력 태그만** 더한다 — 없던 분류 태그를 여기서 임의로 붙이지 않는다.
UPDATE game SET tags = JSON_ARRAY('roster-ready'), content_updated_at = NOW(6)
 WHERE slug IN ('marble-race', 'ladder-draw');

UPDATE game SET tags = JSON_ARRAY('roster-ready', 'relay-ready', 'input-decides'),
                content_updated_at = NOW(6)
 WHERE slug = 'card-flip';
