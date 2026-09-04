-- 카드 그림을 PNG 에서 JPEG 로. 320x180 실플레이 캡처를 PNG 로 담고 있었는데, 사진에 PNG 라
-- 장당 41KB(합 1.7MB)였다. 같은 그림이 JPEG 품질 82 로는 장당 16KB(합 688KB)다 — 카드가
-- 화면에서 차지하는 크기(고해상도 폰에서 약 290px)를 생각하면 눈에 보이는 차이는 없다.
--
-- 파일은 games 저장소의 thumbs/shots 에 같은 이름으로 함께 들어간다. 옛 PNG 는 이번에는 남겨 둔다 —
-- 이 마이그레이션(게임 서비스)과 정적 파일(portal-fe)은 배포 시점이 몇 분 어긋나므로, 먼저 지우면
-- 그 사이 카드가 빈 자리로 뜬다. 확인 뒤 별도로 지운다.

UPDATE game
SET thumbnail_url = CONCAT('/games/thumbs/shots/', slug, '.jpg'),
    updated_at    = NOW(6)
WHERE thumbnail_url LIKE '/games/thumbs/shots/%.png';
