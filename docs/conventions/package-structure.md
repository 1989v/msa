# Package Structure Convention

> 표준의 근거와 변종 정리 계획: `docs/adr/ADR-0083-layer-structure-standard-and-gate.md`.
> 신규 도메인을 올릴 때는 `docs/standards/new-domain-checklist.md` 를 위에서 아래로 훑는다.
> 코드 견본은 `inventory/feature`.

## Base Package

`com.kgd.{service}` — 폴드된 도메인도 호스트 하위가 아니라 자기 이름이다 (`com.kgd.deal`, `com.kgd.codedictionary.deal` 아님).

## Nested Submodule Layout

각 서비스는 `{service}:domain` + `{service}:app`(상주 JVM) **또는** `{service}:feature`(비-bootable
라이브러리, 호스트 앱에 폴드 — ADR-0058) 로 나뉜다. `app` 과 `feature` 의 내부 레이아웃은 같다.

```
{service}/
├── domain/                              ← :{service}:domain (순수 Kotlin, 의존은 :common 뿐)
│   └── src/main/kotlin/com/kgd/{service}/
│       └── domain/
│           └── {entity}/
│               ├── model/        # Aggregate, Entity, Value Object
│               ├── policy/       # Domain Policy, Specification
│               ├── event/        # Domain Event
│               └── exception/    # Domain Exception
└── app/  또는  feature/                 ← :{service}:app (Spring Boot) / :{service}:feature (라이브러리)
    └── src/main/kotlin/com/kgd/{service}/
        ├── application/
        │   └── {entity}/
        │       ├── usecase/      # UseCase interface (Inbound Port) + 내부 Command/Query/Result
        │       ├── service/      # UseCase 구현체 (@Service) — Port 만 주입
        │       ├── port/         # Outbound Port interface
        │       └── dto/          # (선택) 여러 UseCase 가 공유하는 Query/Result
        ├── infrastructure/
        │   ├── persistence/
        │   │   └── {entity}/
        │   │       ├── entity/   # JPA Entity
        │   │       ├── repository/ # Spring Data Repository + QueryDSL
        │   │       └── adapter/  # Port 구현체
        │   ├── client/           # WebClient 기반 외부 API Adapter
        │   ├── messaging/        # Kafka Producer/Consumer Adapter
        │   └── config/           # 기술 설정 (DataSource, Kafka, Redis …)
        └── presentation/
            └── {entity}/
                ├── controller/   # RestController — UseCase interface 만 주입
                └── dto/          # Request DTO, Response DTO
```

## Rules

1. **domain 모듈**: Spring/JPA 어노테이션 사용 금지 (의존성 자체가 없으므로 컴파일 에러). 의존성을
   추가해서 뚫지 않는다 — 유일한 예외는 아래 `search:domain`.
2. **도메인 간 cross-reference 금지**: Order → Product 직접 참조 금지, API 호출/Kafka 만 허용.
3. **app/feature 모듈**: `implementation(project(":{service}:domain"))` 으로 domain 의존.
4. **bootJar 이름**: `tasks.bootJar { archiveBaseName.set("{service}") }` (app). feature 는 bootJar disabled.
5. **디렉토리 == package 선언.** 레이어를 디렉토리에서 생략하지 않는다. 파일 경로에서 유도한 패키지와
   `package` 줄이 다르면 틀린 것이다.
6. **Outbound Port 는 `application/{entity}/port`.** domain 모듈에 두지 않는다. 포트 시그니처에
   JPA 엔티티·프레임워크 타입을 쓰지 않는다.
7. **UseCase 는 인터페이스다.** 단일 구현이라도 `@Service` 클래스로 대체하지 않는다. 컨트롤러는
   UseCase 인터페이스만 주입한다 — 게이트 규칙 ④가 `presentation → application.{entity}.service` import 를 막는다.
   **DTO 를 `service` 패키지에 두지 않는다**: 구현을 부르는 것과 타입을 쓰는 것은 다르지만 위치가 같으면
   규칙이 구분하지 못한다. `dto` 로 옮긴다.

   > **주의 — 인터페이스를 붙이면 프록시 방식이 바뀔 수 있다.** `@Cacheable`/`@Transactional` 이 걸린 클래스에
   > 인터페이스가 생기면 그 빈이 JDK 프록시가 되어 **구상 타입으로 주입하던 곳이 `BeanNotOfRequiredTypeException`
   > 으로 죽는다.** 앱 자체는 안전하다 — `@SpringBootApplication` 이 켜는 `AopAutoConfiguration` 이
   > `spring.aop.proxy-target-class` 기본값(true)으로 CGLIB 을 강제하기 때문이다. 위험한 곳은 **auto-config 가
   > 안 도는 최소 테스트 컨텍스트**다(맨 `@EnableCaching` = JDK 프록시). 2026-08-26 code-dictionary 에서
   > 실제로 여기서만 깨졌다 — 그런 컨텍스트에는 `@EnableCaching(proxyTargetClass = true)` 로 프로덕션과 맞춰
   > 두어야 프로덕션에는 없는 실패가 나지 않는다. 그와 별개로 주입은 컨트롤러·서비스·테스트 모두 인터페이스로 옮긴다.

8. **application 은 infrastructure 를 import 하지 않는다.** `JpaRepository`·`JpaEntity`·metrics·
   properties 를 서비스에 직접 주입하는 것이 가장 흔한 위반이다. **`presentation` 도 같은 규칙**이고,
   application 패키지 안의 `org.springframework.data.jpa.`·`jakarta.persistence.` import 도 포함한다
   (`interface XRepo : JpaRepository<…>` 를 application 에 두면 infrastructure 문자열 없이 통과하므로).
   루트 `verifyLayerDependencies` 게이트가 빌드에서 잡는다.
9. **폴드는 레이어 면제 사유가 아니다.** `:feature` 도 위 규칙 전부를 따른다. ADR-0058 은 모듈
   **간** 규칙(feature 끼리 빈 주입 금지·Kafka 유지·datasource 분리)이고 이 문서는 모듈 **안** 규칙이다.
10. 한 컨텍스트의 포트가 여럿이면 `{Context}Ports.kt` 한 파일에 묶어도 된다 (game 이 그렇게 한다).
    파일 이름이 아니라 **패키지 위치**가 규칙이다.
11. **`@ConfigurationProperties` 는 그것을 읽는 레이어가 소유한다.** application 서비스가 읽으면
    `application/{entity}/config/{X}Properties.kt`, 인프라 어댑터만 읽으면 `infrastructure/config`.
    인프라에 두고 application 이 import 하면 규칙 8 위반이다 (chatbot·quant 가 그랬다).

## Infrastructure-only Modules (Single-level)

- `common`: 공통 라이브러리 (jar only, no bootJar). Outbox·멱등 헬퍼·`ApiResponse` 의 정본.
- `gateway`: Spring Cloud Gateway (WebFlux — 다른 서비스와 혼재 금지).
- `agent-viewer:api`: 개발 도구. 플랫폼 서비스가 아니라 레이어 규칙 대상이 아니다.
- `game:sim` · `game:web`: KMP 모듈. JVM 레이어 규칙 대상이 아니다.

## search:domain Port Exception

search:domain 모듈은 `product/port/` 패키지에 Outbound Port 를 포함한다. `Page`/`Pageable` 을 포트
시그니처에 쓰기 위해 `spring-data-commons` 에 의존하며, 이것이 domain 모듈이 Spring 계열 의존성을
갖는 **유일한** 문서화된 예외다. 새 예외를 만들지 않는다.

## Search Service Exception

search 는 3개의 app-level 서브모듈을 가진다:

| Gradle path | Role | 배포 |
|---|---|---|
| `:search:app` | REST API (읽기 전용) | Deployment |
| `:search:consumer` | Kafka 증분 색인 | Deployment (Worker tier, ADR-0058) |
| `:search:batch` | Spring Batch 전체 색인 | CronJob (상주 Deployment 제거, ADR-0058) |
