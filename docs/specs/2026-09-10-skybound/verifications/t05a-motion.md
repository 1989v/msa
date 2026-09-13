# T05A-0 · 이동 전환과 공격 동작

직접 실행 결과:

```text
node --test implementation/t02b/traversal/tests/action-motion.test.mjs implementation/t02b/traversal/tests/animation.test.mjs implementation/t02b/character/tests/motion.test.mjs
# tests 12
# pass 12
# fail 0
node --test implementation/t02b/traversal/tests/camera.test.mjs
# tests 3
# pass 3
# fail 0
node release/build-beta.mjs
Built docs/specs/2026-09-10-skybound/release/dist/index.html (5 payload files; metadata added)
```

관련 검사만 실행했다. 초기에는 기존 골반X=0 조건1개가 새로운 좌우반동과 충돌해 실패했다. 조건을 ±8mm 제한/주기 누적 이동 없음으로 변경했으며 실제 루트 이동0·두LOD 발접지·발목 이음새 검사는 유지했다.

단발 공격 제한/시간/reset, 오른손 움직임/클립 끝 복귀, 반복공격 재사용, 빠른 걷기·달리기 전환과 위상유지, 기존 이동상태 전환을 확인했다. 공격은 동작만이며 적피해는 미구현이다. 새 동작의 브라우저/실기기 미관 평가는 추가로 하지 않았으므로 최종 아트 품질 통과를 주장하지 않는다.
