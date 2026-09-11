# ADR-0093 — 서비스 토폴로지 재편 (성격 기준 재그룹핑)

- Status: Accepted
- Date: 2026-09-10
- Supersedes: ADR-0058 §2(도메인 병합)·§"분리 유지" 목록 / Relates: ADR-0019(K8s), ADR-0025(Latency Budget),
  ADR-0059(game 폴드), ADR-0064(resume), ADR-0069(deal), ADR-0072(blog), ADR-0081(ranking), ADR-0083(레이어 표준)

## Context

ADR-0058 이 과분할을 해소한 뒤 석 달 동안 도메인이 다섯 늘었고(game·blog·ranking·deal·place),
그 배치가 **ADR-0058 의 분류표를 거치지 않고 결정됐다.** 지금 토폴로지는 설계가 아니라 누적이다.

측정으로 확인한 어긋남:

| ADR-0058 이 정한 것 | 현재 | |
|---|---|---|
| `identity` = auth + member | auth 단독, member 는 commerce 로 | 반쪽 |
| `engagement` = recommendation + experiment | 각각 별도 파드 | 미실행 |
| `code-dictionary` = **분리 유지**("도메인 단절 사이드앱") | **game·blog·ranking·deal 의 폴드 호스트** | 정반대 |
| `product` = 분리 유지("카탈로그 SSOT") | 그대로 | 근거 다섯 글자. 사가 참여자 중 혼자 밖에 있다 |
| (place 는 표에 없음) | 단독 파드 | ADR-0058 에 `place` 등장 0회 — 평가된 적 없음 |

결과로 **한 파드가 5도메인 26,428줄**을 안고 있다.

```
code-dictionary 파드 = code-dictionary 7,507 + game 10,718 + blog 4,629
                      + ranking 1,653 + deal 1,921 = 26,428줄
```

2026-09-10 에 이 구조의 대가가 실제로 나타났다. `GAME_HMAC_SECRET` 이 없어 이 파드가 새 이미지로
못 뜨자 **game·blog·ranking·deal 넷이 함께 옛 코드에 묶였다.** 이름은 game 것인 시크릿 하나가
관계없는 세 도메인을 멈춰 세운다.

현재 상주 백엔드 Deployment 는 **15개**이고 전부 `replicas: 1` · 컨테이너 1개(`app`)다.
사이드카는 없다. 도메인 모듈은 22개다 — 둘이 안 맞는 이유가 폴드다.

## Decision

### 1) 성격 축으로 다시 그룹핑한다 (15 → 12)

| 파드 | 도메인 | 줄수 | 성격 |
|---|---|---|---|
| `commerce` | order · inventory · fulfillment · warehouse · product · deal | 8,129 | 커머스 트랜잭션·사가 |
| `content` | game · place · blog · ranking | 22,346 | 노출 서브도메인 (game·place·blog·rank) |
| `atlas` | 개념 사전 · 서비스 카탈로그 · 포트폴리오 · 전시 · **이력서** | — | apex 사이트 총람 |
| `account` | member · wishlist | — | **회원(타인)**에 관한 데이터 |
| `engagement` | recommendation · experiment | — | 실험·추천 (ADR-0058 계획 실행) |
| `sideapp` | quant · chatbot · gifticon | — | 도메인 단절 사이드앱 |
| 단독 6 | gateway · auth · search · search-consumer · analytics · recommendation-ann | — | 아래 근거 |

### 2) 단독 유지의 근거를 명시한다

ADR-0058 의 "분리 유지" 목록이 근거를 한 단어로만 적어 다음 결정에서 인용되지 못했다. 이번에는 적는다.

| 파드 | 왜 못 합치나 |
|---|---|
| `gateway` | WebFlux 리액티브. 서블릿/JPA 와 한 JVM 금지. 전 트래픽 입구라 장애 반경도 최대 |
| `auth` | `secretKeyRef` 4개로 전 서비스 최다. `AUTH_SUBJECT_HASH_KEY` 분실 시 전 회원 로그인 불가(해시 재생성 불가). 별도 private 서브모듈(`1989v/msa-auth`) |
| `search` | OpenSearch 전용 + P99 SLA Tier 1 (ADR-0025) |
| `search-consumer` | Worker 티어. 벌크 색인이 쿼리 P99 를 위협해서 뗀 것 — 합치면 뗀 이유가 사라진다 |
| `analytics` | Worker 티어. Kafka Streams 상주라 GC 가 튄다 |
| `recommendation-ann` | PVC + 모델 적재. 메모리 성격이 JVM 서비스와 다르다 |

**`product` 의 분리 근거는 폐기한다.** "카탈로그 SSOT" 는 분리 이유가 되지 못한다 — 그 SSOT 를
소비하는 order·inventory 가 이미 `commerce` 안에 있어, 사가 참여자 중 하나만 밖에 있는 상태였다.

**`warehouse` 는 `commerce` 에 남긴다.** inventory 의 참조 마스터이고, 프로덕션 코드에
`import com.kgd.warehouse` 가 0건이라(FK-as-ID) 옮길 수는 있으나 옮길 이유가 없다.

### 3) 이름

`atlas` 는 개념 사전이 트리맵·그래프로 그려지는 **총람**이라는 뜻이다. 후보 중 `common`(최상위
Gradle 모듈과 충돌) · `curation`(deal·game 을 가리키는 기존 용어) · `display`(그 파드 안 하위
도메인 이름, 12%) 는 전부 기존 어휘를 밟아 기각했다. `atlas` 는 게임 아트 파이프라인의
텍스처 아틀라스와 철자가 같지만 어휘 영역이 달라 혼동 위험이 낮다고 판단했다.

`code-dictionary` 는 자기 도메인을 `:code-dictionary:feature` 로 내리고 `atlas:app` 은
**자기 도메인 없는 aggregator** 가 된다 — `commerce` 와 같은 모양이다.

### 4) 게이트웨이 라우팅이 이번 개정의 가장 큰 위험이다

지금은 상수 하나(`CODE_DICTIONARY_URI`)로 30개 라우트가 간다. 재편 후 목적지가 넷으로 갈리고,
**경로 접두사와 파드가 1:1 이 아니다.**

```
/api/v1/games/**       → content      /api/v1/concepts/**   → atlas
/api/v1/blog/**        → content      /api/v1/portfolio/**  → atlas
/api/v1/boards/**      → content      /api/v1/wishlist/**   → account
/api/v1/deals/**       → commerce     /api/v1/resume/**     → account
```

2026-09-10 에 친구 그룹 API(`/api/v1/games/party/rosters`)가 전용 라우트 없이 공개 캐치올로
떨어져 **`X-User-Id` 헤더 한 줄로 아무 회원의 명부가 열렸다**(ADR-0092 G). 목적지가 넷으로
갈리면 같은 함정도 넷이 된다.

그래서 **경계는 문서가 아니라 검사가 고정한다** — `GatewayRoutingSpec` 에 그룹마다
무인증 호출과 위조 신원 헤더 호출의 기대 상태를 박고, 라우트를 옮기기 **전에** 그 검사가
실제로 빨간불인 것을 확인한다.

### 5) 단계 — 각 단계가 독립적으로 롤백된다

| 단계 | 내용 | 테이블 이전 | 상태 |
|---|---|---|---|
| **①** | product·place 를 `:app` → `:feature` 폴드 · `engagement` · `sideapp` · `account`(member·wishlist) | **0** | engagement·account·product·sideapp 완료(2026-09-11), place 남음 |
| **②** | `deal` → commerce · `ranking` → content | 3 + 5 | 완료(2026-09-11) |
| **③** | `blog` → content | 7 | 진행 중(2026-09-11) |
| **④** | ~~`resume` → account~~ **기각** (2026-09-11, 아래 §7) | 0 | 기각 |

총 **26테이블**. `blog_post_view`(하루 1표 조회 원장)와 `resume_access_log`(열람 기록)는 행이
계속 쌓이는 원장이라 이전 시간을 따로 잡는다.

①은 데이터 이전이 없어 ADR-0058 의 재분리 체크리스트만으로 끝난다. ②~④는 각각 마이그레이션이
붙으므로 **한 단계가 배포되어 안정된 뒤 다음 단계로 간다.** 커밋한 마이그레이션은 되돌릴 수
없으므로(체크섬 불일치로 서비스가 죽는다) 단계마다 운영 `flyway_schema_history` 확인이 완료 조건이다.

### 6) ADR-0058 의 불변식은 그대로 간다

`:domain` 분리 유지 · 스키마/datasource/EMF/TM 도메인별 분리 · 컨텍스트 간 통신은 같은 JVM
이라도 Kafka 유지 · 교차 빈 주입 금지. 이번 개정은 **어느 JVM 에 담느냐만** 바꾼다.

### 7) ④ `resume` → account 는 기각한다 (2026-09-11)

원안의 근거는 분류표의 한 줄 — "`account` = 사람에 관한 데이터" 였다. 옮기려고 코드를 열어
보니 **그 분류가 두 가지를 섞고 있었다.**

- `account` 가 담는 것은 **회원(타인)의 데이터**다 — member 신원, wishlist. 회원이 탈퇴하면
  같이 지워지는 것들이다.
- `resume` 는 **사이트 주인의 콘텐츠**다. 지우는 주체도 수명도 다르다. 같은 "사람에 관한" 이지만
  담는 이유가 반대다.

코드가 그 판단을 뒷받침했다. 실제 결합은 셋이다.

1. `PortfolioProjectService`(code-dictionary 자기 도메인)가 resume 리포지토리 포트를
   **다섯 개 직접 주입**받는다. 포트폴리오는 사실상 resume 구조화 데이터의 읽기 뷰다.
2. `/api/v1/resume` 의 응답 `ResumeOverview` 는 **문서 + 구조화 프로필**이다
   (`getProfile.profile()`). 문서만 떼어 갈 수 없다.
3. resume 11 테이블 중 7개(company·project·skill·skill_group·category·project_skill·
   code_snippet)가 그 구조화 데이터고, `/portfolio` 와 `/resume` 가 **같은 행을 함께** 읽는다.

옮기면 한 페이지 렌더에 HTTP 홉이 두 번 생긴다(포트폴리오 1, 이력서 개요 1). 문서 4테이블만
쪼개는 안도 시도했으나 2번 때문에 성립하지 않는다 — 실제로 추출해 보고 컴파일 오류로 확인했다.

**resume 는 portfolio 와 한 바운디드 컨텍스트다.** 둘 다 apex 사이트가 자기 경력을 보여 주는
면이고, 그것이 `atlas` 의 정체성이다. 그래서 atlas 에 남긴다 — 이전 테이블 0.

> 이 기각이 남기는 것: **분류표의 한 줄로 이전을 정하지 않는다.** 라벨이 같아도 담는 이유가
> 다를 수 있고, 그건 코드를 열어야 보인다. ①~③ 은 모듈 경계가 이미 있었지만 ④ 는 없었다 —
> "모듈이 없다" 가 곧 "경계가 없다" 였다.

## 실행 기록 — ①단계에서 실제로 나온 것 (2026-09-11)

폴드 셋을 순서대로 배포하며 **컴파일과 단위 테스트가 전부 통과하는 채로** 드러난 결함들이다.
전부 컨텍스트 로드 검사가 잡았고, 배포 순서를 A(코드)/B(매니페스트)로 쪼갠 덕에 하나씩 갈렸다.

**공통 교훈: 폴드 결함은 조용하다.** 빌드·단위 테스트·readiness 프로브가 모두 초록인데
기능만 죽는다. 그래서 폴드마다 컨텍스트 로드 검사가 **필수**다.

| 폴드 | 나온 결함 |
|---|---|
| `engagement` | ClickHouse `DataSource` 빈 하나로 `DataSourceAutoConfiguration` 이 back-off → experiment 의 JPA 소멸. Hikari 풀이 기동 때 연결을 열어 ClickHouse 장애가 A/B 배정까지 세움 |
| `account` | 두 도메인 모두 비-@Primary 였다(commerce 에서는 inventory 가 primary) → primary 없는 호스트에서 타입 주입 실패 |
| `sideapp` | quant·chatbot 이 MySQL 을 **자동 구성에 맡기고** 있었고 gifticon 이 `@Primary dataSource` 를 직접 만들어, 폴드 순간 두 도메인의 JPA 가 사라진다. gifticon Querydsl 은 `EntityManager` 를 타입으로 받아 **quant DB 로 질의**. ClickHouse 풀 둘이 기동 때 연결을 열어 ClickHouse 장애가 chatbot·gifticon 까지 내림. `LocalFileKmsAdapter` 가 `@Profile` 로 갈려 프로파일 없는 컨텍스트에서 KMS 주입 실패 |
| `product` | **여섯**: 클래스명 충돌(`DataSourceConfig`·`KafkaConfig`·`OpenApiConfig`) · 빈 이름 충돌 5종 · 설정 키 누락 · 최상위 `kafka:` 중복 키 · `IdempotentEventHandler` 다중화 · common 멱등 엔티티 스캔 누락 · Querydsl 이 호스트 EMF 에 붙어 **다른 DB 로 질의** |

배포 쪽에서도 셋이 나왔다.

- **jib 이 조용히 꺼졌다** — 새 폴드 호스트를 `mainClassByImage` 에 안 넣으면 `jib SKIPPED` 인데
  워크플로는 성공으로 끝나고 태그만 올려 `ErrImagePull` 이 난다. 안내를 `warn` 으로 올렸다.
- **NetworkPolicy 가 라벨을 못 따라왔다** — 파드는 Ready 인데 ClickHouse 만 막혔다.
  허용 목록이 `In` 방식인 규칙(ClickHouse)은 폴드마다 갱신해야 하고, `NotIn` 방식(MySQL·Redis·Kafka)은 그대로 통과한다.
- **`settings.gradle.kts` 를 건드리면 전 서비스가 재빌드·재배포된다.** 4 OCPU 단일 노드에서
  load 6.14 까지 올라갔다. 폴드 커밋은 그 성질을 항상 갖는다 — 한산한 시간에 올린다.
- **`images.yml` 의 `case` 는 첫 일치가 이긴다.** commerce 줄에 `product/*` 를 더하면서 위에 있던
  product 전용 줄을 안 지워, product 를 건드린 커밋이 계속 'product' 로 분류돼 없는
  `:product:app:test` 를 찾다 죽었다. 게이트가 거기서 멈추니 그 커밋의 이미지는 **하나도** 안 나온다.
- **폴드는 코드만 옮긴다 — 운영 프로파일은 안 따라온다.** 기본 yml 의 `spring.datasource.product.*`
  기본값이 `localhost:3316` 인데 `commerce` 의 kubernetes 프로파일에 product 블록을 안 넣어
  운영에서 `Connection refused` 로 CrashLoopBackOff 가 났다. 도메인 블록을 옮길 때
  **application.yml 과 application-kubernetes.yml 을 짝으로** 옮긴다.
- **폴드된 라이브러리에 `application.yml` 을 남기지 않는다.** 호스트와 같은 클래스패스 이름으로
  경합한다. product/feature 에만 남아 있었고, 이기는 쪽이 jar 순서로 정해져 근거가 되지 못했다.
- **라벨을 안 따라간 NetworkPolicy 는 에러 없이 무효가 된다.** product 폴드 뒤
  `allow-order-to-product`·`allow-search-batch-to-product` 가 없는 파드를 선택한 채 남아 있었다.
  앞엣것은 한 프로세스 안이 돼 필요 없어졌고, 뒤엣것은 대상이 commerce 라 **실제로 막힌**
  상태였다(그 CronJob 이 suspend 라 안 드러났다). 같은 커밋에서 `PRODUCT_API_BASE_URL` 도
  없는 Service 를 가리키고 있었다 — 파드 이름이 바뀌면 **매니페스트 안의 URL 도 찾아야 한다.**
- **게이트웨이 이미지는 따로 나간다.** 라우트를 commerce 로 옮겼는데 그 커밋의 이미지 빌드가
  위 `case` 결함으로 통째로 실패해, 매니페스트는 넘어갔고 게이트웨이만 옛 이미지로 남았다 —
  `/api/v1/products` 가 운영에서 404 였다. 파드 이름이 바뀌는 커밋은 **게이트웨이 이미지가
  실제로 새 태그인지**까지 확인해야 끝난다.

### 이번에 세운 게이트 둘

문서로는 안 지켜진다는 것이 이 ADR 의 출발점이므로, 두 가지를 빌드로 내렸다.

- **`verifyPodTopology`** (루트 `build.gradle.kts`, `verifyArchitecture` 묶음 → pre-push) —
  `settings.gradle.kts` 의 `:{x}:app` 이 승인 목록 밖이면 막는다. 새 파드를 만들려면
  목록에 한 줄 더하며 ADR 을 고치게 된다. 같은 태스크가 각 파드의 jib 매핑 · `ALL_JVM` ·
  `k8s/base/<name>/deployment.yaml` 셋을 다 요구한다 — 위 '조용히 꺼진 jib' 을 잡는다.
  회귀를 주입해 두 갈래 모두 빨간불을 확인했다.
- **`GatewayRoutingSpec` 의 목적지 검사** — 라우트 표의 모든 http(s) 목적지 호스트가 실재하는
  Service 이름 집합 안에 있는지 본다. 라우트 하나를 폴드 전 이름으로 되돌려 빨간불을 확인했다.

## Alternatives Considered

| 후보 | 판정 | 근거 |
|---|---|---|
| 현행 유지 | 기각 | 시크릿 하나가 4도메인을 멈춰 세우는 것이 이미 실현됐다 |
| 도메인마다 파드 | 기각 | JVM 22개 × 최소 256Mi ≈ 5.6Gi. 단일 노드 4 OCPU 예산 밖 |
| `code-dictionary` 이름 유지 | 기각(근소) | 재편 후 61%가 실제로 사전이라 유지도 성립하지만, 포트폴리오·전시 33%가 계속 어긋난다 |
| `place` 를 atlas 로 | 기각 | place 는 자기 서브도메인·자기 DB·자기 ingest 를 가진 노출 면이다. content 가 맞다 |
| `blog`·`ranking` 을 atlas 에 잔류 | 기각 | 이전 0이라 싸지만, 둘 다 색인 대상 서브도메인이라 성격이 content 다 |
| `account` 를 auth 에 합침 | 보류 | ADR-0058 의 `identity` 계획. auth 서브모듈 경계 정리가 선행이라 이번 범위 밖 |

## Consequences

- (+) 상주 JVM 15 → 12. request 기준 약 768Mi~1.5Gi 회수
- (+) 장애 반경 분리 — 한 시크릿·한 기동 실패가 5도메인을 멈추던 것이 갈린다
- (+) ADR-0058 의 미실행 계획(`engagement`) 정리, 평가 누락(`place`) 해소
- (−) `content` 22,346줄로 여전히 최대다. 노출 서브도메인 넷이 한 파드라 **장애 반경이 크게 줄지는 않는다.**
  `game` 이 혼자 10,718줄로 절반이라 **후속 분리 1순위**이나, 파드 예산 때문에 이번에는 넣지 않는다
- (−) 15테이블 이전(④ 기각으로 26 → 15). ②~③은 되돌릴 수 없는 작업이다
- (−) 새 파드 이름 다섯(`atlas`·`content`·`account`·`engagement`·`sideapp`) → OCIR 이미지,
  k8s Deployment/Service/ServiceAccount, 게이트웨이 URI 상수, `images.yml` 경로 매핑, Argo 전부 갱신
