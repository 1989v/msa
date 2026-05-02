---
id: 17
title: Spring Web 처리 심화 — Filter · Interceptor · AOP · Jackson · gzip
status: completed
created: 2026-05-01
updated: 2026-05-02
tags: [spring, filter-chain, interceptor, aop, jackson, gzip, http-pipeline, security]
difficulty: intermediate
estimated-hours: 14
codebase-relevant: true
---

# Spring Web 처리 심화

## 1. 개요

Spring 의 HTTP 요청-응답 파이프라인 (Servlet Filter → DispatcherServlet → HandlerInterceptor → @Controller → ResponseBodyAdvice → MessageConverter → 압축) 전반을 학습한다. Filter/Interceptor/AOP 의 차이, Spring Security FilterChainProxy, Jackson 직렬화 커스터마이징, HTTP gzip 압축까지 묶어 다룬다.

원본 17 의 5개 항목 중 17-1(readOnly Transactional) 은 #5 에 흡수, 17-3(스레드 덤프) 은 #3 에 흡수 → 남은 17-2/17-4/17-5 를 "HTTP 파이프라인" 우산으로 통합.

## 2. 학습 목표

- Servlet Filter ↔ Spring HandlerInterceptor ↔ Spring AOP 3 layer 의 실행 순서/위치 그림으로 설명
- Spring Security FilterChainProxy 와 일반 Filter 의 관계 (DelegatingFilterProxy)
- AOP 종류 (proxy-based, AspectJ load-time/compile-time) 와 self-invocation 한계
- Jackson 의 ObjectMapper 동작 (Module, MixIn, JsonSerializer/Deserializer, polymorphic, snake_case)
- Jackson 보안 이슈 (default typing, gadget chain) 와 안전 패턴
- HTTP gzip 압축의 layer (servlet/Spring/reverse proxy) 선택 기준과 측정
- BREACH 공격 위험과 대응
- 면접에서 "Filter 와 Interceptor 차이?" "@AOP 가 안 먹는 경우는?" 답변

## 3. 선수 지식

- Servlet API 기본
- Spring MVC DispatcherServlet 흐름
- 프록시 패턴 / 데코레이터 패턴

## 4. 학습 로드맵

### Phase 1: 기본 개념
- HTTP 요청 파이프라인 그림 (Browser → Reverse Proxy → Tomcat → Filter chain → DispatcherServlet → HandlerMapping → Interceptor.preHandle → Controller → Interceptor.postHandle → ResponseBodyAdvice → MessageConverter → Filter chain (response) → Reverse Proxy → Browser)
- Filter / Interceptor / AOP 가 각각 어디 위치하는가
- ServletRequest 가 Spring HandlerMapping 에 도달하기 전 vs 후

### Phase 2: 심화
- **Servlet Filter**
  - `jakarta.servlet.Filter` 인터페이스
  - `@Order` / `FilterRegistrationBean` 으로 순서 제어
  - DispatcherServlet 진입 *전* 동작 → Spring DI 일부 제약 (lazy bean)
  - 활용: 인증, 로깅, CORS, request body 로깅 (caching wrapper 필요)
- **Spring Security FilterChainProxy**
  - DelegatingFilterProxy → FilterChainProxy → SecurityFilterChain
  - SecurityFilter 들 (AuthenticationFilter, AuthorizationFilter, CsrfFilter, ...)
  - 일반 Filter chain 안의 한 Filter 로 박혀 있는 구조
- **HandlerInterceptor**
  - `preHandle` / `postHandle` / `afterCompletion`
  - HandlerMapping 매칭 *후* 동작 → Handler/HandlerMethod 정보 접근 가능
  - `WebMvcConfigurer.addInterceptors`
  - Filter 와의 차이: Spring 빈 주입 자유, exception 발생 위치, request/response wrapping 가능 여부
- **AOP**
  - Spring AOP (proxy-based): JDK Dynamic Proxy (인터페이스) vs CGLIB (클래스)
  - self-invocation 미동작 문제 (#5 와 동일)
  - AspectJ load-time/compile-time weaving
  - `@Aspect`, Pointcut expression, Advice 종류 (Before/After/Around/AfterReturning/AfterThrowing)
  - Filter/Interceptor 와의 비교: Method 단위 cross-cutting (logging, timing, audit, retry)
- **Jackson 심화 (17-4)**
  - ObjectMapper lifecycle, thread-safety, 비싼 객체 → 싱글톤
  - `@JsonProperty`, `@JsonIgnore`, `@JsonInclude`, `@JsonCreator`, `@JsonFormat`
  - Module 시스템 (kotlin-module, jsr310 module)
  - MixIn (소유 안 하는 클래스 직렬화 커스터마이징)
  - Custom JsonSerializer / JsonDeserializer
  - Polymorphic serialization: `@JsonTypeInfo`, `@JsonSubTypes`
  - **보안: Default Typing 의 위험** (CVE-2017-7525 등 gadget chain) → `activateDefaultTyping` 절대 금지, allow-list 사용
  - snake_case 변환 (`PropertyNamingStrategies.SNAKE_CASE`), `spring.jackson.property-naming-strategy`
  - `@JsonView` 로 응답별 필드 노출 제어
  - 성능: Afterburner / Blackbird module
  - Kotlin null-safety (`KotlinModule(strictNullChecks=true)`)
- **HTTP gzip 압축 (17-5)**
  - 압축 layer 선택지: Tomcat (`server.compression.enabled=true`), Spring Boot 자동, Reverse Proxy (Nginx/Envoy/CloudFront), Application 직접
  - 어디서 압축할지 의사결정: CPU 비용 vs 네트워크 비용, mTLS terminate 위치
  - 압축 알고리즘 비교: gzip / deflate / brotli (Accept-Encoding 협상)
  - **압축하면 안 되는 것**: 이미 압축된 컨텐츠 (image/jpeg, video, gzipped json), 작은 응답 (< 1KB 무의미), TLS+gzip → BREACH 공격 (민감 데이터 응답 압축 주의)
  - `Accept-Encoding` ↔ `Content-Encoding` ↔ `Vary: Accept-Encoding` 캐시 정합성
  - 측정: 응답 크기 절감 vs CPU 사용 증가 (Prometheus + 부하 시험)

### Phase 3: 실전 적용
- msa **gateway** Filter chain 분석 (인증, Rate Limiting, 로깅 위치)
- 각 서비스의 HandlerInterceptor 사용처
- common 의 AOP (logging, timing) — `@Around` 로 외부 API 호출 latency 자동 측정
- ObjectMapper 설정 통일 (common/auto-config) → snake_case, kotlin module, jsr310 module
- gzip 활성화 위치 결정: K8s ingress(Nginx) 에서 할지 Spring Boot 에서 할지
- BREACH 위험 점검 (인증 토큰 응답 body 노출 + gzip 활성)
- HandlerInterceptor 로 trace id 주입 패턴

### Phase 4: 면접 대비
- "Filter 와 Interceptor 의 차이는? 언제 어떤 걸 쓰나요?"
- "Spring Security 의 Filter 는 일반 Filter 와 어떻게 결합되나요?"
- "AOP 가 안 먹는 경우는?"
- "ObjectMapper 가 thread-safe 한가요? 왜 싱글톤?"
- "Jackson Default Typing 이 왜 위험한가요?"
- "HTTP gzip 을 어디서 켜는 게 맞나요? 늘 켜야 하나요?"
- "BREACH 공격이 뭔가요? 대응책은?"
- "snake_case API 를 카멜케이스 모델로 받으려면 어떻게 설정하나요?"

## 5. 코드베이스 연관성

- **gateway**: Spring Cloud Gateway Filter (WebFlux 기반)
- **common**: 공통 AOP, ObjectMapper config
- **각 서비스**: HandlerInterceptor 사용처
- **K8s ingress-nginx**: gzip 설정 위치
- **ADR 후보**: "응답 압축 위치 표준화"

## 6. 참고 자료

- Spring Reference (MVC, Security, AOP)
- "Spring in Action" Filter/Interceptor 챕터
- Jackson 공식 wiki (특히 보안 관련)
- "BREACH: Reviving the CRIME attack" 논문
- Mozilla Web Security Guidelines (compression)

## 7. 미결 사항

- 17 묶음의 적정 깊이 (5개 sub-topic 깊이 균형)
- BREACH 실습 포함 여부
- WebFlux 의 Filter 모델 (WebFilter) 까지 다룰지

## 8. 원본 메모

```
17. spring
  17-1. Transactional(readonly, writable)  → #5 에 흡수
  17-2. spring filter chain, intercept, aop
  17-3. 스레드 덤프, 분석                   → #3 에 흡수
  17-4. jackson
  17-5. gzip
```
