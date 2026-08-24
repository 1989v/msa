# ADR-0082 — 외부 API 쿼터 게이트: 장부는 제공자 단위, 게이트는 호출 계층에

- 상태: 채택 (2026-08-24)
- 관련: ADR-0081(rank — 외부 한도가 서비스 수명을 정한다), ADR-0070(수집 CronJob),
  ADR-0065(place — 수집 원천), ADR-0031(NetworkPolicy — 서비스별 외부 egress),
  ADR-0025(latency budget)

## 맥락

무료 쿼터가 있는 외부 API를 여러 서비스가 쓴다. 지금 상태를 실측하면 이렇다 (2026-08-24).

| 어디 | 무엇 | 한도를 어떻게 아나 |
|---|---|---|
| `place/AttractionLinkService.kt` | YouTube 100 / 네이버 5,000 | Kotlin `when` 상수 |
| `place/ingest/src/main.py` | Google Places 1,000 | 환경변수 `GOOGLE_PLACES_DAILY_BUDGET` |
| `ranking` | 길찾기 일일 예산 | 또 다른 구현 |

**세 구현이 서로를 모른다.** 그리고 더 중요한 문제가 있다 — 카운트 근거가 각자의 도메인
테이블(수집 결과 행 수)이라 **제공자 단위 합산이 원천적으로 불가능**하다.

네이버 검색 API는 일 25,000콜이고 그중 place 가 5,000을 쓴다. 여기에 deal 이 혜택 수집으로
붙으면 각자 자기 카운터만 보며 "여유 있음"이라 판단한다. 합쳐서 넘겨도 아무도 모른다.

쿼터는 **API 키(제공자 계정)에 붙지 서비스에 붙지 않는다.** 장부의 단위가 틀려 있었다.

## 결정

### 1) 장부는 제공자 단위 · Redis · 자정 TTL

```
external-api-quota:{provider}:{yyyy-MM-dd}   →  INCR, 자정까지 TTL
```

서비스도 언어도 **같은 키를 증가**시킨다. JVM(Kotlin)과 place/ingest(Python)가 같은 Redis 를
본다. 도메인 테이블에 세지 않는 이유가 이것이다 — 테이블이 도메인마다 달라 합산이 안 된다.

`INCR` 은 원자적이라 동시 호출에도 초과가 안 난다. 만료가 공짜라 정리 배치가 필요 없다.

> **Redis 재시작이면 그날 사용분을 잊는다.** 초과 호출 가능. 그래서 한도는 제공자 한도보다
> 낮게 잡는다. 한도는 안전 마진이지 조절 손잡이가 아니다 — 늘리고 싶으면 상수가 아니라
> 제공자 문서를 본다.

### 2) 비용은 콜 수가 아니라 **단위(unit)** 다

YouTube Data API 는 일 10,000 **units** 이고 `search.list` 가 건당 100 units, `videos.list` 가
1 unit 이다. 콜 수로 세면 100배 틀린다. 그래서 `acquire(provider, cost)` 로 가중치를 받는다.

| provider | 한도 | 단위 | 한도의 출처 |
|---|---|---|---|
| `NAVER_SEARCH` | 25,000 | call | 제공자 공표 |
| `YOUTUBE_DATA` | 10,000 | unit | 제공자 공표 (search=100, videos=1) |
| `GOOGLE_PLACES` | 1,000 | call | **자체 상한** — 무과금이지만 상한 없이 돌리지 않는다 |
| `GOOGLE_DIRECTIONS` | 설정값 | call | 자체 상한 (Essentials 무료 구간 고정) |
| `DATA_GO_KR` | `null` | call | **제공자가 공개하지 않음** → 관측만 |
| `EXCHANGE_*`(퀀트) | `null` | call | 일일 무료 쿼터 개념 없음 → 관측만 |

### 3) 한도 없는 provider 도 게이트를 태운다 (`limit = null`)

막지 않고 세기만 한다. 둘을 얻는다.

- 어느 API가 얼마나 나가는지 **관측**이 생긴다
- 새 외부 API를 붙일 때 **provider 등록이 필수 경로**가 되어 "한도 있나?"를 강제로 묻게 된다

### 4) 게이트는 호출 계층에 박는다 — 호출부가 기억하지 않는다

`if (quota.tryAcquire(...)) client.call()` 은 컨벤션이지 강제가 아니다. 호출부가 늘면
누군가 반드시 빠뜨리고, 빠뜨려도 쿼터를 넘긴 날까지 아무 일도 안 일어난다.

붙일 자리가 **호출 방식마다 다르다.**

| 방식 | 자리 | 왜 |
|---|---|---|
| 논블로킹 `WebClient` | **`ExchangeFilterFunction`** | exchange 마다 돈다 → 재시도도 각각 셈 |
| 블로킹 `RestClient` | `ClientHttpRequestInterceptor` | 실제 요청 직전 |
| 그 외(JDK `HttpClient` 등) | AOP `@Around` | 인터셉터 훅이 없을 때의 차선 |
| Python (`place/ingest`) | 얇은 래퍼 | AOP·필터가 없다. **같은 Redis 키**를 쓰는 것이 핵심 |

**논블로킹에 AOP 를 쓰지 않는다.** `@Around` 는 메서드 호출 시점에 도는데, 리액티브 메서드는
그때 `Mono`(콜드 퍼블리셔)를 **조립만** 하고 실제 요청은 `subscribe()` 에서 나간다. 그래서

- 구독하지 않고 버리면 → 실제 0회, AOP 는 1회 (과다)
- `.retry(2)` 로 재구독하면 → 실제 최대 3회, AOP 는 1회 (**과소 — 위험**)

재시도는 제공자도 각각 1콜로 센다. 과소 계상은 쿼터를 넘긴 줄 모르고 계속 때리게 만든다 —
막으려고 만든 장치가 정확히 반대로 동작한다.

### 5) 소비 시점 — 성공·빈결과·실패·타임아웃 전부 1콜

예약은 **요청 전송 직전**, 확정은 응답 결과와 무관하다. 넷 다 제공자 쿼터를 실제로 썼다.
**실패를 반납하지 않는다** — 반납하면 장애 시 무한 재시도가 된다.

(place 의 기존 구현이 이미 "성공·빈결과·실패를 모두 센다"로 맞게 하고 있었다. 그대로 승격한다.)

### 6) 우회 차단 — 빌드가 깨뜨린다

여기까지 다 해도 이 한 줄이면 무력화된다.

```kotlin
private val webClient = WebClient.builder().build()   // 공용 팩토리를 안 거친다
```

실제로 `quant/application/discover/GlobalIndicesQuery.kt` 가 이 형태다(실측).
공용 빈이 아니라 클래스 안에서 만들면 중앙에서 필터를 걸 방법이 없다.

**`verifyExternalApiQuota` Gradle 태스크**가 이걸 잡는다. 외부 API 호스트 문자열
(`openapi.naver.com` · `googleapis.com` · `apis.data.go.kr` 등)이 소스에 있는데 그 모듈이
`ExternalApiProvider` 를 참조하지 않으면 빌드를 깨뜨린다. `check` 에 붙여 `./gradlew build` 로 돈다.

`verifyFlywayWiring` 과 같은 패턴이다 — 문서와 리뷰는 사람이 빠뜨리지만 빌드는 안 빠뜨린다.

### 7) 사용자 요청 경로에서 외부 API를 직접 부르지 않는다

큐에 적재하고 배치가 소비한다. 요청 수에 외부 호출을 묶으면 인기가 생기는 순간 쿼터가
터진다. 그때 게이트는 "막아주는" 게 아니라 **서비스를 죽인다**(전부 429). 게이트 이전의
설계 문제이므로 여기 함께 못박는다. (ADR-0081 이 같은 경고를 rank 에서 했다.)

## 결과

- (+) 제공자 단위 합산이 처음으로 가능해진다. place 와 deal 이 네이버 25,000을 나눠 쓴다.
- (+) 새 외부 API 도입이 provider 등록을 강제한다 — 한도를 모르고 붙이는 일이 사라진다.
- (+) 관측이 생긴다(`limit = null` 포함).
- (−) Redis 의존이 생긴다. Redis 가 죽으면 **호출을 막을지 통과시킬지** 정해야 한다 →
  **통과(fail-open)** 로 간다. 쿼터 초과는 다음 날 회복되지만 수집 중단은 회복되지 않는다.
  대신 fail-open 이 발생하면 warn 로그를 남긴다.
- (−) 기존 3종 구현을 옮겨야 한다. 옮기기 전까지 이중 계상이 아니라 **이중 관리**다.
- (−) Python 래퍼는 JVM 과 코드를 공유하지 않는다 — 키 포맷이 어긋나면 합산이 조용히 깨진다.
  키 포맷을 이 ADR 에 박아 두고 양쪽 테스트로 고정한다.

## 참조

- spec: `docs/specs/2026-08-24-external-api-quota-gate/`
- `docs/architecture/data-sources.md` — provider 별 한도의 출처
