# Engineer Review — Architecture (광고 네트워크)

- 대상: `spec.md` · `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml` · `docs/adr/ADR-0098-ad-network.md`
- 기준: hns `reviewers/architecture/checklist.md` · `references/language-reference.md` §3 · ADR-0083 · ADR-0093 · `docs/conventions/package-structure.md` · `docs/conventions/transactional-usage.md` · `docs/standards/new-domain-checklist.md`
- KB: [[modular-monolith-fold]] (vault `wiki/concepts/`, updated 2026-09-11) — 표준으로 적용. `kb-search.sh` 는 이 세션에 셸 도구가 없어 실행하지 못했고, `HNS_KB_PATH`(`.claude/hns-hooks.env:10`)의 `wiki/` 를 직접 검색해 찾았다
- 확인한 코드: `EngagementApplication.kt:13-20` · `engagement/app/build.gradle.kts` · `engagement/app/src/main/resources/application{,-kubernetes}.yml` · `EngagementContextLoadSpec.kt` · `ExperimentDataSourceConfig.kt` · `ScopedFlywayMigrator.kt` · `GatewayRouteConfig.kt:213-219,369-377` · 루트 `build.gradle.kts:622-820` · `.github/workflows/images.yml:132-174` · `k8s/overlays/oci-arm/kustomization.yaml:128-173` · game `ads` 모듈 16파일 · `V6__ads_house.sql`

## 판정 요약

폴드 위치(engagement), 레이어 표준, 모듈 구성(`:ads:domain` + `:ads:feature`), game ads 흡수 순서는 표준과 맞다. 흡수 순서(ads 기동 → 게이트웨이 전환 → game 제거, `spec.md:108`)는 [[modular-monolith-fold]] 「배포 순서」의 A→B1→B2→B3 과 같다. 문제는 **폴드가 조용히 깨뜨리는 자리 네 곳**이다. 스펙이 이 자리를 명시하지 않았다. 전부 기존 게이트나 컨벤션으로 고칠 수 있고, 사람이 판단할 충돌은 없다 → **REVISE**.

## 체크리스트

| 항목 | 판정 | 근거 |
|---|---|---|
| 레이어 책임 분리 | 통과 | `spec.md:21` ADR-0083 표준, 견본 `inventory/feature`. 경매·페이싱·pCTR·원장 팩토리가 `:ads:domain` 에 있다(`test-quality.md:7-19`) |
| 상향 의존 없음 | 통과 | `spec.md:20` domain 은 `:common` 만 의존 |
| 외부 연동은 Port 경유 | 통과 | 이미지 저장 `ImageStoragePort`(`spec.md:142`), analytics 발행은 Kafka |
| 모듈 경계 변경의 근거 | **REVISE** | R3(ads_db 배선), R4(게이트웨이 신원), R5(`:common` 변경의 배포 파급) |
| 패턴 일관성 | 통과, 조건 있음 | `ExperimentDataSourceConfig` 와 같은 모양(`spec.md:23`). 단 R1·R3 |
| 순환 의존 없음 | 통과 | `spec.md:24` recommendation·experiment 빈 직접 주입 금지 (ADR-0058 불변식 1) |
| 트랜잭션 경계 소유 | **REVISE** | R1(비-primary TM 한정자), R2(Redis→MySQL 합산의 경계) |
| 인터페이스 면적 최소 | 통과 | 결정 API 하나가 여러 지면을 받는다(`spec.md:48`). 이벤트는 토큰 묶음 하나(`spec.md:68`) |
| 얕은 pass-through 없음 | 통과 | 새 모듈 두 개 모두 깊다(아래 Deletion Test) |
| 정보 은닉 | 통과 | 호출자(FE)는 채움 순서와 사유 코드만 안다(`spec.md:54,58`) |
| Seam 실재성 | 통과, 기록 | `ImageStoragePort` 는 어댑터가 1개인 가설 seam 이다. 다만 ADR-0083 이 모든 Outbound 에 Port 를 요구하고, ADR-0098 `(−)` 줄(`ADR-0098:91`)이 교체 시점을 적었다. 허용 |
| 모듈 이름은 glossary 에서 | 보류 | `ads/glossary.md` 는 아직 없다(`requirements.md:135`). 구현 전에 등재해야 한다. 서비스 이름은 `AdService` 가 아니라 사전 어휘(`Auction`·`Pacing`·`Settlement`·`Ledger`)로 짓는다 — 흡수 대상인 game `AdService.kt` 이름을 그대로 가져오지 않는다 |

### Deletion Test

| 새 모듈 | 지우면 | 판정 |
|---|---|---|
| `:ads:domain` | 경매·페이싱·pCTR·원장 불변식·소재 검증이 서비스 N곳으로 흩어진다 | 깊다 — SHIP |
| `:ads:feature` | 결정·계측·정산·콘솔·어드민 API 전부 | 깊다 — SHIP |
| `Publisher` 엔티티(`requirements.md:133`) | 행 1개(1989v)와 원장 계정 하나만 남는다. 복잡도는 **사라진다** | 1단계에서는 만들지 않는다 — R6 |

## Findings

### R1. ads 는 비-primary 도메인이다 — TM 한정자와 값으로 확인하는 호스트 쓰기 검사가 스펙에 없다 (트랜잭션 경계)

- 스펙 결정: `spec.md:23` 「experiment 의 `@Primary` 는 그대로 둔다」 → ads 의 `*DataSourceConfig` 에는 `@Primary` 가 없다
- 규칙: `docs/conventions/transactional-usage.md:47-52` — 한정자 없는 `@Transactional` 은 호스트 primary TM(여기서는 `experimentTransactionManager`, `ExperimentDataSourceConfig.kt:90-94`)에 붙는다. 그러면 `@Modifying` 쓰기가 **예외 없이 사라진다**
- 게이트: 루트 `build.gradle.kts:703-731` — 비-primary 이고 `@Modifying` 을 가진 도메인은 호스트 `*ContextLoadSpec` 이 `com.kgd.ads.application.` 진입점을 불러야 통과한다. ads 는 지갑 잔액 갱신(`spec.md:83`)과 DeliveryHourly 합산(`spec.md:71`)에서 조건부 UPDATE 를 쓸 공산이 크다
- 스펙의 공백: `test-quality.md:40` C1 은 「EMF/TM/Flyway 가 도메인별로 갈린다」만 본다. 빈 존재와 분리만으로는 한정자 사고를 못 잡는다([[modular-monolith-fold]] 「검증 방법」: 조회만 하는 테스트는 전부 통과한다)
- 가장 위험한 자리: `spec.md:69` 클릭 리다이렉트는 「검증 실패여도 이동은 막지 않는다」. 호출부가 예외를 삼키는 구조다. `transactional-usage.md:88-90` 의 deal `/go/{slug}` 사고(클릭 수가 며칠간 0)와 같은 모양이다
- 수정안
  1. SR-1 에 한 줄 추가: 「ads 의 `@Service` 는 클래스에 `@Qualifier("adsTransactionManager")` 를 단다(`transactional-usage.md:64-75`). Querydsl 을 쓰면 `adsJpaQueryFactory` 도 한정자로 받는다」
  2. `test-quality.md` C1 을 값 기반으로 바꾼다: 호스트 컨텍스트에서 `TopUpCreditUseCase`(이름은 glossary 기준)를 불러 **지갑 잔액이 `was + amount`** 인지 본다. 이벤트 수락 → 합산 작업을 한 번 돌린 뒤 **DeliveryHourly 의 노출 수가 `was + 1`** 인지 본다. 회귀 주입 목록(`test-quality.md:52-57`)에 「한정자 제거 → C1 빨간불」을 더한다

### R2. Redis 카운터 → MySQL 합산의 트랜잭션 경계와 스케줄러 배선이 정해지지 않았다

- 스펙 결정: `spec.md:70-71` 「카운터는 5분 이하 주기로 DeliveryHourly 에 더해진다. 이미 더한 몫은 다시 더하지 않는다」, `spec.md:91` 정산이 늦어도 예산은 Redis 가 지킨다
- 공백: Redis 와 MySQL 은 한 트랜잭션에 묶이지 않는다. 「읽고 지우기(GETDEL) → MySQL 커밋」 순서면 커밋 실패 때 몫을 잃는다. 반대 순서면 커밋 뒤 크래시 때 두 번 더한다. 스펙은 어느 쪽인지, 무엇이 「이미 더한 몫」을 기억하는지 적지 않았다. `transactional-usage.md` 는 트랜잭션 안에서 외부 IO(Redis·Kafka)를 하지 말라고 한다. 이 경계가 그 규칙과 부딪히는 자리다
- 스케줄러: ADR-0098 `:32` 와 `requirements.md:102` 는 「engagement 가 스케줄러를 이미 갖고 있다」고 적었다. 그런데 `recommendation/feature` 와 `experiment/feature` 어디에도 `@EnableScheduling`·`@Scheduled` 가 없다(Grep 0건). ads 는 주기 작업 넷을 새로 들인다(인덱스 새로고침 1분 `spec.md:55` · 카운터 합산 5분 `:71` · 시간별 정산 `:87` · 일일 원장 합 검사 `:84`)
- 수정안
  1. SR-7 에 합산 방식을 명시한다. 권장: Redis 는 **누적값만 올리고 지우지 않는다**(TTL 은 그 시각 + 여유). MySQL 은 (캠페인, 소재, 지면, 시각) 행에 `applied_*` 누적값을 두고, 한 MySQL 트랜잭션 안에서 `delta = redis누적 − applied` 를 더하고 `applied` 를 옮긴다. Redis 읽기는 트랜잭션 **밖**에서 먼저 한다. 재실행과 중복 실행에 멱등이다
  2. ADR-0098 §1 의 근거 문구를 「Redis·Kafka 는 이미 있다. 스케줄링은 ads 가 `@EnableScheduling` 을 들인다」로 고친다. `replicas: 1`(`k8s/base/engagement/deployment.yaml:12`)을 전제로 적는다. 레플리카를 늘리면 작업이 중복 실행된다. 위 1의 멱등 설계가 그 대비다

### R3. `ads_db` 배선이 「인프라 추가 없음」과 맞지 않고, 설정 prefix·인스턴스·테스트 DB 가 비어 있다

- 스펙 결정: `spec.md:23` 전용 스키마 `ads_db`, `spec.md:25` 「그 밖의 인프라 추가는 없다」
- 실제로 필요한 것
  - 스키마·계정 생성: `k8s/infra/local/mysql/configmap-init.yaml:31,71`, `k8s/infra/prod/percona-mysql/init-databases-job.yaml:31,51` 에 `experiment_db` 처럼 한 줄씩 넣어야 한다. prod 는 비밀번호 키(`*_PASSWORD`, `percona-mysql/README.md:113`)도 필요하다
  - 설정 prefix: `ExperimentDataSourceConfig.kt:50-53` 은 `spring.datasource.*` 를 가져간다. 「같은 모양」을 그대로 베끼면 두 도메인이 같은 키를 읽는다. ads 는 별도 prefix(예: `ads.datasource.*`)를 쓴다. `application.yml` 과 `application-kubernetes.yml`(`:3` 이 `mysql-experiment-master` 를 가리킨다) **둘 다**에 블록을 둔다. [[modular-monolith-fold]] 「따라오지 않는 것」 첫 줄이 운영 프로파일이다
  - 인스턴스 선택: `ads_db` 를 `mysql-experiment-master` 에 둘지 다른 인스턴스에 둘지 정해야 한다. 다른 인스턴스면 NetworkPolicy 가 필요하다(default-deny, `k8s/CLAUDE.md`)
  - `ddl-auto`: `application.yml:21-23` 의 전역 `update` 는 `EntityManagerFactoryBuilder` 를 거쳐 ads EMF 에도 걸린다. ads 는 V1 부터 Flyway 로 시작하는 새 스키마다(`baselineVersion` 없음). ads EMF 에만 `hibernate.hbm2ddl.auto=validate` 를 주면 컨벤션 목표(`jpa-persistence.md:80`)를 처음부터 지킬 수 있다
  - 테스트: `EngagementContextLoadSpec.kt:95` 컨테이너는 `experiment_db` 만 만들고 `:39-40` 은 `ddl-auto=create` · `spring.flyway.enabled=false` 다. ads 의 `ScopedFlywayMigrator` 는 `spring.flyway.enabled` 와 무관하게 돈다(`ScopedFlywayMigrator.kt:30-38`). 그래서 `ads_db` 가 컨테이너에 없으면 기동이 실패한다
- 수정안: SR-1 의 「그 밖의 인프라 추가는 없다」를 「상주 JVM·새 저장소는 없다. `ads_db` 스키마·계정·비밀번호 키와 engagement 설정 블록은 추가한다」로 바꾼다. 위 다섯 곳을 tasks 에 넣는다. 인스턴스는 스펙에서 정한다

### R4. 「공개」 라우트가 필터 없는 경로면 광고주 본인 제외(SR-8)가 동작하지 않고 신원 헤더가 위조된다

- 스펙 결정: `spec.md:104` 결정·이벤트·클릭·에셋은 「공개」다. `spec.md:75` 광고주 본인(로그인 회원 = 캠페인 소유자)의 노출·클릭은 과금하지 않는다
- 충돌: 게이트웨이는 `authFilter.apply(optionalUserConfig())` 를 건 라우트에서만 `X-User-Id` 를 주입하고, 위조된 헤더를 벗긴다(`GatewayRouteConfig.kt:378-380` 주석, `gateway/CLAUDE.md` 「JWT 검증」). 필터 없는 공개 라우트면 두 가지가 동시에 생긴다. ① 로그인한 광고주도 신원이 안 실려 본인 제외가 **절대 발동하지 않는다** ② 손으로 붙인 `X-User-Id` 가 그대로 통과한다. `game/CLAUDE.md` 의 친구 그룹 사고가 같은 모양이다
- 경로 순서: 광고주 API 의 경로가 스펙에 없다. 공개 쪽이 `/api/v1/ads/**` 캐치올이면 뒤에 선언한 로그인 라우트가 가려져 인증이 조용히 약해진다(`gateway/CLAUDE.md` 「좁은 경로를 먼저」)
- 수정안: SR-13 을 이렇게 고친다
  - 공개(게스트 허용) = `optionalUserConfig` 필터를 건다. 대상은 `decisions`·`events`·`click/**`. 에셋은 신원이 필요 없지만 같은 라우트에 두어도 무해하다
  - 광고주 = 좁은 prefix(예: `/api/v1/ads/advertiser/**`)에 `userConfig` 를 걸고, 캐치올보다 **먼저** 선언한다
  - 어드민 = `/api/v1/admin/ads/**` 에 `adminConfig`. 기존 도메인별 어드민 라우트(`GatewayRouteConfig.kt:232,438,461`)와 같은 형태다
  - `test-quality.md` C2 에 「광고주 경로를 토큰 없이 부르면 401」 「공개 경로에 위조 `X-User-Id` 를 붙이면 백엔드에 닿지 않는다」 두 줄을 더한다

### R5. `CrawlerUserAgents` 를 `:common` 으로 올리면 전 JVM 이미지가 다시 구워진다 — 슬라이스를 분리한다

- 스펙 결정: `spec.md:74` 세 번째 사용이라 `:common` 으로 올린다. Rule of Three 에 맞고 근거도 있다
- 파급: `common/` 변경은 전 JVM 재빌드를 부른다(`.github/workflows/images.yml:132-138`). `common/CLAUDE.md` 는 이를 L3 리스크로 적는다. 롤아웃은 sync-wave 로 직렬화되지만, 한꺼번에 도는 롤아웃이 단일 노드에서 배치를 죽인 이력이 있다(`k8s/CLAUDE.md` 「`rebuild_all` 을 쓰지 마라」)
- 수정안: tasks 에서 이 이동을 **ads 와 별도 커밋·별도 배포 슬라이스**로 먼저 둔다. analytics(`presentation/event/CrawlerUserAgents.kt`)와 deal(`DealRedirectService.kt:85`)이 새 위치를 쓰도록 바꾸는 것까지 그 슬라이스에 넣는다. ads 코드의 배포와 섞지 않는다

### R6. `Publisher` 엔티티는 1단계에 만들지 않는다 (YAGNI · Deletion Test)

- 근거: `requirements.md:133` 「Publisher | supporting | 1989v 단일 | 2단계 확장점」. 1단계에서 퍼블리셔는 1989v 하나다(`requirements.md:53`)
- Deletion Test: 이 엔티티를 지우면 복잡도가 사라진다. 원장 계정 「퍼블리셔 미지급(1989v)」(`spec.md:81`) 하나로 충분하다
- 수정안: glossary 와 스키마에 `Publisher` 표를 두지 않는다. 퍼블리셔 몫은 원장 계정 하나로 둔다. 외부 퍼블리셔(2단계)가 올 때 만든다

### R7. 문서·컨벤션 대장에서 빠진 두 곳

- 파드 배분표: `docs/adr/ADR-0093-service-topology-regrouping.md:47` 과 `docs/standards/new-domain-checklist.md:21` 의 engagement 행에는 「recommendation · experiment」만 있다. `verifyPodTopology` 는 `scanBasePackages` 로 판정하므로(`build.gradle.kts:690-698`) 게이트는 통과한다. 하지만 사람이 읽는 분류표가 어긋난다. SR-16(`spec.md:120`)의 문서 목록에 두 행을 더한다. engagement 의 정의가 「다른 도메인을 관찰해 순위를 매기는 것」(`new-domain-checklist.md:21`)이므로, 광고 경매가 그 축에 드는 이유(ADR-0098 §1)를 그 행에 한 구로 남긴다
- 발행 방식: `new-domain-checklist.md:82` 는 발행에 common Outbox 를 쓰라고 한다. SR-14(`spec.md:111-113`)는 실패하면 경고만 남기는 fire-and-forget 이다. analytics 사본은 과금 원천이 아니므로(ADR-0098 §3) 타당한 선택이다. 다만 체크리스트 이탈이므로 SR-14 에 「Outbox 를 쓰지 않는다 — 사본이 유실돼도 과금·정산은 바뀌지 않는다」를 명시한다. game 세션 이벤트(`game/CLAUDE.md` 「발행은 트랜잭션 밖」)와 같은 판단이다

## 이 차원에서 문제없는 것 (확인만)

- 메모리 등급: `k8s/overlays/oci-arm/kustomization.yaml:167-173` 에서 engagement 는 Tier S 패치 대상이다. Tier M 은 「k3s-lite 글로벌 기본값, 별도 패치 없음」(`:169`)이다. S 패치 한 블록을 지우는 것으로 `spec.md:25` 가 성립한다. 노드 여유 확인은 OQ-002 가 갖는다
- 시크릿 반경: `ADS_TOKEN_SECRET` 이 없으면 recommendation·experiment 도 함께 멈춘다. OQ-003 과 ADR-0098 `(−)` 줄이 [[modular-monolith-fold]] 「장애 반경」의 교훈을 그대로 반영했다
- CI 경로 매핑: `images.yml:170-174` 의 폴드 배치는 `topology_pod_for_path` 가 생성물에서 판정한다. 그래서 `ads/*` 경로는 `scanBasePackages` 에 `com.kgd.ads` 가 들어가는 순간 engagement 로 매핑된다. 손으로 고칠 곳이 없다
- 흡수 대상 실재: game `ads` 16파일(domain 5 · application 7 · infrastructure 2 · presentation 1 · test 1)과 `V6__ads_house.sql`·`V8__seed_rewarded_placement.sql` 이 있다. 게이트웨이 `game-ads` 라우트가 `GatewayRouteConfig.kt:370-377` 에 있다. 스펙의 인용은 정확하다. HOUSE 시드는 `ads_db` 쪽에 **값을 옮겨 적는** 마이그레이션이어야 한다(서비스 간 DB 공유 금지). `V6__ads_house.sql:44-52` 의 크리에이티브가 어드민으로 바뀐 적이 있는지는 운영 `game_db.ad_placement` 를 조회해 확인한 뒤 옮긴다. 이것은 tasks 몫이다

VERDICT: REVISE

---

# Round 2 — 개정 2 재검토 (2026-09-23)

- 대상: `spec.md`(개정 2) · `planning/requirements.md` · `planning/test-quality.md`(개정 2) · `context/open-questions.yml` · `docs/adr/ADR-0098-ad-network.md`
- 이번에 확인한 코드: `WishlistDataSourceConfig.kt:27-90` · 루트 `build.gradle.kts:700-731,824-860` · `AuthenticationGatewayFilter.kt:33-90` · `VisitorIdFilter.kt:14-18` · `EngagementApplication.kt:13-20` · `EngagementContextLoadSpec.kt:37-111` · `engagement/app/src/main/resources/application{,-kubernetes}.yml` · `k8s/base/engagement/deployment.yaml` · `k8s/infra/local/mysql/{configmap-init,services}.yaml` · `k8s/infra/prod/percona-mysql/init-databases-job.yaml:39-49` · `common/.../KgdMessagingOutboxAutoConfiguration.kt:37-46` · `common/.../AutoConfiguration.imports:6-7` · `common/.../analytics/EntityType.kt` · `RecommendationEventConsumer.kt:48` · analytics `ProductMetrics.kt:15`·`KeywordMetrics.kt:16`·`AnalyticsStreamTopology.kt:61,127` · `ExperimentDataSourceConfig.kt:62-79`

## 1차 지적 해소 확인

| # | 판정 | 개정 2 근거 |
|---|---|---|
| R1 TM 한정자 · 값 검사 | **해소** | `spec.md:24` 「ads 의 모든 `@Transactional` 은 `adsTransactionManager` 한정자」. `test-quality.md:61` C1 이 쓰기 진입점을 불러 행이 남는지 값으로 본다. `:120` 회귀 주입 「한정자 제거 → 행 없음」. 기계 게이트 `build.gradle.kts:703-731`(호스트 스펙의 진입점 참조)·`:835`(`verifyTransactionQualifiers`)도 `spec.md:165` 에 인용됐다 |
| R2 합산 경계 · 스케줄러 | **해소** | `spec.md:98` 절대값 UPSERT(증분 없음 → 재실행·중복 실행 멱등), `test-quality.md:42,119` I5 와 회귀 주입. `spec.md:26` ads 가 `@EnableScheduling`, replicas 1 전제, 멱등 키. ADR-0098 `:32` · `requirements.md:107` 문구도 고쳤다. 사실 관계 하나는 아래 N3 에서 바로잡는다 |
| R3 `ads_db` 배선 | **대부분 해소** | `spec.md:24` prefix `ads.datasource`·ads EMF 만 `validate`, `spec.md:28-33` 인프라 변경 목록에 스키마·계정·시크릿 명시. 남은 세부는 N4 |
| R4 게이트웨이 신원 | **해소** | `spec.md:81-84` 본인 판정을 결정 시점으로 옮기고 공개 라우트에 `optionalUserConfig`. 코드 확인: 토큰이 없으면 `asAnonymous` 가 `X-User-Id` 를 지운다(`AuthenticationGatewayFilter.kt:39,87-90`). `spec.md:130` 라우트 표에 좁은 경로 우선·캐치올 제거·광고주·어드민 분리. `test-quality.md:63-64` C3·C4 |
| R5 common 슬라이스 분리 | **해소** | `spec.md:142` 별도 슬라이스 선배포, `spec.md:125` 전환 순서 1번. ADR-0098 `:104` |
| R6 `Publisher` 엔티티 | **해소** | `spec.md:104` 「퍼블리셔는 원장 계정으로만 존재」. `requirements.md:130-137` 엔티티 표에서 `Publisher` 행이 빠졌다 |
| R7 파드 배분표 · Outbox 이탈 | **해소** | `spec.md:152` 문서 목록에 ADR-0093·`new-domain-checklist.md` engagement 행. `spec.md:145` · ADR-0098 `:56-57` Outbox 이탈 명시 |

추가로 확인한 것(문제 없음):
- `EntityType.AD` 추가(`spec.md:142`)의 소비자 영향: recommendation 은 `PRODUCT` 만 받는다(`RecommendationEventConsumer.kt:48`). analytics 스트림 지표도 `PRODUCT` 로 거른다(`ProductMetrics.kt:15`, `KeywordMetrics.kt:16`, `AnalyticsStreamTopology.kt:61,127`). common 슬라이스를 먼저 배포하므로 옛 enum 으로 역직렬화하다 실패하는 소비자는 남지 않는다
- 방문자 신원: `VisitorIdFilter` 는 `GlobalFilter` 다(`VisitorIdFilter.kt:14`). 그래서 `X-Visitor-Id` 는 ads 라우트에도 실린다(`spec.md:62`)
- 비-primary 견본 `WishlistDataSourceConfig` 는 자기 prefix(`spring.datasource.wishlist.master`, `:36`)와 `ScopedFlywayMigrator`(`:65-73`)를 갖는다. `spec.md:24` 가 이것을 견본으로 삼은 것은 맞다. `ExperimentDataSourceConfig` 를 베낄 때 생기던 prefix 충돌이 사라진다

## 새 지적 (개정 2 에서 생긴 것)

### N1. 미정산 지출 차감이 멱등 키 뒤에 있는 비멱등 부작용이다 — 한 번 놓치면 영구히 남는다 (트랜잭션 경계)

- 스펙 결정: `spec.md:110` 「정산 커밋 뒤 Redis 의 광고주 미정산 지출을 그 시각 지출만큼 줄인다. 그 사이에 죽으면 값이 높게 남아 게재가 일찍 멈출 뿐」. 정산은 멱등 키 `SETTLE:{캠페인}:{시각}` 로 한 번만 반영된다(`spec.md:108`). 결정은 이 값으로 지갑 여유를 계산한다(`spec.md:65`)
- 공백: 커밋과 차감 사이에 죽으면 재실행이 멱등 키에 걸려 **건너뛴다**. 그래서 차감은 다시 돌지 않는다. 스펙은 「일찍 멈출 뿐」이라고 적었지만 이것은 한 시각의 일이 아니다. 광고주 단위 카운터는 활동 중인 광고주라면 계속 쓰인다. TTL 48시간(`spec.md:101`)이 쓰기마다 갱신되면 이 오차는 만료되지 않는다. 사고가 쌓일수록 그 광고주의 게재 한도가 **영구히** 줄어든다. 차감 명령이 타임아웃 뒤 늦게 적용되는 경우도 같은 모양이다
- 규칙: 외부 IO 는 트랜잭션 밖에 둔다(`transactional-usage.md`). 밖에 둔 부작용은 재실행 경로가 있거나 멱등해야 한다. 지금 설계는 둘 다 아니다
- 수정안(권장): 차감을 없앤다. 미정산 지출 키를 **(광고주, KST 시각)** 로 쪼갠다. 인덱스 스냅샷(`spec.md:71`, 1분 갱신)이 광고주별 「정산 완료 시각」을 함께 싣는다. 결정 스크립트는 그 시각 **이후**의 시각 키만 더한다. 그러면 정산은 MySQL 트랜잭션 하나로 끝나고 Redis 쓰기가 없다. 재실행해도 값이 바뀌지 않는다. 더할 키는 평소 1~2개다(정산 주기가 1시간). 1회 스크립트 원칙(`spec.md:69`)도 그대로 지킨다
- 대안: 차감을 유지하려면 Lua 한 번으로 `SETNX settled:{캠페인}:{시각}` 가 성공할 때만 `DECRBY` 한다. 그리고 정산 배치가 「원장에는 있고 표식은 없는」 (캠페인, 시각)을 다시 찾아 차감하게 한다. 부품이 더 많아서 권장안보다 복잡하다
- 테스트: `test-quality.md` 회귀 주입에 「정산 커밋 직후 차감 전에 예외 → 재실행 뒤 지갑 여유가 원래 값으로 돌아온다」를 더한다

### N2. 닫기·정산이 같은 분(:10)에 겹치고, 놓친 실행을 따라잡는 규칙이 없다

- 스펙 결정: `spec.md:99` 시각이 끝나고 10분 뒤 `closed` 표시. `spec.md:108` 정산은 「매시 10분(KST)에 닫힌 시각을」 처리. `spec.md:98` 5분 주기 UPSERT
- 공백
  1. **경합**: 닫기와 정산이 같은 분에 돈다. 정산이 먼저 돌면 그 시각은 아직 닫히지 않은 상태다. 정산이 「직전 시각」만 보도록 구현되면 그 시각은 **영영 정산되지 않는다**
  2. **놓친 실행**: engagement 는 replicas 1 이다(`k8s/base/engagement/deployment.yaml:12`). 롤아웃은 wave 9 로 늦게 돈다(`k8s/overlays/oci-arm/kustomization.yaml:283-290`). common 슬라이스(`spec.md:142`)는 전 JVM 을 다시 띄운다. `@Scheduled` cron 은 파드가 없던 동안의 실행을 따라잡지 않는다
  3. **닫기 전제**: 시각 H 의 마지막 UPSERT 는 H 가 끝난 **뒤**에 한 번은 성공해야 한다. 그 전에 닫으면 집계가 Redis 보다 적게 남는다. 리포트의 지출(`spec.md:115`)과 Redis 가 지킨 예산도 어긋난다. 또 카운터 키의 「KST 시각」이 이벤트 **수락** 시각인지 결정(토큰 발급) 시각인지 적혀 있지 않다. 토큰 수명이 2시간(`spec.md:76`)이라 발급 시각으로 키를 잡으면 닫힌 뒤에도 그 시각에 값이 들어온다
- 수정안(SR-10·SR-11 각 한 줄)
  - 카운터 시각 = 이벤트 **수락** 시각(KST)
  - 닫기 조건 = 「시각 종료 뒤 성공한 UPSERT 가 있었고 종료 후 10분이 지났다」. 마지막 UPSERT 성공 시각을 행이나 작업 상태에 남긴다
  - 정산 대상 = **닫혔고 정산되지 않은 (캠페인, 시각) 전부**. 「직전 시각」만 보지 않는다. 멱등 키가 있어서 이렇게 해도 안전하다. 실행 시각은 닫기와 겹치지 않게 :15 로 옮기거나, 닫기 → 정산을 한 작업 안에서 순서대로 돌린다
  - `test-quality.md` 에 「정산 한 번을 건너뛰고 다음 실행 → 두 시각이 모두 정산된다」를 더한다

### N3. 스케줄러는 이미 켜져 있다 — 문제는 스레드가 1개라는 것이다

- 사실 정정: `spec.md:26`·ADR-0098 `:32`·`requirements.md:107` 은 「engagement 에는 스케줄러가 없다」고 적었다. 1차 R2 도 같은 전제를 썼다. 실제로는 common 의 `KgdMessagingOutboxAutoConfiguration` 이 `@EnableScheduling` 을 달고 있다(`KgdMessagingOutboxAutoConfiguration.kt:45`). 이 자동 구성은 `AutoConfiguration.imports:7` 에 등록돼 있다. 조건은 JPA 가 클래스패스에 있고(`:38`) `outbox.polling.enabled` 가 미설정이면 켜짐(`:39-44`)이다. engagement 는 experiment JPA 가 있고 이 속성을 두지 않는다(`application.yml` 전체). 그러므로 스케줄링은 **이미 켜져 있다**. 다만 `@Scheduled` 작업이 없을 뿐이다
- 스펙이 ads 에서 `@EnableScheduling` 을 명시한 것은 여전히 맞다. outbox 속성 하나에 기대면 누가 그것을 끄는 순간 ads 작업 넷이 조용히 멈춘다. 문구만 「스케줄링은 common 자동 구성에 우연히 켜져 있다. ads 는 그것에 기대지 않고 직접 켠다」로 고친다
- 진짜 공백: Spring Boot 기본 스케줄러는 **스레드 1개**다(`spring.task.scheduling.pool.size` 기본 1). 레포 전체 `application*.yml` 에 이 설정이 없다(Grep 0건). ads 작업 넷이 한 스레드를 나눠 쓴다. 매시 정산은 캠페인마다 `FOR UPDATE` 트랜잭션을 돈다(`spec.md:107-108`). 일일 원장 합 검사는 전체 분개를 훑는다(`spec.md:112`). 이 둘이 도는 동안 1분 인덱스 갱신(`spec.md:71`)이 밀린다. 그러면 「정지 광고주는 1분 안에 후보에서 빠진다」(`spec.md:37`)와 기간 만료·총예산 소진 → `ENDED`(`spec.md:45`)가 늦어진다
- 수정안: SR-1 에 「engagement `spring.task.scheduling.pool.size` 를 작업 수 이상(예: 4)으로 둔다. 인덱스 갱신이 정산 뒤에 줄 서지 않는다」 한 줄. 스펙이 1분이라는 SLA 를 적었으므로 조기 최적화가 아니다

### N4. `ads_db` 배선 세부 — 비밀번호 방식·호스트 이름·테스트 DB (R3 잔여)

- 비밀번호: `spec.md:30` 「비밀번호는 기존 MySQL 시크릿에 키 추가」는 운영(oci-arm) 방식과 맞지 않는다. blog·deal 은 yml 기본값을 쓴다(`content/app/src/main/resources/application.yml:57` `${BLOG_MYSQL_PASSWORD:blog_password}`, `commerce/app/src/main/resources/application.yml:84`). 시크릿 키는 prod-k8s 쪽 방식이다(`init-databases-job.yaml:39-49`, `k8s/overlays/prod-k8s/patches/db-password-*.yaml`). 지금 engagement 는 `commerce` 계정·빈 비밀번호로 붙는다(`engagement/app/src/main/resources/application.yml:17-18`). 배포 매니페스트에 시크릿 참조도 없다(`k8s/base/engagement/deployment.yaml:31-47`). 기동 전제 셋(`spec.md:31`, OQ-003)의 판단이 이 방식에 달려 있으니 명시한다. 권장: `${ADS_MYSQL_PASSWORD:ads_password}`(blog·deal 과 같은 방식). prod-k8s 대칭을 위해 `init-databases-job.yaml` 한 줄과 패치 하나를 추가한다
- 호스트 이름: 로컬·운영 MySQL 은 도메인마다 Service 별칭을 둔다(`k8s/infra/local/mysql/services.yaml:1-6`, `:162` `mysql-experiment-master`). `application-kubernetes.yml` 의 ads URL 이 어느 이름을 쓸지 정한다. 새 별칭(`mysql-ads-master`)이면 `services.yaml` 에 한 블록을 추가한다. 이 파일은 `configmap-init.yaml` 과 함께 tasks 에 들어가야 한다
- 테스트 DB: `test-quality.md:14` 는 properties 만 적었다. `EngagementContextLoadSpec` 의 컨테이너는 `experiment_db` 하나다(`EngagementContextLoadSpec.kt:95`). `ads.datasource` 를 같은 DB 로 향하게 하면 두 `ScopedFlywayMigrator`(`ExperimentDataSourceConfig.kt:67-79` 와 ads 것)가 기본 `flyway_schema_history` 를 나눠 쓴다. 그러면 V1 이 부딪친다. 수정안: ads 는 별도 DB 를 쓴다(root 계정 + `createDatabaseIfNotExist=true` 또는 init 스크립트). `test-quality.md` C1·C2 에 한 줄을 더한다

### 기록만 (비차단)

- 이름: `requirements.md:133` 엔티티 표는 아직 `Placement` 이고 설명이 「광고 단위 = 지면 = 구좌」다. `spec.md:9` 는 `AdPlacement` 로 정했고, glossary 의 Avoid 는 「구좌」를 금한다(`spec.md:152`). glossary 를 쓸 때 이 표도 `AdPlacement` 로 맞추고 「구좌」를 뺀다

## Round 2 판정

1차 R1~R7 은 모두 해소됐다(R3 은 세부만 N4 로 남음). 새로 생긴 것은 N1~N4 다. N1 과 N2 는 돈이 조용히 틀리는 자리다(한도 영구 축소, 정산 누락). 다만 둘 다 스펙 안의 한두 줄로 고칠 수 있다. 문서·코드와 충돌하지 않으므로 사람 판단이 필요 없다. BLOCK 이 아니다. N3 은 설정 한 줄, N4 는 tasks 세부다.

VERDICT: REVISE

---

# Round 3 — 개정 3 최종 재검토 (2026-09-23)

- 대상: `spec.md`(개정 3) · `planning/test-quality.md`(개정 3) · `context/open-questions.yml` · ADR-0098
- 이번에 확인한 코드: `common/.../outbox/KgdMessagingOutboxAutoConfiguration.kt:37-73` · `common/.../redis/CommonRedisAutoConfiguration.kt:18-44` · `engagement/app/src/main/resources/application.yml:14-34,66-71` · recommendation `StringRedisTemplate` 주입부 6곳(`RedisRecommendationAdapter.kt:23` · `ItemSimilaritySync.kt:26` · `CbScoreSync.kt:25` · `RedisItemSimilarityAdapter.kt:18` · `BanditPolicy.kt:30` · `RedisThompsonSampler.kt:23`) · 레포 전체 `TaskScheduler`·`@EnableScheduling` Grep

## 2차 지적 해소 확인

| # | 판정 | 개정 3 근거 |
|---|---|---|
| N1 미정산 지출 차감 | **해소** | 권장안 그대로다. `spec.md:68` 에서 지갑 여유를 「스냅샷 잔액 − 정산 완료 시각 이후 (광고주, 시각) 지출 합」으로 계산하고, 차감하지 않는다. `spec.md:103` 은 카운터 키를 (광고주, 시각)으로 둔다. `spec.md:118` 은 광고주별 정산 완료 시각을 기록한다. 이제 정산에는 Redis 쓰기가 없다. 테스트는 `test-quality.md:37` U17 이다. 6시간 넘게 미정산인 광고주를 빼는 규칙(`spec.md:68`)은 TTL 48시간(`spec.md:109`) 안에 들어간다 |
| N2 닫기·정산 경합, 따라잡기 | **해소** (한 곳은 아래 C-1) | `spec.md:103` 에서 카운터 시각을 수락 시각(KST)으로 정했다. `spec.md:107` 은 UPSERT → 닫기 → 정산을 한 작업 안에서 순서대로 돌리고, 닫기 조건은 「종료 뒤 UPSERT 성공」이다. 정산 대상은 「닫혔고 정산 안 된 시각 전부」다. 테스트는 `test-quality.md:48` I6 이다 |
| N3 스케줄러 스레드 | **해소** | `spec.md:26` 에서 풀을 4로 뒀다. 코드도 확인했다. `KgdMessagingOutboxAutoConfiguration` 은 `TaskScheduler` 빈을 만들지 않는다(`:45-73`). 레포 전체에 `TaskScheduler` 빈 정의도 없다(Grep 0건). 그래서 Boot 기본 스케줄러가 쓰이고 `spring.task.scheduling.pool.size` 가 먹는다. 다만 `@EnableScheduling` 을 직접 켜지 않기로 한 것은 2차 권고와 다르다 → C-3 |
| N4 `ads_db` 배선 세부 | **해소** | 비밀번호는 blog 방식 `${ADS_MYSQL_PASSWORD:기본값}`(`spec.md:30`). Service 별칭은 `mysql-ads-master`(`spec.md:30`). 테스트 DB 는 `ads_db` 를 따로 두어 Flyway 이력이 부딪치지 않는다(`test-quality.md:13`). prod-k8s 쪽 한 줄이 빠진 것은 → C-4 |
| 기록(이름) | 대상 아님 | 2차에서 비차단 기록이었다. 다시 올리지 않는다 |

## 개정 3 에서 새로 생긴 것

차단할 결함은 없다. 아래 네 가지는 모두 tasks 를 만들 때 한두 줄로 반영할 수 있다. **C-1·C-2 는 돈과 기존 도메인을 조용히 깨는 자리라 tasks 에 필수로 넣는다.**

### C-1 (필수). UPSERT 대상이 「현재·직전 시각」뿐이라 파드가 한 시간 넘게 없으면 따라잡기가 성립하지 않는다

- 스펙 결정: `spec.md:107` ① 「현재·직전 시각 카운터를 … UPSERT」 ② 「그 뒤 UPSERT 가 한 번 성공한 시각을 `closed`」 ③ 「파드가 없던 동안 놓친 시각도 다음 실행이 따라잡는다」
- 모순: 파드가 H 시각 도중부터 H+2 이후까지 없었다고 하자. 복구 뒤 첫 실행은 H+2·H+1 만 UPSERT 한다. H 는 종료 뒤 UPSERT 가 한 번도 없으므로 ② 에 걸려 **영원히 닫히지 않는다**. 닫히지 않으면 정산도 되지 않는다. 그 광고주의 정산 완료 시각이 H 에 멈춘다. 6시간 뒤에는 `spec.md:68` 규칙으로 **그 광고주가 후보에서 영구히 빠진다**. 그 시각에 활동한 모든 광고주가 같은 상태가 된다. 한 시간 넘는 공백은 실제로 생길 수 있다. replicas 1(`k8s/base/engagement/deployment.yaml:12`)이고, common 슬라이스가 전 JVM 을 재기동하며(`spec.md:149`), 크래시 루프도 있다
- 테스트 공백: `test-quality.md:48` I6 은 「3시각이 **닫힌 채**」에서 시작한다. 닫히지 못한 시각은 다루지 않는다
- tasks 반영: ① 의 대상을 「`closed` 가 아닌 시각 중 카운터 TTL(48시간, `spec.md:109`) 안의 전부」로 바꾼다. I6 에 「3시각 동안 작업 0회 → 작업 1회로 세 시각 모두 UPSERT·닫기·정산」 케이스를 더한다. 회귀 주입은 「대상을 현재·직전으로 되돌리기 → 빨간불」이다

### C-2 (필수). ads 전용 Redis 연결을 빈으로 등록하면 recommendation 의 Redis 연결을 대신 차지한다

- 스펙 결정: `spec.md:33` 「같은 Redis 인스턴스, ads 만 명령 타임아웃 250ms … engagement 공용 연결은 건드리지 않는다」
- 코드: engagement 는 standalone Redis 다(`application.yml:30-34`, `cluster.nodes` 없음). 그래서 `CommonRedisAutoConfiguration` 은 꺼져 있고(`CommonRedisAutoConfiguration.kt:21`) Boot 기본 자동 구성이 연결을 만든다. Boot 기본 연결 팩토리와 `StringRedisTemplate` 은 `@ConditionalOnMissingBean` 이다. recommendation 은 한정자 없이 `StringRedisTemplate` 을 주입한다(6곳, 위 목록)
- 결과: ads 가 `LettuceConnectionFactory`(또는 `RedisConnectionFactory`)나 `StringRedisTemplate` 을 **빈으로** 등록하면 Boot 기본 빈이 물러난다. 그러면 recommendation 동기화의 `RENAME`·`delete` 가 ads 의 250ms 타임아웃 연결로 돈다. 기동 실패도 없고 컴파일 오류도 없다. 스펙 문장은 지켜진 것처럼 보이지만 실제로는 지켜지지 않는다
- tasks 반영: 방법은 둘 중 하나다. ⓐ ads 연결 팩토리와 템플릿은 ads 설정 클래스 안에서만 만들고 **빈으로 노출하지 않는다**(라이프사이클은 그 클래스가 닫는다). ⓑ 빈으로 두려면 공용 팩토리·템플릿을 `@Primary` 로 명시 선언한다. 검증은 C1(`EngagementContextLoadSpec`)에 한 줄을 더한다. recommendation 이 받는 `StringRedisTemplate` 의 연결 팩토리 명령 타임아웃이 250ms 가 **아닌지** 값으로 본다. 회귀 주입은 「ads 팩토리를 `@Bean` 으로 노출 → 빨간불」이다

### C-3. 스케줄링이 outbox 속성 하나에 기대고 있다

- `spec.md:26` 은 「ads 는 `@EnableScheduling` 을 더하지 않는다」로 정했다. 지금 스케줄링은 `KgdMessagingOutboxAutoConfiguration.kt:39-45` 가 켠다. 이 설정은 `outbox.polling.enabled` 가 미설정일 때만 켜진다. 누가 engagement 에서 outbox 폴링을 끄면 ads 작업 넷(집계·정산·인덱스·원장 검사)이 로그 없이 멈춘다. `@EnableScheduling` 은 여러 번 붙여도 해가 없다. 다른 폴드 도메인도 자기 설정에 직접 단다(`gifticon/.../SchedulerConfig.kt:7`, `chatbot/.../ChatbotConfig.kt:12`)
- tasks 반영: ads 설정 클래스에 `@EnableScheduling` 을 단다. 붙이지 않을 거라면 C1 에서 「`outbox.polling.enabled=false` 여도 ads 작업이 스케줄에 등록된다」를 확인한다

### C-4. prod-k8s 쪽 `ads_db` 줄이 빠졌다

- `spec.md:30` 인프라 목록에는 로컬 `configmap-init.yaml`, 운영 수동 SQL, `services.yaml` 만 있다. prod-k8s 모드(`k8s/infra/prod/percona-mysql/init-databases-job.yaml:39-49` 와 `k8s/overlays/prod-k8s/patches/db-password-*.yaml`)는 목록에 없다. 이 모드를 쓰지 않는 동안은 영향이 없다. 모드 대칭을 지키려면 tasks 에 두 줄을 넣거나, 「prod-k8s 는 이번 범위 밖」이라고 SR-2 에 한 구를 적는다

## Round 3 판정

2차 N1~N4 는 모두 해소됐다. 개정 3 에서 새로 생긴 자리는 넷이다. C-1 은 스펙 문장 안에서 서로 어긋나는 곳이다. C-2 는 스펙 문장을 코드가 조용히 뒤집을 수 있는 곳이다. 둘 다 결과는 무겁지만, 고치는 데는 대상 범위 한 줄과 빈 노출 규칙 한 줄이면 된다. 문서·코드와 충돌하지 않아 사람 판단도 필요 없다. 그래서 tasks 생성 때 **필수 반영 항목**으로 넘기고 SHIP 한다. C-3·C-4 는 선택 반영이다.

VERDICT: SHIP
