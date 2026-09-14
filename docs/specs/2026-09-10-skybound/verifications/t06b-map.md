<!-- source: docs/specs/2026-09-10-skybound/implementation/t06a/src/exploration.mjs, docs/specs/2026-09-10-skybound/implementation/t02b/traversal/src/map-view.mjs -->
# T06B-2 · 지도와 발견

`node --test docs/specs/2026-09-10-skybound/implementation/t06a/tests/exploration.test.mjs docs/specs/2026-09-10-skybound/implementation/t07a/tests/save.test.mjs` → `# tests 10`, `# pass 10`, `# fail 0`.
발견 범위/높이/중복/저장 복원, 불량 ID·중복·배열 크기 거부, 지도 좌표 북쪽/축척 확인.
`node docs/specs/2026-09-10-skybound/release/build-beta.mjs` → `Built .../release/dist/index.html (5 payload files; metadata added)`.
브라우저 UI/키보드·터치/성능 검사는 후속. 새 외부 의존/서비스 구조 변경 없음.
