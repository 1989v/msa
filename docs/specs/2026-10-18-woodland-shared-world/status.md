# Verification — 2026-10-18

| 단계 | 결과 | 증거 |
|---|---|---|
| 기존 회귀 | PASS | `node --test portal-fe/public/games/woodland-haven/tests/*.test.mjs` 최초 수정 전/공유 틱 분리 후 `tests59/pass59/fail0` |
| 실제 HTTP/SSE | PASS | `node --test .../tests/server.test.mjs` `tests13/pass13/fail0`, duration43424ms. 생활 전체 HTTP dispatch, 실제 디스크 재시작, 두 클라이언트 경합/재전송, 연결/쿠키/경로/한도·실패 포함 |
| 클라이언트 복구 | PASS | `tests/online.test.mjs` tests3/pass3/fail0, 네트워크 어댑터 fixture |
| 클릭 활성화 | PASS | `tests/dialog-refresh.test.mjs` tests2/pass2/fail0, jsdom |
| 구문 | PASS | 모든 `woodland-haven/*.mjs`에 `node --check`, exit0 |
| FE 타입 | PASS | `cd portal-fe && npx tsc -b`, exit0 |
| FE 빌드 | PASS/WARN | `npx vite build`, exit0 `built in1m15s`; 기존 큰 chunk와 플러그인 소요 경고 |
| 독립 리뷰 | SHIP | 부모가 fresh-context 코어/클라이언트 리뷰 후 수정 검증, 양쪽 SHIP 전달 |
| 전체 확장 suite | PASS | `node --test portal-fe/public/games/woodland-haven/tests/*.test.mjs` `tests84/pass84/fail0`, duration45599.991292ms. 기존59 + 추가25 회귀 |
| 실제 브라우저 UI | 미실행 | 새 컴퓨터 사용 승인 없음. HTTP·jsdom을 브라우저 검증으로 대체 주장하지 않음 |

## 실제 프로세스 재시작 보강

기존 HTTP 재시작 테스트는 같은 Node 프로세스의 서버 인스턴스 재생성이므로, 별도 `tests/process-restart.test.mjs`를 추가했다. 실제 자식 Node 프로세스를 실행해 게스트 발급·경제 명령을 저장하고 SIGTERM 종료 후 다른 PID에서 같은 쿠키/가방/자원 소진/저장된 명령 결과를 복원한다. 이어 SIGKILL로 남긴 잠금을 세 번째 PID가 회수하고 같은 명령을 재실행하지 않는지 확인한다. 제품 코드는 변경하지 않았다.

- 구현자 집중 검증: `node --test portal-fe/public/games/woodland-haven/tests/process-restart.test.mjs`, `tests1/pass1/fail0`, duration341.067459ms. 실제 PIDs92658→92661→92662.
- 부모 독립 집중 검증: 같은 명령 `tests1/pass1/fail0`, duration421.243ms. 실제 PIDs95185→95231→95232.
- 부모 기존 전체 검증: `tests84/pass84/fail0`, duration46029.60025ms.
- 보강 후 전체 검증: `node --test portal-fe/public/games/woodland-haven/tests/*.test.mjs`, `tests85/pass85/fail0`, duration43963.359125ms. 로그 `/private/tmp/woodland-shared-world-process-tests.log`.
