# Verification Report: 2026-09-23-ad-network
**Date:** 2026-09-24 (KST)  **Status:** NEEDS_ATTENTION

## Summary
그룹 1~12 의 `[x]` 항목은 모두 코드·테스트에서 근거를 찾았다. 지정한 광고 관련 스위트(Gradle 289건, portal-fe 210건, admin-fe 2건, tsc 두 개, kustomize 오버레이 세 개)는 실패 0 이다.
돈·일회성·차단 경로(★)의 회귀 주입 증거도 로그로 남아 있다.
판정을 NEEDS_ATTENTION 으로 둔 이유는 푸시 전에 처리할 것 두 가지다. 하나는 R3 브랜치를 `origin/main` 에 리베이스할 때 나는 충돌이고, 다른 하나는 R3 회귀 주입(F5 포함)의 로그가 `regression-injection.md` 에 없다는 점이다. 문서와 실제가 어긋난 곳도 몇 군데 있다.

검증 대상: 워크트리 `.claude/worktrees/ads-network`, HEAD `25913049`(`origin/main` 보다 4커밋 앞, 19커밋 뒤). 워크트리는 깨끗하다.

## Tasks

| 그룹 | 판정 | 근거 |
|---|---|---|
| 0 운영 사전 조건 | PASS (운영 기록 기준) · **tasks.md 미체크** | 코드 항목이 없다. `context/progress.md` 「R2 운영 반영」: ads_db·ads_user SQL, `ads-token` 시크릿, 노드 57%(OQ-002). 체크박스 0.1~0.5 는 전부 `[ ]` 로 남아 있다. DNS `ads.1989v.com`(0.4)가 실제로 반영됐는지는 이 검증에서 확인하지 않았다 |
| 1 common (R1) | PASS | `common/.../analytics/EntityType.kt:33` `AD` · `RecommendationEventConsumerTest.kt:202` (`EntityType.AD` 무시) — 8/0, `AnalyticsEventTest` 4/0 |
| 2 모듈·폴드 | PASS | `settings.gradle.kts` `:ads:domain`·`:ads:feature` · `AdsDataSourceConfig` · `AdsRedisConnection`(팩토리를 빈으로 등록하지 않음, 250ms/500ms) · `AdsSchedulingConfig` `@EnableScheduling`+`ads.scheduling.enabled` 조건, 작업 빈 3종 각각 같은 조건 · `V1__ads.sql` · `EngagementContextLoadSpec` 8/0 · `AdsSchemaIntegrationSpec` 7/0 · `verifyPodTopology`·`verifyTransactionQualifiers` 통과 |
| 3 도메인 | PASS | `:ads:domain` 은 `implementation(project(":common"))` 만 의존. 스펙 11개, 88/0. `LedgerTransaction`·`RevenueSplit`·`SettlementCalculator`·`Auction`·`Pacing`·`PredictedCtr`·`WalletHeadroom`·`ServeTokenSigner`·`HouseLink`·`LandingUrl`·`CreativeImageRules` |
| 4 결정 | PASS | `DecisionService` · `CandidateIndexService` · `DecisionCounterRedisAdapter` · `DecisionMetrics` — `DecisionIntegrationSpec` 13/0(차단 4경로 N−1/N 경계, 크롤러 Redis 0, DB `Com_*` 0, Redis 정지 1초), `CandidateIndexIntegrationSpec` 5/0 |
| 5 이벤트·클릭·에셋 | PASS | `EventCounterRedisAdapter`(Lua 1회) · `AdEventController` · `CreativeAssetController` — Event 12/0 · Click 7/0 · Asset 2/0 |
| 6 집계·정산·원장 | PASS | `SettlementService`·`LedgerService`(READ COMMITTED, `adsTransactionManager`)·`HourlyStatsAdapter`·`LedgerCheckJob` · `V2__ads_aggregation_hour.sql` — Settlement 6/0 · Ledger 4/0 · Aggregation 4/0 |
| 7 API·리포트·호환 | PASS | `AdvertiserController`·`AdvertiserCampaignController`·`AdsAdminController`·`AdsHouseAdminController`·`LegacyPlacementController`·`ReportService` · `V3__ads_admin_action.sql` — AdvertiserApi 24/0 · CreativeUpload 10/0 · AdminApi 12/0 · Report 7/0 · Legacy 3/0 |
| 8 게이트웨이 | PASS | `GatewayRouteConfig.kt:424-444` `ads-admin`·`ads-advertiser`·`ads-public`, `"game-ads"` 문자열은 main 에 없다 · oci-arm `KGD_GATEWAY_ADS_ALLOWED_HOSTS=1989v.com,blog,game,place,ads` · `AdsRouteSpec` 14/0 · `AdsRouteKeyResolverSpec` 3/0 · 기존 `GatewayRoutingSpec` 17/0·`GatewayRouteAuthSpec` 16/0 불변 |
| 9 analytics 사본 | PASS | `AnalyticsCopyKafkaAdapter`(`max.block.ms=500`) — `AnalyticsCopyIntegrationSpec` 7/0 |
| 10 FE 지면 (R3) | PASS | `AdSlot.tsx`(`selfAds`, 800ms, 3초 AdSense 관찰) · `AdCard.tsx`(`useImpression`) · `adsApi.ts`(결정은 `apiClient.post`, 비콘만 `sendBeacon`/`fetch keepalive`) · `HouseBanner.tsx` · `DealPage.tsx:226` `selfAds={false}` · `copy.mjs` kebab 키 · 광고 FE 경로에 `dangerouslySetInnerHTML` 0건. vitest AdSlot 16 · AdCard 5 · HouseBanner 4. 10.1 목표 이미지와 10.9 CDP 4조합은 사람이 확인한 항목이라 기록(`status.md`, 아티팩트 id)으로만 근거를 삼았다 |
| 11 콘솔·어드민·방침 (R3) | PASS | `pages/ads/*`(콘솔 6화면) · `App.tsx` 호스트 분기 · `nginx.conf:11` `X-Robots-Tag` · `prerender-seo.mjs` `adsConsoleMeta` · `serviceHref.ts:29` · `ADSENSE_HOSTS` 에서 제외 · ingress host+TLS(오버레이 렌더에서 `ads.1989v.com` 2곳) · admin-fe `pages/ads/*` 7종+`api/ads.ts`+`Sidebar` · `PrivacyPage.tsx` · `privacyRetention.test.ts` 가 `AdsRedisKeys.kt` 의 `VISITOR_FREQUENCY_TTL_HOURS` 를 읽는다 · 11.8 `AdsExceptionHandler`(컨텍스트 스펙에서 advice 범위 확인). 콘솔 13 · 어드민 심사 2 · 방침 6 |
| 12 인프라·CI·문서 | PASS (하위 두 항목 미확인) | configmap-init·prod init-job `ads_db`/`ads_user` · `mysql-ads-master` · engagement 768Mi/384Mi · `ADS_TOKEN_SECRET(_PREVIOUS)` 배선 · `ci.yml:179,202` · 문서(`ads/CLAUDE.md`·`glossary.md`·루트 CLAUDE.md 194/197행·ADR-0093·체크리스트·kafka-convention·latency-budget 68행·ADR-0059 개정·ADR-0098 「채택」). **미확인 1**: `scripts/doc_map.py` 가 이 워크트리에 없어 `--check` 를 돌리지 못했다. **미확인 2**: 12.5 「첫 PR CI 로그에서 ads 세 태스크 실행」은 이번에 CI 로그를 열어 보지 않았다 |
| 13 game ads 제거 (R4) | 이월 (의도) | 전부 `[ ]`. 다음 릴리스 몫이다 |

## Test Suite

```
$ ./gradlew :ads:domain:test :ads:feature:test :engagement:app:test :gateway:check \
    :common:test --tests '*AnalyticsEvent*' \
    :recommendation:feature:test --tests '*RecommendationEventConsumerTest*' \
    verifyArchitecture --rerun-tasks
BUILD SUCCESSFUL in 1m 49s   (EXIT=0)
```
JUnit XML 을 모듈별로 합산했다(타임스탬프가 이번 실행 시각 2026-09-24T11:37Z 라서 이번 실행의 결과다).

| 모듈 | 클래스 | tests | failures | errors | skipped |
|---|---|---|---|---|---|
| ads:domain | 11 | 88 | 0 | 0 | 0 |
| ads:feature | 14 | 116 | 0 | 0 | 0 |
| engagement:app | 2 | 15 | 0 | 0 | 0 |
| gateway | 6 | 58 | 0 | 0 | 0 |
| common (`*AnalyticsEvent*`) | 1 | 4 | 0 | 0 | 0 |
| recommendation:feature (`*RecommendationEventConsumerTest*`) | 1 | 8 | 0 | 0 | 0 |
| **합계** | 35 | **289** | **0** | 0 | 0 |

`verifyArchitecture` 하위 태스크(`verifyLayerDependencies`·`verifyPodTopology`·`verifyTransactionQualifiers`·`verifyFlywayWiring`·`verifyTopologyGenerated` 등)도 모두 실행됐다.

```
$ cd portal-fe && npx vitest run src/components/ads src/pages/ads src/pages/games \
    src/pages/__tests__/privacyRetention.test.ts src/shell src/seo src/pages/deal
 Test Files  21 passed (21)
      Tests  210 passed (210)
$ npx tsc --noEmit -p tsconfig.app.json          → EXIT=0
$ npx tsc -p tsconfig.app.json --listFilesOnly   → 1228개 (node_modules 제외 251개, 광고 FE 17개)
```
stderr 에 jsdom XHR `AggregateError` 가 찍힌다. 출처는 `GameDetailPage.loop.test.tsx` 이고 광고 코드와는 관계없으며, 테스트는 통과했다.

```
$ cd admin/frontend && npx vitest run src/pages/ads
 Test Files  1 passed (1)
      Tests  2 passed (2)
$ npx tsc --noEmit -p tsconfig.app.json          → EXIT=0
$ npx tsc -p tsconfig.app.json --listFilesOnly   → node_modules 제외 95개 (ads 10개)
```

```
$ kubectl kustomize k8s/overlays/oci-arm   → exit 0
$ kubectl kustomize k8s/overlays/k3s-lite  → exit 0
$ kubectl kustomize k8s/overlays/prod-k8s  → exit 0
```

## Failed Tests
None

## AC Coverage

기준은 `planning/test-quality.md` 의 AC↔테스트 표다. 테스트 이름은 실제 스펙의 `given/then` 문구를 따랐다. 모든 테스트는 이번 실행에서 초록이었다.

| AC | 계획 | 실제 테스트 (파일 › 시나리오) | 판정 |
|---|---|---|---|
| AC-1 | I18 · E1 | `AdvertiserApiIntegrationSpec` › 「두 번 불러도 ad_advertiser 행은 하나」 · 「ads 에는 회원·인증 서비스를 가리키는 코드가 없다」(컴파일된 클래스 상수 풀 검사) | 자동 PASS, E1 운영 대기 |
| AC-2 | U15 · I3 | `LedgerIntegrationSpec` › 「1회 상한을 넘는 충전은 거절되고 원장 행이 없다」 · 「하루 합계 … 다음 날은 다시 된다」 · 「★ 정산과 한도 경계의 충전 두 건이 동시에」 | PASS |
| AC-3 | U9 · U10 · U17 · I8 | `CampaignTest` (전이·기간 밖·예산 소진·저장 불변식) · `WalletHeadroomTest` · `DecisionIntegrationSpec` 차단 경로 4종 · `AdvertiserApiIntegrationSpec` 「저장 불변식」 | PASS |
| AC-4 | U12 · I23 | `CreativeUploadIntegrationSpec` (GIF 위장·20000×20000·1.91:1 폭탄 20000×10471·2001px·300KB+1·비율·랜딩 URL) · `AssetIntegrationSpec` · `CreativeTest` 「랜딩 URL」 | PASS |
| AC-5 | U4~U8 · I8 | `ChargeAmountTest` · `AuctionTest` (eCPM·동점·중복 낙찰 금지·최저가·비율·pCTR·페이싱) · `DecisionIntegrationSpec` | PASS |
| AC-6 | F1 · E2 | `AdSlot.test.tsx` 채움 순서 8건 (오류 500·빈 200·800ms·unfilled·3초 무응답·숨김) | 자동 PASS, E2 운영 대기 |
| AC-7 | I4 | `DecisionIntegrationSpec` › 「200 으로 redis_unavailable 을 1초 안에」 · `EventAcceptanceIntegrationSpec` › 「수락 0 · redis_unavailable 을 1초 안에」 | PASS |
| AC-8 | E4 | 없음. 운영 측정 항목이다 | **미검증 (운영)** — latency-budget 도 「미측정 추정」이라고 적어 두었다 |
| AC-9 | U14 · I1 · I7 · I10 · I14 · I15 · F5 | `ServeTokenTest` · `EventAcceptanceIntegrationSpec` (중복·몰아 제출·총예산·부분 수락·PTTL·visitor_mismatch·crawler) · `DecisionIntegrationSpec` 크롤러 · `AdCard.test.tsx` 50%/1초 3건 | PASS |
| AC-9b | U14 · C4 · C5 · C6 · F2 · E5 | `ServeTokenTest` 「not_billable」 · `AdsRouteSpec` (신원 헤더 제거·Bearer 주입·401) · `DecisionIntegrationSpec` 「광고주 본인 판정」 · `EventAcceptanceIntegrationSpec` 「광고주 본인에게 나간 토큰은 not_billable」 · `AdSlot.test.tsx` 「Bearer 가 실린다」 | 자동 PASS, E5 운영 대기 (R3 미배포) |
| AC-10 | I12 | `ClickRedirectIntegrationSpec` 7건 (정상·서명 불량·승인 철회·만료·속도·TTL·Redis 정지, `no-store`/`noindex` 단언) | PASS |
| AC-11 | U1 · I3 · I21 | `LedgerTransactionTest` · `LedgerIntegrationSpec` 동시성·원장 합 검사기 · `AdminApiIntegrationSpec` 「원장 검사」 | PASS |
| AC-12 | U2 · I2 · I5 · I6 | `SettlementCalculatorTest` · `SettlementIntegrationSpec` 6건 · `AggregationIntegrationSpec` 4건 (UPSERT 실패 시 닫지 않음 · 세 시각 따라잡기 포함) | PASS |
| AC-13 | I5 · I20 · E1 | `ReportIntegrationSpec` 7건 (원장 총액 행 포함) | 자동 PASS, E1 운영 대기 |
| AC-14 | U11 · U16 · I9 · I19 | `CreativeTest` 「revise()」 · `CandidateIndexIntegrationSpec` · `AdminApiIntegrationSpec` (반려 사유·승인 반영·정지/해제) · `AdvertiserApiIntegrationSpec` 「정지된 광고주 조회는 되고 쓰기는 403」 | PASS. U16 은 도메인 단위 테스트 없이 통합 테스트로만 덮는다 |
| AC-15 | I11 | `DecisionIntegrationSpec` 「unregistered_placement … 키별 요청 수」·「필드 상한(200)」 · `AdminApiIntegrationSpec` 「미등록 지면 키 목록」 | PASS |
| AC-16 | U13 · I16 · I22 · F3 · E3 | `CreativeTest` 「HOUSE 링크」 · `SettlementIntegrationSpec` 「HOUSE … 정산하지 않는다」 · `LegacyPlacementIntegrationSpec` 3건 · `HouseBanner.test.tsx` 4건 · `AdsSchemaIntegrationSpec` 시드 3종 | 자동 PASS, E3 운영 대기. I16 의 「빈도와 관계없이 매번」은 따로 단언한 테스트가 없다(HOUSE 는 빈도 판정 경로를 타지 않는 구조로만 보장된다) |
| AC-16b | 그룹 13 | 없음 | **이월 (R4)** |
| AC-17 | I13 | `AnalyticsCopyIntegrationSpec` 7건 (페이로드 필드·거절/크롤러 미발행·발행 실패 시 정산 정상·브로커 불통 시 블록 없음) | PASS |
| AC-18 | I17 · C4 · C5 | `AdvertiserApiIntegrationSpec` 「남의 캠페인·소재」·「요청 모델」 · `AdsRouteSpec` 광고주·어드민 경로 401/403 | PASS |
| AC-19 | F4 | `AdCard.test.tsx` 「마크업이 있어도 글자로」 · `AdsConsolePage.test.tsx` 「텍스트로만」 · admin `AdsReviewPage.test.tsx` 「텍스트로만」 | PASS |
| AC-20 | U3 | `RevenueSplitTest` · `LedgerTransactionTest` 「청구액 1,000 을 68%」 | PASS |
| SR-17 방침 | F6 | `privacyRetention.test.ts` 「Redis 빈도 키 TTL 상수와 방침이 같은 시간」 | PASS |
| SR-15 콘솔 | F7 | `AdsConsolePage.test.tsx` noindex·비로그인·비광고주·정지 | PASS |

컴포넌트 C1~C3 은 `EngagementContextLoadSpec`(잔액 재조회 값 판정, 공용 Redis 타임아웃 250ms 아님, outbox 를 꺼도 스케줄링 동작, 풀 크기 4)와 `AdsSchemaIntegrationSpec`(validate, 키 없음·31바이트 → 기동 실패)이 맡는다. 모두 PASS 다.

### 회귀 주입 (`verifications/regression-injection.md` 검토)
- 로그로 남은 것: U1 · U3 · U12(a·b, FINDING 해소 뒤 폭탄 케이스 추가) · I1 · I2 · I5 · I7 · C1(게이트+컨텍스트) · C6 · 「미정산 지출 차감 제거」(결정 경로·도메인). 원래 계획의 10개 중 F5 를 뺀 전부와 test C-1 추가 주입이다.
- C1 은 계획의 「잔액 불일치」가 아니라 `MANDATORY` 전파 예외로 빨간불이 났다. 문서에 이미 적혀 있다. 한정자 게이트(`verifyTransactionQualifiers`)가 먼저 막는 구조라서 실질적인 방어는 된다.
- **F5 는 문서에 「이월 — FE 그룹 10 몫」으로 남아 있다.** 그룹 10 구현 기록에는 「회귀 주입 9건 + 백엔드 1건 빨간불」, 그룹 11 에는 「4건 빨간불」이라고 적혀 있지만, 대상별 결과나 실행 출력은 이 문서에 없다. 표의 분류로 치면 「기록」 등급이다.
- 격리 수준(I3)·결정 경로 DB 무접근·게이트웨이 Host 목록·analytics 사본도 「기록」 등급 그대로다.

## Gaps / Deviations

1. **리베이스 충돌 (푸시 전 필수).** `git merge-tree HEAD origin/main` 결과 `admin/frontend/src/components/layout/Sidebar.tsx` 에서 CONFLICT 가 난다. `admin/frontend/src/App.tsx`·`portal-fe/src/App.tsx` 는 자동 병합된다. 브랜치가 origin/main 보다 19커밋 뒤라서, 리베이스한 뒤 portal-fe·admin-fe 의 vitest 와 tsc 를 다시 돌려야 한다.
2. **R3 회귀 주입 증거 누락.** 위에서 말한 대로 F5 와 그룹 10·11 의 주입 결과가 `regression-injection.md` 에 없다. 게이트가 무는지를 로그로 보여 주라는 그룹 12 의 AC 는 백엔드만 채웠다.
3. **tasks.md 와 실제의 어긋남.**
   - 그룹 0 체크박스가 전부 `[ ]` 다. 운영 반영은 `progress.md` 에 기록돼 있다.
   - 11.7 Verify 명령의 경로 `src/seo/privacyRetention.test.ts` 는 틀렸다. 실제 파일은 `src/pages/__tests__/privacyRetention.test.ts` 다. admin-fe 의 `tsc -p .` 도 그룹 10 기록이 말한 0파일 함정에 걸리는 형태다. 실제로 검사하는 것은 `-p tsconfig.app.json` 이다.
   - 12.4 구현 기록의 「부분」은 이후 재주입으로 해소됐지만 문구가 그대로 남아 있다.
4. **`open-questions.yml` OQ-004 가 `open`.** 그런데 커밋 `6e517556` 이 `ci.yml` 의 `:experiment:app:test` 를 engagement 매핑으로 고쳤다. 지금 `ci.yml` 에 `experiment:app:test` 는 없다. 해소로 닫을 후보다.
5. **Docker 가 없으면 조용히 건너뜀.** `ads:feature` 통합 스펙은 `DockerAvailable` EnabledCondition 으로 스펙째 빠지고, `EngagementContextLoadSpec`/`AdsSchemaIntegrationSpec` 도 `enabledIf = { dockerAvailable }` 다. 그래서 Docker 없는 환경에서는 초록불이 나도 0건이 돌았을 수 있다. 이번 실행은 skipped 0 이고 스펙마다 건수가 있어서 실제로 돌았다. CI 러너(ubuntu-24.04-arm)에서도 건수가 0 이 아닌지 로그로 한 번 확인해 두는 편이 안전하다.
6. **status.md 의 tsc 파일 수.** 그룹 11 행의 「EXIT=0(680)」은 이번 측정값(node_modules 제외 251, 전체 1228)과 맞지 않는다. 무엇을 셌는지 불분명하다. 통과 여부에는 영향이 없다.
7. prod-k8s 의 `ads-token` 은 `k8s/infra/prod/sealed-secrets/README.md` 에 목록으로만 있고, 봉인된 파일은 없다. 이 디렉토리의 다른 시크릿도 README 만 있어서 기존 방식과는 같다. 12.1 문구(「SealedSecret」)와 차이가 있다는 것만 적어 둔다.
8. `scripts/doc_map.py` 가 워크트리에 없어서 12.3/12.5 의 `doc_map.py --check` 는 이번에 확인하지 못했다.

## Deferred

- **그룹 13 (R4)**: game ads 코드·표 3종 삭제 마이그레이션, 호환 경로 `/placements/**`·라우트 제거, `fetchAdPlacement` 삭제 → AC-16b. 선행 조건은 R3 운영 확인(HouseBanner 가 새 API 로 동작)이다.
- **운영 검증 (tasks.md 「운영 검증」 표)**: R2 는 `progress.md` 에 기록돼 있다(롤아웃, 442Mi, Flyway V1~V3, `/decisions` 200, rt 404, 옛 경로 200). 결정 P99(E4, AC-8)는 기록이 없다. R3 뒤 항목은 E1 전 흐름, E2 대체 순서(CDP 4조합), E3 HOUSE 순환, E5 광고주 본인 청구 0(실제 게이트웨이 경유)이다. R4 뒤는 game 스키마 표가 사라졌는지 확인한다.
- 사람이 확인하는 항목: 10.1·11.1 목표 이미지 승인, 10.9·11 CDP 4조합 측정. 기록만 있고 이번에 다시 재지 않았다.
- `docs/product/roadmap.md` 가 없어서 로드맵 완료 표시 후보는 없다.

## Follow-ups

1. `origin/main` 으로 리베이스하고 `Sidebar.tsx` 충돌을 해결한 뒤, portal-fe·admin-fe vitest+tsc(app)를 다시 돌리고 R3 을 푸시한다.
2. F5 회귀 주입(카드에서 `useImpression` 대신 즉시 보고)을 임시 사본에서 다시 돌려 `regression-injection.md` 에 로그로 남긴다. 그룹 10·11 의 나머지 주입도 같이 남긴다.
3. tasks.md 를 정리한다: 그룹 0 체크, 11.7 경로·`-p tsconfig.app.json`, 12.4 「부분」 문구. OQ-004 를 `resolved`(6e517556)로 바꾼다.
4. R3 배포 뒤 E1·E2·E3·E5, 그리고 E4(P99 ≤ 30ms)를 사람 UA + 저장된 행 수로 확인한다.
5. 첫 PR/푸시 CI 로그에서 `:ads:domain:test :ads:feature:test :engagement:app:test` 가 돌았고 건수가 0 이 아닌지 확인한다(Docker 건너뜀 대비).
