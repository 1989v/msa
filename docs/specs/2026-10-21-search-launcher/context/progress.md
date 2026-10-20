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
