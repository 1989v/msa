<!-- source: docs/specs/2026-09-10-skybound/implementation/t02b/traversal/src/charger-view.mjs, docs/specs/2026-09-10-skybound/implementation/t05a/src/guardian.mjs -->
# T05B-4 · 돌진 수호기 전투 연결

`node --test docs/specs/2026-09-10-skybound/implementation/t05a/tests/guardian.test.mjs docs/specs/2026-09-10-skybound/implementation/t05a/tests/shared-damage.test.mjs docs/specs/2026-09-10-skybound/implementation/t05b/tests/charger-view.test.mjs` → `# tests 9`, `# pass 9`, `# fail 0`.
실제 지형에서 위치/타격 대상 동기화, 플레이어 피해, 적 처치/복귀 보존, 동시 공격 한 번의 피해, 회피 타격 시점, pause/복귀/기존 반격 회귀 확인.
`node docs/specs/2026-09-10-skybound/release/build-beta.mjs` → `Built .../release/dist/index.html (5 payload files; metadata added)`.
브라우저 플레이·난이도·예고 표현 시각 검사는 미수행. 현재 돌진 역할은 운영 미배포.
