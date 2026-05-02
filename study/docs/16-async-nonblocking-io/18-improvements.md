---
parent: 16-async-nonblocking-io
seq: 18
title: msa 비동기/논블로킹 개선 후보
type: improvement
created: 2026-05-01
---

# 18. msa 비동기/논블로킹 개선 후보

이 문서는 msa 코드베이스에 비동기/논블로킹 IO 학습 결과를 적용한 *제안 카탈로그* 다. 각 항목은 **현황 → 문제 → 제안 → 영향 → ADR 필요 여부** 형식.

> 우선순위: P0 (즉시) / P1 (다음 sprint) / P2 (장기 ADR 필요)

---

## 제안 1. Spring Boot 3.2+ Virtual Threads 활성화 (MVC 서비스)

**우선순위**: P1
**대상**: product, order, search/api, member, gifticon, wishlist, fulfillment, inventory, warehouse, auth, quant

### 현황
- 모든 MVC 서비스가 default Tomcat thread pool (200 thread) 사용
- 동접이 200 을 넘을 가능성 (특히 order, product) 시 큐잉 발생
- JDBC + WebClient + Lettuce sync 모두 *thread 가 IO 대기 중 점유*

### 문제
- 동접 1K+ 시나리오 (예: flash sale, product list 광고 트래픽) 에서 Tomcat thread pool 포화
- pool 늘리면 메모리 (1MB stack × N) 폭증
- 현재는 horizontal scaling 으로 대응 — 비용 증가

### 제안
`application.yml` 한 줄 추가:
```yaml
spring:
  threads:
    virtual:
      enabled: true
```

**전제 조건**:
- Spring Boot 3.2+ ([build.gradle.kts](../../../gradle/libs.versions.toml) 확인)
- JDK 21+ (이미)
- 라이브러리 호환성 점검 (특히 native binding 사용 라이브러리)

### 영향
- 동접 한계 200 → 수만 (메모리 한계까지)
- 코드 변경 0 — *그냥 켜기만*
- VT pinning 함정 (synchronized + blocking) 점검 필요
- ThreadLocal 누적 → ScopedValue 마이그레이션 후보

### ADR
**필요**. ADR-0027 (가칭): "Virtual Threads 활성화 정책".
- 활성화 대상 서비스 범위
- VT pinning 모니터링 방법 (`-Djdk.tracePinnedThreads`)
- ThreadLocal 사용 점검 (`SecurityContextHolder` 등)
- 언제 비활성화 할 것인가 (rollback 기준)

---

## 제안 2. WebClient → RestClient 점진적 전환 (MVC + VT 환경 후)

**우선순위**: P2 (제안 1 완료 후)
**대상**: order, search/batch, experiment, auth (RestClient 미사용 서비스)

### 현황
- MVC 서비스가 `WebClient + awaitSingle` 패턴 사용 (예: `order/ProductAdapter.kt`)
- `awaitSingle` 의 다리 코드, `Mono.flatMap` 체인이 *MVC 환경에선 overhead*

### 문제
- WebFlux 안 쓰는데 Reactor 의 학습 비용 / 디버깅 비용 발생
- VT 활성화 후엔 *sync HTTP 호출이 자연스럽게 unmount* — Reactor 가치 감소

### 제안
- 신규 코드부터 `RestClient` 사용
- 기존 `WebClient + awaitSingle` 은 *유지* (재작성 비용 > 이득)
- fan-out 이 필요한 곳만 WebClient 또는 Java 21 `StructuredTaskScope`

### 영향
- 코드 단순화: `Mono.flatMap` → 일반 sync 호출
- 디버깅 stack trace 정상화
- Coroutine 의존성 점진 감소

### ADR
**필요**. ADR-0028 (가칭): "HTTP client 선택 가이드".
- 매트릭스 (WebFlux/MVC × VT/non-VT × 단발/fan-out)
- 신규 vs 기존 코드 정책

---

## 제안 3. Gateway downstream timeout / circuit breaker 보강

**우선순위**: P0
**대상**: gateway

### 현황
- `gateway/build.gradle.kts` 에 `spring-cloud-circuitbreaker-reactor-resilience4j` 의존성은 있음
- `application.yml` 에서 *route 별 timeout / CB 미설정* — **검증 결과 (2026-05-01)**: `gateway/src/main/resources/application.yml` 확인 결과 `spring.cloud.gateway.httpclient.*` (connect-timeout, response-timeout, pool) 설정 없음. route metadata `response-timeout: 0` 만 SSE 라우트 (`quant-paper-sse`) 에 명시. 글로벌 default 도, CB filter 도 미적용 — 도입 필요
- 다운스트림이 hang 하면 Gateway 의 connection 누적 가능

### 문제
- 한 다운스트림 장애가 Gateway 전체 latency 에 영향
- Reactor Netty 의 default timeout 이 *무한대*
- Connection pool exhaustion → 다른 정상 라우트도 영향

### 제안
`application.yml` 에 명시:
```yaml
spring:
  cloud:
    gateway:
      httpclient:
        connect-timeout: 1000
        response-timeout: 5s
        pool:
          max-connections: 200
          max-idle-time: 30s
      default-filters:
        - name: CircuitBreaker
          args:
            name: defaultCB
            fallbackUri: forward:/fallback
```

route 별로 짧은 timeout 도 가능:
```kotlin
.route("auth-service") { r ->
    r.path("/api/auth/**")
        .filters { f ->
            f.circuitBreaker { cb ->
                cb.setName("auth-cb")
                cb.setFallbackUri("forward:/fallback/auth")
            }
        }
        .uri("http://auth:8087")
}
```

### 영향
- 다운스트림 격리
- P99 안정화
- fallback 응답 정의 필요

### ADR
**필요**. 이미 `ADR-0015-resilience-strategy` 가 있으니 *Gateway 적용 정책* 으로 sub-section 추가.

---

## 제안 4. Gateway Redis fail-open 알람 메트릭

**우선순위**: P1
**대상**: gateway

### 현황
`AuthenticationGatewayFilter` 에서:
```kotlin
redisTemplate.hasKey("blacklist:$token")
    .onErrorReturn(false)  // Redis 장애 시 통과
```

### 문제
- Redis 장애가 *조용히 무력화* — blacklist 가 사실상 OFF
- 발견 timing 이 늦으면 보안 사고
- 현재 메트릭 / 알람 미설정 — **검증 결과 (2026-05-01)**: `gateway/.../filter/AuthenticationGatewayFilter.kt` 의 `onErrorReturn(false)` 경로에 Micrometer counter 등 메트릭 호출 없음. Prometheus 알람 룰도 별도 정의 없음 (검색 zero hit) — 도입 필요

### 제안
```kotlin
redisTemplate.hasKey("blacklist:$token")
    .doOnError { ex ->
        Metrics.counter("gateway.redis.blacklist.error",
                        "type", ex.javaClass.simpleName).increment()
    }
    .onErrorReturn(false)
```

알람 룰:
- 1분 내 100 회 이상 → on-call slack
- access token 만료 시간 < 5분 (이미? — token 정책 점검)

### 영향
- 보안 사각 시간 단축
- 메트릭 1 개 추가

### ADR
**불필요** (운영 보강).

---

## 제안 5. Lettuce Cluster timeout / retry 정책 강화

**우선순위**: P1
**대상**: 모든 서비스 (`common/CommonRedisAutoConfiguration`)

### 현황
```kotlin
.commandTimeout(Duration.ofSeconds(2))
```

### 문제
- 2초 timeout 이 *Tier 1 서비스 (Gateway 인증, ratelimit)* 엔 길 수 있음
- topology refresh 가 10분 주기 + adaptive — 일부 짧은 장애 시 MOVED 폭주 가능
- retry 정책 부재 — `RedisCommandTimeoutException` 즉시 propagate

### 제안
- Tier 별 timeout 차등 (Gateway 0.5s, 일반 2s)
- adaptive refresh trigger 의 RECONNECT_ATTEMPTS_THRESHOLD 명시
- Resilience4j retry 통합:
  ```kotlin
  RetryConfig.custom<Any>()
      .maxAttempts(2)
      .retryExceptions(RedisCommandTimeoutException::class.java)
      .build()
  ```

### 영향
- Redis transient 장애 자체 회복
- P99 안정화

### ADR
**필요**. ADR-0029 (가칭) 또는 0015 의 sub-section.

---

## 제안 6. Kafka `@KafkaListener` 안 blocking 시간 모니터링

**우선순위**: P2
**대상**: order, fulfillment, search/consumer, product, inventory, analytics

### 현황
- `@KafkaListener` 메서드 안에서 JDBC + 외부 API 호출 (blocking sync)
- consumer thread 가 처리 시간만큼 점유
- 처리 시간이 `max.poll.interval.ms` (default 5분) 넘으면 *consumer rebalance*

### 문제
- 외부 API timeout 누적 시 처리 시간 폭증
- Rebalance 발생 시 *모든 partition 재할당* — 단발성 hiccup 이 전체 lag 로 번짐

### 제안
- 처리 시간 메트릭 (Micrometer histogram)
- `max.poll.interval.ms` 명시 (default 의존 X)
- 처리 시간 > N 초면 즉시 알람
- 길어지는 작업은 *별도 thread + 큐* 로 분리 (기존 ADR-0012 idempotent consumer 와 결합)

### 영향
- Rebalance 사고 예방
- lag 가시성

### ADR
**불필요** (운영 보강), 기존 `ADR-0012-idempotent-consumer` 의 운영 가이드에 추가.

---

## 제안 7. SSE 기반 실시간 알림 / 실시간 시세 도입 검토

**우선순위**: P2
**대상**: 신규 — *quant* 시세 stream, *order* 상태 변경 푸시

### 현황
- 현재 클라이언트가 *polling* 으로 상태 확인 (가정)
- 실시간성 부족, 부하 증가

### 제안
- Gateway 또는 신규 push 서비스에서 SSE endpoint 제공
- WebFlux + `Flux<ServerSentEvent>` 패턴
- 백프레셔: `onBackpressureLatest()` (시세) / `onBackpressureBuffer(N)` (주문 상태)

```kotlin
@GetMapping("/api/quotes/{symbol}", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
fun streamQuotes(@PathVariable symbol: String): Flux<ServerSentEvent<Quote>> =
    quoteSink.asFlux()
        .filter { it.symbol == symbol }
        .map { ServerSentEvent.builder(it).build() }
        .onBackpressureLatest()
```

### 영향
- 실시간성 향상
- 클라이언트 polling 부하 제거
- Gateway 의 *long-lived connection* 증가 → connection limit 점검 필요

### ADR
**필요**. ADR-0030 (가칭): "SSE / WebSocket 도입 정책".
- 어느 서비스가 push 책임을 가지나
- backpressure 전략
- 인증 처리 (SSE 는 Authorization header 못 보냄 → cookie or token-in-query)

---

## 제안 8. HTTP/2 활성화 (서비스 간 호출)

**우선순위**: P2
**대상**: WebClient / RestClient 모두

### 현황
- 모든 서비스 간 호출이 HTTP/1.1 default
- connection pool 이 host 별 16~64 개

### 문제
- HTTP/1.1 의 head-of-line blocking
- connection 수가 다운스트림에 부하

### 제안
- WebClient 의 ReactorClientHttpConnector 에 HTTP/2 활성화:
  ```kotlin
  val httpClient = HttpClient.create()
      .protocol(HttpProtocol.H2C)  // h2c (cleartext) for K8s 내부
  ```
- RestClient 의 JdkHttpClient 는 HTTP/2 default

### 영향
- connection 수 80% 감소 가능
- 다운스트림 부하 감소
- Spring Cloud Gateway 의 default-filters 에 영향 — 점검 필요

### ADR
**필요**. ADR-0031 (가칭): "내부 통신 HTTP/2 도입 정책".

---

## 제안 9. ScopedValue 도입 검토 (VT 활성화 후)

**우선순위**: P2
**대상**: VT 활성화 서비스 (제안 1 완료 후)

### 현황
- ThreadLocal 사용처: SecurityContextHolder, MDC, RequestContextHolder, Hibernate session
- VT 가 1만 개 동접이면 ThreadLocal 도 1만 인스턴스

### 문제
- ThreadLocal 메모리 누수 위험
- VT 라이프사이클이 길어지면 GC 압박

### 제안
- JDK 21 의 `ScopedValue` (JEP 446) 점진적 도입
- Spring 6.x 가 점차 ScopedValue 채택 — 라이브러리 follow

```kotlin
val USER_ID = ScopedValue.newInstance<Long>()

ScopedValue.where(USER_ID, 123L).run {
    // 이 안에서 USER_ID.get() 가능
    process()
}
```

### 영향
- 메모리 사용 감소
- VT 친화적 ThreadLocal 대안

### ADR
**필요** (제안 1 이후). 시점은 Spring 의 ScopedValue 1급 시민화 시점에 맞춤.

---

## 우선순위 요약

| # | 제안 | 우선순위 | ADR? |
|---|---|---|---|
| 3 | Gateway downstream timeout / CB | **P0** | 0015 sub |
| 1 | VT 활성화 (MVC) | P1 | 0027 |
| 4 | Redis fail-open 알람 | P1 | - |
| 5 | Lettuce timeout / retry 강화 | P1 | 0029 |
| 2 | WebClient → RestClient 전환 | P2 | 0028 |
| 6 | Kafka 처리 시간 모니터링 | P2 | 0012 sub |
| 7 | SSE 실시간 푸시 | P2 | 0030 |
| 8 | HTTP/2 내부 통신 | P2 | 0031 |
| 9 | ScopedValue 도입 | P2 | (VT 정착 후) |

---

## 적용 순서 권장

```
Week 1-2:  P0 - Gateway timeout / CB 보강
Week 3-4:  P1 - VT 활성화 (단계적: 1 서비스 → 모든 MVC)
Week 5-6:  P1 - Lettuce / Redis 보강
Week 7+:   P2 - 전환 / 신규 도입
```

---

## 면접에서 활용

이 문서의 각 제안은 *"우리 회사에서 비동기 IO 관련 개선 작업 해보셨어요?"* 라는 면접 질문의 답변으로 그대로 사용 가능. 특히 *제안 1 (VT)* 와 *제안 3 (Gateway timeout)* 은 *현실적이고 효과 큰* 작업이라 면접관 인상 좋음.

> 답변 시 *제안 → 리스크 → 검증 방법* 까지 함께 말하는 게 신뢰도 ↑.

---

## 다음 학습

- [19-interview-qa.md](19-interview-qa.md) — 면접 Q&A 카드 + 50 문항
