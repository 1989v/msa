# ADR-0083 — 레이어 구조 표준 확정과 빌드 게이트: 변종 넷을 하나로

- 상태: 채택 (2026-08-26)
- 관련: ADR-0014(코드 컨벤션 — `docs/conventions/code-convention.md` 로 이전), ADR-0058(모듈러 모놀리스 —
  모듈 **간** 경계), ADR-0059/0069/0072/0081(폴드된 신규 도메인), ADR-0026(docs 분류),
  ADR-0082(빌드 게이트 선례)

## 맥락

아키텍처 원칙(의존성 안쪽 방향·domain 순수성·`ApiResponse`·Kotest)은 51개 모듈이 전부 지킨다.
갈라진 것은 **application 레이어의 모양**과 **디렉토리 위치** 두 축이고, 2026-08-26 실측으로
네 가지 변종이 확인됐다.

| 변종 | 모양 | 모듈 | 증거 |
|---|---|---|---|
| **A 표준형** | UseCase 인터페이스 + `Command/Result` · Port 는 `application/{entity}/port` · Adapter 는 `infrastructure` | inventory · fulfillment · warehouse · member · wishlist · gifticon · place · chatbot (+ product · order · search · auth 도 모양은 같음) | `inventory/feature` UseCase 8 / Port 4 / Adapter 5 |
| **B UseCase 클래스형** | UseCase 가 인터페이스가 아니라 `@Service` 클래스 · Port 가 `domain` 모듈에 | analytics · experiment · recommendation · quant(포트는 application, UseCase 만 클래스) | analytics/domain `domain/port` 4, recommendation/domain `com.kgd.recommendation.port` 5, quant UseCase 클래스 14 |
| **C 포트 생략형** | `@Service` 가 `JpaRepository`/`JpaEntity` 를 직접 주입 — Port/Adapter 없음 | blog · ranking · deal(포트 디렉토리는 있으나 미사용) | application → infrastructure import: blog 41 · ranking 20 · deal 12 |
| **D 레거시 디렉토리** | package 선언은 전체 레이어 경로인데 디렉토리는 레이어를 생략 | product/app 31 · auth/app 29 · order/feature 26 · search/app 21 · domain 3개 13 = **120 파일** | `order/feature/.../order/order/controller/` 와 `.../order/presentation/order/controller/` 가 같은 패키지를 나눠 가짐 |

변종이 생긴 원인은 코드가 아니라 **하네스의 구멍 셋**이다.

1. **문서가 죽은 규칙을 살려 뒀다.** `package-structure.md` 의 "Filesystem vs Package Declaration
   Note" 가 디렉토리에서 레이어를 생략하라고 명시한다. 이후 만든 서비스 전부가 이를 무시하고
   전체 경로를 썼으니 문서가 코드와 정반대이고, 변종 D 는 드리프트가 아니라 **문서화된 컨벤션의
   잔재**다.
2. **Outbound Port 위치가 열려 있었다.** `00.clean-architecture.md` §4.2 가 "Domain 또는
   Application (팀 컨벤션에 따라 통일)" 이라 적어 두고 통일하지 않았다. 변종 B 는 그 틈이다.
3. **강제 장치가 없다.** ArchUnit/Konsist 0건. 빌드 게이트는 Flyway 배선(`verifyFlywayWiring`)과
   외부 API 쿼터(`verifyExternalApiQuota`) 둘뿐이고 레이어 의존은 아무도 보지 않는다. `hns:validate`
   도 base package 만 검사한다. 그래서 가장 최근에 만든 세 도메인(blog·deal·ranking)이 가장
   느슨한 변종 C 다 — **게이트가 없으면 신규 도메인은 항상 가장 쉬운 쪽으로 간다.**

## 결정

### 1) Application 레이어 표준 = 변종 A. UseCase 인터페이스와 Outbound Port 는 **둘 다 필수**

```
presentation/{entity}/controller  →  application/{entity}/usecase   (interface + Command/Result)
                                        ↑ implements
                                     application/{entity}/service   (@Service)
                                        ↓ depends on
                                     application/{entity}/port      (interface)
                                        ↑ implements
                                     infrastructure/persistence/{entity}/adapter
```

단일 구현이라도 UseCase 인터페이스를 생략하지 않는다. 이유는 셋이다 — 컨트롤러가 인바운드
포트에만 의존해야 서비스 교체·테스트 더블이 컨트롤러를 건드리지 않고, 전 도메인이 **같은
모양**이어야 신규 도메인이 복사할 견본이 하나가 되며, "이 서비스는 작으니까" 가 변종 C 의
출발점이었다. 견본은 `inventory/feature` 다.

### 2) Outbound Port 위치 = `application/{entity}/port`. `domain` 모듈에 두지 않는다

`00.clean-architecture.md` §4.2 의 "또는" 을 지운다. 유일한 예외는 `search:domain` 이다 —
`Page`/`Pageable` 을 포트 시그니처에 쓰려고 `spring-data-commons` 에 의존하는 것이 문서화돼
있고, 이 ADR 은 그 예외를 그대로 둔다. 포트 시그니처에 JPA 엔티티·프레임워크 타입을 노출하지
않는다 (quant `PaperAccountRepositoryPort` 가 `PaperAccountEntity` 를 import 하는 형태 금지).

### 3) 디렉토리 == 패키지

`package-structure.md` 의 생략 노트를 폐기한다. 변종 D 의 120 파일은 package 선언을 바꾸지
않고 `git mv` 만 한다 — 컴파일 산출물이 같으므로 동작 변화가 0 이다. 이행 전까지 그 모듈에
새 파일을 만들 때는 **전체 레이어 경로 디렉토리**에 만든다 (이웃 파일 위치가 아니라 package
선언을 따른다).

### 4) 폴드는 배포 형태이지 레이어 면제 사유가 아니다

ADR-0058 은 모듈 **간** 경계(feature 끼리 빈 주입 금지·Kafka 유지·datasource 분리)를 정하고,
이 ADR 은 모듈 **안** 레이어를 정한다. 둘은 겹치지 않는다. `:feature` 라이브러리도 `:app` 과
같은 규칙을 따른다.

### 5) 빌드 게이트 `verifyLayerDependencies` — 텍스트 스캔, `check` + CI + pre-push

`verifyFlywayWiring` 과 같은 패턴이다. 의존성을 추가하지 않고 소스를 읽어 세 규칙을 본다.

| 규칙 | 신호 | 왜 이 신호인가 |
|---|---|---|
| ① application → infrastructure 금지 | `package …application…` 파일의 `import com.kgd.*.infrastructure.` | 변종 C 의 정의 그 자체. 오탐 없음 |
| ② domain 모듈 프레임워크 금지 | `*/domain/src/main` 의 `import org.springframework.` / `jakarta.persistence.` | 빌드 의존성이 없어 이미 컴파일 에러지만, `search:domain` 처럼 의존성을 추가한 순간 뚫린다 |
| ③ 디렉토리 == 패키지 | 파일 경로에서 유도한 패키지 ≠ `package` 선언 | 변종 D 재발 방지 |
| ④ presentation → application.service 금지 | `package …presentation…` 파일의 `import com.kgd.*.application.{entity}.service.X` | 규칙 7("컨트롤러는 UseCase 인터페이스만 주입")의 강제 장치. 이게 없으면 UseCase 를 아예 안 만들어도 게이트를 통과한다 |

규칙 ①은 `presentation` 도 본다 — 컨트롤러가 `JpaRepository`/어댑터를 직접 부르면 application 을 통째로
건너뛴 것이라 변종 C 보다 나쁘다. 그리고 ①의 import 목록에는 `org.springframework.data.jpa.` ·
`jakarta.persistence.` 도 들어간다: application 패키지 안에 `interface XRepo : JpaRepository<…>` 를 정의하면
`com.kgd.*.infrastructure.` 가 한 번도 안 나와 통과하기 때문이다 (변종 C 를 되살리는 가장 자연스러운 경로).

규칙 ④의 신호는 **마지막 패키지 세그먼트가 `service`** 인 import 다. code-dictionary 에는 `service` 라는
*엔티티* 가 있어 `application.service.dto.ServiceResultDto` 가 존재하는데, 이걸 레이어로 오인하면 오탐이 된다.
뒤에 대문자(타입명)를 요구해 가른다. DTO 가 `service` 패키지에 살면 규칙이 구현 호출과 구별할 수 없으므로
`dto` 로 옮긴다 — 2026-08-26 에 5개(`GameSort`·`AdPlacementDto`·`RewardDto`·`PortfolioSort`·`SnippetUnlockDto`·`ResumeOverview`)를 옮겼다.

현재 위반은 **모듈 단위 allowlist** 로 통과시키되 항목마다 "왜 · 언제 비우는지" 를 적는다
(ADR-0082 `quotaGateExempt` 와 같은 규율 — 이유 없는 예외가 쌓이면 검사가 죽는다). 이행
단계마다 allowlist 를 비우고, 비운 항목은 다시 넣지 못한다.

**`check` 에만 붙이면 아무 데서도 안 돈다** (2026-08-26 확인). `check` 는 `test` 를 포함하지만 그 역은
아니고, ci.yml·images.yml 은 둘 다 `:module:test` 만 부른다. 그래서 세 지점에서 태스크를 **직접** 부른다 —
텍스트 스캔이라 컴파일 없이 ~7초다.

| 지점 | 언제 | 막는 것 |
|---|---|---|
| `.githooks/pre-push` | Kotlin 이 섞인 push (로컬) | main 이 배포 브랜치라 **위반이 원격에 닿기 전 마지막 지점** |
| `ci.yml` compile-gate | 모든 PR·main push, 변경 범위 무관 | 신호. 컴파일보다 **먼저** 돌려 빨리 실패시킨다 |
| `images.yml` | 이미지 굽기 직전 | 위반이 운영으로 나가는 것 |

`check` 연결은 그대로 둔다 — `./gradlew build` 를 돌리는 사람에게는 그쪽이 자연스럽다.

### 6) 게이트 밖 모듈 — 명시적 예외

| 모듈 | 이유 |
|---|---|
| `gateway` · `common` | 인프라 단일 모듈. 레이어가 없다 (문서화됨) |
| `agent-viewer/api` | 플랫폼 서비스가 아니라 개발 도구. `ApiResponse` 도 안 쓴다 — 서비스 표에서도 도구로 분류 |
| `game:sim` · `game:web` | KMP 모듈. JVM 레이어 규칙 대상이 아니다 |
| `search:domain` | 규칙 ② 예외 — `spring-data-commons` 만 허용 |

**게이트는 통과하지만 견본과 모양이 다른 두 곳** (2026-08-26 실측, 위반 아님 — 문서화로 닫는다):

| 모듈 | 모양 | 왜 그대로 두나 |
|---|---|---|
| `quant:app` | `application/{port,usecase,service,view}` 플랫 구조와 `application/paper/{port,usecase}` 엔티티 구조가 공존 (플랫 port 43 · usecase 20) | 도메인이 전략·백테스트·페이퍼·실매매로 갈리는데 엔티티 축이 하나로 안 잡힌다. 재배치 비용이 크고 얻는 것이 이름뿐이다. quant 는 자기 레이아웃을 `quant/CLAUDE.md` 에 적어 둔다 |
| `search:app` · `search:batch` | `com.kgd.search.{bandit,config,search}` · `com.kgd.search.job` 이 세 레이어 **밖** 최상위에 있다 | 규칙 ③(디렉토리==패키지)은 만족한다. 다만 레이어 밖이라 **규칙 ①·④의 시야에도 없다** — `bandit` 패키지가 커지면 검사되지 않는 면이 함께 커진다. 다음에 이 패키지를 손댈 때 `application`/`infrastructure` 로 접는다 |

### 7) 기존 위반 정리 순서

`docs/plans/2026-08-26-layer-structure-alignment.md` 가 단계·파일·검증을 든다. 순서는
**게이트 → 변종 C → 변종 D → 변종 B → DRY → 테스트 소스셋**이다. 게이트가 먼저인 이유는 정리하는
동안에도 새 도메인이 생기기 때문이고, 변종 C 가 D 보다 먼저인 이유는 C 가 가장 최근·가장 활발한
모듈이라 지금 안 고치면 더 커지기 때문이다.

## 대안

- **Port 필수 · UseCase 인터페이스 선택 (A+B 흡수)** — 작업량이 가장 적다. 기각: 두 모양이 공존하면
  견본이 둘이 되고, 신규 도메인은 늘 생략 쪽을 고른다. "경계 포트만 필수" 는 YAGNI 로 읽히지만
  UseCase 도 인바운드 **경계 포트**다.
- **변종 C 를 "폴드된 CRUD 전용 feature 예외" 로 인정** — 기각: `00.clean-architecture.md` §9
  "Application → Infrastructure 직접 참조 0건" 을 폐기해야 하고, 모든 신규 도메인이 자기를 CRUD
  전용이라 주장하게 된다.
- **Konsist 아키텍처 테스트** — 정밀하지만 새 의존성과 별도 테스트 모듈이 필요하다. 텍스트 스캔이
  오탐을 내기 시작하면 그때 교체한다.
- **현상 유지 + 리뷰 의존** — 기각: 리뷰는 사람이 빠뜨린다. 변종 C 세 모듈이 전부 리뷰를 통과했다.

## 결과

- (+) 신규 도메인의 견본이 하나(`inventory/feature`)가 되고 체크리스트
  (`docs/standards/new-domain-checklist.md`)가 그 견본을 가리킨다.
- (+) 게이트가 회귀를 빌드에서 막는다. 문서와 코드가 어긋나도 빌드는 어긋나지 않는다.
- (−) 변종 D `git mv` 120 파일 — `git blame` 은 `--follow` 로 본다. `auth/app` 은 private 서브모듈이라
  서브모듈 먼저 푸시.
- (−) 변종 B 의 UseCase 클래스 ~25개에 인터페이스 추출, 변종 C 세 모듈에 Port/Adapter 약 20 파일
  신설. 동작 변화는 없고 테스트는 포트 MockK 로 바뀐다.
- (−) 변종 C 에서 `JpaEntity` 를 응답 DTO 로 직접 쓰던 자리는 도메인 모델을 거치게 되어 매핑 코드가
  늘어난다 — 이것이 표준의 비용이고, 이 비용을 아끼려던 것이 변종 C 였다.
