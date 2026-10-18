<!-- source: portal-fe/src/pages/games/GamesPage.tsx -->
<!-- source: portal-fe/src/pages/games/catalogState.ts -->
<!-- source: portal-fe/src/seo/copy.mjs -->
<!-- source: portal-fe/scripts/prerender-seo.mjs -->
<!-- source: blog/feature/src/main/kotlin/com/kgd/blog/infrastructure/render/BlogMetaRenderer.kt -->
<!-- source: game/feature/src/main/resources/gamedb/migration/V108__landslide_multiplayer_tag.sql -->
<!-- source: game/feature/src/main/resources/gamedb/migration/V109__landslide_multiplayer_json_snapshot.sql -->
# 2026-10-18 사이트 조사 보완 작업

이하 구현·브라우저·초기 build 기록은 최초 공유 작업공간 시점이다. **배포 checkout의 최신 상태와 검증은 바로 아래 절을 우선한다.**

범위: [조사 보고서](../research/2026-10-18-site-audit/README.md)의 현행 코드로 재현되는 결함. 운영 배포·DB 변경 실행은 하지 않는다. 브라우저 검증은 후속으로 승인된 범위에서 부모의 native Safari CUA가 수행했다. 기존 dirty/staged 변경을 보존한다.

## 최신 origin 기준 배포 패키징 (2026-10-18)

- 독립 checkout: `/private/tmp/site-audit-deploy-20261018`, 기준 `a8ca172ea649305870f28d066b0b9d47fd6c7856`. 기존 main/ads-network의 index·unrelated source는 변경하지 않았다. 사용자의 후속 `배포해` 승인에 따라 이 패키지를 준비하며 운영 push/rollout은 부모가 담당한다.
- 최신 origin에는 실제 `/search?q` 통합검색이 있으므로 기본 **SearchAction을 유지**한다. 초기 조사 시점의 제거를 재적용하지 않는다. transaction manager literal도 이미 선반영돼 변경하지 않는다.
- 관광지 상세 정적 프리렌더는 최신 ADR-0103에서 서버 SSR로 대체됐다. 기존 enriched `visitSummary`의 요금·주차요금·출처 갱신일을 그대로 보존하고 중복 제거와 줄별 목록만 port했다. 구형 `visitorInfo` 별도 helper는 추가하지 않는다. SSR 수정도 현재 main의 기존 renderer에 적용했다.
- V106/V107은 최신 원격의 기존 migration이다. 신규 **V108**은 landslide slug + multiplayer tag만 대상으로 `INSERT IGNORE` 최대 1행을 추가한다. 새 컬럼/index/다른 게임 UPDATE는 없다. 로컬 실행하지 않았으며 배포하면 기존 Flyway가 자동 적용한다. 적용 이력이 있는 V106/V107은 수정하지 않는다.
- private auth/gifticon clone 인증은 실패했다. 필요한 검증 source는 로컬 Git object에서 최신 origin이 기록한 정확한 SHA(auth `eca3e91d`, gifticon `848ed98b`)의 `git archive`로 독립 checkout에만 준비했다. 서브모듈 포인터 변경은 없다.
- `node --check scripts/prerender-seo.mjs` 통과. `node scripts/render-content.mjs` → `npx tsc -b` 통과. 관련 Vitest **7 files / 89 tests passed** (실제 초기 renderDetail 한/영 landslide·일반 MULTI, 최신 App route 추출 포함).
- 변경 FE ESLint **exit0 / 0 errors / 1 기존 warning** (`GameDetailPage`의 변경하지 않은 stageRef cleanup 줄). `npx vite build` **exit0**와 route map/404 생성 성공. API 6천 건을 호출하는 전체 prerender는 최신 CI 단계에서 실행하므로 이번 로컬 포트에서는 반복하지 않았다.
- 실제 nginx 컨테이너 HTTP fixture **18 checks passed**: unknown404/noindex, mixed-case route, host 제약, 동적 deep link, query/trailing slash, raw frame/static asset. 기존 search SSR location/resolver/fallback을 유지한다.
- 독립 fresh reviewer 최종 코드 **SHIP**. source-derived routes의 ads host guard 및 최신 SSR/golden12개 의도 범위 보존을 확인했다.
- 최신 backend 검증 결과는 아래에 기록한다.

## 최초 공유 작업공간 구현 기록

| 조사 항목 | 구현/보류 상태 | 근거와 검증 |
|---|---|---|
| 1 게임 전체 목록 | 구현. 48개 뒤 다음 페이지, 실제 누적/전체 건수, id 중복 제거, 마지막 더 보기 숨김. 실패 시 기존 카드 유지. | [GamesPage](../../portal-fe/src/pages/games/GamesPage.tsx), [테스트](../../portal-fe/src/pages/games/__tests__/GamesPage.seo.test.tsx). 82개·중복·실패 재시도·stale 응답 검증. |
| 2 사태 인원 정합성 | 구현. SPA/초기 HTML 공통 `혼자 연습 · 온라인 1대1`; JSON-LD 두 모드. multiplayer 태그 추가 V108 작성, **미실행**. | [공통 카피](../../portal-fe/src/seo/copy.mjs), [V108](../../game/feature/src/main/resources/gamedb/migration/V108__landslide_multiplayer_tag.sql). V93의 봇 연습/온라인 보드와 공개 게임 js/로비 구현을 근거로 함. 다른 게임 SINGLE/MULTI 계약 유지 테스트. 실제 대전 동작은 미검증. |
| 3 블로그 초기 표/알림 | 구현. CommonMark 0.24.0과 같은 버전 GFM tables, 알림 제목·본문 AST 렌더. raw HTML 제거 유지, 위험 URL 차단. | [렌더러](../../blog/feature/src/main/kotlin/com/kgd/blog/infrastructure/render/BlogMetaRenderer.kt), [테스트](../../blog/feature/src/test/kotlin/com/kgd/blog/BlogMetaRendererTest.kt). 표/알림/코드/XSS 포함 13 tests, failures=0, errors=0. |
| 4 검색 구조화 데이터 | 구현. apex 기본 SearchAction 제거. 명시적인 searchUrlTemplate 옵션은 유지. | [copy.mjs](../../portal-fe/src/seo/copy.mjs). `/tech?q` 동작을 새로 만들지 않음. |
| 5 영문 관광 | 구현. 원천 코드 VE040200의 영어 오타는 main API 출력에서 정확히 보정(raw 보존). 영문 공통 내비게이션/React·초기 프리렌더 footer 및 owning SSR footer 보완. | [코드명 서비스](../../place/feature/src/main/kotlin/com/kgd/place/application/attraction/service/AttractionCategoryCodeService.kt), [Footer](../../portal-fe/src/components/Footer.tsx). SSR 수정은 별도 ads-network worktree에 있음. 운영 반영은 별도 배포 필요. |
| 6 메인 진입점 | 구현. 기존 primary 버튼을 `서비스 둘러보기`로, 경력·프로젝트는 보조 링크. 타임라인 없을 때 실제 `#about`로 연결. | [HomePage](../../portal-fe/src/pages/HomePage.tsx), 기존 ServiceShowcase는 데이터 조회 전에도 서비스 링크/`#services`를 렌더. 디자인 토큰/레이아웃 유지. 전환/실기기 시인성은 미측정. |
| 7 상태 복원/복구 | 구현. 게임 태그·정렬 URL, 언어/장르/선택별 최대 20개 메모리 캐시, 페이지·스크롤 복원. aria-pressed/status/alert. 메인·블로그 최신글·랭킹 명시적 retry. | [게임 상태](../../portal-fe/src/pages/games/catalogState.ts), GamesPage 회귀 테스트. 캐시는 현재 탭 JS 세션 동안만 유지. 키보드/스크린리더·브라우저 뒤로가기 실측은 보류. |
| 8 PREOPEN 일치 | 구현. 초기 프리렌더는 display API OPEN/PREOPEN을 사용하고 준비 중에는 링크를 내지 않음. React 탐색과 랭킹 빈 상태도 준비 상태 안내. | [초기 상태 테스트](../../portal-fe/src/seo/__tests__/siteAuditRemaining.test.ts). OPEN 전환을 같은 데이터로 반영하며, 상태 미확인 rank 링크는 생략. |
| 9 혜택 초기 탐색 | 구현. 초기 안전 링크와 카드별 제휴 고지, 원문 근거의 이벤트 모음 분류, 공유 적용조건·확인일 미제공 안내. | [DealPage](../../portal-fe/src/pages/deal/DealPage.tsx). 실제 할인 조건·검증일은 생성하지 않음. 부모 CUA에서 안내/분류/여행 필터4건 확인. |
| 10 관광 방문 정보 | 구현. 원천 줄바꿈 목록, 라벨+정규화 값의 동일 중복만 제거, 변경·예외 원문 보존, 없는 수집일·갱신일은 미제공 안내. | [공통 formatter](../../portal-fe/src/seo/visitorInfo.mjs). 부모 CUA에서 영문 Hours/Closed/Parking/Contact 각1개 확인. owning SSR도 별도 보완. |
| 11 오류 URL | 구현. App.tsx AST에서 nginx 경로 계약 생성, 미등록 path 실제404+noindex+홈/서비스 복구링크. | [ADR 추가 결정](../adr/ADR-0062-seo-and-organic-discovery.md), [검증 스크립트](../../portal-fe/scripts/verify-spa-http.mjs). 실제 nginx HTTP18개 검증. 없는 동적 ID는 기존 상세/API 존재 확인 경로 유지. |
| 12 성능 | 구현. 화면 밖 서비스 query4개 유예, 서비스 직접 링크 상시 제공. 관측/rAF 정지 시에도 본문·실제 통계 표시. | [가시성/요청 테스트](../../portal-fe/src/components/home/__tests__/ServiceShowcase.loading.test.tsx). 부모 Safari CUA에서 히어로·8/82/7/12 실제 수치 확인. LCP/INP/CLS 실측치는 주장하지 않음. |

## 1차 검증 기록 (후속 수정 전의 역사적 결과)

- FE 1차: 5 files / 67 tests passed. 최종 게임 10개에 다음 페이지·중복·실패·필터 race·복원·retry 후 복원·A→B→A 동일 key의 옛 응답 차단 포함.
- 확대 FE: `npx vitest run src/pages/blog/__tests__ src/pages/games/__tests__ src/seo/__tests__` → **24 files / 230 tests passed**. 기존 GameDetailPage.loop 테스트에 act/jsdom 네트워크 경고 있음. 별도 앞선 실행은 rankView 순수 함수 테스트까지 포함해 25 files / 237 tests passed였다(당시 게임 회귀 7개). RankPage/Footer 화면의 브라우저 검증으로 주장하지 않는다.
- Backend: `./gradlew :blog:feature:test --tests com.kgd.blog.BlogMetaRendererTest` → **BUILD SUCCESSFUL**, XML **tests=13 skipped=0 failures=0 errors=0**.
- 변경 범위 eslint → **0 errors, 1 warning** (기존 GameDetailPage stageRef cleanup).
- `git diff --check` → exit 0.
- `./gradlew :blog:feature:test --tests com.kgd.blog.BlogMetaRendererTest verifyArchitecture` → **verifyTransactionQualifiers FAILED**. BlogShortLinkService와 GameShortLinkService의 상수 transactionManager 사용 6개를 규칙이 한정자 없음으로 판정. 두 파일은 HEAD 대비 diff 없음. 본 작업과 무관하여 변경하지 않음. 별도 blog 테스트는 위와 같이 성공.
- `npm run build` → **exit 0**. `tsc -b`, Vite `built in 32.97s`, API 조회·프리렌더(게임 82종, place sitemap 60,739 URL, place 상세 6,539장, 기타 184장), 주석 제거 6,858개 파일 완료. 마지막 게임 캐시 리뷰 수정 후 별도 `npx tsc -b`·게임 회귀 테스트를 다시 통과했다.

## 현재 운영 반영 전 남은 확인

V106은 검토용이며 실행하지 않았다. 배포·push·운영 변경은 없다. 부모가 승인 범위의 native Safari CUA로 로컬 게임 더 보기/상세 후 Back, 히어로 실제수치, 영문 상세/푸터, 혜택 안내/필터, 랭킹 빈 상태와 select Tab→Space→Escape를 확인했다. 전체 키보드·모바일 접근성 인증으로 해석하지 않는다. 운영에는 main과 별도 ads-network owning SSR 변경의 통합·rollout 확인이 남는다.

## 자체 검토와 커밋 범위

Fresh review에서 발견한 두 캐시 결함은 재현 테스트 후 수정했다: 필터 이탈 중 추가 로드의 loading 상태 잔류, 초기 retry 후 캐시 복원 무효화. 요청 세대 토큰으로 A→B→A에서 늦은 옛 페이지가 새 페이지를 덮는 경로도 차단했다. 명시적 retry는 현재 선택의 캐시를 삭제하고 재요청한다.

사전 변경은 소유 패치에서 제외한다. 특히 prerender-seo.mjs의 기존 `robotsTxt` export 및 Meta 크롤러 정책 hunk는 포함하지 않는다. V106 이름은 game 마이그레이션 디렉터리에서 유일하며 SELECT는 slug=landslide, tag=multiplayer로 한정됨을 검토했다. 마이그레이션 DB 실행 검증은 수행하지 않았다.


## 남은 항목 보완 (후속 요청)

- 5: 공개 category-codes API에서 `en / VE040200 / Village Tourism Siteas`를 직접 확인했다. `AttractionCategoryCodeService` 공개 코드명 경계에서 이 정확한 조합만 `Village Tourism Sites`로 보정하며 DB 원천은 보존한다. 조회 회귀 테스트 성공. 운영 SSR은 `.claude/worktrees/ads-network/search/app/.../AttractionPageRenderer.kt` 소유임을 확인했고 해당 worktree에서 영문 footer·방문정보의 작은 호환 수정과 전용 회귀/골든 검증을 완료했다. main으로 렌더러 전체를 복제하지 않는다.
- 8: 초기 푸터는 display API의 OPEN/PREOPEN을 읽고 PREOPEN에는 링크 없는 준비 중 문구를 표시한다. OPEN 전환은 같은 데이터로 자동 반영된다. 조회 실패 시 상태가 불명인 rank 링크는 생략한다. 영문 Explorer의 공통 내비게이션과 준비 상태도 영문으로 표시한다.
- 9: 혜택 카드 유형을 원문 제목/요약에서 이벤트 모음/혜택 안내로 구분한다. 적용 대상·최소금액·기간·예외는 원문 확인, 조건 최종 확인일은 미제공임을 한 공유 문구로 표시한다. 임의 검증일·할인 보장 없음. 삼성카드 LINK 공식 안내와 Klook FAQ 공개 원문은 조건 확인 필요성의 근거이며 개별 카드 검증일로 사용하지 않는다.
- 10: main 관광 SPA/초기 렌더는 동일 formatter로 라벨+정규화 값이 같은 중복만 제거한다. 원문 줄바꿈은 목록으로 보존하며 내용이 다른 예외는 남긴다. 기존 응답 modifiedAt이 있으면 원천 날짜를 그대로 표시하고, 수집일은 미제공으로 구분한다.
- 11: ADR-0062 추가 결정에 따라 App.tsx Route AST에서 nginx map을 생성한다. 알려지지 않은 path는 실제404+noindex+복구 링크. 알려진 동적 path는 기존 API/상세 존재 확인을 유지한다. 실제 nginx1.27 Docker HTTP **18 checks passed**: host조건, query, trailing slash, 관광/상품/블로그 deep links, raw frame, 정적 파일 포함.
- 12: 서비스 영역 320px 앞에서만 네 showcase query가 활성화되며 기본 링크는 항상 렌더된다. 관측 불가 브라우저는 기존처럼 즉시 요청한다. callback/rAF가 멈춰도 reveal 본문은 opacity1, 통계는 실제 로드값을 즉시 표시한다. 후속 관측 테스트 및 네 query 호출 유예/활성화 테스트 성공. LCP/INP 수치는 만들지 않는다.
- 검증 장애: 두 ShortLinkService의 transactionManager 상수 사용을 동일 문자열 literal로 바꿨다(실제 TM 무변경). `verifyArchitecture`와 category/ShortLink scoped tests **BUILD SUCCESSFUL**, XML **26 tests, failures/errors0**.
- 부모 CUA: 로컬4187 게임 48/82 → 더 보기 →82/82, 상세 이동 후 Back에도82/82를 실제 확인했다. 이 대화의 AX/화면 근거이며 저장한 스크린샷 파일을 주장하지 않는다. Safari hero 검증 중 Vite 감시가 디스크 수정을 못 반영한 문제를 HTTP GET 원문으로 재현했고 polling으로 재시작했다. 재시작 후 제공 JS에는 counted 함수가 없고 실제값 렌더가 있으며 opacity1 CSS를 확인했다.

외부 조건 출처: [삼성카드 LINK](https://www.samsungcard.com/personal/services/link/UHPPBE0401M0.jsp), [Klook 쿠폰 FAQ](https://www.klook.com/ko/faq/category-63-question-955/).


## 최신 검증 (후속 보완)

- `./gradlew verifyArchitecture :place:feature:test --tests com.kgd.place.application.attraction.service.AttractionCategoryCodeServiceTest :blog:feature:test --tests '*ShortLink*' :game:feature:test --tests '*ShortLink*'` → **BUILD SUCCESSFUL** (49 actionable tasks). XML category7+blog10+game9=**26 tests, failures/errors0**. 1차의 architecture6개 실패는 해결됨.
- `npm run build` → **exit0**, route map+404 생성, Vite **built in1m8s**, 게임82종·관광60,739 URL·상세6,539장·기타184장, HTML 주석제거6,859파일 완료.
- `node scripts/verify-spa-http.mjs` → **nginx HTTP18 checks passed**. `/SHOP/orders`의 React Router 기본 대소문자 비구분 계약과 명시 caseSensitive 처리도 반영.
- 최종 main 관련 FE: `npx vitest run src/seo/__tests__ src/pages/games/__tests__ src/pages/place/__tests__ src/pages/deal/__tests__ src/components/home/__tests__ src/hooks/__tests__` → **26 files / 268 tests passed**. `npx tsc -b` 성공. 변경 eslint0errors.
- 부모가 Safari hero 구코드 문제 해결 뒤 재확인: 히어로 문구/CTA,8개·82종·7개·12년차 실제 표시. 영문 상세 Visitor info4종 각1개, 데이터 날짜 미제공·영문 footer. rank준비 상태와 select키보드일부, deal조건안내·이벤트모음·여행4건 필터 확인.

- owning SSR worktree: `/Users/gideok-kwon/IdeaProjects/msa/.claude/worktrees/ads-network`. 수정 전 소유 파일은 clean이었고 별도 baseline을 보존했다. renderer1·테스트3·승인된 HTML골든12개만 수정했다. 초기165개 중 실패15개는 새 목록/번역 기대의 갱신대상이었고, 기대값 갱신 뒤 **BUILD SUCCESSFUL**. 세부 XML 합계는 최종 핸드오프에 기록한다. 수정은 main으로 복사·merge·commit하지 않았다.
- 패치: main `/private/tmp/site-audit-remediation/remaining-owned.patch` 및 별도 SSR `/private/tmp/site-audit-remediation/runtime-owned.patch`. 기존 1차 작업 패치는 `owned.patch`. 사용자 stage/index는 보존하며 커밋 승인 재요청 없음.

- SSR 최종 회귀: `AttractionPageRendererTest`127 + `VisitSummaryParityTest`39 + `FooterLinksParityTest`2 = **168 tests, failures/errors0**. 업데이트 플래그 없는 검증도 **BUILD SUCCESSFUL in8s**로 완료했다. 상태 데이터가 없는 owning SSR footer는 rank를 양언어에서 생략해 OPEN/PREOPEN을 추정하지 않는다. main 프리렌더/React는 전시 API 상태를 사용한다.
- 마지막 CSS/숫자 가시성 수정 후 `npx vite build --emptyOutDir false` → **exit0, built in1m2s**, `node scripts/spa-routes.mjs`로 최종 route map도 갱신했다. 원격 수집에 의존하는 전체 프리렌더는 같은 함수에 대해 앞선 `npm run build`에서 성공했고 반복하지 않았다.
- 현재 한계는 배포 전이라는 점과 미측정 범위다. 전화390px·전체 키보드/스크린리더·Web Vitals 수치를 검증했다고 주장하지 않는다. 승인된 공개/로컬 CUA 관찰만 기록했다.

- 마지막 날짜 정확성 보완: 공개 상세 API13686은 modifiedAt=`2026-06-23T11:37:49`를 이미 제공했다. main의 optional 타입 누락을 보완하고 SPA/초기렌더 공통 helper가 `2026-06-23` 원천 날짜를 그대로 표시한다. 수집일과 혼동하지 않고 빌드·조회 시각을 넣지 않으며 timezone 변환도 하지 않는다. 원천 시각 없음/offset 있는 원천 날짜 보존 회귀를 포함했다. 앞선 Safari의 두 날짜 미제공 관찰은 이 마지막 수정 이전 화면이다.

- 최종 날짜 수정 검증: `npx vitest run src/seo/__tests__/siteAuditRemaining.test.ts src/seo/__tests__/prerenderPlace.test.ts` → **2 files /34 tests passed**. 기존 응답 날짜/없는 날짜/offset 원천 날짜 및 생성 HTML까지 확인했다. 뒤이어 `npx tsc -b`·변경 eslint exit0.
- 부모의 마지막 승인 Safari reload에서 **Source updated: 2026-06-23 · Collection date: Not provided.**를 실제 확인했다. 구형 Vite cache가 남는 환경이라 최종 수정 후 서버를 재시작하고 HTTP 원문 제공까지 확인했다. 날짜 검증 미완료 상태는 해소됐으며 승인된 UI bundle은 완료됐다.

## 배포 startup probe 후속 수정

- 사이트 실제 404 정책 적용 후 기존 k3s-lite의 전체 commerce Deployment용 startup probe가 nginx FE에도 `/actuator/health/liveness`를 주입한 문제가 드러났다. 이전 SPA soft404 응답이 이를 숨겼다. 부모는 새 FE 내부 `/` 응답 성공과 startup404로 rollout 대기를 확인했다.
- generic patch 뒤 portal-fe의 startup `httpGet.path`만 `/`로 override한다. readiness/liveness도 기존 실제 루트 `/`를 유지한다. probe 제거나 예산 완화, nginx 가짜 actuator는 추가하지 않는다.
- `kubectl kustomize k8s/overlays/k3s-lite` 및 `kubectl kustomize k8s/overlays/oci-arm` 모두 성공. 렌더 YAML의 두 overlay × portal-fe/content/search/gateway **8개 조합**을 assertion으로 검증했다: FE의 startup/readiness/liveness는 `/`, JVM은 actuator 경로 유지, 모든 startup failureThreshold60 유지. `git diff --check` 통과.
- 운영 적용·Argo sync 검증은 부모가 이어서 수행한다.

## 배포 후 Landslide JSON 태그 정합성 보완

- 부모가 운영 V108 적용 성공에도 API tags에 `multiplayer`가 없고 playerMode가 SINGLE인 것을 확인했다. `GameCatalogAdapters.syncTagMap`은 `Game.tags` JSON snapshot → map 단방향이며 `GameQueryService`도 JSON tags로 playerMode를 계산한다. V108의 normalized map 한 행만으로 API 원천이 바뀌지 않았음을 확인했다.
- 이미 적용된 V108은 변경하지 않는다. 신규 V109는 landslide에 한정하여 기존 JSON 배열에 multiplayer가 없을 때만 append하고, normalized map도 INSERT IGNORE로 정합한다. 기존 태그·순서를 보존하고 null/빈 배열은 multiplayer 배열로 만든다. 다른 게임/스키마를 수정하지 않는다. 운영에서는 기존 Flyway가 V108→V109 자동 적용하며 부모가 배포/API 검증을 담당한다.
- 실제 MySQL 8 격리 검증: `python3 game/feature/src/test/scripts/verify_landslide_tag_migration.py`. V1의 실제 game/tag/map DDL을 사용해 V108 적용 상태·이미 태그 존재·빈 배열·null·landslide 없음 5개 시나리오를 실행한다. 각 시나리오에서 V109를 두 번 실행하여 전체 game JSON/updated_at과 map의 멱등성, 기존 태그 보존, 다른 게임 JSON/updated_at/map 불변을 검사한다.
- 실행 결과: **`MySQL 8 V109: 5 scenarios passed`**, exit0. V108 diff 없음, `git diff --check` 통과. 테스트 컨테이너는 finally에서 제거됐고 운영 DB에는 연결하지 않았다.
