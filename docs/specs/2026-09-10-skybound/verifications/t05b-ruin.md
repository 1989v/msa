# T05B-2 · 파수터 활성화

- 구현: 수호석 처치 후 고정 장치에 접근해 G 또는 터치로 활성화. 거리/높이/가림/지상/동작 잠금 조건 적용. 중복 완료 없음.
- 보존: 기존 공중 경로와 파수터 진행은 안전 복귀에 유지. 전체 초기화 및 재접속 저장은 미지원.
- 검증: `node --test docs/specs/2026-09-10-skybound/implementation/t05b/tests/ruin.test.mjs docs/specs/2026-09-10-skybound/implementation/t05b/tests/ruin-integration.test.mjs` → `# tests 5`, `# pass 5`, `# fail 0`.
- 빌드: `node docs/specs/2026-09-10-skybound/release/build-beta.mjs` → `Built .../release/dist/index.html (5 payload files; metadata added)`.
- 실제 브라우저/터치 배치 검사는 생략했으며 후속 플레이 테스트에 남긴다.
- 자체 검토: Three/DOM은 표현층, 규칙은 무의존. 새로운 패키지/서비스/구조 변경 없음. 운영 배포 미실행.
