-- 순서 정하기(DECIDER) 장르 신설 — 커피 사는 사람·역할·차례를 정할 때 쓰는 도구형 게임.
--
-- 이 장르가 따로 필요한 이유는 분류 미관이 아니라 **기능**이다:
-- 게임 허브의 「랜덤으로 돌리기」가 이 장르 전체를 대상으로 하나를 뽑아 바로 시작한다.
-- 그래서 이 장르에 들어오는 게임은 두 가지를 지켜야 한다.
--   ① 파티 인계 규약(localStorage `kgd.party.v1`)을 읽어 참가자·방식이 정해진 채로 바로 시작
--   ② 출발 위치가 결과를 정하지 않을 것 — 출발 위치 ↔ 도착 등수 스피어만 |rho| < 0.1
-- 규약과 하한은 docs/standards/game-cleanroom-pipeline.md 의 `party-decider` 프리셋에 있다.

UPDATE game SET genre = 'DECIDER', updated_at = NOW(6)
WHERE slug IN ('marble-race', 'ladder-draw');
