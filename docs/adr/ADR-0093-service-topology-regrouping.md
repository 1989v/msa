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
| `atlas` | 개념 사전 · 서비스 카탈로그 · 포트폴리오 · 전시 | 4,791 | apex 사이트 총람 |
| `account` | member · wishlist · resume | 4,634 | 사람에 관한 데이터 |
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
| **①** | product·place 를 `:app` → `:feature` 폴드 · `engagement` · `sideapp` · `account`(member·wishlist) | **0** | engagement·account·product 완료(2026-09-11), place·sideapp 남음 |
| **②** | `deal` → commerce · `ranking` → content | 3 + 5 | 미착수 |
| **③** | `blog` → content | 7 | 미착수 |
| **④** | `resume` → account (`:resume:feature` 모듈 신설 선행) | 11 | 미착수 |

총 **26테이블**. `blog_post_view`(하루 1표 조회 원장)와 `resume_access_log`(열람 기록)는 행이
계속 쌓이는 원장이라 이전 시간을 따로 잡는다.

①은 데이터 이전이 없어 ADR-0058 의 재분리 체크리스트만으로 끝난다. ②~④는 각각 마이그레이션이
붙으므로 **한 단계가 배포되어 안정된 뒤 다음 단계로 간다.** 커밋한 마이그레이션은 되돌릴 수
없으므로(체크섬 불일치로 서비스가 죽는다) 단계마다 운영 `flyway_schema_history` 확인이 완료 조건이다.

### 6) ADR-0058 의 불변식은 그대로 간다

`:domain` 분리 유지 · 스키마/datasource/EMF/TM 도메인별 분리 · 컨텍스트 간 통신은 같은 JVM
이라도 Kafka 유지 · 교차 빈 주입 금지. 이번 개정은 **어느 JVM 에 담느냐만** 바꾼다.

## 실행 기록 — ①단계에서 실제로 나온 것 (2026-09-11)

폴드 셋을 순서대로 배포하며 **컴파일과 단위 테스트가 전부 통과하는 채로** 드러난 결함들이다.
전부 컨텍스트 로드 검사가 잡았고, 배포 순서를 A(코드)/B(매니페스트)로 쪼갠 덕에 하나씩 갈렸다.

**공통 교훈: 폴드 결함은 조용하다.** 빌드·단위 테스트·readiness 프로브가 모두 초록인데
기능만 죽는다. 그래서 폴드마다 컨텍스트 로드 검사가 **필수**다.

| 폴드 | 나온 결함 |
|---|---|
| `engagement` | ClickHouse `DataSource` 빈 하나로 `DataSourceAutoConfiguration` 이 back-off → experiment 의 JPA 소멸. Hikari 풀이 기동 때 연결을 열어 ClickHouse 장애가 A/B 배정까지 세움 |
| `account` | 두 도메인 모두 비-@Primary 였다(commerce 에서는 inventory 가 primary) → primary 없는 호스트에서 타입 주입 실패 |
| `product` | **여섯**: 클래스명 충돌(`DataSourceConfig`·`KafkaConfig`·`OpenApiConfig`) · 빈 이름 충돌 5종 · 설정 키 누락 · 최상위 `kafka:` 중복 키 · `IdempotentEventHandler` 다중화 · common 멱등 엔티티 스캔 누락 · Querydsl 이 호스트 EMF 에 붙어 **다른 DB 로 질의** |

배포 쪽에서도 셋이 나왔다.

- **jib 이 조용히 꺼졌다** — 새 폴드 호스트를 `mainClassByImage` 에 안 넣으면 `jib SKIPPED` 인데
  워크플로는 성공으로 끝나고 태그만 올려 `ErrImagePull` 이 난다. 안내를 `warn` 으로 올렸다.
- **NetworkPolicy 가 라벨을 못 따라왔다** — 파드는 Ready 인데 ClickHouse 만 막혔다.
  허용 목록이 `In` 방식인 규칙(ClickHouse)은 폴드마다 갱신해야 하고, `NotIn` 방식(MySQL·Redis·Kafka)은 그대로 통과한다.
- **`settings.gradle.kts` 를 건드리면 전 서비스가 재빌드·재배포된다.** 4 OCPU 단일 노드에서
  load 6.14 까지 올라갔다. 폴드 커밋은 그 성질을 항상 갖는다 — 한산한 시간에 올린다.

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
- (−) 26테이블 이전. ②~④는 되돌릴 수 없는 작업이라 단계 사이에 안정화 기간이 필요하다
- (−) 새 파드 이름 다섯(`atlas`·`content`·`account`·`engagement`·`sideapp`) → OCIR 이미지,
  k8s Deployment/Service/ServiceAccount, 게이트웨이 URI 상수, `images.yml` 경로 매핑, Argo 전부 갱신
- (−) `:resume:feature` 모듈 신설이 필요하다. blog·deal 과 달리 resume 는 아직 모듈이 아니다
