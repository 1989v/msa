---
parent: 17-spring-web
type: preview
created: 2026-05-01
---

# Spring Web 처리 심화 — Preview

> 학습자 수준: intermediate · 전체 예상 시간: 14h · 목표: HTTP 파이프라인 모든 layer 를 그림으로 설명 + 면접 답변
> 계획서: [00-plan.md](00-plan.md) · 학습 순서: 파이프라인 외곽(Filter)부터 안쪽(Controller, MessageConverter)으로 → 응답 후 처리(gzip)
> 산출물 후보: ObjectMapper auto-config 통일, AOP 표준 패턴, "응답 압축 위치" ADR

---

## 멘탈 모델: "HTTP 요청 한 통의 여행 일지"

브라우저가 보낸 HTTP 한 통이 응답으로 돌아오기까지, **8개 관문**을 통과한다. 각 관문마다 누가 일하는지, 무엇을 할 수 있고 없는지 외워두면 면접 시 어떤 질문이 나와도 같은 그림 위에서 답할 수 있다.

```
 [Client]
    │
    ▼
 ┌─────────────────────────────────────┐
 │ ① Reverse Proxy (Nginx Ingress)     │  TLS 종단 / gzip 후보지 #1
 └──────────────┬──────────────────────┘
                ▼
 ┌─────────────────────────────────────┐
 │ ② Tomcat / Reactor Netty            │  서블릿 컨테이너, gzip 후보지 #2
 └──────────────┬──────────────────────┘
                ▼
 ┌─────────────────────────────────────┐
 │ ③ Servlet Filter Chain              │  jakarta.servlet.Filter
 │   - Security FilterChainProxy        │  DelegatingFilterProxy → SecurityFilter*
 │   - 일반 @Component Filter           │
 └──────────────┬──────────────────────┘
                ▼
 ┌─────────────────────────────────────┐
 │ ④ DispatcherServlet                 │  HandlerMapping, ArgumentResolver
 └──────────────┬──────────────────────┘
                ▼
 ┌─────────────────────────────────────┐
 │ ⑤ HandlerInterceptor.preHandle      │  Handler 정보 접근 가능
 └──────────────┬──────────────────────┘
                ▼
 ┌─────────────────────────────────────┐
 │ ⑥ AOP Proxy → @Controller           │  Spring AOP / AspectJ
 │   ↓                                  │
 │   Service / Repository (proxy chain) │
 └──────────────┬──────────────────────┘
                ▼
 ┌─────────────────────────────────────┐
 │ ⑦ ResponseBodyAdvice / Converter     │  Jackson MappingJackson2HttpMessageConverter
 └──────────────┬──────────────────────┘
                ▼
 ┌─────────────────────────────────────┐
 │ ⑧ Filter chain (response 측) → ②→①  │  gzip 인코딩 후보지 #3
 └─────────────────────────────────────┘
```

**핵심 5문장만 외운다**:

1. **Filter 는 DispatcherServlet 밖, Interceptor 는 안** — Filter 는 Spring 빈 정보 없이 동작, Interceptor 는 HandlerMethod 정보 받음.
2. **Spring Security 의 모든 Security Filter 는 단 하나의 `FilterChainProxy` 라는 Servlet Filter 안에서 실행된다** (DelegatingFilterProxy 가 다리).
3. **Spring AOP 는 프록시 기반이라 같은 빈 안의 자기 호출(self-invocation)은 advice 가 적용되지 않는다** — 이게 면접 단골.
4. **ObjectMapper 는 thread-safe 하고 비싼 객체이므로 반드시 싱글톤** — Jackson Default Typing 활성화는 RCE 위험.
5. **gzip 은 어디서든 한 곳에서만** — Reverse Proxy(Ingress)에서 끝내는 게 표준. 민감 응답에는 BREACH 위험으로 켜지 말 것.

---

## 소주제 지도

> 21개 파일로 분할. 각 파일 평균 ~1h. 파이프라인 외곽 → 안쪽 → 응답 → 적용 → 면접 순.

### Phase 1: 파이프라인 그림 (4개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | HTTP 요청-응답 파이프라인 8단계 | [01-http-pipeline.md](01-http-pipeline.md) | Tomcat → Filter → DispatcherServlet → Interceptor → Controller → Converter |
| 02 | Filter vs Interceptor vs AOP 위치 정의 | [02-filter-vs-interceptor-vs-aop.md](02-filter-vs-interceptor-vs-aop.md) | "어디서 잡히는가" 표 + 결정 트리 |
| 03 | DispatcherServlet 내부 흐름 | [03-dispatcher-servlet.md](03-dispatcher-servlet.md) | HandlerMapping/Adapter/ArgumentResolver/ReturnValueHandler |
| 04 | WebMVC vs WebFlux 의 Filter 모델 | [04-webmvc-vs-webflux.md](04-webmvc-vs-webflux.md) | Servlet Filter ↔ WebFilter, gateway 가 후자인 이유 |

### Phase 2a: Filter / Interceptor / AOP 심화 (4개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 05 | Servlet Filter 상세 | [05-servlet-filter.md](05-servlet-filter.md) | FilterRegistrationBean, Order, ContentCachingWrapper |
| 06 | Spring Security FilterChainProxy | [06-security-filter-chain.md](06-security-filter-chain.md) | DelegatingFilterProxy, SecurityFilterChain, 13개 SecurityFilter |
| 07 | HandlerInterceptor | [07-handler-interceptor.md](07-handler-interceptor.md) | preHandle/postHandle/afterCompletion + WebMvcConfigurer |
| 08 | Spring AOP + AspectJ | [08-spring-aop.md](08-spring-aop.md) | JDK Proxy vs CGLIB, self-invocation, @Aspect, AspectJ weaving |

### Phase 2b: Jackson 심화 (5개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 09 | ObjectMapper lifecycle + thread-safety | [09-jackson-objectmapper.md](09-jackson-objectmapper.md) | 왜 싱글톤, 어디서 비싼가, ReaderFor/WriterFor |
| 10 | Jackson Module / MixIn / Annotation | [10-jackson-modules.md](10-jackson-modules.md) | KotlinModule, jsr310, MixIn 우회 패턴 |
| 11 | Custom Serializer / Deserializer + Polymorphic | [11-jackson-serializer.md](11-jackson-serializer.md) | StdSerializer, @JsonTypeInfo allow-list |
| 12 | Default Typing 의 위험 (CVE 시리즈) | [12-jackson-default-typing.md](12-jackson-default-typing.md) | gadget chain, PolymorphicTypeValidator, 안전 패턴 |
| 13 | snake_case + KotlinModule + 성능 | [13-jackson-naming-perf.md](13-jackson-naming-perf.md) | PropertyNamingStrategies, strictNullChecks, Blackbird |

### Phase 2c: HTTP gzip (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 14 | 압축 layer 선택 + 알고리즘 비교 | [14-gzip-layers.md](14-gzip-layers.md) | Tomcat/Spring/Nginx/Envoy 위치, gzip vs br vs zstd |
| 15 | Accept-Encoding ↔ Vary ↔ 캐시 | [15-gzip-vary-cache.md](15-gzip-vary-cache.md) | 협상 메커니즘, Vary 누락 시 캐시 오염 |
| 16 | BREACH/CRIME 공격 + 대응 | [16-gzip-breach.md](16-gzip-breach.md) | TLS+압축 사이드 채널, 민감 body 비활성화 패턴 |

### Phase 3: msa 코드베이스 적용 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 17 | gateway Filter chain 실제 구조 분석 | [17-msa-gateway-filter.md](17-msa-gateway-filter.md) | VisitorIdFilter / RequestLoggingFilter / AuthenticationGatewayFilter 순서 |
| 18 | common AOP / ObjectMapper / gzip 활성화 위치 | [18-msa-common-patterns.md](18-msa-common-patterns.md) | CommonJacksonAutoConfiguration 한계, @Around timing 표준안, gzip 위치 결정 |

### 산출물 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 19 | msa 표준화 후보 종합 | [19-improvements.md](19-improvements.md) | ObjectMapper 통일, AOP logging 표준, gzip 위치 ADR 후보 |
| 20 | 면접 Q&A 카드 | [20-interview-qa.md](20-interview-qa.md) | 4 Phase × 8개 = 32 카드 |

---

## 개념 관계도

```
                      ┌─────────────────────────┐
                      │  외부 (Reverse Proxy)    │ ← gzip 표준 위치
                      └────────────┬────────────┘
                                   │
            ┌──────────────────────┼──────────────────────┐
            │                      │                      │
            ▼                      ▼                      ▼
   ┌──────────────────┐   ┌────────────────┐   ┌──────────────────┐
   │  Servlet Filter   │   │ Interceptor    │   │  AOP @Aspect     │
   │  - 인증/CORS      │   │ - trace ID     │   │  - timing/audit  │
   │  - 압축(대안)     │   │ - 권한 후처리   │   │  - retry         │
   └────────┬──────────┘   └────────┬───────┘   └────────┬─────────┘
            │                       │                    │
            ▼                       ▼                    ▼
                ─────────── DispatcherServlet ───────────
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │  Controller / DTO    │ ← Jackson 영역
                        │  ResponseBodyAdvice  │
                        │  HttpMessageConverter│
                        └─────────────────────┘
```

---

## Phase 1 치트시트 (학습 시작 전 한 장)

### "이건 어디서?" 빠른 결정표

| 하고 싶은 것 | 위치 | 이유 |
|---|---|---|
| HTTPS → HTTP redirect | Reverse Proxy / Filter | DispatcherServlet 도달 전이 자연스러움 |
| JWT 인증 | Servlet Filter (또는 Security Filter) | Controller 진입 막아야 함 |
| trace ID MDC 주입 | Servlet Filter | 모든 로그/Interceptor/AOP 가 보게 |
| 권한별 routing | Security Filter / Gateway | URL 패턴 매칭 |
| Controller 진입 직전 권한 체크 (HandlerMethod 기준) | HandlerInterceptor | `@PreAuthorize` 도 가능 |
| 외부 API 호출 시간 측정 | AOP `@Around` | 메소드 단위, cross-cutting |
| 응답 본문 후가공 (e.g. ApiResponse 래핑) | `ResponseBodyAdvice` | Converter 직전 |
| JSON snake_case 변환 | ObjectMapper 설정 | 전 서비스 일관 |
| 응답 gzip 압축 | Reverse Proxy (1순위) | CPU 비용 외주, 운영 단순 |

### 절대 하지 말 것

- Servlet Filter 안에서 Spring `@Service` 빈 의존(초기에 NPE 가능, lazy 필요)
- `ObjectMapper` 매 요청마다 `new ObjectMapper()` 호출
- Jackson `enableDefaultTyping(...)` (CVE 줄줄이 — allow-list 만 사용)
- 같은 빈 안에서 `this.method()` 호출하며 `@Transactional`/`@Async`/AOP 동작 기대
- gzip 을 Tomcat 과 Nginx 둘 다에서 켜기 (이중 압축은 일어나지 않지만 디버깅 혼란)
- 인증 토큰 응답 body 에 그대로 노출 + gzip 켜기 (BREACH 위험)
- `Vary: Accept-Encoding` 누락한 채 CDN 앞단에 캐시 (압축/비압축 응답 섞임)

---

## 학습 진행 가이드

- 권장 순서: **01 → 02 → ... → 18** (외곽 → 안쪽 → 응답)
- Phase 1(01-04) 은 그림 위주 — 빠르게 통과 후 02 의 결정표만 외워도 면접 60% 커버
- Phase 2a(05-08) 는 면접 단골 — Filter/Interceptor 차이, AOP self-invocation 은 답변 줄줄 나오게
- Phase 2b(09-13) 는 실무 비중 큼 — 12(Default Typing) 는 보안 면접 단골
- Phase 2c(14-16) 는 BREACH 한 번만 깊이 보면 됨, 나머지는 운영 결정
- 17-18 은 실제 msa 코드 읽으며 학습 (gateway/common)
- **20-interview-qa.md** 는 회독용 — 1주 간격 2-3 회독

각 파일 호출:

```
/study:start 17           # 다음 deep file 자동 선택
/study:start 17 12        # 12-jackson-default-typing.md 직접 지정
```
