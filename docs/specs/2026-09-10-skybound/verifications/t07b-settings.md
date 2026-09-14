<!-- source: docs/specs/2026-09-10-skybound/implementation/t07a/src/settings.mjs -->
# T07B-1 · 플레이 설정

`node --test docs/specs/2026-09-10-skybound/implementation/t07a/tests/settings.test.mjs` → `# tests 3`, `# pass 3`, `# fail 0`.
설정 라운드트립/잘못된 감도와 버전/저장 거부/그래픽 DPR·그림자 계약 확인.
`node docs/specs/2026-09-10-skybound/release/build-beta.mjs` → `Built .../release/dist/index.html (5 payload files; metadata added)`.
실제 브라우저 감도/그림자 시각/실기기 성능은 미검증. 이번 변경으로 관련 검사만 실행.

모션 감소 확장: 같은 settings.test.mjs 실행 → `# tests 4`, `# pass 4`, `# fail 0`. OS 기본/이전 v1/사용자 명시 해제 보존 확인. build-beta.mjs도 통과. 실제 브라우저 모션 확인은 후속.
