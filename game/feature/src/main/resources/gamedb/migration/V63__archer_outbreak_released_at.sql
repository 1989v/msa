-- 공개된 게임인데 released_at 이 비어 있으면 「최신」 정렬에서 빠진다.
--
-- V61 시드가 released_at 을 NULL 로 넣었다. 공개 목록은 PUBLISHED·BETA 를 모두 싣지만
-- sort=new 는 이 컬럼으로 줄을 세우므로, 값이 없으면 **새 게임인데 최신순에서 안 보인다** —
-- 사용자가 새 게임을 찾는 가장 흔한 경로가 그 정렬이라 사실상 노출되지 않는 것과 같다.
--
-- DRAFT 는 건드리지 않는다. 아직 내보내지 않은 게임에 출시일을 박으면 승격 시점이 사라진다.

UPDATE game
SET released_at = created_at
WHERE released_at IS NULL
  AND status IN ('PUBLISHED', 'BETA');
