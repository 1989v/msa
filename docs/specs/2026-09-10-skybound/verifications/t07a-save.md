# T07A-1 · 로컬 저장과 안전 복원

- 명령: `node --test docs/specs/2026-09-10-skybound/implementation/t07a/tests/save.test.mjs docs/specs/2026-09-10-skybound/implementation/t05b/tests/saved-ruin.test.mjs`
- 결과: `# tests 6`, `# pass 6`, `# fail 0`. 버전/자료 검증, 저장소 거부/할당량, 게임 키 삭제, 재접속 안전 위치/수호석 완료 유지.
- `node docs/specs/2026-09-10-skybound/release/build-beta.mjs` → `Built .../release/dist/index.html (5 payload files; metadata added)`.
- 브라우저/초기화 확인창/실제 저장소 재접속 플레이 테스트는 생략하고 후속에 남긴다.
- 자체 검토: 저장 어댑터는 callback으로 저장소를 얻고 Three/DOM에 의존하지 않는다. 렌더링 중 쓰지 않고 완료 이벤트와 명시 저장만 기록한다. 실패 후 자동 저장 루프를 차단한다.
- 한계: 파수터 및 공중 경로만 저장. 프리즘 배치와 돌고리 완료 저장은 다음 단계. 운영 반영 미실행.
