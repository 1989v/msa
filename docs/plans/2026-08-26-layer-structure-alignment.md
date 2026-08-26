# 레이어 구조 정렬 실행 플랜 (ADR-0083)

- 작성: 2026-08-26
- 근거: `docs/adr/ADR-0083-layer-structure-standard-and-gate.md`
- 표준: `docs/conventions/package-structure.md` · 체크리스트: `docs/standards/new-domain-checklist.md`
- 실측 스크립트: 모듈별 `dir≠pkg / Port / Adapter / UseCase-iface / UseCase-class / app→infra / 테스트` 집계
  (ADR-0083 맥락 표가 그 결과). 각 단계 종료 시 같은 집계를 다시 돌려 0 이 됐는지 본다.

## 원칙

- 단계마다 **동작 변화 0** 을 유지한다. 리팩터링과 기능 변경을 한 커밋에 섞지 않는다.
- 한 단계 = 한 커밋 묶음. 단계 끝에 `./gradlew build` 와 allowlist 축소를 같이 커밋한다.
- 여러 세션이 워킹트리를 공유하므로 `git add` 는 경로로 좁힌다.
- `main` 이 곧 배포 브랜치다 — 이미지가 새로 구워지는 모듈을 단계별로 적어 둔다 (images.yml 테스트
  게이트가 한 모듈 실패로 그 커밋의 **모든** 이미지를 막는다).

## P0 — 하네스 정비 (완료 2026-08-26)

ADR-0083 · 신규 도메인 체크리스트 · `package-structure.md`(생략 노트 폐기·규칙 추가) ·
`module-structure.md`(전 모듈 표) · `00.clean-architecture.md` §4.2 · `code-convention.md` §2 ·
루트 `CLAUDE.md` · 서비스 `CLAUDE.md` 6개 신규 + 19개 "구조 상태" · `settings.gradle.kts` 주석.

## P1 — 빌드 게이트 `verifyLayerDependencies`

**파일**: 루트 `build.gradle.kts` (`verifyFlywayWiring` 아래, 같은 패턴). `check` 에 dependsOn.

규칙과 초기 allowlist (항목마다 이유·비우는 단계):

```kotlin
// ① application → infrastructure import 금지
val layerImportExempt = mapOf(
    ":blog:feature" to "변종 C — P2-3 에서 Port 도입 후 제거",
    ":ranking:feature" to "변종 C — P2-1",
    ":deal:feature" to "변종 C — P2-2",
    ":quant:app" to "포트가 JPA 엔티티·metrics 를 import — P4",
    ":code-dictionary:app" to "SyncService → IndexAliasManager 1건 — P4",
    ":recommendation:app" to "변종 B — P4",
    ":search:app" to "2건 — P4",
    ":auth:app" to "1건 — P4 (서브모듈)",
    ":experiment:app" to "1건 — P4",
    ":inventory:feature" to "1건 — P4",
)
// ② domain 모듈 spring/jakarta import 금지
val domainFrameworkExempt = mapOf(":search:domain" to "Page/Pageable — 문서화된 영구 예외")
// ③ 디렉토리 == 패키지
val dirPackageExempt = mapOf(
    ":product:app" to "변종 D 31 — P3", ":auth:app" to "변종 D 29 — P3 (서브모듈)",
    ":order:feature" to "변종 D 26 — P3", ":search:app" to "변종 D 21 — P3",
    ":product:domain" to "P3", ":order:domain" to "P3", ":search:domain" to "P3",
)
// 게이트 밖: gateway, common, agent-viewer:api, game:sim, game:web (ADR-0083 §6)
```

**검증**: `./gradlew check` 통과 + allowlist 한 항목을 임시로 지우면 실패하는지 확인(게이트가 실제로
읽는지). `docs/standards/agent-behavior.md` 의 자동 리뷰 항목에 한 줄.

**이미지 영향**: 없음 (빌드 스크립트만).

## P2 — 변종 C 포트 도입 (ranking → deal → blog)

작은 것부터. 각 모듈에서:

1. `application/{entity}/port/{Entity}RepositoryPort.kt` — 서비스가 실제로 쓰는 메서드만 (YAGNI).
   반환은 도메인 모델, JPA 엔티티 금지.
2. `infrastructure/persistence/{entity}/adapter/{Entity}RepositoryAdapter.kt` — `toDomain()/fromDomain()`.
3. 서비스 생성자에서 `JpaRepository` → Port. `JpaEntity` 를 응답 DTO 로 바로 쓰던 자리는 도메인 모델 경유.
4. 서비스가 `@Service` 클래스뿐이면 `usecase/{Action}{Entity}UseCase` 인터페이스 추출 + `Command/Result`.
5. 테스트: `JpaRepository` MockK → Port MockK. 컨트롤러 테스트는 UseCase MockK.
6. allowlist 에서 모듈 제거.

| 순서 | 모듈 | 위반 파일 | import | 비고 |
|---|---|---|---|---|
| P2-1 ✅ 2026-08-26 | `ranking/feature` | 4 | 20 | 완료 — UseCase 5 · Port 4 · Adapter 4, allowlist 제거 |
| P2-2 ✅ 2026-08-26 | `deal/feature` | 3 | 12 | 완료 — UseCase 16 · Port 3 · Adapter 3, allowlist 제거 |
| P2-3 ✅ 2026-08-26 | `blog/feature` | 9 | 41 | 완료 — UseCase 31 · Port 6 · Adapter 6, 도메인 Paging/Paged 도입, allowlist 제거 |

**검증**: 모듈 test + `:code-dictionary:app:test`(컨텍스트 로드) + 게이트. 공개 API 응답 JSON 이 이전과
동일한지 FE 스냅샷 또는 curl diff.
**이미지 영향**: code-dictionary (세 모듈 전부 이 호스트).

## P3 — 변종 D `git mv` (package 무변경) ✅ 2026-08-26 완료 (main 120 + test 17 파일, auth 는 서브모듈 별도 커밋)

| 모듈 | 파일 | 주의 |
|---|---|---|
| `product/app` · `product/domain` | 31 + 4 | |
| `order/feature` · `order/domain` | 26 + 5 | 이중 구조 — `order/order/controller` 와 `order/presentation/order/controller` 를 합친다 |
| `search/app` · `search/domain` | 21 + 4 | `search/CLAUDE.md` 의 "디렉터리 ≠ 패키지" 경고 섹션을 삭제 |
| `auth/app` | 29 | **private 서브모듈** — 서브모듈에서 커밋·푸시 후 본체 포인터 갱신 |

방법: 파일의 `package` 선언에서 경로를 유도해 `git mv` 하는 스크립트 1회 실행. 빈 디렉토리 정리.
`git log --follow` 로 이력 유지 확인.

**검증**: `./gradlew build` (컴파일 산출물 동일). 게이트 ③ allowlist 제거.
**이미지 영향**: product · search(app/consumer/batch) · commerce · auth — 코드 변화 0 이지만 태그는 바뀐다.

## P4 — 변종 B 정렬 + 잔여 역참조

| 모듈 | 작업 |
|---|---|
| ✅ `analytics` | 완료 — 포트 `application/{score,event}/port`, UseCase 인터페이스 4 + 서비스 2 |
| ✅ `experiment` | 완료 — 포트 2(AnalyticsMetricsPort 신설), UseCase 인터페이스 6 + 서비스 2 |
| ✅ `recommendation` | 완료 — domain/recommendation/{model,policy}, 포트 9(밴딧·실험·노출 포트 신설), UseCase 인터페이스 3 + 서비스 3 |
| ✅ `quant` | 완료 — 인터페이스 14 + Service 14, `PaperAccount` 도메인 모델, metrics 포트 2, 차트 properties 는 application 소유 |
| ✅ `game` | 완료 — UseCase 인터페이스 31, 컨트롤러 8개 인터페이스 주입 |
| ✅ `code-dictionary` | 아웃바운드는 완료 — `IndexAliasPort`. **인바운드(UseCase 인터페이스)는 P7 에서** |
| ✅ `chatbot` | 완료 — Properties 는 application/chat/config, Config 는 infrastructure/config (규칙 11) |
| ✅ `search/app` · `auth/app` · `inventory/feature` | 완료 — `SearchVariantPort` · `SubjectHashPort` · `InventoryMetricsPort` |

**검증**: 각 모듈 test + 게이트 ① allowlist 비움 ✅ 2026-08-26.

## P5 — DRY (Outbox · 멱등 엔티티) ✅ 2026-08-26

- ✅ `inventory/feature` 자체 Outbox 4파일 + `OutboxPollingPublisher` 삭제 → common `InventoryOutboxRepository : OutboxRepository`
  + `InventoryMessagingConfig` 에 `inventoryOutboxPort`/`inventoryOutboxPollingPublisher` 빈. 스키마는 common `OutboxEntity` 와
  컬럼 단위로 같아 마이그레이션 없음(인덱스 선언만 common 쪽에 있고 DDL 은 이미 있었다). 죽은 키 `inventory.outbox.*` 제거.
- ✅ ProcessedEvent 5벌 — **설계상 중복이 아니었다.** ADR-0058 불변식 3 이 요구하는 것은 "도메인별 EMF 바인딩" 이지
  "도메인별 엔티티" 가 아니다. outbox 와 같은 모양으로 common `messaging.idempotency` 에 엔티티·`@NoRepositoryBean` 베이스·어댑터
  한 벌, 도메인은 `{Domain}ProcessedEventRepository` 한 줄 + EMF 패키지 + 어댑터 빈. 단독 앱(product·quant)은 `@EntityScan`
  (Boot 4 는 `org.springframework.boot.persistence.autoconfigure.EntityScan`). 어댑터 테스트 4벌 → common 1벌.
  규칙은 `idempotent-consumer.md` §1.3.
- `quant/app` Outbox(`OutboxRelay`, Postgres) — 형태가 달라 별도 검토. 이 플랜에서 결정하지 않는다.

**검증**: common 81 · inventory 29 · fulfillment 17 · order 20 · product 16 · quant 129 · commerce 3(`CommerceContextLoadSpec` Testcontainers 로
inventory EMF 가 common 엔티티 두 개를 inventory_db 에 매핑하는 것까지) 전부 통과, `verifyLayerDependencies` 통과.

## P6 — 테스트 소스셋 없는 모듈 ✅ 2026-08-26

`agent-viewer/api`(예외 — 도구) 제외 5개 모두 소스셋 생김 — `warehouse/feature` `WarehouseServiceTest`, `member/feature` `MemberServiceTest`,
`gifticon/domain` `GifticonTest`·`ExpiryAlertPolicyTest`, `gifticon/app` `GifticonServiceTest`, `chatbot/app` `PromptBuilderTest`·`ChatServiceTest`.
전부 Port MockK 단위 테스트(Spring 컨텍스트 없음). 체크리스트 §8 "소스셋 없는 모듈 금지" 가 이후 신규를 막는다.

## P7 — 규칙 7 강제 (컨트롤러가 UseCase 를 본다) ✅ 2026-08-26

P1~P6 을 끝낸 뒤 재측정에서 **완료 기준의 지표 자체가 틀렸다는 것**이 드러났다. `UseCase-class 0` 은
"UseCase 를 클래스로 구현한 것"을 세는데, code-dictionary 는 **UseCase 가 아예 없어서** 그 수치를 공짜로
통과했다. 21개 모듈 중 유일하게 컨트롤러가 `*Service` 를 직접 주입하고 있었고, 하필 game·deal·blog·ranking
을 폴드한 최대 호스트라 신규 도메인이 복사할 견본이 거기 있었다.

- 규칙 ①을 `presentation` 까지 + import 목록에 `org.springframework.data.jpa.`·`jakarta.persistence.` 추가.
- presentation → infrastructure 6파일 수정 (허용목록 없이): `MemberStatsController`·`OrderStatsController` 는
  포트 집계 메서드 + `Get*StatsUseCase`, `JudgmentController` 는 `JudgmentRepositoryPort`+`JudgmentRecord`,
  `BanditMonitorController` 는 `BanditPort` 확장 + `MonitorBanditUseCase`, `BlogPageController` 는
  `BlogShellPort`/`BlogPageRenderPort` + `RenderBlogPageUseCase`(sealed `Page`), `SearchDebugController` 는
  `SearchDebugPort` + `SearchDebugAdapter`(OpenSearch·리랭커·프로퍼티 9개가 어댑터로).
  **응답 JSON 은 그대로다** — admin-fe 의 `searchDebug.ts` 필드명을 그대로 옮겨 담았다.
- code-dictionary 18 서비스 → UseCase 인터페이스 18개(`application/{entity}/usecase`), 컨트롤러 14개가
  인터페이스를 주입.
- DTO 가 `service` 패키지에 살면 규칙이 구현 호출과 구별할 수 없어 6개를 `dto` 로 이동.
- 게이트 규칙 ④ 추가 + 허용목록 `useCaseGateExempt` (비어 있다).

**걸린 것**: 인터페이스를 붙이자 `@Cacheable` 이 걸린 `ConceptService` 의 빈이 JDK 프록시가 되어 구상 타입으로
주입하던 곳이 `BeanNotOfRequiredTypeException` 으로 죽었다. **원인을 다시 재보니 앱이 아니라 테스트 컨텍스트
한정이었다** — `@SpringBootApplication` 은 `AopAutoConfiguration` 이 `spring.aop.proxy-target-class` 기본값(true)으로
CGLIB 을 강제하는데, `ConceptCacheTestContext` 는 auto-config 가 안 도는 최소 컨텍스트라 맨 `@EnableCaching`
기본값(JDK)이 걸렸다. `@EnableCaching(proxyTargetClass = true)` 로 프로덕션과 맞추자 구상 주입도 통과한다(실측).
주입은 컨벤션대로 인터페이스로 두되, **프로덕션에 없는 실패를 내는 테스트 컨텍스트를 고치는 것이 진짜 수정**이다.

**검증**: 일부러 만든 위반으로 규칙 ①·④가 실패하는 것 확인 후 원복, DTO import 는 통과(오탐 없음),
code-dictionary 41 · game · blog · deal · ranking · search · analytics · recommendation · member · order · commerce test 통과.

## P8 — quant 레이아웃을 표준으로 ✅ 2026-08-26

"quant 는 예외" 라고 적어 둔 근거가 없었다 — 규약은 2026-03-18 부터 있었고 quant 포트는 2026-04-25 에
flat 으로 만들어졌으며, quant 의 어떤 ADR·스펙도 패키지 구조를 규정한 적이 없다. 프레임워크도 같다.
사후 정당화였으므로 철회하고 표준으로 옮겼다(포트 43 + flat `usecase`/`view`/`service`).

묶음의 두 축(엔티티 / **외부 시스템**)을 `package-structure.md` 규칙 6 에 명시했다. 이것이 규약의
진짜 빈칸이었다 — quant 를 옮기기만 하고 이걸 안 채웠으면 다음 서비스가 또 갈린다.

## P9 — 레이아웃 무관 주입 게이트 ✅ 2026-08-26

규칙 ④는 `service` 라는 패키지 이름에 기대므로 UseCase 와 구현이 같은 패키지에 살면 못 잡고, 포트나
`*Query` 클래스 직접 주입도 못 본다. 규칙 ⑤(주입 타입의 **선언 위치** 판정)를 넣자 5개 모듈 19건이
드러났고, 허용목록에 이유·단계를 적어 넣은 뒤 단계마다 비웠다 — 지금은 비어 있다.

| 모듈 | 고친 것 |
|---|---|
| chatbot | `AdminController` → `ReloadKnowledgeBaseUseCase` |
| search | `SearchController` → `RecordSearchInteractionUseCase` |
| gifticon | `PushSubscriptionController` → `ManagePushSubscriptionUseCase` (서브모듈) |
| game | `ArcadeController` → 아케이드 조회 3종 UseCase |
| quant | chart 5 · discover 2 · kimchi 1 · market 1 · 포트 5 → UseCase 인터페이스 + `GetChartDataUseCase`·`SubscribePriceStreamUseCase` |

`search` 의 레이어 밖 패키지도 함께 닫았다 — `com.kgd.search.{bandit,config}` 9파일이 세 레이어 밖에
있었고(어댑터 2 · `@Configuration` 1 · 프로퍼티 2 · 리랭커 4), 기술 어댑터는 `infrastructure`, 랭킹 정책과
프로퍼티는 `application/ranking/{service,config}` 으로 갈랐다. `search/batch` 의 `job/` 도 `infrastructure/job`.
이제 세 모듈 모두 최상위에 세 레이어와 `*Application.kt` 만 남는다.

**검증**: quant 129 · search app 46/batch 11/consumer 7 · chatbot 9 · gifticon 9+10 · game 107 ·
code-dictionary 41 통과, `verifyArchitecture` 통과(허용목록 ①③④⑤ 전부 빔, ② `search:domain` 만).

## P10 — 게이트가 3rd-party 기술을 보게 ✅ 2026-08-26

규칙 ①의 신호가 `com.kgd.*.infrastructure.` + JPA 뿐이라, **기술을 직접 손에 쥔 application** 은 통과했다.
quant `GlobalIndicesQuery` 가 UseCase 를 구현한 채 application 안에서 Yahoo URL 로 `WebClient` 를 세우고
있었다(변종 C 와 같은 실패, JPA 대신 HTTP). Redis·Kafka·OpenSearch·JDBC 도 같은 사각이었다 —
P7 이 고친 `SearchDebugController` 의 원래 형태(컨트롤러가 `OpenSearchClient` 보유)가 다시 들어와도
안 걸리는 상태였다.

- 규칙 ①의 import 목록에 I/O 기술을 넣었다. **Caffeine 은 넣지 않았다** — 인메모리 자료구조는
  프로세스 밖으로 안 나가므로 기술 누수가 아니고, 넣으면 캐시 TTL 같은 application 정책까지 포트 뒤로 민다.
- `GlobalIndicesQuery` 의 Yahoo 호출을 `GlobalIndexQuotePort` + `YahooGlobalIndicesAdapter` 로 뺐다.
  같은 패키지에 `YahooLatestPriceAdapter`·`YahooNewsAdapter`·`YahooFundamentalsAdapter` 가 이미 있다.
  캐시 TTL 과 실패 흡수는 application 에 남겼다 — 화면 정책이지 원천의 성질이 아니다.
- 규칙 ⑤의 타입 해석을 전역 심플명 색인 → **파일의 import 우선**으로 바꿨다. 충돌 이름 45건이
  `putIfAbsent` + 파일시스템 순서로 갈려 로컬/CI 판정이 달라질 수 있었다(현재 실영향 0이었지만 잠복).
- 덤으로 `quant/domain` 의 `AssetClass` 중복 2벌(상수까지 동일)을 하나로 합쳤다.

**검증**: application 에 `WebClient`, presentation 에 `OpenSearchClient` 를 심어 규칙 ①이 잡는 것 확인 후 원복.

## P11 — 반대 방향 의존 ✅ 2026-08-26

①~⑤가 전부 "안쪽이 바깥을 부르는" 방향만 봤다. 반대 방향은 무검사였고 딱 한 곳이 걸렸다 —
quant `JpaSignalStrategyAdapter` 가 프레젠테이션 DTO 를 그대로 직렬화해 DB JSON 컬럼에 넣고 있었다.
`@JsonTypeInfo` 판별자가 API 계약이자 저장된 값이라, 응답 DTO 이름을 바꾸면 기존 행이 못 읽힌다.

- `infrastructure/persistence/payload/SignalConfigPayload`·`PositionSizingPayload` 를 infrastructure
  소유로 만들고 자기 `toDomain`/`from` 을 갖게 했다. 판별자 문자열은 **이미 저장된 값이라 고정**이며,
  그 사실을 KDoc 과 계약 테스트(`SignalConfigPayloadSpec`, 왕복 3케이스)로 못 박았다.
- 게이트 규칙 ⑥(`infrastructure → presentation` 금지). 위반이 그 1건뿐이라 허용목록 없이 켰다.

**검증**: infrastructure 에 프레젠테이션 DTO 를 심어 ⑥이 잡는 것 확인 후 원복.

## P12 — ADR-0058 불변식 1 을 코드로 ✅ 2026-08-26

ADR-0058 은 "교차 import 가 **컴파일 에러로 차단**(결합 구조적 불가)" 이라고 적었는데, 그건 feature
끼리에만 참이었다. 호스트 앱은 폴드된 도메인을 build.gradle 로 의존하므로 컴파일이 통과한다 —
**불변식이 문서에만 있고 강제 장치가 없던 셈**이다(ADR-0083 이 지목한 바로 그 상태).

- 규칙 ⑦: 그 모듈이 소유하지 않은 `com.kgd.{다른서비스}.` import 금지(`common` 제외).
- 실측 위반 1건은 `code-dictionary:app` 의 `RetentionRunner`(폴드된 blog 의 `PurgeBlogViewsUseCase`)
  뿐이고, 이건 **부채가 아니라 의도된 합성 루트 배선**이다(원장 정리는 blog·resume 을 함께 만져야 해서
  호스트 말고 있을 곳이 없다). `crossServiceImportAllowed` 에 영구 예외로 두되 **이유를 적어** 둔다 —
  `search:domain`(규칙 ②)과 같은 종류의 예외이지 "비워야 할 목록" 이 아니다.
- ADR-0058 도 함께 고쳤다: 불변식 1 에 "컴파일 차단은 feature 끼리만 참" 을 명시하고, **재분리
  체크리스트에 4번(호스트 교차 배선 정리)을 추가**했다 — 없으면 2번만 하고 컴파일이 깨진다.

**검증**: `deal:feature` 에 blog import 를 심어 ⑦이 잡는 것 확인 후 원복.

## 완료 기준 — 전부 충족 (2026-08-26)

- ✅ 게이트 allowlist 에 `search:domain`(②) 만 남는다.
- ✅ 실측 집계: `dir≠pkg 0 · app→infra 0 · presentation→infra 0 · presentation→app.service 0 · 테스트 소스셋 부재 0(도구 제외)`.
  (P7 에서 `UseCase-class 0` 을 폐기했다 — UseCase 가 없으면 공짜로 통과하는 지표였다.)
- ✅ `package-structure.md` 의 "레거시 디렉토리 (이행 중)" 절 삭제.
