# Release progress

- 실제 배포 패키지: `/private/tmp/search-launcher-release-20261021`, branch `release/search-launcher-20261021`.
- base: `59644dd328bfc2821654cef4646513bd9eb1b97a`. 원본 shared tree는 staged/dirty 변경 그대로 보존.
- 최신 remote grouped API/6타입 unified +별도 attractions hybrid를 유지하는 부모 승인 호환 구현으로 재구성했다.
  기존 unified 매핑/문서와 source재시도/CronJob/live 모델 설정을 보존하며 suggest/cafe/page/독립 FE/PWA 추가.
- 격리 검증: Gradle app757 +batch137 +domain262 =1156 tests, failures/errors0, verifyArchitecture 포함 `BUILD SUCCESSFUL in 33s`.
- FE `render-content` 후 `tsc -b` exit0;8files/33tests passed; `npm run build` exit0, SEO/HTML 정리 완료.
  기존 landslide 상세500→요약 대체 경고는 unrelated data 문제로 범위 확장하지 않음.
- CLI router/생성 nginx search+s/manifest/PNG PASS. diff --check exit0.
- 로컬 엔진 없음. 부모가 read-only 실제OS prefix case_insensitive probe 성공을 확인했다.
  전체 운영 동작/기존 타입 건수 보존은 부모가 배포·재색인 후 확인해야 한다.
- UI 도구 미사용. 기존 localhost UI승인은 연결 브라우저 없어 실행되지 않았다; 생산 UI승인 없음.
- 원본189test/flat full API/관광지 중복index/suspended 새CronJob의 설명은 이 배포판에 적용하지 않는다.
- 로그: `/private/tmp/search-release-{compile,gradle,tsc,fe-tests,build}.log`. 재생성 비용 큰 산출물 없음.
- 현재 hook적용 커밋 준비. push/build/deploy/reindex는 부모 책임이며 이 에이전트는 아직 실행하지 않았다.


## 2026-10-21 검색 화면 개정

- 위치: 동일 격리 release checkout. origin/main fetch + ff-only 확인 시 `Already up to date` (eef3e8fd3).
- 승인된 범위: 필터/state/type URL 제한 제거. legacy type URL에서도 자동완성/전체/페이지 모두 전체 타입 요청.
- `useHeritageSurface`/`ThemeToggle` 유지. kh-field/kh-display/kh-button-ghost, 한지·기와 정경 토큰과 황토 라벨 사용.
  전체 button CSS가 토글을 덮지 않도록 범위를 좁혔고 선택 강조는 그림자 대신 border를 사용한다.
- FE 검증: 관련 5 files/22 tests + appShell 1 file/8 tests + routes 1 file/10 tests passed (총40), scoped ESLint exit0, `npx tsc -b` exit0, diff --check exit0.
- 화면 브라우저 검증은 실행하지 않았다(이번 개정 UI 승인 없음). 원본 shared workspace는 변경하지 않았다.
- `doc_scan.py`는 격리 clone의 미초기화 ai submodule에 없어 실행하지 못했다. 기능 spec/결정/tasks와 DESIGN scope를 수동 동기화했다.
- `npm run build` exit0 (render-content → tsc -b → Vite → SPA routes → SEO → HTML 정리).
  출력: `[seo] 프리렌더 190개 페이지 · 게임 83종`, `[html] 주석 제거 795개 파일 · 1402.9KB 절감`.
  로그: `/private/tmp/search-heritage-build.log`. routes 테스트에는 기존 외부 XHR stderr가 있지만10 tests passed.
- 부모가 이 개정의 push/image build/rollout을 담당한다. 이 에이전트는 배포하지 않는다.
