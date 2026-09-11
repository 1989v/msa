# 신규 도메인 체크리스트

> 새 바운디드 컨텍스트를 플랫폼에 올릴 때 위에서 아래로 한 번에 훑는 한 장. 규칙의 근거는
> 각 줄이 가리키는 문서가 갖고, 여기서는 **순서와 빠뜨리기 쉬운 것**만 적는다.
> 코드 견본은 **`inventory/feature`** 다 (ADR-0083). 복사해서 시작한다.

## 0. 결정 먼저 — ADR

- [ ] `docs/adr/` 에 ADR 을 먼저 쓴다. 새 모듈 추가는 ADR 트리거다 (`hns:start` PHASE 2.8).
  번호는 `ls docs/adr | sort | tail` 로 확인한 뒤 +1 (번호 중복 사고 전례 있음, `docs/README.md`).
- [ ] **어느 파드에 들어가는지**를 ADR 에 적는다. 기본은 **새 JVM 을 만들지 않는다**
  (ADR-0058 / ADR-0093) — `:domain` + `:feature` 라이브러리를 호스트 앱에 폴드한다.
  고르는 기준은 기술 스택이 아니라 **성격**이다. 도메인이 무엇에 관한 것인지로 한 줄 고른다.

  | 호스트 | 성격 — 이런 도메인이 여기 온다 | 폴드된 도메인 | 스키마 |
  |---|---|---|---|
  | `commerce:app` | 돈·재고·주문이 오가는 커머스 트랜잭션과 사가 | order · inventory · fulfillment · warehouse · product | 도메인별 전용 |
  | `content:app` | 사람에게 보여 주는 것. 서브도메인으로 공개된다 | game · place · blog · ranking | game·place 전용, 나머지 과도기 공유 |
  | `atlas:app` | apex 사이트 자체의 총람 — 사전·카탈로그·포트폴리오·전시 | code-dictionary | 호스트 |
  | `account:app` | **사람에 관한** 데이터. 회원이 지우면 같이 지워지는 것 | member · wishlist · resume | 도메인별 전용 |
  | `engagement:app` | 실험·추천 — 다른 도메인을 관찰해 순위를 매기는 것 | recommendation · experiment | 전용 + ClickHouse read |
  | `sideapp:app` | 위 어디에도 안 붙는 **도메인 단절 사이드앱** | quant · chatbot · gifticon | 도메인별 전용 |

  > `content`·`atlas` 는 ADR-0093 ②~④ 단계에서 `code-dictionary` 가 갈라져 생긴다. 그 전에
  > 노출 도메인을 새로 만든다면 `code-dictionary:app` 에 붙이고 ADR 에 그렇게 적는다.

- [ ] **새 `:app`(상주 JVM)을 만들려면 그것이 결정이어야 한다.** 빌드 게이트
  `verifyPodTopology`(루트 `build.gradle.kts`)가 `settings.gradle.kts` 의 `:{x}:app` 을 세어
  ADR-0093 의 승인 목록 밖이면 push 를 막는다. 통과시키려면 `approvedPods` 에 한 줄 더하고
  ADR 을 고치게 되어 있다 — 분류표를 우회해 파드가 늘어난 것이 ADR-0093 을 쓰게 만든 원인이다.
  단독 유지의 사유는 gateway(리액티브 혼재 금지)·auth(키 분실 = 전 회원 로그인 불가)·
  search(P99 SLA Tier 1)·analytics(Kafka Streams GC) 급이어야 하고, ADR-0093 §2 에 적는다.

## 1. 모듈 골격

- [ ] `settings.gradle.kts` 에 `"{svc}:domain"`, `"{svc}:feature"` 두 줄 + 주석(ADR 번호, 호스트).
- [ ] `{svc}/domain/build.gradle.kts` — 의존은 `project(":common")` 뿐. Spring/JPA 를 넣는 순간 domain 이 아니다.
- [ ] `{svc}/feature/build.gradle.kts` — `bootJar` disabled / `jar` enabled, `@SpringBootApplication` 없음.
  원본은 `wishlist/feature/build.gradle.kts`(전용 datasource) 또는 `deal/feature/build.gradle.kts`(스키마 공유).
- [ ] 패키지는 **`com.kgd.{svc}`** — 호스트 하위(`com.kgd.codedictionary.{svc}`)가 아니다. 잘못된 패키지
  이름은 폴드가 풀린 뒤에도 남는다 (ADR-0069 §4).

## 2. 레이어 — 표준 하나, 예외 없음 (ADR-0083)

- [ ] `application/{entity}/usecase` — **인터페이스** + 내부 `Command`/`Query`/`Result`. 단일 구현이라도 생략 금지.
- [ ] `application/{entity}/port` — Outbound Port 인터페이스. **domain 모듈에 두지 않는다.** 시그니처에
  JPA 엔티티·프레임워크 타입 금지.
- [ ] `application/{entity}/service` — `@Service`, UseCase 구현, **Port 만 주입**. `JpaRepository`/`JpaEntity`
  import 가 하나라도 있으면 틀린 것이다 — 빌드 게이트 `verifyLayerDependencies` 가 잡는다.
- [ ] `infrastructure/persistence/{entity}/{entity,repository,adapter}` — Adapter 가 Port 를 구현.
- [ ] `presentation/{entity}/{controller,dto}` — 컨트롤러는 UseCase 인터페이스만 주입. 응답은 `ApiResponse<T>`.
- [ ] **디렉토리 == package 선언.** 레이어를 디렉토리에서 생략하지 않는다.
- [ ] 네이밍·DI 방향·팩토리 패턴 → `docs/conventions/code-convention.md`. 레이아웃 전체 →
  `docs/conventions/package-structure.md`.

## 3. 호스트 폴드 — 세 곳 + 한 줄

- [ ] 호스트 `@SpringBootApplication(scanBasePackages = [...])` 에 `com.kgd.{svc}` 추가.
  **빠뜨리면 기동은 되고 그 도메인만 조용히 404** 다.
- [ ] 호스트 EMF `packages(...)` 에 엔티티 패키지 (스키마 공유형). 전용 datasource 형은 feature 의
  `{Svc}DataSourceConfig` 가 자기 EMF/TM 을 갖는다 — `@Transactional("{svc}TransactionManager")` 한정자 명시.
  **한정자를 빠뜨리면 호스트의 primary TM 에 붙어 쓰기가 조용히 사라진다**(deal 클릭 수 사고).
  `verifyTransactionQualifiers` 가 `@Primary` 없는 도메인 전부에 이것을 강제한다 — 도메인 목록을
  손으로 유지하지 않고 `*DataSourceConfig.kt` 에서 판정하므로, 새 도메인은 등록 없이 바로 걸린다.
- [ ] 호스트 `@EnableJpaRepositories` basePackages (스키마 공유형).
- [ ] 호스트 컨텍스트 로드 spec(`CodeDictionaryContextLoadSpec` / `CommerceContextLoadSpec`)에
  "폴드된 도메인의 컨트롤러가 전부 빈으로 등록된다" 한 줄 추가 — 첫 번째 항목 누락을 잡는 유일한 자동 장치.
- [ ] 폴드 모듈 간 **직접 빈 주입 금지** — 다른 feature 를 의존에 넣지 않는다 (ADR-0058 불변식 1).

## 4. 스키마

- [ ] 전용 datasource 형: `src/main/resources/{svc}db/migration/V1__…sql` + `ScopedFlywayMigrator` 빈
  (`spring-boot-flyway` 자동설정은 폴드 앱에서 버전이 충돌한다 — 루트 `verifyFlywayWiring` 이 검사).
- [ ] 스키마 공유형: **호스트의** `db/migration/V{n}__{svc}.sql` — 히스토리가 하나라 수열도 하나.
- [ ] **커밋한 마이그레이션은 불변이다.** main 이 곧 배포 브랜치라 이미 적용됐을 수 있다 — 고치려면 다음 번호.
- [ ] JPA 규칙(enum STRING·FK-as-ID·validate) → `docs/conventions/jpa-persistence.md`.

## 5. 메시징

- [ ] 토픽 `{svc}.{entity}.{event}` → `docs/architecture/kafka-convention.md` 표에 발행/수신 행 추가.
- [ ] 컨슈머는 common `IdempotentEventHandler` 만 쓴다 (자체 dedup 금지) → `docs/conventions/idempotent-consumer.md`.
- [ ] 발행은 common Outbox 를 도메인 전용 서브인터페이스로 바인딩 (`OrderOutboxRepository : OutboxRepository` 패턴).
- [ ] 소비 멱등 원장도 같은 방식 — `{Domain}ProcessedEventRepository : ProcessedEventRepository` + EMF `packages(...)` 에
  `com.kgd.common.messaging.idempotency` + `JpaProcessedEventRepositoryAdapter` 빈 (`docs/conventions/idempotent-consumer.md` §1.3).
  엔티티를 도메인에 다시 만들지 않는다.
  자체 Outbox 를 새로 짜지 않는다.
- [ ] 같은 JVM 의 다른 BC 와도 **Kafka 로** 통신한다 — in-process `@EventListener` 금지 (ADR-0058 불변식 2).

## 6. 외부 호출

- [ ] 외부 API 를 부르면 `ExternalApiProvider` 쿼터 게이트를 탄다 (ADR-0082, 루트 `verifyExternalApiQuota` 가 검사).
- [ ] 상시 파드에 egress 를 열지 않는다 — 수집은 CronJob 으로 분리 (ADR-0031/0070). NetworkPolicy 갱신.
- [ ] 외부 데이터를 붙이면 `docs/architecture/data-sources.md` 대장 갱신 — 원천 필드 전부 적재·가공은 파생 컬럼.

## 7. 노출

- [ ] gateway 라우트 — 인증 수준별로 분리(public / 게스트 허용 `required=false` / ROLE_USER / ADMIN), `gateway/CLAUDE.md`.
- [ ] 어드민 API 는 `/api/v1/admin/**` 로 서비스가 제공 (admin 은 FE 전용).
- [ ] API 문서에 드러낼 도메인이면 feature 에 `GroupedOpenApi`(`infrastructure/config/OpenApiConfig.kt`)
  를 두고 gateway `openApiServices` 에 `/v3/api-docs/{group}` 으로 등록한다. 폴드 호스트의 기본
  `/v3/api-docs` 는 도메인이 합쳐진 하나라 **이름만 다른 같은 스펙**이 된다.
- [ ] 서브도메인이면 루트 `CLAUDE.md` "새 서브도메인 서비스 체크리스트" 4단계 (ingress · `App.tsx` · 프리렌더
  `_hosts/$host` · `SUBDOMAIN_ORIGIN`). 로그인은 apex `/login` 한 곳 (ADR-0079).
- [ ] SEO 카피는 `portal-fe/src/seo/copy.mjs` 한 곳. `index.html` 에 canonical 을 두지 않는다 (ADR-0062).

## 8. 테스트 — 소스셋 없는 모듈 금지

- [ ] `{svc}/domain/src/test` — 순수 단위, Mock 없음.
- [ ] `{svc}/feature/src/test` — 서비스 테스트는 Port 를 MockK 로. 컨트롤러는 UseCase 를 MockK 로.
- [ ] 호스트 컨텍스트 로드 spec 갱신 (§3).
- [ ] Kotest BehaviorSpec, `{ClassName}Test.kt` → `docs/standards/test-rules.md`.

## 9. 문서

- [ ] `{svc}/CLAUDE.md` — Modules / Commands / **구조 상태** / Key Rules. `{svc}/glossary.md` + `docs/context-map.md` 행.
- [ ] 루트 `CLAUDE.md` 서비스 표 행 + (호스트 변경 시) Frontend 진입 구조 표.
- [ ] `docs/architecture/module-structure.md` 모듈 표, `docs/doc-index.json` `source_roots`.
- [ ] `python3 ai/plugins/hns/scripts/doc_map.py --check` 로 lock drift 확인 후 재생성.

## 10. 검증 — 이 네 줄이 통과해야 끝이다

```bash
./gradlew :{svc}:domain:test :{svc}:feature:test      # 도메인 + 서비스
./gradlew :{host}:app:test                             # 컨텍스트 로드 (폴드 3곳 누락 검출)
./gradlew :{host}:app:check                            # verifyLayerDependencies · verifyFlywayWiring · verifyExternalApiQuota
python3 ai/plugins/hns/scripts/doc_map.py --check      # 문서-소스 lock
```

## 예외 — 이 체크리스트를 타지 않는 모듈

| 모듈 | 이유 |
|---|---|
| `gateway` · `common` | 인프라 단일 모듈 — 레이어 없음 |
| `agent-viewer/api` | 개발 도구, 플랫폼 서비스 아님 |
| `game:sim` · `game:web` | KMP — JVM 레이어 규칙 비대상 |
| `search:domain` | `spring-data-commons` 의존이 문서화된 유일한 domain 예외 |
