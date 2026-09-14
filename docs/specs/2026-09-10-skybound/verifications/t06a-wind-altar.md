# T06A-1 · 바람탑 제단과 세 유적

- `node --test docs/specs/2026-09-10-skybound/implementation/t06a/tests/ruins.test.mjs docs/specs/2026-09-10-skybound/implementation/t06a/tests/wind-altar.test.mjs docs/specs/2026-09-10-skybound/implementation/t07a/tests/save.test.mjs` → `# tests 13`, `# pass 13`, `# fail 0`.
- 경로/발판/거리/높이/입력 잠금, 중복 방지, 여섯 완료 순서, 실제 발판 좌표/저장 재접속을 검사했다.
- `node docs/specs/2026-09-10-skybound/release/build-beta.mjs` → `Built .../release/dist/index.html (5 payload files; metadata added)`.
- 자체 검토: 규칙은 Three/DOM/스토리지 무의존, 기존 G 상호작용을 공유하며 발판 실제 높이를 사용한다. 신규 패키지/서비스 변경 없음.
- 브라우저 플레이 생략. 운영 반영 미실행. 바람문/최종 전망섬은 다음 단위.
