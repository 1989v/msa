# 구현 인계 — 2026-10-18

- 작업 위치: `/Users/gideok-kwon/IdeaProjects/msa`, 게임 submodule `portal-fe/public/games`, 게임 코드 소유 범위 `woodland-haven/`.
- 완료: 공유/개인 합성, 기존 순수 규칙 재사용, 로컬 권위 서버·HTTP/SSE·쿠키·해시·원자 저장, 전체 생활 UI 의도 라우팅, 순번/응답 손실 재확인, 다중 탭 충돌 복구, 입력 TTL, 안정 ID, 클릭 활성화 중 관리창 갱신 지연.
- 독립 리뷰: 부모가 코어/클라이언트 리뷰 수행, 발견 수정 후 두 리뷰 SHIP 수신. 부모가 최종 게임 커밋 승인했으며 부모 별도 suite 재실행 중.
- 검증: 기존59 회귀 유지. 서버 HTTP13개 PASS(43초, 실제 매 틱 fsync), 클라이언트3개 PASS, 관리창 jsdom2개 PASS, 초기 공유 모델5개 PASS. 최종 전체 suite `tests84/pass84/fail0`, duration45599.991292ms.
- 빌드: `npx tsc -b` exit0; `npx vite build` exit0, `built in 1m 15s` (기존 chunk-size/plugin-time 경고). 모든 최상위 게임 mjs 구문 PASS.
- 다음: 전체 suite 결과 기록 → 부모 최종 재검증 → 게임 파일만 커밋 → 부모 root 문서/서브모듈 포인터 반영.
- 블로커: 새 브라우저 UI 승인 없음. 브라우저/UI/CDP/Playwright를 사용하지 않았으며 모델·HTTP/SSE·jsdom 검증을 실제 브라우저 검증으로 표시하면 안 된다.
- 유지 사항: `territory/`가 다른 세션의 신규 파일로 보임. 소유 범위 밖이므로 스테이징/변경 금지.
- 함정: 최초 위치의 최인접 자원은 가지가 아닌 작은 돌이다. 경합 명령은 서버가 다음 최인접 대상으로 바꾸지 않도록 원래 target kind+ID를 보낸다. 같은 게스트 연결을 새로 열어도 채집 대기는 초기화하면 안 된다. 오프라인 개인 위치도 설치/성장으로 막으면 저장 파서가 재시작을 거부하므로 모든 저장 위치를 예약한다.
- 산출물: `woodland-haven/openapi.json`은 로컬 API 계약, `README.md`는 실행/데이터/실패 복구/제한 안내. 임시 테스트 로그 `/private/tmp/woodland-shared-world-tests.log` — 재생성 약45초. 저장 실패 fixture는 실제 파일 쓰기 전 실패를 주입하고, 실패 틱·명령은 공개하지 않는다.

- 프로세스 재시작 검증 보강: `tests/process-restart.test.mjs` 실제 PID3개, SIGTERM 저장 복원·SIGKILL stale-lock 회수·같은 쿠키/명령 재전송 무중복 확인. 최종 전체85/pass85/fail0, duration43963.359125ms; 제품 코드 변경 없음. 부모 집중 검증1/pass1/fail0.
