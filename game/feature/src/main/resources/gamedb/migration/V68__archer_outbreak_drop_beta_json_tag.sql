-- BETA 배지가 여전히 붙던 것 — **태그의 출처를 잘못 짚었다.**
--
-- V67 은 `game_tag_map` 에서 beta 행을 지웠고 성공했다. 그런데 화면이 읽는 태그는
-- 그 표가 아니라 `game.tags` **JSON 컬럼**이다(GameJpaEntity 가 이 컬럼을 읽는다).
-- 0행 삭제는 오류가 아니라 조용히 지나가므로, 마이그레이션이 성공했는데도 화면은
-- 그대로였다. 확인 없이 표 이름을 가정한 대가다.
--
-- V67 을 고치지 않는다 — 이미 적용됐다(2026-08-30 01:05). 새 번호로 간다.
UPDATE game
SET tags = JSON_REMOVE(tags, JSON_UNQUOTE(JSON_SEARCH(tags, 'one', 'beta')))
WHERE slug = 'archer-outbreak'
  AND JSON_SEARCH(tags, 'one', 'beta') IS NOT NULL;
