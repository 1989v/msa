---
parent: 17-spring-web
seq: 19
title: msa 표준화 후보 종합
type: deep
created: 2026-05-01
---

# 19. msa 표준화 후보 종합

> 본 파일은 17번 학습 전체 ([01](01-http-pipeline.md) ~ [18](18-msa-common-patterns.md)) 의 결론을 우선순위별 ADR 후보로 정리한다.

## 1. 제안 종합표

| # | 제안 | 대상 | 영향도 | 우선순위 | ADR 필요 |
|---|---|---|---|---|---|
| 1 | `CommonJacksonAutoConfiguration` ObjectMapper 모듈/설정 보강 | `common/jackson` | L3 (전 서비스) | **높음** | Y (마이너) |
| 2 | gzip 활성화 위치 표준화: ingress-nginx 한 곳 | k8s | L2 | **높음** | Y |
| 3 | trace ID Filter (gateway WebFilter + common Servlet Filter) + logback 패턴 | gateway / common | L2 | **높음** | Y (마이너) |
| 4 | Default Typing / `@JsonTypeInfo Id.CLASS` 사용 점검 | 전 서비스 | L1 | 중간 | N (점검) |
| 5 | Micrometer `@Timed` 가이드 + common `@ExternalCall` Aspect | common | L2 | 중간 | Y (장기) |
| 6 | BREACH 대응: 인증 응답 path 별 gzip 분리 | k8s | L2 | 중간 | Y (#2 와 합침) |
| 7 | `ApiResponseAdvice` 자동 래핑 | common | L2 | 낮음 | N (선택) |
| 8 | gateway VisitorIdFilter — `Secure` / `SameSite` 보강 | gateway | L1 | 낮음 | N |
| 9 | Spring Cloud Gateway 단방향 SecurityWebFilter 표준화 (외부 IdP 도입 시) | gateway | L3 | 낮음 | Y (L3) |
| 10 | gateway → 다운스트림 mTLS / NetworkPolicy | k8s | 매우 높음 | 낮음 | Y (L3, 13번 ADR 와 통합) |

## 2. 우선순위 TOP 3 (즉시 추진 가치)

### 1. ObjectMapper 표준화 (`CommonJacksonAutoConfiguration`)

**현재 상태**:

```kotlin
@Bean
@ConditionalOnMissingBean(ObjectMapper::class)
fun legacyObjectMapper(): ObjectMapper = ObjectMapper()  // 모듈 미등록
```

**문제**:

- KotlinModule / JavaTimeModule 명시 미등록 — Spring Boot 자동 발견에 묵시적 의존
- `strictNullChecks` 미적용 — non-null 필드에 null 통과
- 직렬화 정책 (NON_NULL, BigDecimal, depth limit) 미설정
- `agent-viewer` 만 자체 등록 → 응답 포맷 불일치 가능

**개선** (단계적):

**Phase 1** — 모듈/설정 명시 (strictNullChecks 제외):

```kotlin
@Bean
@ConditionalOnMissingBean(ObjectMapper::class)
fun objectMapper(): ObjectMapper = jacksonObjectMapper().apply {
    registerModule(JavaTimeModule())
    registerModule(
        KotlinModule.Builder()
            .configure(KotlinFeature.NullIsSameAsDefault, true)
            .configure(KotlinFeature.SingletonSupport, true)
            .build()
    )
    disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
    setSerializationInclusion(JsonInclude.Include.NON_NULL)
    disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
    enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
    enable(MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS)
    factory.streamReadConstraints = StreamReadConstraints.builder()
        .maxNestingDepth(100)
        .maxStringLength(10_000_000)
        .maxNumberLength(1000)
        .build()
}
```

**Phase 2** — `strictNullChecks=true` 활성화 (각 서비스 모니터링 후):

```kotlin
.configure(KotlinFeature.StrictNullChecks, true)
```

**왜 1순위**:

- 직렬화 일관성 — 모든 서비스 응답 포맷 통일
- 보안 (depth/length limit) 자동 적용 → JSON Bomb DoS 방어
- 데이터 무결성 (Phase 2 strictNullChecks) — non-null 약속 강화

**영향**: common (L3) — 전 서비스 빌드 영향. 기존 응답에 null 이 섞여있으면 Phase 2 진입 시 실패 케이스 발견 (의도된 효과).

**ADR**: 마이너 (ObjectMapper 정책 표준)

### 2. gzip 활성화: ingress-nginx 한 곳

**현재 상태**: 모든 응답 raw 송출 (압축 0%)

**개선**:

```yaml
# k8s/infra/local/ingress-nginx/values.yaml (Helm)
controller:
  config:
    use-gzip: "true"
    gzip-level: "6"
    gzip-min-length: "1024"
    gzip-types: "application/json text/plain application/xml application/javascript text/css"
    # SSE 와 image/* 는 자동 제외 (gzip_types 에 없으므로)
```

추가 — BREACH 대응 (path 별):

```yaml
# k8s/base/gateway/ingress-private.yaml (신규, 인증 응답 분리)
metadata:
  name: gateway-private
  annotations:
    nginx.ingress.kubernetes.io/configuration-snippet: |
      gzip off;
spec:
  rules:
    - http:
        paths:
          - path: /api/auth
          - path: /api/members/me
          # /api/orders 는 검토 — 입력 echo 가 없으면 gzip 유지
```

**왜 2순위**:

- 응답 70-80% 절감 — 모바일/저속 회선 체감
- 한 곳 설정 — 운영 단순
- BREACH 대응을 처음부터 정책에 포함

**영향**: ingress 만 — 백엔드 서비스 코드 변경 없음 (L2)

**ADR**: 응답 압축 위치 표준 — 신규 ADR (제안)

### 3. trace ID Filter

**현재 상태**: 분산 추적 헤더 없음. 한 요청을 여러 서비스 거쳐 추적 어려움.

**개선** (3-segment):

#### 3.1. gateway WebFilter

```kotlin
// gateway/src/main/kotlin/com/kgd/gateway/filter/TraceIdFilter.kt
@Component
class TraceIdFilter : GlobalFilter, Ordered {
    override fun getOrder(): Int = Ordered.HIGHEST_PRECEDENCE - 1

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val traceId = exchange.request.headers.getFirst(TRACE_HEADER)
            ?: UUID.randomUUID().toString()

        val mutated = exchange.request.mutate().header(TRACE_HEADER, traceId).build()
        exchange.response.headers.set(TRACE_HEADER, traceId)
        return chain.filter(exchange.mutate().request(mutated).build())
    }

    companion object { const val TRACE_HEADER = "X-Trace-Id" }
}
```

#### 3.2. common Servlet Filter (모든 다운스트림 서비스 자동 적용)

```kotlin
// common/src/main/kotlin/com/kgd/common/web/TraceIdFilter.kt
class TraceIdFilter : OncePerRequestFilter() {
    override fun doFilterInternal(req, res, chain: FilterChain) {
        val traceId = req.getHeader(TRACE_HEADER) ?: UUID.randomUUID().toString()
        MDC.put(MDC_KEY, traceId)
        res.setHeader(TRACE_HEADER, traceId)
        try { chain.doFilter(req, res) } finally { MDC.remove(MDC_KEY) }
    }
    companion object {
        const val TRACE_HEADER = "X-Trace-Id"
        const val MDC_KEY = "traceId"
    }
}

@AutoConfiguration
class CommonWebAutoConfiguration {
    @Bean
    fun traceIdFilterRegistration(): FilterRegistrationBean<TraceIdFilter> =
        FilterRegistrationBean(TraceIdFilter()).apply {
            urlPatterns = listOf("/*")
            order = Ordered.HIGHEST_PRECEDENCE
        }
}
```

#### 3.3. logback pattern

```xml
<pattern>%d{HH:mm:ss.SSS} [%thread] [%X{traceId:-}] %-5level %logger{36} - %msg%n</pattern>
```

**왜 3순위**:

- 서비스 간 호출 디버깅 압도적 단축
- ELK/Loki 에서 한 요청의 전 로그 검색 가능
- 코드 변경 최소 (gateway 1 파일 + common 1 파일 + logback 라인)

**영향**: L2 — common + gateway. logback 은 서비스마다 패턴 변경 필요할 수 있음.

**ADR**: 마이너 (분산 추적 헤더 표준)

## 3. 중기 (ADR 필요)

### 4. Default Typing 점검 — 보안 audit

```bash
# msa 코드베이스 audit script (단순)
grep -rn "activateDefaultTyping\|enableDefaultTyping" --include="*.kt" .
grep -rn "JsonTypeInfo.Id.CLASS\|JsonTypeInfo.Id.MINIMAL_CLASS" --include="*.kt" .
grep -rn "readValue.*Object::class\|readValue.*Any::class" --include="*.kt" .
```

→ **현재 0건 확인됨** ([12](12-jackson-default-typing.md)). 다만 신규 코드 도입 시 차단을 위해:

- ArchUnit 또는 Detekt 룰로 자동 검증
- PR 템플릿에 체크리스트 항목 추가

**ADR 불필요**, 코드 audit 정책으로.

### 5. Micrometer @Timed 가이드 + 장기 @ExternalCall Aspect

**Phase 1** — Micrometer `@Timed` 사용 가이드 (즉시):

```kotlin
@Service
class BithumbClient(...) {
    @Timed(value = "external.api.duration", extraTags = ["api", "bithumb", "endpoint", "ticker"])
    suspend fun getTicker(symbol: String): Ticker = ...
}
```

→ Latency Budget (ADR-0025) 와 자동 연결.

**Phase 2** — `common.aop.@ExternalCall` Aspect (필요시):

- Mono/Flux/Suspend 모두 호환
- 메트릭 + 자동 retry / circuit-breaker hook
- Resilience4j 와 통합

**언제 Phase 2?**: Tier 1 서비스에서 외부 호출 latency 가 SLA 의 50% 를 넘기 시작할 때.

**ADR**: 장기 (AOP 표준 패턴)

### 6. BREACH 대응 — 위 #2 와 합침

ingress 압축 ADR 안에 path 분리 정책 포함.

## 4. 장기 (L3 변경)

### 9. Gateway SecurityWebFilter 표준화

**현재**: `SecurityConfig` 가 `permitAll` 만 두고 인증은 `AuthenticationGatewayFilter` 가 별도 처리.

**개선 시점**: 외부 IdP (Cognito/Keycloak/Auth0) 도입 시.

```kotlin
@Bean
fun chain(http: ServerHttpSecurity, jwtDecoder: ReactiveJwtDecoder): SecurityWebFilterChain =
    http
        .csrf { it.disable() }
        .authorizeExchange { ex ->
            ex.pathMatchers("/api/auth/**", "/api/products/**").permitAll()
            ex.pathMatchers("/api/admin/**").hasRole("ADMIN")
            ex.anyExchange().authenticated()
        }
        .oauth2ResourceServer { it.jwt { jwt -> jwt.jwtDecoder(jwtDecoder) } }
        .build()
```

→ Spring Security 표준 컴포넌트 (JWT decoder, JWKS, RBAC) 활용.

**ADR**: L3 — 13번 ADR-0004 (인증) + 외부 IdP 도입과 함께.

### 10. mTLS / NetworkPolicy

**현재**: 다운스트림이 X-User-Id 헤더 신뢰. gateway 우회 호출 시 위조 가능.

**개선**:

- K8s `NetworkPolicy` — gateway pod 만 다운스트림 service 호출 가능
- Istio/Linkerd — 자동 mTLS, SPIFFE identity

→ 13번 학습의 #17-mtls 과 직결.

**ADR**: L3 — 서비스 메시 도입 결정.

## 5. 빠른 실행 가능한 마이크로 개선

### 5.1. gateway VisitorIdFilter — 쿠키 보강

```kotlin
ResponseCookie.from(VISITOR_COOKIE, visitorId)
    .path("/")
    .maxAge(Duration.ofDays(365))
    .httpOnly(true)
    .secure(true)              // 추가
    .sameSite("Lax")           // 추가
    .build()
```

### 5.2. RequestLoggingFilter 에 traceId 통합

trace ID Filter (#3) 도입 후 RequestLoggingFilter 의 로그에 traceId 자동 포함 (logback pattern).

### 5.3. AuthenticationGatewayFilter — kid/iss/aud 검증 추가

13번 학습의 19-improvements 1순위와 동일. `JwtUtil` 보강 후 gateway 가 자동으로 혜택.

## 6. 체크리스트 (학습 후 즉시 가능한 것)

### Phase 1 (이번 주)

- [ ] common ObjectMapper Phase 1 (strictNullChecks 제외) 적용
- [ ] common Jackson 보안 limit (maxNestingDepth/maxStringLength) 추가
- [ ] gateway VisitorIdFilter `Secure` / `SameSite` 추가
- [ ] msa 코드베이스 Default Typing audit (grep 결과 기록)
- [ ] gateway TraceIdFilter 도입 (X-Trace-Id 헤더만)

### Phase 2 (이번 달)

- [ ] common TraceIdFilter + AutoConfiguration 추가
- [ ] logback pattern 에 `[%X{traceId:-}]` 추가 (모든 서비스)
- [ ] ingress-nginx ConfigMap 에 gzip 활성화
- [ ] BREACH 대응 — 인증 응답 path 분리 ingress 또는 annotation
- [ ] external API 호출에 Micrometer `@Timed` 적용 시작 (charting/quant)

### Phase 3 (분기)

- [ ] common ObjectMapper Phase 2 — strictNullChecks=true 활성화
- [ ] common `@ExternalCall` Aspect 도입 검토
- [ ] ApiResponseAdvice 자동 래핑 (신규 서비스 부터 시범 적용)
- [ ] ArchUnit / Detekt 으로 Default Typing 차단 룰

### 장기 (분기 이상)

- [ ] gateway SecurityWebFilter 표준화 (외부 IdP 도입 후)
- [ ] mTLS / NetworkPolicy (서비스 메시 도입 후)
- [ ] CDN 도입 시 gzip + brotli 정책

## 7. 관련 다음 학습 제안

- **#13 (이미 완료)** — JWT 표준 클레임 보강과 본 #3 의 trace ID 표준이 시너지
- **신규 주제: Spring Boot 4 / Jackson 3 마이그레이션** — 본 학습의 ObjectMapper bridge 가 임시방편이라, 정식 마이그레이션 계획 필요
- **신규 주제: 분산 추적 (OpenTelemetry / Zipkin)** — trace ID 만 두고 끝나지 않고 span 까지 연결. 본 #3 의 자연스러운 다음 단계
- **신규 주제: Service Mesh (Istio / Linkerd)** — #10 의 mTLS / NetworkPolicy 와 겹침

## 8. ADR 후보 정리

이번 학습 결과 작성 권장 ADR:

| ADR 번호 (제안) | 제목 |
|---|---|
| ADR-0028 | Common ObjectMapper 표준 (KotlinModule/JavaTimeModule/security limit) |
| ADR-0029 | 응답 압축 위치 표준 (ingress-nginx + BREACH 대응 path 분리) |
| ADR-0030 | 분산 추적 헤더 표준 (X-Trace-Id + MDC + logback pattern) |
| (장기) | AOP 표준 패턴 (@Auditable, @ExternalCall, @TenantBoundary) |

## 다음 학습

- [20-interview-qa.md](20-interview-qa.md) — 면접 회독 카드
