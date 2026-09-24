# 동시성 — 커버리지 체크리스트

원천:
- study/docs/3-java-kotlin-concurrency/ — 99-concept-catalog.md(§1-A 갭 30개 · §2 A~K 표) + 본문 노트 01~25 (카탈로그 = 이 카탈로그, 카탈로그 X(16) = 16번 카탈로그)
- study/docs/16-async-nonblocking-io/ — 99-concept-catalog.md(§1-A 갭 33개 · §2 A~J 표) + 본문 노트 01~20
- 볼트 claude/artifact/system-resources-cheatsheet.md §06(epoll · 시스템 콜)
- 분야 표준 — Java Concurrency in Practice(Goetz) · JLS 17장(JMM) · java.util.concurrent 패키지 목차 · Kotlin Coroutines 가이드 · Reactive Streams 명세 · Linux man pages(select/poll/epoll/io_uring) · Doug Lea 'Scalable IO in Java'
- 레포 코드 — quant · chatbot · gateway · recommendation · ads · agent-viewer 의 동시성 사용처(grep 확인)

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| concurrent-programming | 동시성 (concurrency) | study/3 개요 · study/16 개요 | placed |
| conc-execution-model | 실행 단위 구성 | study/3 §01·§07 · study/16 §01 | placed |
| thread | 스레드 (thread) | study/3 §01 · 카탈로그 E | placed |
| conc-thread-interruption | 인터럽트 (interrupt) | study/3 §01 · 분야 표준(JCIP 7장) | placed |
| conc-thread-factory | ThreadFactory | study/3 §01 · 카탈로그 E(ThreadFactory·UncaughtExceptionHandler) | placed |
| thread-pool | 스레드 풀 (thread pool) | study/3 §07 · 카탈로그 E | placed |
| conc-pool-sizing | 풀 크기 산정 (pool sizing) | study/3 §07 · 분야 표준(JCIP 8장) | placed |
| conc-rejection-policy | 거절 정책 (RejectedExecutionHandler) | study/3 §07 | placed |
| conc-scheduled-executor | 예약 실행기 (ScheduledExecutorService) | study/3 §07 · 카탈로그 E | placed |
| conc-graceful-shutdown | 풀 종료 (graceful shutdown) | study/3 §07 | placed |
| conc-fork-join-pool | ForkJoinPool | study/3 §07 · 카탈로그 E | placed |
| conc-work-stealing | 워크 스틸링 (work stealing) | study/3 §07 · 카탈로그 1-A #27 | placed |
| conc-common-pool-saturation | 공용 풀 점유 (commonPool starvation) | study/3 §13·§20 | placed |
| conc-virtual-thread | 가상 스레드 (virtual thread) | study/3 §17·§25 · study/16 §13 · 카탈로그 F | placed |
| conc-structured-task-scope | StructuredTaskScope (Structured Concurrency) | study/3 §25 · 카탈로그 G | placed |
| conc-vt-pinning | 가상 스레드 피닝 (pinning) | study/3 §17·§25 · 카탈로그 C·F | placed |
| coroutine | 코루틴 (coroutine) | study/3 §14 · 카탈로그 I | placed |
| kotlinx-coroutines | kotlinx.coroutines (Kotlin Coroutines) | study/3 §14 · 레포(gradle/libs.versions.toml) | placed |
| conc-resource-exhaustion | 자원 고갈 (resource exhaustion) | study/3 §20 · study/16 §01 | placed |
| conc-throughput | 처리량 (throughput) | study/16 §12 · 분야 표준 | placed |
| conc-pool-queue-depth | 풀 대기열 길이 (queue size) | study/3 §07(풀 모니터링) | placed |
| conc-thread-group | ThreadGroup | study/3 §01 | excluded — 레거시 API 라 쓰지 않는다(노트도 '무시해도 되는 레거시'로 정리) |
| conc-thread-priority | 스레드 우선순위(Thread.priority) | study/3 §01 | excluded — OS 가 무시하기도 하는 힌트 값이라 개념이 아니다(역전은 conc-priority-inversion) |
| conc-async-annotation | @Async | study/3 §22 · 카탈로그 K | excluded — owned by spring (spring-async-method) |
| conc-scheduled-annotation | @Scheduled | study/3 §22·§23 · 카탈로그 K | excluded — owned by spring (spring-scheduling) |
| conc-thread-pool-bulkhead | 스레드 풀 격벽 | study/3 §22 | excluded — owned by distributed (dist-thread-pool-bulkhead) |
| conc-servlet-thread-per-request | 서블릿 컨테이너 요청 스레드 | study/16 §12 | excluded — owned by spring (spring-servlet-container) |
| conc-kafka-listener-concurrency | Kafka 컨슈머 동시성 | study/3 §22·§23 · study/16 §16 | excluded — owned by messaging (msg-consumer-concurrency) |
| conc-memory-model | 메모리 모델 이해 (Java Memory Model) | study/3 §09 · 카탈로그 A | placed |
| conc-volatile | volatile | study/3 §03 · 카탈로그 A | placed |
| conc-memory-barrier | 메모리 배리어 (memory barrier) | 카탈로그 A · 분야 표준(JSR-133 Cookbook) | placed |
| conc-safe-publication | 안전한 공개 (safe publication) | study/3 §09(publication 패턴) · 분야 표준(JCIP 3장) | placed |
| conc-final-field-semantics | final 필드 보장 (final field semantics) | study/3 §09 · 카탈로그 A(JLS 17.5) | placed |
| conc-double-checked-locking | Double-Checked Locking (DCL) | study/3 §02·§03 | placed |
| conc-cache-line-padding | 캐시 라인 패딩 (padding) | study/3 §19 · study/12 §02 | placed |
| conc-visibility-failure | 가시성 결함 (stale read) | study/3 §03 | placed |
| conc-word-tearing | 64비트 찢김 (word tearing) | study/3 §03 · 카탈로그 A(JLS 17.7) | placed |
| conc-unsafe-publication | 불완전 공개 (this escape) | study/3 §09(함정 4) | placed |
| conc-false-sharing | False Sharing (false sharing) | study/3 §19 · study/12 §02 | placed |
| conc-cache-coherence | 캐시 일관성(MESI) | study/3 §19 | excluded — owned by runtime (rt-cache-coherence) |
| conc-cache-line | 캐시 라인 | study/3 §19 · study/12 §02 | excluded — owned by runtime (rt-cache-line) |
| conc-synchronization | 동기화 | study/3 §02·§05 · 카탈로그 C | placed |
| mutex | 뮤텍스 (mutex) | 카탈로그 C · 분야 표준 | placed |
| conc-synchronized | synchronized | study/3 §02·§10 · 카탈로그 C | placed |
| conc-lock-inflation | 락 팽창 (lock inflation) | study/3 §10 | placed |
| conc-reentrant-lock | ReentrantLock | study/3 §05 · 카탈로그 C | placed |
| conc-fair-lock | 공정 락 (fair lock) | study/3 §05 | placed |
| conc-read-write-lock | ReadWriteLock | study/3 §05 · 카탈로그 C | placed |
| conc-stamped-lock | StampedLock | study/3 §12 · 카탈로그 C | placed |
| conc-spin-lock | 스핀 락 (spin lock) | study/3 §04·§10(adaptive spinning) | placed |
| conc-aqs | AQS (AbstractQueuedSynchronizer) | study/3 §05 | placed |
| semaphore | 세마포어 (semaphore) | study/3 §08 · 카탈로그 C | placed |
| atomic-operation | 원자 연산 (atomic operation) | study/3 §04 · 카탈로그 B | placed |
| compare-and-swap | CAS (compare-and-swap) | study/3 §04 · 카탈로그 B | placed |
| conc-long-adder | LongAdder | study/3 §04 · 카탈로그 B·1-A #30 | placed |
| conc-var-handle | VarHandle | 카탈로그 B·1-A #4·#29 | placed |
| conc-atomic-stamped-reference | AtomicStampedReference | study/3 §04 · 카탈로그 B | placed |
| conc-lock-free-algorithm | 락-프리 알고리즘 (lock-free) | study/3 §04 · 분야 표준(Art of Multiprocessor Programming) | placed |
| conc-thread-confinement | 스레드 한정 (thread confinement) | 분야 표준(JCIP 3장) | placed |
| conc-lock-ordering | 락 순서 고정 (lock ordering) | study/3 §20 · 분야 표준(JCIP 10장) | placed |
| race-condition | 레이스 컨디션 (race condition) | study/3 §02 · 분야 표준 | placed |
| deadlock | 데드락 (deadlock) | study/3 §20 · 카탈로그 J | placed |
| conc-livelock | 라이브락 (livelock) | 분야 표준(JCIP 10장) | placed |
| conc-starvation | 기아 (starvation) | study/3 §05(공정성) · 분야 표준 | placed |
| conc-priority-inversion | 우선순위 역전 (priority inversion) | 분야 표준(OS 교재) | placed |
| conc-lock-contention | 락 경합 (lock contention) | study/3 §21 · 카탈로그 1-A #24 | placed |
| conc-aba-problem | ABA 문제 (ABA problem) | study/3 §04 · 카탈로그 B | placed |
| conc-lock-wait-time | 락 대기 시간 (lock wait) | study/3 §21 · 카탈로그 J(JFR) | placed |
| conc-lock-elision | 락 제거 · 락 확장(JIT) | study/3 §10 | excluded — owned by runtime (rt-lock-elision · rt-lock-coarsening) |
| conc-optimistic-lock | 낙관적 락(@Version) | study/3 §22 · 카탈로그 K | excluded — owned by data (optimistic-lock) |
| conc-pessimistic-lock | 비관적 락(@Lock) | study/3 §22 · 카탈로그 K | excluded — owned by data (pessimistic-lock) |
| conc-distributed-lock | Redis 분산 락 | study/3 §22·§23 · 카탈로그 K | excluded — owned by distributed (distributed-lock) |
| conc-linearizability | 선형성 | 분야 표준 | excluded — owned by distributed (dist-linearizability) |
| conc-randomized-backoff | 무작위 백오프(라이브락 해소) | 분야 표준 | excluded — owned by distributed (dist-exponential-backoff) |
| conc-coordination | 스레드 간 조율 | study/3 §08 · 카탈로그 1-A 동기화 게이트 | placed |
| conc-condition-variable | 조건 변수 (condition variable) | study/3 §02·§05 · 카탈로그 C | placed |
| conc-countdown-latch | CountDownLatch | study/3 §08 | placed |
| conc-cyclic-barrier | CyclicBarrier | study/3 §08 | placed |
| conc-phaser | Phaser | study/3 §08 · 카탈로그 1-A #25 | placed |
| conc-exchanger | Exchanger | study/3 §08 · 카탈로그 1-A #26 | placed |
| conc-producer-consumer | 생산자·소비자 (producer-consumer) | study/3 §08 · 분야 표준 | placed |
| conc-spurious-wakeup | 가짜 깨어남 (spurious wakeup) | study/3 §02(while 루프) | placed |
| conc-concurrent-collections | 동시 컬렉션 선택 | study/3 §08·§11 · 카탈로그 D | placed |
| conc-synchronized-collection | 동기화 래퍼 컬렉션 (Collections.synchronizedMap) | study/3 §08 | placed |
| conc-concurrent-hash-map | ConcurrentHashMap | study/3 §08·§11 · 카탈로그 D | placed |
| conc-concurrent-skip-list-map | ConcurrentSkipListMap | study/3 §08 · 카탈로그 D | placed |
| conc-copy-on-write-collection | Copy-On-Write 컬렉션 (CopyOnWriteArrayList) | study/3 §08 · 카탈로그 D | placed |
| conc-concurrent-linked-queue | ConcurrentLinkedQueue | study/3 §08 · 카탈로그 D | placed |
| conc-blocking-queue | BlockingQueue | study/3 §08 · 카탈로그 D | placed |
| conc-array-blocking-queue | ArrayBlockingQueue | 카탈로그 D | placed |
| conc-linked-blocking-queue | LinkedBlockingQueue | 카탈로그 D · study/3 §07 | placed |
| conc-priority-blocking-queue | PriorityBlockingQueue | 카탈로그 D | placed |
| conc-delay-queue | DelayQueue | 카탈로그 D | placed |
| conc-synchronous-queue | SynchronousQueue | 카탈로그 D | placed |
| conc-linked-transfer-queue | LinkedTransferQueue | 카탈로그 D | placed |
| conc-disruptor | Disruptor (LMAX Disruptor) | study/3 §19 · 카탈로그 D | placed |
| conc-concurrent-modification | 순회 중 변경 (ConcurrentModificationException) | study/3 §08 · 분야 표준 | placed |
| conc-async-handling | 비동기 처리 | study/3 §13 · study/16 §03 | placed |
| conc-callback | 콜백 (callback) | study/16 §03 · 분야 표준 | placed |
| conc-callback-hell | 콜백 지옥 (callback hell) | 분야 표준 | placed |
| conc-future | Future | 카탈로그 E | placed |
| conc-completable-future | CompletableFuture | study/3 §13 · 카탈로그 E | placed |
| conc-completion-service | CompletionService (ExecutorCompletionService) | 카탈로그 E·1-A #28 | placed |
| async-await | async/await (async await) | study/3 §14 | placed |
| conc-listenable-future | ListenableFuture(Guava) | 카탈로그 E | excluded — 레포에 없는 벤더 API 이고 개념은 conc-completable-future 가 담는다 |
| conc-jdk-http-client | JDK HttpClient | study/16 §17 · 카탈로그 H(16) | excluded — owned by spring (HTTP 클라이언트 선택은 spring-webclient · spring-rest-client 와 함께) |
| conc-webclient | WebClient | study/16 §17 · 카탈로그 F(16) | excluded — owned by spring (spring-webclient) |
| conc-rest-client | RestClient · RestTemplate · OkHttp | study/16 §17 | excluded — owned by spring (spring-rest-client) |
| conc-coroutine-programming | 코루틴 설계 | study/3 §14·§16 · 카탈로그 I | placed |
| conc-coroutine-scope | CoroutineScope | study/3 §16 · 카탈로그 I | placed |
| conc-supervisor-job | SupervisorJob | study/3 §16 · 카탈로그 I | placed |
| conc-coroutine-dispatcher | 디스패처 (Dispatchers.IO) | study/3 §14 · 카탈로그 I | placed |
| conc-coroutine-cancellation | 코루틴 취소 (cancellation) | study/3 §16 · 카탈로그 I·1-A #17 | placed |
| conc-coroutine-exception-handling | 코루틴 예외 전파 (CoroutineExceptionHandler) | study/3 §16 · 카탈로그 I·1-A #18 | placed |
| conc-cps-transformation | CPS 변환 (continuation-passing style) | study/3 §14·§25 | placed |
| conc-kotlin-flow | Flow (Kotlin Flow) | study/3 §15 · 카탈로그 I·1-A #13 | placed |
| conc-shared-flow | SharedFlow | study/3 §15 · 카탈로그 I | placed |
| conc-state-flow | StateFlow | study/3 §15 · 카탈로그 I | placed |
| conc-coroutine-channel | Channel | study/3 §15 · 카탈로그 I·1-A #16 | placed |
| conc-channel-fan-pattern | 팬아웃 · 팬인 · 파이프라인 (fan-out) | study/3 §15 · 카탈로그 I | placed |
| conc-run-blocking | runBlocking | study/3 §22(WebSocket runBlocking) | placed |
| conc-coroutine-leak | 코루틴 누수 (coroutine leak) | study/3 §16 · 분야 표준 | placed |
| conc-blocking-in-coroutine | 코루틴 안 블로킹 (blocking call in coroutine) | study/3 §25(Dispatcher 함정) | placed |
| conc-reactive-programming | 리액티브 스트림 처리 | study/16 §10·§20 | placed |
| reactive-streams | 리액티브 스트림 (Reactive Streams) | study/16 §10·§20 · 카탈로그 E(16) | placed |
| conc-java-flow-api | java.util.concurrent.Flow (Java 9 Flow API) | study/16 카탈로그 E · study/3 카탈로그 H | placed |
| project-reactor | Project Reactor (Reactor Core) | study/16 §10 · 레포(gateway 필터) | placed |
| spring-webflux | Spring WebFlux | study/16 §12 · 레포 | placed |
| conc-reactor-operators | 리액티브 연산자 (flatMap) | study/16 §10 · 카탈로그 D(16) | placed |
| conc-reactor-schedulers | 리액티브 스케줄러 (Schedulers) | study/16 §10·§20 · 카탈로그 D(16) | placed |
| conc-reactor-sinks | Sinks (Sinks.many) | study/16 §10·§20 · 카탈로그 D(16) | placed |
| conc-backpressure-overflow-strategy | 배압 넘침 전략 (onBackpressureBuffer) | study/16 §11 · 카탈로그 D(16) | placed |
| conc-reactor-coroutine-bridge | Reactor ↔ 코루틴 연결 (kotlinx-coroutines-reactor) | study/16 §14 | placed |
| conc-unbounded-buffer | 무한 버퍼 (unbounded buffer) | study/16 §11(안티패턴 a) | placed |
| conc-unsubscribed-publisher | 구독 누락 (nothing happens until you subscribe) | study/16 §12(사고 3) | placed |
| conc-rxjava-mutiny | RxJava · Mutiny · Akka Streams | 카탈로그 E(16) | excluded — 레포에 없는 대체 구현체라 TECHNOLOGY 로 두지 않는다(개념은 reactive-streams) |
| conc-reactive-tck | Reactive Streams TCK | 카탈로그 E(16) | excluded — 구현체 적합성 검사 도구라 개념이 아니다 |
| conc-r2dbc | R2DBC | study/16 §11 · 카탈로그 F(16) | excluded — owned by data (data-reactive-db-driver) |
| conc-webflux-routing | WebFlux 함수형 라우팅 · WebFilter | 카탈로그 F(16) | excluded — owned by spring (spring-reactive-web) |
| conc-lettuce | Lettuce(Netty 기반 Redis 클라이언트) | study/16 §16 | excluded — owned by data (data-multiplexed-connection) |
| conc-step-verifier | StepVerifier | study/16 카탈로그 D | excluded — owned by testing (test-reactive-stream-verification) |
| conc-context-propagation | 실행 문맥 전달 | study/3 §06 · study/16 §20 | placed |
| conc-thread-local | ThreadLocal | study/3 §06 | placed |
| conc-inheritable-thread-local | InheritableThreadLocal | study/3 §06 | placed |
| conc-scoped-value | ScopedValue | study/3 §25 · 카탈로그 G | placed |
| conc-mdc-propagation | MDC 전파 | study/3 §06 | placed |
| conc-reactor-context | Reactor Context | study/16 §10·§20 · 카탈로그 D(16) | placed |
| conc-thread-context-element | ThreadContextElement (asContextElement) | study/3 §06(asContextElement) | placed |
| conc-threadlocal-leak | ThreadLocal 누수 (ThreadLocal leak) | study/3 §06 | placed |
| conc-io-model | IO 모델 선택 | study/16 §02·§03 | placed |
| conc-thread-per-connection | 연결당 스레드 (thread-per-connection) | study/16 §01 | placed |
| conc-blocking-io | 블로킹 IO (blocking IO) | study/16 §02 | placed |
| conc-nonblocking-io | 논블로킹 IO (non-blocking IO) | study/16 §02 | placed |
| conc-io-multiplexing | IO 다중화 (IO multiplexing) | study/16 §02·§04 | placed |
| conc-select | select | study/16 §04 | placed |
| conc-poll | poll | study/16 §04 | placed |
| conc-epoll | epoll | study/16 §04 · 치트시트 §06 | placed |
| conc-kqueue | kqueue | study/16 §04 | placed |
| conc-async-io | 비동기 IO (asynchronous IO) | study/16 §02 | placed |
| conc-iocp | IOCP (IO Completion Port) | study/16 §04 | placed |
| conc-posix-aio | POSIX AIO | study/16 카탈로그 A·1-A #2 | placed |
| conc-io-uring | io_uring | study/16 §05 | placed |
| conc-java-nio | Java NIO | study/16 §06 | placed |
| conc-nio-selector | Selector | study/16 §06 | placed |
| conc-nio-channel | Channel (SocketChannel) | study/16 §06 | placed |
| conc-byte-buffer | ByteBuffer | study/16 §06 | placed |
| conc-nio2-async-channel | AsynchronousChannel (NIO.2) | study/16 §06 · 카탈로그 B(16) | placed |
| conc-zero-copy | 제로 카피 (zero-copy) | study/16 §07 | placed |
| conc-sendfile | sendfile · transferTo | study/16 §07 | placed |
| conc-c10k | C10K 문제 | study/16 §01 | placed |
| conc-nio2-path-files | Path · Files (NIO.2) | study/16 §06 | excluded — 파일 시스템 API 라 동시성 개념이 아니다 |
| conc-direct-buffer | 다이렉트 버퍼 | study/16 §07 | excluded — owned by runtime (rt-direct-memory) |
| conc-mmap | 메모리 맵 파일 | study/16 §07 | excluded — owned by runtime (rt-mmap) |
| conc-tcp-nodelay | TCP_NODELAY · Nagle · QUICKACK | 카탈로그 I(16) | excluded — owned by network (net-nagle-algorithm) |
| conc-tcp-fast-open | TCP Fast Open | 카탈로그 I(16) | excluded — owned by network (net-tcp-fast-open) |
| conc-socket-options | SO_BACKLOG · SO_REUSEPORT · SO_KEEPALIVE · SO_LINGER | 카탈로그 C·I(16) | excluded — owned by network (net-listen-backlog 등 소켓 옵션) |
| conc-kernel-bypass | 커널 바이패스(C10M) | study/16 §01 | excluded — owned by network |
| conc-event-driven-server | 이벤트 루프 서버 구성 | study/16 §08·§09 | placed |
| conc-event-loop | 이벤트 루프 (event loop) | study/16 §09 | placed |
| conc-reactor-pattern | 리액터 패턴 (Reactor pattern) | study/16 §08 | placed |
| conc-multi-reactor | 멀티 리액터 (main-sub reactor) | study/16 §08(Doug Lea 변형) | placed |
| conc-proactor-pattern | 프로액터 패턴 (Proactor pattern) | study/16 §08 | placed |
| conc-netty-event-loop-group | EventLoopGroup | study/16 §09·§20 | placed |
| conc-channel-pipeline | ChannelPipeline | study/16 §09·§20 | placed |
| conc-netty-bytebuf | ByteBuf | study/16 §09·§20 | placed |
| conc-fast-thread-local | FastThreadLocal | study/16 카탈로그 C | placed |
| conc-hashed-wheel-timer | 해시 휠 타이머 (HashedWheelTimer) | study/16 §09 | placed |
| reactor-netty | Reactor Netty (reactor-netty) | study/16 §20 · 레포(quant 웹소켓) | placed |
| conc-event-loop-blocking | 이벤트 루프 블로킹 (blocking the event loop) | study/16 §09·§12 | placed |
| conc-bytebuf-leak | ByteBuf 누수 (ByteBuf leak) | study/16 §09 · 카탈로그 C(16) | placed |
| conc-netty-http-codecs | Netty HTTP/2 · h2c · HTTP/3 코덱 | 카탈로그 C(16) | excluded — owned by network (http2 · net-term-h2c) |
| conc-netty-websocket-sse | WebSocket · SSE on Netty | 카탈로그 F(16) | excluded — owned by network (websocket · sse) |
| conc-grpc-on-netty | gRPC on Netty | 카탈로그 1-A #23(16) | excluded — owned by network (grpc) |
| conc-diagnosis | 동시성 문제 진단 | study/3 §20·§21 | placed |
| conc-deadlock-detection | 교착 탐지 (deadlock detection) | study/3 §20 · 카탈로그 J | placed |
| conc-lock-profiling | 락 프로파일링 (lock profiling) | study/3 §21 · 카탈로그 J | placed |
| conc-pinning-trace | 피닝 추적 (jdk.tracePinnedThreads) | study/3 §17 · 카탈로그 J | placed |
| conc-coroutine-debugging | 코루틴 디버깅 (kotlinx-coroutines-debug) | 카탈로그 J·1-A #20 | placed |
| conc-concurrency-stress-test | 동시성 스트레스 테스트 (jcstress) | 분야 표준(OpenJDK jcstress) | placed |
| concurrency-glossary | 동시성 용어 사전 (glossary) | 구조 노드 | placed |
| conc-glossary-thread | 스레드 용어 | 구조 노드 | placed |
| conc-thread-state | 스레드 상태 (Thread.State) | study/3 §01·§20 | placed |
| conc-daemon-thread | 데몬 스레드 (daemon thread) | study/3 §01 · 카탈로그 E | placed |
| conc-context-switch | 컨텍스트 스위칭 (context switch) | study/16 §01 · study/12 카탈로그 2-A | placed |
| conc-carrier-thread | 캐리어 스레드 (carrier thread) | study/3 §25 · 카탈로그 F | placed |
| conc-continuation | Continuation (continuation) | study/3 §25 · 카탈로그 F | placed |
| conc-work-queue | 작업 큐 (work queue) | study/3 §07 | placed |
| conc-recursive-task | RecursiveTask · RecursiveAction | study/3 §07 · 카탈로그 E | placed |
| conc-glossary-memory | 메모리 모델 용어 | 구조 노드 | placed |
| conc-memory-visibility | 메모리 가시성 (memory visibility) | study/3 §03 | placed |
| conc-happens-before | happens-before | study/3 §09 · 카탈로그 A | placed |
| conc-synchronizes-with | synchronizes-with | study/3 §09 | placed |
| conc-reordering | 명령 재배치 (reordering) | study/3 §09 · 분야 표준(JLS 17.4) | placed |
| conc-acquire-release | acquire · release (acquire semantics) | 카탈로그 A | placed |
| conc-sequential-consistency | 순차 일관성 (sequential consistency) | study/3 §09 | excluded — 같은 개념 dist-sequential-consistency 로 합쳤다 |
| conc-as-if-serial | as-if-serial | study/3 §09 | placed |
| conc-hardware-memory-model | 하드웨어 메모리 모델 (TSO) | study/3 §09(ARM/x86) | placed |
| conc-glossary-sync | 동기화 용어 | 구조 노드 | placed |
| conc-critical-section | 임계 구역 (critical section) | 분야 표준 | placed |
| conc-monitor | 모니터 (monitor) | study/3 §02 | placed |
| conc-reentrancy | 재진입성 (reentrancy) | study/3 §05 | placed |
| conc-thread-safety | 스레드 안전 (thread safety) | 분야 표준(JCIP 2장) | placed |
| conc-check-then-act | check-then-act | study/3 §11 · 분야 표준 | placed |
| conc-coffman-conditions | 교착 네 조건 (Coffman conditions) | 분야 표준(OS 교재) | placed |
| conc-glossary-async | 비동기 용어 | 구조 노드 | placed |
| conc-blocking-nonblocking | 블로킹 · 논블로킹 (blocking) | study/16 §03 | placed |
| conc-sync-async | 동기 · 비동기 (synchronous) | study/16 §03 | placed |
| conc-io-two-phases | IO 의 두 단계 (wait for data) | study/16 §02 | placed |
| conc-edge-level-trigger | 엣지 · 레벨 트리거 (edge-triggered) | study/16 §04 | placed |
| conc-suspend-function | suspend 함수 (suspend fun) | study/3 §14 | placed |
| conc-structured-concurrency | 구조화된 동시성 (structured concurrency) | study/3 §16 · 카탈로그 G | placed |
| conc-coroutine-context | CoroutineContext | study/3 §25 · 카탈로그 I | placed |
| conc-job | Job | study/3 §16 | placed |
| conc-function-coloring | 함수 색칠 (function coloring) | study/3 §25 | placed |
| conc-hot-cold-stream | 핫 · 콜드 스트림 (hot publisher) | study/16 §10 · study/3 §18 | placed |
| conc-reactive-signals | 리액티브 신호 (onSubscribe) | study/16 §20 · 카탈로그 E(16) | placed |
| conc-assembly-subscription | 조립 시점 · 구독 시점 (assembly time) | study/16 §10·§20 | placed |
| conc-weakly-consistent-iteration | 약한 일관성 순회 (weakly consistent iterator) | study/3 §11 | placed |
| conc-thread-dump | 스레드 덤프(jstack · jcmd) | study/3 §20 · 카탈로그 J | excluded — owned by runtime (rt-thread-dump) |
| conc-jfr-events | JFR 모니터 이벤트 | study/3 §21 · 카탈로그 J | excluded — owned by runtime (rt-jfr) |
| conc-async-profiler | async-profiler lock 모드 | study/3 §21 · 카탈로그 J | excluded — owned by runtime (rt-async-profiler) |
| conc-intellij-coroutine-debugger | IntelliJ 코루틴 디버거 | 카탈로그 J | excluded — IDE 기능이라 conc-coroutine-debugging 에 합쳤다 |
| conc-littles-law | 리틀의 법칙 | study/16 §12 · 분야 표준 | excluded — owned by observability (obs-littles-law) |
