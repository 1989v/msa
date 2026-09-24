# Spring — 커버리지 체크리스트

원천:
- `study/docs/5-spring-transactional/` 99-concept-catalog(§1-A 갭 24개 · §2 A~J) + 본문 01~14 (프록시 · 롤백 규칙 · 자기 호출 · 전파 7종 · 격리 · readOnly · 복제본 라우팅 · 클래스 레벨 함정 · 외부 IO 분리 · TransactionTemplate · msa 매핑 · 아웃박스/사가)
- `study/docs/17-spring-web/` 99-concept-catalog(§1-A 갭 44개 · §2 A~J) + 본문 01~19 (HTTP 파이프라인 · 필터/인터셉터/AOP · DispatcherServlet · MVC vs WebFlux · 서블릿 필터 · 보안 필터 체인 · 인터셉터 · AOP · Jackson 5편 · gzip 3편 · 게이트웨이 필터 · 공통 패턴)
- `docs/conventions/transactional-usage.md` 규칙 1~5 (readOnly 남용 · 외부 IO 분리 · 중첩 catch · 클래스 레벨 · 도메인별 TM 한정자)
- `docs/architecture/common-features.md` (자동 구성 · 조건부 빈 · AutoConfiguration.imports · 프로퍼티 설계)
- 분야 표준: Spring Framework 레퍼런스 목차(Core — IoC · Beans · AOP / Data Access — Transactions / Web MVC · WebFlux / Integration — Scheduling · Cache / Testing), Spring Boot 레퍼런스(외부 설정 · 프로파일 · 자동 구성 · Actuator · 우아한 종료 · 테스트 슬라이스), Spring Data JPA 레퍼런스(저장소 · 쿼리 메서드 · 페이징 · 프로젝션 · 감사), Spring Batch 레퍼런스(Job · Step · Chunk · Tasklet)
- 레포 코드 grep (`@Transactional(` · `TransactionTemplate` · `OncePerRequestFilter` · `HandlerMethodArgumentResolver` · `@RestControllerAdvice` · `@ConditionalOn*` · `GlobalFilter` · `JobBuilder` · `@DynamicPropertySource` 등)

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| spring | Spring (Spring Framework) | 분야 표준 | placed |
| spring-container | 빈 구성과 의존성 주입 | 분야 표준 (Core — IoC Container) | placed |
| spring-ioc-container | IoC 컨테이너 (IoC container) | 분야 표준 (Core — IoC Container) | placed |
| spring-dependency-injection | 의존성 주입 (dependency injection) | 분야 표준 (Core — Dependencies) | placed |
| spring-constructor-injection | 생성자 주입 (constructor injection) | 분야 표준 · code-convention DI 방향 | placed |
| spring-field-injection | 필드 · 세터 주입 (field injection) | 분야 표준 | placed |
| spring-component-scan | 컴포넌트 스캔 (component scan) | common-features 사용법(scanBasePackages) · 분야 표준 | placed |
| spring-java-config | 자바 설정 (@Configuration · @Bean) (Java config) | 분야 표준 (Java-based Configuration) | placed |
| spring-bean-selection | 빈 선택 (@Primary · @Qualifier · ObjectProvider) (@Primary) | transactional-usage 규칙 5 · 분야 표준 | placed |
| spring-bean-lifecycle | 빈 생명주기 (bean lifecycle) | 분야 표준 (Bean lifecycle) | placed |
| spring-lifecycle-callback | 초기화 · 소멸 콜백 (@PostConstruct) | 분야 표준 | placed |
| spring-bean-post-processor | 빈 후처리기 (BeanPostProcessor) | study/5 01(프록시 생성 시점) · 분야 표준 | placed |
| spring-smart-lifecycle | SmartLifecycle (Lifecycle) | 분야 표준 | placed |
| spring-startup-runner | 기동 후 실행기 (ApplicationRunner) | 분야 표준 | placed |
| spring-bean-scope | 빈 스코프 (bean scope) | 분야 표준 (Bean Scopes) | placed |
| spring-request-context-holder | RequestContextHolder | study/17 99 §1-A 37 | excluded — 내부 ThreadLocal 보관 클래스라 개념이 아니다 — ThreadLocal 은 owned by concurrency (conc-thread-local) |
| spring-application-event | 애플리케이션 이벤트 (ApplicationEventPublisher) | study/5 09 §4 · 분야 표준 | placed |
| spring-framework | Spring Framework (Spring Core) | 분야 표준 | placed |
| spring-circular-dependency | 순환 의존 (circular dependency) | 분야 표준 | placed |
| spring-ambiguous-bean | 빈 후보 충돌 (NoUniqueBeanDefinitionException) | 분야 표준 | placed |
| spring-singleton-mutable-state | 싱글톤 빈의 가변 상태 | 분야 표준 | placed |
| spring-scope-mismatch | 스코프 불일치 (scoped proxy) | 분야 표준 | placed |
| spring-component-scan-miss | 스캔 누락 | 레포 사고(폴드 도메인 스캔 누락) · common-features | placed |
| spring-configuration | 설정과 자동 구성 | common-features · 분야 표준 (Boot — Externalized Configuration) | placed |
| spring-externalized-config | 외부 설정 (externalized configuration) | 분야 표준 (Externalized Configuration) | placed |
| spring-value-injection | @Value 주입 (@Value) | 분야 표준 | placed |
| spring-configuration-properties | @ConfigurationProperties (type-safe configuration properties) | common-features Step 2 · 분야 표준 | placed |
| spring-profile | 프로파일 (@Profile) | 분야 표준 (Profiles) | placed |
| spring-auto-configuration | 자동 구성 (auto-configuration) | common-features Step 1·3 · study/17 99 §1-A 20 | placed |
| spring-conditional-bean | 조건부 빈 (@Conditional) | common-features 필수 어노테이션 표 | placed |
| spring-conditional-on-web-application | @ConditionalOnWebApplication | common-features 주의 사항 | excluded — 조건부 빈(spring-conditional-bean)의 조건 한 종류라 따로 세우지 않는다 |
| spring-builder-clone | WebClient 빌더 clone 패턴 | common-features 주의 사항 | excluded — 공용 빌더 사용 규칙이라 개념이 아니다 — spring-webclient 설명에 둔다 |
| spring-condition-report | 조건 평가 보고서 (ConditionEvaluationReport) | 분야 표준 (Boot — Auto-configuration report) | placed |
| spring-autoconfig-backoff | 자동 구성 뜻밖의 양보 | study/17 09 §5(ObjectMapper 두 벌) · common-features 주의 사항 | placed |
| spring-cross-cutting | 횡단 관심사 분리 (AOP) | study/17 08 · study/5 01 | placed |
| spring-aop | Spring AOP (AOP) | study/17 08 §1 · study/5 01 §1 | placed |
| spring-jdk-dynamic-proxy | JDK 동적 프록시 (JDK dynamic proxy) | study/17 08 §2 · study/5 01 §2 | placed |
| spring-cglib-proxy | CGLIB 프록시 (CGLIB) | study/17 08 §2 · study/5 01 §2 | placed |
| spring-aspectj-weaving | AspectJ 위빙 (AspectJ) | study/17 08 §6 | placed |
| spring-self-invocation | 자기 호출 (self-invocation) (self-invocation) | study/5 03 · study/17 08 §3 | placed |
| spring-final-class-proxy | final 에 막힌 프록시 | study/5 99 §2-C · study/5 00-preview Kotlin 함정 | placed |
| lang-all-open-plugin | kotlin-spring(all-open) 플러그인 | study/5 00-preview Kotlin 함정 | excluded — owned by language (lang-all-open-plugin) — MITIGATES 로 잇는다 |
| spring-transaction | 트랜잭션 경계 관리 | study/5 00-preview · transactional-usage | placed |
| spring-tx-demarcation | 경계 선언 | study/5 10 | placed |
| spring-declarative-transaction | 선언형 트랜잭션 (@Transactional) (@Transactional) | study/5 01 · study/5 99 §1-A 21 | placed |
| data-isolation-level | 격리 수준 (Isolation 4종) | study/5 05 | excluded — owned by data (data-isolation-level) — USES 로 잇는다 |
| spring-transaction-interceptor | TransactionInterceptor | study/5 99 §1-A 21 | excluded — 선언형 트랜잭션의 구현 클래스라 동의어로 둔다 |
| spring-platform-tm-state-machine | AbstractPlatformTransactionManager 상태 머신 | study/5 99 §1-A 22 | excluded — 프레임워크 내부 구현이라 개념이 아니다 |
| spring-programmatic-transaction | 프로그래밍형 트랜잭션 (TransactionTemplate) (TransactionTemplate) | study/5 10 · study/5 99 §2-D | placed |
| spring-reactive-transaction | 리액티브 · 코루틴 트랜잭션 (TransactionalOperator) | study/5 99 §2-G · study/5 10 §6 | placed |
| spring-transaction-manager | 트랜잭션 매니저 추상화 (PlatformTransactionManager) | study/5 99 §2-B | placed |
| spring-jpa-transaction-manager | JpaTransactionManager | study/5 99 §2-B | placed |
| spring-jta-transaction-manager | JtaTransactionManager (JTA) | study/5 99 §2-H·1-A 13·14 | placed |
| chained-transaction-manager | ChainedTransactionManager | study/5 99 §2-B·H | excluded — 폐기된 라이브러리 클래스(best-effort 1PC)라 벤더 한정 — 개념은 owned by distributed (two-phase-commit·outbox-pattern) |
| transaction-aware-datasource-proxy | TransactionAwareDataSourceProxy | study/5 99 §1-A 4 | excluded — 벤더 한정 어댑터 클래스 |
| two-phase-commit | XA 2단계 커밋 | study/5 99 §1-A 14 | excluded — owned by distributed (two-phase-commit) — USES 로 잇는다 |
| spring-transaction-manager-qualifier | 도메인별 TM 한정자 (@Transactional(transactionManager)) | transactional-usage 규칙 5 | placed |
| spring-class-level-transaction | 클래스 레벨 트랜잭션 과적용 | transactional-usage 규칙 4 · study/5 08 §1 | placed |
| spring-wrong-transaction-manager | 엉뚱한 TM 에 붙은 트랜잭션 | transactional-usage 규칙 5 (deal 클릭 사고) | placed |
| spring-tx-semantics | 전파 · 롤백 규칙 | study/5 04 · study/5 02 | placed |
| spring-propagation | 트랜잭션 전파 (propagation) | study/5 04 · study/5 99 §2-A | placed |
| spring-propagation-required | REQUIRED | study/5 04 §2 | placed |
| spring-propagation-requires-new | REQUIRES_NEW (Propagation.REQUIRES_NEW) | study/5 04 §2·§6 · study/5 99 §3-1 | placed |
| spring-propagation-nested | NESTED (Propagation.NESTED) | study/5 04 §4 · study/5 99 §2-F | placed |
| data-savepoint | JDBC 세이브포인트 | study/5 99 §2-F | excluded — owned by data (data-savepoint) — USES 로 잇는다 |
| spring-propagation-supports | SUPPORTS | study/5 04 §2 | placed |
| spring-propagation-not-supported | NOT_SUPPORTED | study/5 04 §2 | placed |
| spring-propagation-mandatory | MANDATORY (Propagation.MANDATORY) | study/5 04 §2 | placed |
| spring-propagation-never | NEVER | study/5 04 §2 | placed |
| spring-rollback-rule | 롤백 규칙 (rollbackFor) | study/5 02 · study/5 99 §1-A 17 | placed |
| rollback-for-class-name | rollbackForClassName · noRollbackForClassName | study/5 99 §1-A 17 | excluded — 롤백 규칙의 문자열 표기 변형이라 별도 개념이 아니다 |
| spring-readonly-transaction | 읽기 전용 트랜잭션 (@Transactional(readOnly = true)) | study/5 06 · study/5 99 §1-A 16 · transactional-usage 규칙 1 | placed |
| data-read-replica-routing | AbstractRoutingDataSource (읽기 복제본 라우팅) | study/5 07 · study/5 99 §2-I | excluded — owned by data (data-read-replica-routing) — USES 로 잇는다 |
| data-lazy-connection-acquisition | LazyConnectionDataSourceProxy | study/5 07 §3 | excluded — owned by data (data-lazy-connection-acquisition) — USES 로 잇는다 |
| data-dirty-checking | 변경 감지 · flush 모드 | study/5 06 §2 | excluded — owned by data (data-dirty-checking) — USES 로 잇는다 |
| data-replication-lag | 복제 지연으로 인한 read-after-write 불일치 | study/5 07 §8 | excluded — owned by data (data-replication-lag) |
| spring-unexpected-rollback | UnexpectedRollbackException (rollback-only) | transactional-usage 규칙 3 · study/5 08 §2 | placed |
| spring-checked-exception-commit | checked 예외 커밋 | study/5 02 §1 Kotlin 함의 | placed |
| spring-readonly-silent-write | 읽기 전용 안의 조용한 쓰기 누락 | study/5 06 §6 | placed |
| spring-tx-resources | 커넥션과 커밋 후 처리 | study/5 09 · transactional-usage 규칙 2 | placed |
| spring-transaction-synchronization | 트랜잭션 동기화 (TransactionSynchronizationManager) | study/5 99 §2-E·1-A 5·18 | placed |
| spring-transactional-event-listener | @TransactionalEventListener (TransactionPhase) | study/5 09 §4 · study/5 99 §1-A 6 | placed |
| outbox-pattern | 아웃박스 패턴 | study/5 09 §3 · study/5 12 | excluded — owned by distributed (outbox-pattern) — ALTERNATIVE_TO 로 잇는다 |
| saga-pattern | 사가 (Choreography · Orchestration) | study/5 09 §5 · study/5 12 §4 | excluded — owned by distributed (saga-pattern) |
| cdc | CDC (binlog → Kafka) | study/5 99 §2-H | excluded — owned by messaging |
| idempotency | 멱등 소비자 (ADR-0012) | study/5 11 §4 | excluded — owned by distributed (idempotency) |
| spring-transactional-service-split | 트랜잭션 서비스 분리 | transactional-usage 규칙 2 · study/5 09 §2 | placed |
| spring-external-io-in-transaction | 트랜잭션 안의 외부 호출 | transactional-usage 규칙 2 · study/5 09 §1 | placed |
| data-long-transaction | long-running 트랜잭션 · MDL 충돌 | study/5 99 §1-A 24 | excluded — owned by data (data-long-transaction·data-metadata-lock) — CAUSES 로 잇는다 |
| data-connection-leak-detection | HikariCP 누수 탐지 (leakDetectionThreshold) | study/5 99 §2-J | excluded — owned by data (data-connection-leak-detection) |
| conc-virtual-thread | 가상 스레드 + @Transactional | study/5 99 §1-A 18 · §3-8 | excluded — owned by concurrency (conc-virtual-thread) |
| spring-transaction-duration | 트랜잭션 보유 시간 (connection hold time) | study/5 99 §1-A 23 | placed |
| spring-data-access | 데이터 접근 (Spring Data) | 분야 표준 (Spring Data JPA 레퍼런스) | placed |
| spring-data-repository | Spring Data 저장소 (Repository) | 분야 표준 (Spring Data — Repositories) | placed |
| data-persistence-context | 영속성 컨텍스트 | study/5 06 §3 | excluded — owned by data (data-persistence-context) — USES 로 잇는다 |
| data-lazy-loading | 지연 로딩 | transactional-usage 규칙 1 | excluded — owned by data (data-lazy-loading) |
| data-fetch-join | @EntityGraph · 페치 조인 | 분야 표준 | excluded — owned by data (data-fetch-join) |
| n-plus-one | N+1 쿼리 | 분야 표준 | excluded — owned by data (n-plus-one) |
| pessimistic-lock | @Lock · @Version | study/5 05 §6 | excluded — owned by data (pessimistic-lock·optimistic-lock) |
| spring-derived-query | 메서드 이름 쿼리 (derived query) | 분야 표준 (Query Methods) | placed |
| spring-query-annotation | @Query | 분야 표준 (@Query) | placed |
| spring-modifying-query | @Modifying 벌크 쿼리 (@Modifying) | 분야 표준 (Modifying Queries) · transactional-usage 규칙 5 | placed |
| spring-paging | 페이징 (Pageable) | 분야 표준 (Paging and Sorting) | placed |
| spring-projection | 프로젝션 (projection) | 분야 표준 (Projections) | placed |
| spring-jpa-auditing | JPA 감사 (Auditing) (@EnableJpaAuditing) | 분야 표준 (Auditing) | placed |
| spring-multi-datasource-config | 도메인별 DataSource · EMF 구성 (@EnableJpaRepositories) | study/5 11 §5 · transactional-usage 규칙 5 | placed |
| spring-open-session-in-view | Open Session In View (OSIV) | 분야 표준 (Boot — spring.jpa.open-in-view) | placed |
| spring-cache-abstraction | 캐시 추상화 (@Cacheable) (@Cacheable) | 분야 표준 (Cache Abstraction) | placed |
| spring-bulk-update-stale-context | 벌크 쓰기 뒤 낡은 영속성 컨텍스트 | 분야 표준 | placed |
| spring-data-jpa | Spring Data JPA | 분야 표준 | placed |
| spring-web-mvc | 요청 처리 (Spring Web MVC) | study/17 01 · study/17 03 | placed |
| spring-servlet-container | 서블릿 컨테이너 (Servlet container) | study/17 01 §2-② · study/17 99 §2-I | placed |
| servlet-container-choice | Tomcat · Jetty · Undertow · Reactor Netty 비교 | study/17 99 §1-A 31 | excluded — 제품 선택 비교라 개념이 아니다 — Reactor Netty 는 owned by concurrency (reactor-netty) |
| spring-virtual-thread-executor | VirtualThreadTaskExecutor · Tomcat 가상 스레드 | study/17 99 §2-G | excluded — owned by concurrency (conc-virtual-thread) |
| http2-tomcat | HTTP/2 on Tomcat · HTTP/3 | study/17 99 §1-A 9·10 | excluded — owned by network |
| spring-servlet-filter | 서블릿 필터 (Filter) | study/17 05 · study/17 99 §2-A | placed |
| spring-security | Spring Security 필터 체인 · DelegatingFilterProxy | study/17 06 | excluded — owned by security (spring-security) |
| method-security | 메서드 보안 (@PreAuthorize) | study/17 99 §1-A 38 | excluded — owned by security |
| cors | CORS 설정 | study/17 99 §1-A 19 | excluded — owned by security (cors) |
| csrf | CSRF 토큰 | study/17 99 §1-A 20 | excluded — owned by security (csrf) |
| spring-dispatcher-servlet | DispatcherServlet (front controller) | study/17 03 | placed |
| spring-handler-mapping | HandlerMapping (RequestMappingHandlerMapping) | study/17 03 §3 | placed |
| spring-handler-adapter | HandlerAdapter (RequestMappingHandlerAdapter) | study/17 03 §3·§4 · study/17 99 §1-A 3 | placed |
| spring-handler-interceptor | HandlerInterceptor (interceptor) | study/17 07 · study/17 02 | placed |
| spring-annotated-controller | 애너테이션 컨트롤러 (@RestController) | study/17 99 §2-F · 분야 표준 | placed |
| spring-argument-resolver | ArgumentResolver (HandlerMethodArgumentResolver) | study/17 03 §4 · study/17 99 §1-A 2 | placed |
| spring-message-converter | HttpMessageConverter | study/17 99 §1-A 5 · §2-D | placed |
| jackson-object-mapper | ObjectMapper 설정 · 모듈 · 직렬화기 · MixIn · 다형 타입 | study/17 09~13 | excluded — owned by language (serialization 하위 개념) — USES 로 잇는다 |
| sec-insecure-deserialization | Jackson Default Typing 가젯 체인 | study/17 12 | excluded — owned by security (sec-insecure-deserialization) |
| spring-content-negotiation | 콘텐츠 협상 (content negotiation) | study/17 99 §1-A 6 | placed |
| spring-response-body-advice | ResponseBodyAdvice | study/17 99 §1-A 4 · study/17 18 §6 | placed |
| spring-exception-handler | 전역 예외 처리 (@RestControllerAdvice) | study/17 03 §5 · study/17 99 §2-C | placed |
| locale-theme-resolver | LocaleResolver · ThemeResolver | study/17 99 §1-A 27·28 | excluded — 뷰 렌더링용 설정값이고 ThemeResolver 는 폐기됐다 |
| multipart-resolver | MultipartResolver · 정적 리소스 핸들러 | study/17 99 §1-A 29·30 | excluded — 업로드·정적 파일 설정값이라 개념이 아니다 |
| spring-bean-validation | Bean Validation (@Valid) | study/17 99 §1-A 25·26 | placed |
| spring-async-request | 비동기 요청 처리 (DeferredResult) | study/17 99 §1-A 7 · §2-G | placed |
| sse | Server-Sent Events | study/17 99 §1-A 12 | excluded — owned by network (sse) — USES 로 잇는다 |
| websocket-stomp | WebSocket · STOMP | study/17 99 §1-A 11 | excluded — owned by network (websocket) |
| web-async-configurer | WebAsyncSupportConfigurer | study/17 99 §2-G | excluded — 벤더 한정 설정 클래스 |
| spring-http-client | HTTP 클라이언트 | study/17 99 §2-F | placed |
| spring-rest-template | RestTemplate | study/17 99 §1-A 15 | placed |
| spring-rest-client | RestClient | study/17 99 §1-A 16 | placed |
| spring-webclient | WebClient | study/17 99 §1-A 15 · common-features WebClient | placed |
| spring-http-interface | HTTP interface 클라이언트 (@HttpExchange) | study/17 99 §1-A 17 | placed |
| spring-filter-exception-escape | 필터 예외의 처리 누락 | study/17 06 §7 · study/17 02 §7 | placed |
| http-compression | gzip · brotli · zstd 압축과 위치 | study/17 14 | excluded — owned by network |
| vary-cache | Vary · ETag · Cache-Control 조건부 요청 | study/17 15 · study/17 99 §1-A 22·23 | excluded — owned by network (HTTP 캐싱) |
| breach-crime | BREACH · CRIME 압축 공격 | study/17 16 | excluded — owned by security |
| spring-webmvc | Spring Web MVC (spring-boot-starter-web) | 분야 표준 | placed |
| spring-reactive-web | 리액티브 웹 (WebFlux · Gateway) | study/17 04 | placed |
| spring-dispatcher-handler | DispatcherHandler (WebFlux) | study/17 04 · study/17 99 §1-A 14 | placed |
| spring-functional-endpoint | 함수형 엔드포인트 (RouterFunction) | study/17 99 §1-A 13 | placed |
| spring-web-filter | WebFilter | study/17 04 §2 · study/17 99 §1-A 14 | placed |
| spring-gateway-route | 게이트웨이 라우트 (route) | study/17 17 · study/17 99 §1-A 40 | placed |
| spring-cloud-gateway | Spring Cloud Gateway | study/17 17 | excluded — owned by network (spring-cloud-gateway) — USES 로 잇는다 |
| rate-limiting | 게이트웨이 레이트 리미터 | study/17 17 §2.5 | excluded — owned by security (rate-limiting) |
| spring-gateway-filter | 게이트웨이 필터 (GlobalFilter) | study/17 17 §2 · study/17 04 §3 | placed |
| spring-reactor-context-loss | 리액터에서 끊기는 ThreadLocal | study/17 18 §5 · study/5 10 §6 | placed |
| conc-mdc-propagation | trace ID · MDC 전파 | study/17 18 §5 · study/17 99 §1-A 36 | excluded — owned by observability·concurrency (conc-mdc-propagation) |
| spring-execution | 스케줄 · 비동기 · 배치 실행 | 분야 표준 (Task Execution and Scheduling · Spring Batch) | placed |
| spring-scheduling | 스케줄링 (@Scheduled) (@Scheduled) | 분야 표준 (Scheduling) | placed |
| spring-async-method | 비동기 메서드 (@Async) (@Async) | study/17 99 §2-G | placed |
| spring-batch-job | 배치 잡 (Job) | 분야 표준 (Spring Batch) | placed |
| spring-chunk-processing | 청크 처리 (chunk-oriented processing) | 분야 표준 (Spring Batch) | placed |
| spring-tasklet | Tasklet | 분야 표준 (Spring Batch) | placed |
| spring-duplicate-schedule | 레플리카 중복 실행 | study/5 13 §5(멀티 레플리카 안전화) · 분야 표준 | placed |
| spring-batch | Spring Batch | 분야 표준 | placed |
| spring-operations | 운영 노출 (Actuator) | study/17 99 §1-A 33 · §2-J | placed |
| spring-actuator-endpoint | Actuator 엔드포인트 (/actuator) | study/17 99 §2-J | placed |
| spring-health-indicator | HealthIndicator | 분야 표준 (Actuator — Health) | placed |
| spring-custom-endpoint | 사용자 정의 엔드포인트 (@Endpoint) | study/17 99 §2-J | placed |
| micrometer-observation | Micrometer · ObservationRegistry · Micrometer Tracing | study/17 99 §1-A 34~36 | excluded — owned by observability |
| spring-graceful-shutdown | 우아한 종료 (server.shutdown=graceful) | 분야 표준 (Boot — Graceful Shutdown) | placed |
| spring-actuator-exposure | 운영 엔드포인트 노출 | 분야 표준 (Actuator — Security) | placed |
| spring-boot-actuator | Spring Boot Actuator | 분야 표준 | placed |
| rt-aot-compilation | GraalVM Native Image · Spring AOT | study/17 99 §1-A 32 | excluded — owned by runtime (rt-aot-compilation) |
| spring-testing | 스프링 테스트 | 분야 표준 (Spring TestContext · Boot Testing) | placed |
| spring-test-context | 스프링 통합 테스트 컨텍스트 (@SpringBootTest) | 분야 표준 | placed |
| spring-test-slice | 테스트 슬라이스 (@WebMvcTest) | 분야 표준 (Test slices) | placed |
| spring-mockmvc | MockMvc | 분야 표준 | placed |
| spring-webtestclient | WebTestClient | 분야 표준 | placed |
| spring-dynamic-property | @DynamicPropertySource | 분야 표준 | placed |
| spring-test-bean-override | 테스트 빈 교체 (@TestConfiguration) | 분야 표준 | placed |
| spring-context-cache-miss | 테스트 컨텍스트 캐시 깨짐 | 분야 표준 | placed |
| spring-boot | Spring Boot | CLAUDE.md · architecture.yaml | excluded — owned by architecture (spring-boot) — USES 로 잇는다 |
| spring-kafka | @KafkaListener · KafkaTemplate | 분야 표준 | excluded — owned by messaging (spring-kafka) |
| net-api-spec | springdoc OpenAPI | 레포 의존성 | excluded — owned by network (net-api-spec) |
| spring-glossary | Spring 용어 사전 (glossary) | 분야 표준 | placed |
| spring-glossary-container | 컨테이너 용어 | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-bean | 빈 (bean) | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-bean-definition | 빈 정의 (BeanDefinition) | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-application-context | ApplicationContext (application context) | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-stereotype-annotation | 스테레오타입 애너테이션 (@Component) | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-property-source | PropertySource (property source) | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-starter | 스타터 (starter) | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-glossary-aop | AOP 용어 | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-aspect | 애스펙트 (aspect) | study/17 08 §4 | placed |
| spring-term-advice | 어드바이스 (advice) | study/17 08 §4 | placed |
| spring-term-pointcut | 포인트컷 (pointcut) | study/17 08 §4 | placed |
| spring-term-join-point | 조인 포인트 (join point) | study/17 08 §4 | placed |
| spring-term-advisor | 어드바이저 (advisor) | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-weaving | 위빙 (weaving) | study/17 08 §6 | placed |
| spring-term-proxy-target | 타깃 객체 (target object) | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-glossary-transaction | 트랜잭션 용어 | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-transaction-attribute | 트랜잭션 속성 (TransactionDefinition) | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-physical-logical-transaction | 물리 · 논리 트랜잭션 (physical transaction) | study/5 04 · 분야 표준 | placed |
| spring-term-rollback-only | rollback-only 표시 (rollback-only) | study/5 08 §2 | placed |
| spring-term-transaction-timeout | 트랜잭션 타임아웃 (timeout) | study/5 99 §1 · §1-A 20 | placed |
| spring-glossary-web | 웹 용어 | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-servlet | 서블릿 (Servlet) | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-handler | 핸들러 (handler) | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-builtin-filters | 기본 제공 필터 (ForwardedHeaderFilter) | study/17 99 §1-A 41·42·44 · §2-A | placed |
| spring-term-problem-detail | ProblemDetail (Problem Details) | study/17 99 §1-A 1 · §2-C | placed |
| spring-term-response-entity | ResponseEntity | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-glossary-data | 데이터 · 배치 용어 | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-page-slice | Page · Slice (Page) | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
| spring-term-job-repository | JobRepository | 분야 표준 (Spring Framework·Boot 레퍼런스) | placed |
