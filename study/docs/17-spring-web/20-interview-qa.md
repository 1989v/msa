---
parent: 17-spring-web
seq: 20
title: 면접 Q&A 카드 + 자가평가
type: deep
created: 2026-05-01
---

# 20. 면접 Q&A 카드

> 이 파일은 회독용. 학습 종료 후 1주일 간격으로 2-3회 회독 권장.
> 한 카드 = 30초 답변. 모든 답에 "어디서 배운 개념" 을 떠올릴 수 있어야.

---

## Phase 1: 파이프라인 그림 (8개)

**Q1.1** HTTP 요청이 클라이언트에서 떠나서 응답으로 돌아오기까지 어떤 단계를 거치나요?

> Reverse Proxy (TLS 종단 + L7 라우팅 + gzip 후보지) → Servlet Container (Tomcat 또는 Reactor Netty) → Servlet Filter chain (Spring Security 의 FilterChainProxy 포함) → DispatcherServlet → HandlerInterceptor.preHandle → Controller (AOP proxy chain 포함) → ReturnValueHandler → HttpMessageConverter (Jackson) → Filter chain 응답측 → Container → Reverse Proxy 순입니다. Filter 는 DispatcherServlet 밖, Interceptor 는 안, AOP 는 메소드 단위라는 게 핵심 위치 차이고요.

**Q1.2** Filter 와 Interceptor 의 차이를 한 줄로?

> Filter 는 Servlet 표준이라 DispatcherServlet 밖에서 URL 패턴 단위로 request 를 wrapping 하며 동작하고, Interceptor 는 Spring MVC 가 HandlerMapping 매칭 후 호출하는 인터페이스라 HandlerMethod 정보를 받아 어노테이션 기반 정책을 적용할 수 있습니다.

**Q1.3** AOP 가 Filter / Interceptor 와 다른 점은?

> AOP 는 HTTP 와 무관하게 메소드 호출을 가로챕니다. Filter/Interceptor 가 URL/Handler 단위라면 AOP 는 메소드 시그니처 (포인트컷) 단위라 외부 API 시간 측정, 트랜잭션, retry 같은 비즈니스 메소드 cross-cutting 에 자연스럽고, 같은 패턴이 WebMVC/WebFlux 모두에서 동작합니다.

**Q1.4** HTTPS → HTTP redirect 같은 작업은 어디서 하는 게 좋나요?

> Reverse Proxy 또는 Servlet Filter 가 자연스럽습니다. DispatcherServlet 도달 전 단계가 의미 있고, msa 라면 ingress-nginx 의 `ssl-redirect: "true"` annotation 으로 인프라 단에서 끝내는 게 운영 단순합니다.

**Q1.5** trace ID 는 Filter 에 두는 게 좋을까요 Interceptor 에 두는 게 좋을까요?

> Filter 가 좋습니다. Filter 에서 발생하는 로그까지 보게 하려면 가장 외곽에 있어야 하고, MDC 에 put 한 뒤 finally 에서 remove 하는 패턴이 표준입니다. Interceptor 는 HandlerMapping 매칭 후라서 그 사이의 Security Filter 등의 로그에는 trace 가 안 찍힙니다.

**Q1.6** `@ResponseBody` 컨트롤러 응답 본문을 후처리하려면?

> `ResponseBodyAdvice` 의 `beforeBodyWrite` 를 씁니다. `HandlerInterceptor.postHandle` 은 ModelAndView 가 null 이고 응답 본문이 이미 작성 중이라 변경 못 합니다. msa 에서 `ApiResponse<T>` 자동 래핑을 도입한다면 `@RestControllerAdvice` 로 ResponseBodyAdvice 를 등록하는 게 표준 패턴입니다.

**Q1.7** Filter 에서 던진 예외는 `@RestControllerAdvice` 가 잡나요?

> 못 잡습니다. `@RestControllerAdvice` 의 `@ExceptionHandler` 는 DispatcherServlet 안의 `HandlerExceptionResolver` 가 처리하는데 Filter 는 그 밖에서 동작하기 때문입니다. Filter 안에서는 직접 try/catch 후 `response.status` + body 를 작성해야 합니다.

**Q1.8** WebFlux 에서는 Filter 가 어떻게 다르나요?

> `jakarta.servlet.Filter` 가 아니라 `WebFilter` 또는 Spring Cloud Gateway 의 `GlobalFilter`/`GatewayFilter` 를 씁니다. 시그니처가 `Mono<Void>` 비동기이고, msa 의 gateway 는 후자 패턴으로 `RequestLoggingFilter`, `VisitorIdFilter`, `AuthenticationGatewayFilter` 를 운영 중입니다. AOP 는 양쪽 동일하지만 Mono 반환 시 `proceed()` 직후가 아닌 `doFinally` 시점이 측정 기준이 돼야 정확합니다.

---

## Phase 2a: Filter / Interceptor / AOP (10개)

**Q2.1** Spring Security 의 Filter 는 일반 Servlet Filter 와 어떻게 결합되나요?

> `DelegatingFilterProxy` 라는 일반 Servlet Filter 1개가 컨테이너에 등록되고, 그게 `ApplicationContext` 에서 `springSecurityFilterChain` 빈 (=`FilterChainProxy`) 으로 위임합니다. `FilterChainProxy` 안에 등록된 `SecurityFilterChain[]` 중 매칭되는 chain 의 13개 안팎 Security Filter 를 순회하는 3층 구조죠. 컨테이너 입장에선 단 하나의 Filter 만 알고, Spring 안에서 모든 보안 동작이 빈으로 표현되는 게 이 구조의 가치입니다.

**Q2.2** Spring AOP 의 self-invocation 이 안 먹는 이유와 해결책은?

> Spring AOP 는 proxy 객체가 메소드 호출을 가로채는 구조인데, 같은 빈 안에서 `this.method()` 는 target 자기 자신을 호출하니 proxy 를 거치지 않아 advice 가 적용되지 않습니다. `@Transactional`, `@Async`, `@Cacheable`, `@Retry` 가 모두 이 함정에 빠지죠. 정공은 메소드를 다른 빈으로 분리하는 패턴이고, 자가 주입이나 `AopContext.currentProxy()` 우회는 결합 증가/순환 참조 위험으로 권장 안 합니다. 더 무겁게 가면 AspectJ load-time/compile-time weaving 인데 빌드 복잡도 때문에 일반적으로 과합니다.

**Q2.3** JDK Dynamic Proxy 와 CGLIB 의 차이는?

> JDK Proxy 는 인터페이스 기반이라 타깃 클래스가 인터페이스를 구현해야 하고, CGLIB 은 클래스 상속 기반이라 인터페이스 없이 가능하지만 `final` 클래스/메소드는 proxy 못 합니다. Spring Boot 2 부터 `proxy-target-class=true` 가 기본이라 CGLIB 우선이고, Kotlin 은 클래스가 기본 final 이라 `kotlin-spring` 플러그인이 자동으로 `open` 처리해 줍니다.

**Q2.4** `@Around` 와 `@Before` 의 차이는?

> `@Before` 는 메소드 진입 전 hook 만 가능하고 반환값/예외에 영향을 못 줍니다. `@Around` 는 `ProceedingJoinPoint.proceed()` 를 직접 호출해서 실제 메소드 호출 자체를 감싸니 timing, retry, 예외 변환, 반환값 교체가 다 가능하죠. 시간 측정처럼 finally 자리가 필요하면 항상 `@Around` 입니다.

**Q2.5** Pointcut 표현식 자주 쓰는 패턴은?

> `execution(* com.kgd..service.*Service.*(..))` 같은 메소드 시그니처 매칭, `@annotation(...)` 어노테이션 매칭, `@within(...)` 클래스 어노테이션 매칭이 가장 흔합니다. 어노테이션 기반이 가장 깔끔하고 명시적이라 msa 에 도입한다면 `@ExternalCall`, `@Auditable` 같은 마커 어노테이션 + Aspect 패턴이 표준 후보입니다.

**Q2.6** `OncePerRequestFilter` 가 왜 표준인가요?

> 기본 `Filter` 를 직접 구현하면 forward/include 시 같은 요청이 여러 번 doFilter 를 거쳐 중복 실행될 수 있습니다. `OncePerRequestFilter` 는 request 속성에 처리 마크를 두어 한 요청당 단 한 번만 `doFilterInternal` 을 호출하도록 보호하니 사실상 모든 커스텀 Filter 의 베이스로 삼아야 합니다.

**Q2.7** Filter 의 순서는 어떻게 정하나요?

> `@Order` 또는 `Ordered` 인터페이스, 또는 `FilterRegistrationBean.setOrder(int)` 로 명시합니다. 작을수록 먼저고 `Ordered.HIGHEST_PRECEDENCE` 가 최고 우선이죠. Spring Security 의 `springSecurityFilterChain` 은 자체 order 가 -100 이라 그보다 먼저/나중에 둘지 의식해서 정해야 하고, 명시 안 하면 임의 순서가 되니 가급적 모든 인증/로깅 Filter 는 명시 권장입니다.

**Q2.8** HandlerInterceptor 의 `preHandle` 에서 false 반환 후 어떻게 되나요?

> Controller 호출이 skip 되고 즉시 응답이 종료됩니다. `postHandle` 은 호출 안 되지만 `afterCompletion` 은 그 시점까지 등록된 Interceptor 들에 한해 역순 호출됩니다. preHandle 에서 응답을 직접 작성 (`response.status` + body) 안 하면 빈 200 OK 가 가니 책임지고 응답을 만들어야 합니다.

**Q2.9** SecurityFilterChain 을 여러 개 두는 이유는?

> URL 패턴별로 다른 보안 정책을 두기 위해서입니다. `/admin/**` 은 ROLE_ADMIN 강제, `/api/**` 은 JWT, `/public/**` 은 permitAll 같은 식으로 chain 을 분리하면 각 chain 마다 13개 Filter 의 동작이 독립적으로 구성됩니다. `FilterChainProxy` 가 매칭 순서대로 첫 번째 매칭되는 chain 만 적용하니 `@Order` 로 우선순위 명시가 필요합니다.

**Q2.10** AOP 가 안 먹는 또 다른 케이스가 있나요?

> private/final 메소드 (proxy override 불가), proxy 가 적용 안 된 빈 (Filter 빈, BeanPostProcessor 일부), proxy 자체가 인터페이스 기반인데 타깃 클래스로 직접 주입 받은 경우, AOP advice 가 비동기 결과 (`Mono`/`Flux`) 의 발행 시점이 아닌 생성 시점만 보는 경우 등이 함정입니다. self-invocation 이 가장 흔하고 나머지는 케이스별 대응입니다.

---

## Phase 2b: Jackson (8개)

**Q3.1** ObjectMapper 가 thread-safe 한가요? 왜 싱글톤?

> 모듈 등록과 설정이 끝난 뒤에는 thread-safe 합니다. 내부 Serializer/Deserializer 캐시가 ConcurrentHashMap, SerializationConfig 가 frozen 이라 동시 접근에 안전하죠. 다만 `new ObjectMapper()` + 모듈 등록은 ms 단위 비싼 작업이라 매 요청마다 만들면 latency 가 누적됩니다. 그래서 Spring 빈으로 싱글톤 등록하고 hot path 는 `readerFor/writerFor` 로 immutable Reader/Writer 를 추가로 만들어 씁니다.

**Q3.2** Jackson Default Typing 이 왜 위험한가요?

> JSON 안에 클래스 FQCN 이 함께 직렬화되고 역직렬화 시 그 클래스를 인스턴스화합니다. 공격자가 클래스패스의 'gadget' 클래스 (Spring `ClassPathXmlApplicationContext`, `JdbcRowSetImpl` 등) 를 지정해 보내면 임의 코드 실행이 가능하죠. CVE-2017-7525 부터 새 gadget 이 계속 발견돼 deny-list 로는 못 막고, 정공은 `activateDefaultTyping` 자체를 안 쓰거나 Jackson 2.10+ 의 `BasicPolymorphicTypeValidator` 로 allow-list 를 강제하는 겁니다. 도메인 polymorphic 은 `@JsonTypeInfo(use = Id.NAME)` + `@JsonSubTypes` 로 명시 등록이 정공이고요.

**Q3.3** `@JsonTypeInfo` 의 `Id.CLASS` 와 `Id.NAME` 중 무엇을 쓰나요?

> 항상 `Id.NAME`. `Id.CLASS` 는 default typing 과 같은 RCE 위험이라 절대 안 씁니다. 도메인 이벤트 같은 polymorphic 은 'ORDER_PLACED' 같은 논리 이름으로 직렬화하고 `@JsonSubTypes` allow-list 에 명시 등록합니다.

**Q3.4** snake_case API 를 카멜케이스 모델로 받으려면?

> ObjectMapper 에 `setPropertyNamingStrategy(PropertyNamingStrategies.SNAKE_CASE)` 또는 `application.yml` 의 `spring.jackson.property-naming-strategy: SNAKE_CASE` 한 줄로 양방향 변환됩니다. 한 필드만 다른 컨벤션이면 그 필드만 `@JsonProperty` 로 명시하고요. msa 는 외부 API 컨벤션 결정 후 ADR 로 일괄 적용 계획입니다.

**Q3.5** KotlinModule 의 strictNullChecks 는 어떤 옵션이고 왜 필요한가요?

> 기본 KotlinModule 은 non-null 필드에 null 입력이 들어와도 그대로 통과시킵니다. Kotlin 의 null-safety 가 깨져 도메인 깊숙이 null 이 침투해 NPE 가 늦게 터지죠. strictNullChecks=true 로 두면 역직렬화 시점에 `MissingKotlinParameterException` 으로 fail-fast 됩니다. 운영에서 무조건 켜는 옵션이지만, 기존 데이터에 null 이 섞여있다면 단계적 활성화가 안전합니다.

**Q3.6** 외부 라이브러리의 클래스 직렬화를 변경하려면?

> MixIn 패턴을 씁니다. 라이브러리 클래스 자체는 못 건드리니 별도 abstract class 에 어노테이션을 달고 `mapper.addMixIn(LibClass.class, MixInClass.class)` 로 등록하면 단방향으로 어노테이션이 덮입니다. 외부 SDK DTO 의 민감 필드 마스킹, FQCN 노출 차단 같은 시나리오에 유용합니다.

**Q3.7** `JsonView` vs DTO 분리?

> DTO 분리를 선호합니다. `@JsonView` 는 도메인/응답 클래스 한 곳에 view 정책을 모으는 장점이 있지만, 어노테이션 분산으로 가독성이 떨어지고 view 추가 시 누락 위험이 있습니다. DTO 별도 클래스는 보일러플레이트가 늘지만 명시적이라 운영 안전성이 더 높습니다. msa 도 DTO 분리 패턴이 표준입니다.

**Q3.8** Spring Boot 4 의 Jackson 3 전환은?

> Spring Boot 4 부터 `tools.jackson.databind.ObjectMapper` 가 auto-configured 빈으로 바뀝니다. 기존 Jackson 2 (`com.fasterxml.jackson.databind.ObjectMapper`) import 코드가 많으면 호환성 위해 별도 ObjectMapper 빈을 직접 등록하거나, msa 처럼 auto-configuration 으로 bridge 빈을 만들어야 합니다. 장기적으로는 패키지 마이그레이션이 정공이지만 한 번에 가긴 부담스러워 점진 적용이 일반적입니다.

---

## Phase 2c: HTTP gzip (6개)

**Q4.1** HTTP gzip 을 어디서 켜는 게 맞나요?

> 표준은 reverse proxy/ingress 한 곳입니다. msa 라면 ingress-nginx 의 `use-gzip: true` 설정으로 모든 백엔드 응답에 일괄 적용됩니다. Spring Boot 의 `server.compression.enabled` 를 서비스마다 켜는 건 일관성 깨질 위험과 앱 노드 CPU 부담 때문에 안 쓰고요. CDN 까지 있으면 거기서 또 처리하지만 origin 과 CDN 둘 다 켜는 건 의미 없으니 한쪽만 활성합니다.

**Q4.2** 늘 gzip 을 켜야 하나요?

> 아닙니다. 이미 압축된 컨텐츠 (이미지/비디오), 작은 응답 (<1KB), SSE/WebSocket 같은 스트리밍은 압축이 의미 없거나 latency 만 늘리고, 가장 중요하게 BREACH 공격 위험이 있는 응답은 압축에서 제외해야 합니다. ingress 의 `gzip_types` 로 application/json, text/* 만 한정하고 민감 path 는 별도 분리하는 게 표준입니다.

**Q4.3** BREACH 공격이 뭔가요?

> HTTP 응답 body 에 (1) 공격자가 제어하는 입력이 echo 되고, (2) 같은 응답에 secret 이 함께 있고, (3) gzip 압축이 켜져 있을 때 가능한 사이드 채널 공격입니다. 추측한 입력이 secret 일부와 일치하면 압축 후 크기가 줄어드는 차이를 관찰해 secret 을 한 글자씩 복원합니다. TLS 가 평문은 가려도 암호화된 길이는 노출되니 TLS 1.3 에서도 유효합니다.

**Q4.4** BREACH 대응 방법은?

> 정공은 응답 분리입니다. 인증 토큰을 사용자 입력이 echo 되는 응답과 함께 내려보내지 않는 거죠. 추가로 CSRF 토큰을 매 요청마다 다르게 마스킹하고 (masked double-submit), 민감 path 만 ingress 단에서 압축 비활성합니다. msa 는 ingress-nginx 의 path 별 `gzip off` annotation 또는 별도 ingress 분리로 처리할 계획이고요. rate limit 가 충분히 낮으면 BREACH 의 수천 번 추측이 실전에서 어려워집니다.

**Q4.5** `Vary: Accept-Encoding` 이 왜 필요한가요?

> 같은 URL 이 요청 헤더에 따라 다른 응답을 만들면 캐시가 어느 응답을 보관해야 할지 알아야 합니다. `Vary: Accept-Encoding` 은 '이 응답은 Accept-Encoding 값에 따라 달라진다' 를 캐시에 알리는 헤더로, gzip 응답이 비압축을 기대한 클라이언트에게 잘못 전달되는 캐시 오염을 막아주죠. CDN/proxy 모두 Vary 를 캐시 키에 포함시키고, 누락하면 옛 클라이언트가 깨진 응답을 받습니다.

**Q4.6** gzip vs brotli vs zstd 선택은?

> 동적 응답은 gzip level 6 이 호환성과 비용의 균형이 가장 좋고, 정적 자산을 CDN 에 한 번 압축해 영구 캐시할 땐 brotli level 11 로 압축률 극대화합니다. zstd 는 압축률과 CPU 모두 우수하지만 브라우저 지원이 아직 확산 중이라 fallback 필요하고요. 결정은 운영 환경의 클라이언트 분포와 캐시 라이프사이클로 합니다.

---

## Phase 3: msa 적용 (4개)

**Q5.1** msa gateway 의 Filter chain 을 설명해주세요.

> Spring Cloud Gateway (WebFlux) 라 `GlobalFilter` 와 `GatewayFilter` 두 종류를 씁니다. `RequestLoggingFilter` 가 HIGHEST_PRECEDENCE 로 진입/종료 시간을 측정하고, `VisitorIdFilter` 가 익명 vid 쿠키와 헤더를 주입하며, `AuthenticationGatewayFilter` 가 `GatewayFilterFactory` 패턴으로 라우트별 requiredRoles Config 를 받아 JWT 검증 + Redis 블랙리스트 + 다운스트림에 X-User-Id / X-User-Roles 헤더 주입을 담당합니다. Redis fail-open 으로 인증 인프라 단일 장애가 전 서비스 마비로 번지지 않게 했고, RedisRateLimiter 가 100 token/sec / 200 burst 로 보호합니다.

**Q5.2** msa 의 ObjectMapper 표준화는 어떻게 하나요?

> common 모듈의 `CommonJacksonAutoConfiguration` 에서 `@ConditionalOnMissingBean` 으로 표준 ObjectMapper 를 등록합니다. 권장 구성은 KotlinModule (strictNullChecks 단계 적용), JavaTimeModule, NON_NULL inclusion, FAIL_ON_UNKNOWN_PROPERTIES disable, BigDecimal float 처리, ACCEPT_CASE_INSENSITIVE_ENUMS, 그리고 maxNestingDepth/maxStringLength 같은 보안 limit 까지 모두 명시입니다. 서비스가 자체 빈을 등록하면 그쪽이 우선이라 cherry-pick 도 가능하죠.

**Q5.3** msa 는 gzip 을 어디서 켜나요?

> 현재는 어디도 안 켜져 있는 상태고 ([18](18-msa-common-patterns.md), [19](19-improvements.md)), 표준화 안은 ingress-nginx ConfigMap 한 곳입니다. 백엔드 서비스 yml 에 `server.compression` 을 안 두는 이유는 일관성, CPU 외주, 운영 단순성 때문이고요. BREACH 대응을 위해 인증 응답 path 는 별도 ingress 또는 annotation 으로 gzip off, SSE 라우트는 gzip_types 에서 text/event-stream 제외하는 path 별 정책을 함께 둡니다.

**Q5.4** msa 의 분산 추적은 어떻게 표준화할 건가요?

> gateway 에 `TraceIdFilter` (`GlobalFilter`) 를 HIGHEST_PRECEDENCE - 1 로 두어 X-Trace-Id 헤더를 받거나 신규 발급하고 다운스트림으로 전파합니다. 다운스트림 서비스 (WebMVC) 에는 common 모듈의 `TraceIdFilter` (`OncePerRequestFilter`) 를 AutoConfiguration 으로 자동 등록해 같은 헤더를 받으면 MDC 에 put, finally 에서 remove 합니다. logback pattern 에 `[%X{traceId:-}]` 를 추가해 모든 로그에 자동 출력되게 하면 ELK/Loki 에서 한 요청의 전 로그를 그루핑할 수 있고요. 이게 OpenTelemetry/Zipkin 같은 본격 분산 추적의 1단계 진입점입니다.

---

## 자가 평가 — 5분 셀프 체크

이 5문제를 1분 내에 답변할 수 있으면 17번 학습 합격선:

1. **Filter, Interceptor, AOP 의 위치 차이를 그림으로 그릴 수 있는가?**
2. **`@Transactional` 이 안 먹는 케이스 3가지를 예시 코드 없이 말할 수 있는가?** (self-invocation, private, final / proxy 미적용 빈)
3. **Jackson Default Typing 이 왜 RCE 로 이어지는지 1분 안에 설명할 수 있는가?**
4. **gzip 을 ingress 에 두는 이유 3가지를 즉답할 수 있는가?** (일관성, CPU 외주, 운영 단순)
5. **BREACH 의 3 조건과 대응 1가지를 말할 수 있는가?** (입력 echo + secret + 압축, 응답 분리)

---

## 다음 학습 제안

- 17번 다음으로 자연스러운 주제는 **분산 추적 (OpenTelemetry / Zipkin)** — 본 학습의 trace ID 표준이 1단계, 그 위 span propagation / context propagation 이 2단계
- 또는 **Spring Boot 4 / Jackson 3 마이그레이션** — `CommonJacksonAutoConfiguration` 이 임시방편이라 정식 마이그레이션 계획 필요
- 또는 **Service Mesh (Istio / Linkerd)** — 17 의 mTLS / NetworkPolicy 결정 (#10 in [19](19-improvements.md)) 와 13 의 mTLS 학습이 만나는 지점
