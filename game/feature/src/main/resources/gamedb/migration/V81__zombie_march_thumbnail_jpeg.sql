-- 좀비 행군 카드 그림을 JPEG 로. V79 가 `.png` 로 넣었는데, 카드 그림은 V77 에서 이미
-- 전부 JPEG 로 옮겨 간 뒤였다 — 신작 하나만 옛 확장자를 가리켜 그 카드가 빈 자리로 떴다.
--
-- V79 를 고치지 않는 이유: 이미 운영에 적용됐다. 되고치면 체크섬 불일치로 code-dictionary 가
-- 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).
--
-- OG 카드(`thumbs/og/`)는 PNG 그대로다 — 1200×630 공유 카드는 글자가 들어가 JPEG 링잉이 보인다.

UPDATE game
SET thumbnail_url = '/games/thumbs/shots/zombie-march.jpg',
    updated_at    = NOW(6)
WHERE slug = 'zombie-march';
