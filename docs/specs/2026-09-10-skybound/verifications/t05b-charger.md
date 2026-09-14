<!-- source: docs/specs/2026-09-10-skybound/implementation/t05b/src/charger.mjs -->
# T05B-3 · 돌진 수호기 규칙

`node --test docs/specs/2026-09-10-skybound/implementation/t05b/tests/charger.test.mjs` → `# tests 5`, `# pass 5`, `# fail 0`.
방향 고정/옆회피/복귀, 한돌진한피해 이벤트, 벽·높은단차·지면없음, pause/처치/인지, 프레임 분할 일관성 확인.
아직 브라우저 통합 전인 순수 규칙이며 배포 번들에 포함되지 않는다. 빌드는 이 규칙 단위에서 반복하지 않았다.
