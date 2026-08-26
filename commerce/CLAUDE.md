# Commerce App — 폴드 호스트

자기 도메인이 없는 **부트스트랩 전용 앱**이다 (ADR-0058). order · inventory · fulfillment · warehouse · member ·
wishlist 여섯 `:feature` 라이브러리를 한 JVM(port 8085)으로 띄운다. 코드는 `CommerceApplication.kt` 한 파일과
`application.yml` 뿐이다.

## Modules

| Gradle path | 역할 |
|---|---|
| `:commerce:app` | `@SpringBootApplication(scanBasePackages = [...6 도메인 + common.exception/response])` + bootJar `commerce` |

## Commands

```bash
./gradlew :commerce:app:build      # 6 feature 포함 빌드
./gradlew :commerce:app:test       # CommerceContextLoadSpec + CommerceDualDataSourceIntegrationSpec (Testcontainers MySQL)
```

## 구조 상태 (ADR-0083)

레이어 규칙 **비대상** — 부트스트랩 1파일뿐이고 도메인이 없다. 폴드된 여섯 도메인의 상태는 각자의 `CLAUDE.md` 에 있다
(inventory 가 견본, order 만 디렉토리 레거시 P3).

## 도메인을 폴드할 때 고치는 곳

code-dictionary 와 다르다 — 여기서는 **각 feature 가 자기 `{Svc}DataSourceConfig` 로 EMF/TM/Flyway 를 갖는다.**
그래서 호스트에서 고칠 곳은 둘이다.

| 파일 | 무엇 | 빠뜨리면 |
|---|---|---|
| `CommerceApplication.kt` | `scanBasePackages` 에 `com.kgd.{svc}` | **조용한 404** — 기동은 되고 그 도메인만 매핑이 없다 |
| `application.yml` | `spring.datasource.{svc}` 블록 (master/replica) + `{svc}.flyway.enabled` | 기동 실패 (datasource 빈 없음) |

그리고 `CommerceContextLoadSpec` 에 "그 도메인 컨트롤러가 빈으로 등록된다" 한 줄 — 첫 줄 누락을 잡는 유일한 자동 장치.

## Key Rules (ADR-0058 불변식)

- feature 끼리 **직접 빈 주입 금지** — `build.gradle.kts` 에서 feature 가 다른 feature 를 의존하지 않는다 (교차 import 는 컴파일 에러)
- 같은 JVM 이라도 BC 간 통신은 **Kafka** — order→inventory→fulfillment 사가 코드는 폴드 전과 동일
- datasource · EMF · TM · outbox · `ProcessedEvent` 는 **도메인별**. `@Transactional` 은 자기 TM 한정자 필수
  (`inventoryTransactionManager` 등 6개). 한정자 없는 `@Transactional` 은 `@Primary` 로 잘못 붙는다
- 멱등 핸들러도 도메인별 — 각 `{Svc}MessagingConfig` 가 자기 `IdempotentEventHandler` 빈을 등록한다
- 재분리는 ADR-0058 "재분리 체크리스트" 4단계 — feature·DB·토픽 무변경

## 운영

- k8s `k8s/base/commerce` — 이미지 태그 하나가 6 도메인을 함께 올린다. 한 도메인의 테스트 실패가 여섯 도메인 배포를 막는다
- 헬스: 6 datasource 중 하나라도 replica 서비스가 없으면 DOWN 이 난다 (2026-08-06 member/wishlist replica 부재 사례)

## Docs

- ADR: `docs/adr/ADR-0058-service-consolidation.md` · 폴드 도메인 각각의 `CLAUDE.md`
- 신규 도메인 폴드 절차: `docs/standards/new-domain-checklist.md` §3
