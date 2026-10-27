# Scoped crosscheck

| Layer | Result | Evidence |
|---|---|---|
| Rules → code | PASS | Standalone adapters depend on engine-free gameplay modules; root design tokens centrally mapped; no original-game or MSA edits. Fresh review SHIP. |
| Spec → tasks | PASS | SR-1–4 mapped to the single bounded task group; follow-up prompt/guide included as documentation. |
| Tasks → implementation | PASS | Editable Luau, deterministic place builder, actual-source tests, artifact and README exist. |
| Decisions → behavior | PASS | Last safe platform replaces initial region default; buying and using are distinct; live sales disabled. |
| Docs → paths/commands | PASS | Six local document links checked; parent executed documented verifier command successfully. |
| Runtime acceptance | WARN | Studio/API/physics/touch/receipts require separate runtime checks; no success claimed. |

This check is limited to the new standalone Roblox scope. `roblox/` is not an MSA source root in `docs/doc-index.json`; no platform source mappings or deployment configuration changed. Unrelated dirty and staged work was preserved.

## 2026-10-28 최신 범위

| 대상 | 판정 | 근거 |
|---|---|---|
| 사용자 의도→명세 | PASS | 최우선 개정이 좌표 복제 대신 게임 구성/아이디어 보존과 로블록스 최적화를 명시 |
| 명세→코드 | PASS(소스 범위) | 네이티브 생성기/7구간/조작·진행·부활 연결, 기존 경사 타일/원작 자료 기본 의존 제거 |
| 코드→산출물 | PASS | 부모 검증에서 정확한19개 스크립트·결정적 XML·기본 맵·서비스/스폰/카메라 확인 |
| 수정→리뷰 | SHIP | 유지된 복구·저장·모바일 발견과 추가 재접속 수명주기 문제 해결 재확인 |
| 문서→실행 | PASS | 한글 README·템플릿 최신화, 내부 링크10개 누락0 |
| 실제 플레이 | 미검증 | 스튜디오/API/물리/터치/실저장/실영수증은 도구 접근 거절과 별개 확인 필요 |

실제 코드 검사는9611개 assertion/20개 구문 컴파일/전역 변수 검사이며, 원작 발판 수에 맞췄다는 합격선이 아니다. 상세 출력은 `status.md`.
