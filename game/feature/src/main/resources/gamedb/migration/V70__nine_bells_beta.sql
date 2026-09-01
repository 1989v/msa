-- 아홉 종 — DRAFT → BETA.
--
-- V69 를 DRAFT 로 낸 이유는 캐릭터가 아직 궁수 키우기의 것 그대로였기 때문이다.
-- 그 상태는 그대로지만, **실기에서 직접 해 봐야 알 수 있는 것**(발열·조작감·
-- 실제 GPU fps)이 남아 있어 공개하고 피드백을 받는다. 지금까지의 수치는 전부
-- 소프트웨어 렌더러 값이다.
--
-- 전용 캐릭터가 들어오면 PUBLISHED 로 올리는 UPDATE 를 새 버전으로 낸다.
-- **V69 와 이 파일을 고치지 마라** — 적용된 마이그레이션을 고치면 체크섬 불일치로
-- code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).

UPDATE game
SET status = 'BETA',
    tags = '["action","adventure","leaderboard","beta"]',
    content_updated_at = NOW(6)
WHERE slug = 'nine-bells';

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, 'beta'
FROM game g
WHERE g.slug = 'nine-bells'
  AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug = 'beta')
ON DUPLICATE KEY UPDATE tag_slug = VALUES(tag_slug);
