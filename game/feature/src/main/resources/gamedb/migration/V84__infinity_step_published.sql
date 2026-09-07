-- 인피니티 스탭 정식 배포 — BETA → PUBLISHED.
--
-- **이 파일을 고치지 마라** — 커밋한 마이그레이션은 이미 적용됐을 수 있고, 되고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).
-- 상태를 되돌려야 하면 새 버전으로 UPDATE 를 낸다.
--
-- released_at 은 건드리지 않는다 — BETA 도 노출이라 처음 노출된 2026-09-03 이 출시 시점이고,
-- 여기서 덮으면 「새로 나온 게임」 정렬이 오늘로 튄다.
--
-- 수익화는 이 상태 변경만으로 켜지지 않는다: isMonetizable() 은 PUBLISHED **와** sdk_integrated 를
-- 둘 다 본다. 광고를 붙일 때 sdk_integrated 를 따로 올린다.

UPDATE game
   SET status = 'PUBLISHED',
       updated_at = NOW()
 WHERE slug = 'infinity-step'
   AND status = 'BETA';
