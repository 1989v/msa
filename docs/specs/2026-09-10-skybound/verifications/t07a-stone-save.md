# T07A-2 · 돌고리 저장/복원

- `node --test docs/specs/2026-09-10-skybound/implementation/t04b/tests/receiver.test.mjs docs/specs/2026-09-10-skybound/implementation/t07a/tests/save.test.mjs` → `# tests 11`, `# pass 11`, `# fail 0`.
- 실제 초원 지형에서 완성 pose 복원/완료 latch/집기 잠금/안전 복귀/전체 초기화 확인. v1 새 필드 누락 호환, 불량 값 거부 확인.
- `node docs/specs/2026-09-10-skybound/release/build-beta.mjs` → `Built .../release/dist/index.html (5 payload files; metadata added)`.
- 브라우저 플레이는 사용자 비용 방침에 따라 생략. 운영 배포 미실행.
- 자체 검토: 완료 판정은 기존 receiver 규칙 유지, 스토리지에는 boolean만 저장, 게임 외 파일/구조/의존성 변경 없음.
