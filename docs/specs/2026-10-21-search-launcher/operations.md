# 배포 운영 인계

## 격리 배포 기준

`/private/tmp/search-launcher-release-20261021`, base `59644dd328bfc2821654cef4646513bd9eb1b97a`.
공유 원본의 staged/dirty 상태를 보존하고 최신 원격에 변경을 다시 적용했다.
**이 배포판의 계약은 spec.md/contracts/openapi.yaml이다.** 기존 grouped API·6타입·별도 attractions hybrid를 보존하며
새 suggest, cafe_drink facets, page(default0), 검색 독립 FE/PWA만 더한다.
root build.gradle/워크플로/CronJob cadence/resources/모델 설정/인덱스 매핑은 변경하지 않는다.
기존6타입을 제거하거나 관광지 벡터를 unified에 복제하지 않는다.

## 부모가 수행할 배포·확인

1. hook 적용 커밋과 changed paths를 확인하고 main push. 보통 images는 search/search-batch/portal-fe만 감지한다.
2. 기존 CI/architecture/tests와 images 세 빌드 및 정상 rollout을 확인한다.
3. 기존 unified-reindex는 active 일정 UTC20:10/Forbid를 유지한다. 현재 실행이 없는지 확인한 뒤
   새 search-batch 이미지로 수동 Job 한 회차를 실행한다. 수동 Job은 Forbid의 보호 밖이므로 겹치지 않게 한다.
4. 로그의 원천7종 건수, checked writer 오류0, 정확한 generation count, alias 교체 성공 및 Job exit0 확인.
5. 배포 전 기준: unified4174 = concept4032 + game83 + product25 + blog_post15 + service10 + deal_offer9.
   cafe source1922. 원천 변경이 없다면 새 unified6096 예상. 각 기존 타입 건수가 빠지지 않았는지 반드시 비교한다.
   attractions67488/스탬프 일치 벡터59682/OSgreen 기준도 보존 확인.
6. suggest `q=AMP`/`type=game`, `q=아메리카노`/`type=cafe_drink`, 관광지 이름과0건/잘못된 입력을 확인한다.
   full grouped API의 기존 타입·관광지 hybrid와 page, /search·/s·manifest/icon HTTP를 확인한다.

새 hybrid 플래그는 없다. 기존 `SEARCH_EMBEDDING_MODEL_REF=microsoft/harrier-oss-v1-270m@31de22b#d640`와
기존 attraction hybrid=true를 유지한다. 게임·음료는 문서 벡터 없이 keyword로 검색한다.

## 세대 실패 보존

카페·게임 수집은 실패·빈 원천·malformed/누락 페이지·변경된 총건수·중복을 실패로 간주한다.
기존 원천별 재시도는 유지한다. bulk 오류가 나거나 정확한 OpenSearch count가 모자라면 alias를 바꾸지 않는다.
기존 IndexAliasManager의 live-count 하한과 새 세대 이후/진행 중 세대를 지우지 않는 retention을 보존한다.
원천에 snapshot 토큰이 없어 동일 건수의 동시 수정까지 snapshot 격리를 보장하지 않는다.

## 검증

- 새 release Gradle 테스트 + verifyArchitecture: `BUILD SUCCESSFUL in 33s`, app757/batch137/domain262 tests, failures/errors0(총1156).
- release FE `node scripts/render-content.mjs` 후 `npx tsc -b` exit0.
- release FE 회귀: `Test Files 8 passed (8)`, `Tests 33 passed (33)`.
- `npm run build` exit0 (Vite `✓ built in 502ms`, SEO 프리렌더/HTML 정리 완료).
  기존 landslide 상세API500은 기존 스크립트가 요약으로 대체한 경고이며 이번 작업에서 수정하지 않았다.
- router/생성 nginx /search·/s, manifest scope/start_url, PNG192/512 크기 CLI 검사 PASS.
- `git diff --check` exit0.
- 부모의 읽기 전용 실제 엔진 probe: 기존 title.keyword prefix case_insensitive:true로 `amp` → AMP ARENA(game) 확인.
- 로컬 OpenSearch는 없어 새 전체 경로 engine runtime 미검증; 부모가 운영 rollout 뒤 확인한다.
- 로컬 UI 검증은 과거 사용자 승인이 있었으나 연결 브라우저가 없어 실행하지 못했다. 이번 배포에서 UI 도구 미사용.
- 원본 shared-tree189 테스트 결과는 이 배포판의 증거가 아니다.
