-- 실플레이 화면 캡처를 썸네일로 — 손그림 SVG/부재(404) 경로를 대체한다.
-- 캡처: 각 게임을 구동해 대표 장면을 320x180 PNG 로 축소 저장 (portal-fe 정적 자산)

UPDATE game SET thumbnail_url = CONCAT('/games/thumbs/shots/', slug, '.png'), updated_at = NOW(6)
WHERE slug IN ('monster-tamer', 'depth-delver', 'outlaw-frontier',
               'gate-holdout', 'gear-bastion', 'iron-vanguard', 'ember-temple', 'frost-outpost');

-- 썸네일 캡처 과정에서 생긴 임시 게스트 세이브 정리
DELETE FROM game_save_data WHERE member_id IS NULL AND JSON_EXTRACT(data, '$.t') IS NOT NULL;
