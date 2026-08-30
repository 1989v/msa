-- 궁수 키우기의 BETA 배지가 남아 있던 것.
--
-- V66 이 `status` 만 PUBLISHED 로 바꿨는데, 화면은 두 신호를 모두 본다
-- (portal-fe `isBeta`: status === 'BETA' || tags.includes('beta')).
-- V61 이 심어 둔 `beta` 태그 행이 그대로라 배지가 계속 붙었다.
--
-- **V66 을 고치지 않는다.** main 이 곧 배포 브랜치라 이미 적용됐을 수 있고,
-- 적용된 마이그레이션을 되고치면 체크섬 불일치로 code-dictionary 가 기동하지 못한다
-- (개념사전·게임·전시·이력서·딜이 한 파드라 같이 내려간다).
DELETE gtm FROM game_tag_map gtm
JOIN game g ON g.id = gtm.game_id
WHERE g.slug = 'archer-outbreak' AND gtm.tag_slug = 'beta';
