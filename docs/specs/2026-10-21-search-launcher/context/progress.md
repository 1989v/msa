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


## 2026-10-21 GNB 서비스 탐색 자동완성

- 위치: `/private/tmp/search-launcher-release-20261021`만 수정. clean 확인 후 origin/main 4328cfc4a로 ff. 다른 카페/랭킹 변경 보존.
- 기존 /search와 GNB ServiceExplorer가 `useUnifiedSearch`를 공유한다. 전체 타입 180ms suggest, 첫 결과/방향키 순환/한 번 Enter로 정규 상세 이동.
- query별 응답 키와 generation/AbortController로 역순·입력 변경·clear·close/reopen의 과거 응답을 무시한다.
  status는 요청 키에서 유도하며 effect 안의 동기 상태 초기화를 추가하지 않았다.
- composing/isComposing/229/조합 직후 Enter, native form submit을 공통 보호한다. 정상 Enter는 기본 form 제출을 막아 한 번만 이동한다.
- 첫 Escape는 자동완성 닫기+전파 차단, 다음 Escape는 기존 dialog 닫기. IME Escape도 전파 차단. KhSheet 자체 변경 없음.
- combobox/listbox/activedescendant, 기존 focus trap/복귀, 서비스 카드·한영 문구, 선택행 scroll/모바일 결과 높이 제한 유지.
- 명시적 전체 보기 링크는 unifiedSearchHref(q)에 all=1을 붙여 전체 검색으로 바로 연다. backend/PWA/공유 토큰 변경 없음.
- 검증: scoped 6 files/45 tests passed (두 진입점 동일 계약 + page URL 회귀 + dialog + API/목적지/shell), scoped ESLint exit0, tsc-b exit0.
  로그 `/private/tmp/service-explorer-search-tests.log`, `/private/tmp/service-explorer-search-eslint.log`.
- 최종 코드 `npm run build` exit0: Vite built in492ms, 프리렌더190개 페이지/게임83종, HTML796파일 정리.
  최종 로그 `/private/tmp/service-explorer-search-final-build.log`. 최종 SEO 원격 en/sido48/p3 timeout 경고1회가 있었지만 파이프라인은 exit0.
  초기 build도 exit0이나 IME/link 수정 전 산출물이므로 최종 build 결과를 배포 근거로 사용한다.
- UI computer-use 미실행(해당 범위 승인 없음). 원본 shared workspace 변경 없음. 정상 hook 커밋 후 부모가 push/image rollout 수행.
