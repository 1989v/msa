---
parent: 16-async-nonblocking-io
seq: 19
title: 면접 Q&A 카드 + 50 문항 인덱스
type: interview
created: 2026-05-01
---

# 19. 면접 Q&A 카드 + 50 문항 인덱스

이 문서는 전체 학습 내용을 *면접 답변 형식* 으로 압축한 카드 모음. 회독용.

> 카드 = 1-3 문장 답 + 핵심 키워드. 50 문항 인덱스 = 깊이 가능한 질문 풀.

---

## Phase 1: 기본 개념 (8 카드)

### Q1. C10K 문제가 뭔가요?
A. 1999 년 Dan Kegel 이 제기한 *한 서버에서 1만 동접을 처리할 수 있는가* 문제. thread-per-connection 으로는 1만 thread × 1MB stack = 10GB VAS + 컨텍스트 스위치 폭증 + 커널 자료구조 부담으로 무너짐. 답은 *한 thread 가 epoll 로 여러 fd 멀티플렉싱*. C10M 은 syscall 자체가 비용이 되는 영역으로 io_uring / kernel bypass 가 답.

### Q2. IO 의 두 단계가 뭔가요?
A. (1) 데이터 도착 대기 (네트워크에서 socket recv buffer 까지) + (2) 커널-유저 버퍼 복사 (read syscall 안에서 memcpy). "비동기" 라는 단어가 두 단계를 모두 위임하는지 (1) 만 하는지 모호한데, 이 구분이 IO 모델 분류의 기준.

### Q3. Sync/Async 와 Blocking/Non-blocking 의 차이는?
A. 두 축이 다름. Blocking/Non-blocking 은 *호출이 즉시 리턴하는가* — read 가 데이터 없을 때 막히느냐 EAGAIN 리턴하느냐. Sync/Async 는 *데이터 복사 단계 (커널→유저) 를 OS 에 위임하느냐* — sync 는 호출자가, async 는 OS 가. 그래서 4 분면이 나오는데 실용적으론 (1) blocking sync, (2) non-blocking sync (multiplex), (3) non-blocking async (io_uring/IOCP) 만 의미 있음.

### Q4. 비동기로 짜면 무조건 빠른가요?
A. 아닙니다. CPU-bound 작업은 비동기로 바꿔도 throughput 안 오릅니다 (오히려 컨텍스트 스위치 늘어남). 비동기는 *IO 대기 시간을 다른 작업에 양보* 할 때만 이득. 또 동접이 thread pool 안에 들어오는 워크로드면 thread-per-request 가 *코드 단순함과 디버깅 용이성* 으로 더 나음.

### Q5. IO multiplexing 은 sync 인가 async 인가?
A. **Sync non-blocking**. 데이터 도착 알림(=ready)은 OS 에 위임하지만 *read 호출은 호출자가 직접* 합니다. 즉 단계 (2) 의 복사가 호출자 thread 에서 일어남. 진짜 async (분면 4) 는 io_uring / Windows IOCP 만.

### Q6. Reactor 와 Proactor 의 차이는?
A. 이벤트 의미가 다름. Reactor 는 "ready" 알림 — 'fd 가 준비됐으니 네가 read 해라' (분면 3). Proactor 는 "complete" 알림 — '데이터를 네 buffer 까지 채웠으니 결과만 봐라' (분면 4). Linux/macOS 는 epoll 이 ready 알림밖에 못 줘서 Reactor 가 표준, Windows 는 IOCP 의 complete 알림이라 Proactor.

### Q7. CompletableFuture 는 async 인가요?
A. 이름은 그렇지만 *프로그래밍 모델 차원* 에서만 async 입니다. 안에서 무엇을 하느냐에 달림. `CompletableFuture.supplyAsync { jdbc.query() }` 는 thread pool 에서 *blocking* 으로 도는 코드입니다. OS IO 모델 차원에선 분면 (3) multiplexing.

### Q8. "비동기" 라는 단어가 왜 헷갈리나요?
A. 7 가지 의미를 동시에 가져서. callback, Future, Promise, Reactive Stream, suspend, event loop, OS-level async (io_uring) — 모두 "비동기" 로 불립니다. 면접에선 *어느 층의 비동기인가* (programming model vs IO model) 를 명시해야 정확한 답이 가능.

---

## Phase 2 (a) — Linux IO multiplexing (6 카드)

### Q9. epoll 이 select 보다 빠른 이유는?
A. 두 지점. (1) select 는 호출 시마다 *fd 전체 목록* 을 커널로 복사하지만 epoll 은 `epoll_ctl` 로 *한 번만 등록*. (2) select 는 ready 판별을 위해 *전체 fd 스캔* 하지만 epoll 은 *이벤트 발생한 fd 만 ready list* 에 따로 모아 둠 → wait 호출이 O(이벤트 수). 부수적으로 select 의 fd 1024 한계도 없음.

### Q10. epoll 의 ET 와 LT 차이는?
A. ET (Edge-Triggered) = fd 상태 *변화 순간만* 알림 → 한 번 알림 받으면 EAGAIN 까지 모두 read 해야 함. 안 그럼 다음 알림까지 영영 대기. syscall 수 감소 → Nginx 같은 고성능 서버. LT (Level-Triggered) = ready 상태 *동안 계속* 알림. 기본값. 안전하지만 syscall 더 많음. Netty 는 LT 기본.

### Q11. macOS 에서 epoll 안 되는데 Java NIO 는 어떻게 되나요?
A. Java NIO Selector 가 OS 별로 자동 매핑. Linux = `EPollSelectorProvider`, macOS/BSD = `KQueueSelectorProvider`, Windows = `WindowsSelectorProvider` (select 기반, IOCP 아님). kqueue 는 epoll 과 비슷한 디자인이지만 file/socket 외 process exit / signal / timer / vnode 변경도 감시 가능 — epoll 보다 더 일반적.

### Q12. io_uring 이 epoll 과 다른 점은?
A. (1) 분면이 다름 — epoll 은 (3) sync non-blocking, io_uring 은 (4) async non-blocking. (2) syscall 모델이 다름 — io_uring 은 유저-커널 공유 ring buffer 두 개 (SQ/CQ) 로 *syscall 없이* 요청/완료 전달. SQPOLL 모드면 syscall 0 번 가능. (3) 모든 IO syscall 을 큐잉 가능 + 체이닝 (LINK). 다만 보안 공격 표면이 커서 GKE/ChromeOS 등 비활성, Java 표준 NIO 미지원.

### Q13. select 의 fd 1024 한계는 왜 못 늘리나요?
A. `fd_set` 비트맵 크기가 *컴파일 타임 상수* (`FD_SETSIZE`). 커널 컴파일 시 결정되는 값이라 사용자 어플리케이션이 못 바꿈. 그래서 poll 이 등장 (배열 사용으로 한계 제거), 더 나아가 epoll (등록 모델로 효율 개선).

### Q14. Selector 의 selectedKeys() 의 흔한 함정은?
A. iteration 후 `it.remove()` 빠뜨리면 Selector 가 *같은 key 를 무한 반환*. selectedKeys 는 *처리 완료* 를 호출자가 명시해야 비워짐. 또 다른 함정은 `OP_WRITE` 를 항상 켜두면 *socket 이 거의 항상 writable* 이라 매번 깨어남 → CPU 100%.

---

## Phase 2 (b) — Java NIO + Zero-copy (5 카드)

### Q15. Java NIO 의 핵심 컴포넌트는?
A. 세 축. (1) **Channel** = OS fd 추상화 (SocketChannel, FileChannel). (2) **Buffer** = 메모리 블록 + position/limit/capacity 4 포인터. write 후 flip, read 후 clear/compact. (3) **Selector** = epoll/kqueue 추상화. Channel 을 non-blocking 으로 등록하고 select() 로 ready 받음. Direct Buffer 는 off-heap 으로 syscall 인자 직접 전달 가능.

### Q16. Direct Buffer 와 Heap Buffer 의 차이는?
A. (1) 위치 — heap 은 GC 관리, direct 는 native malloc + Cleaner 회수. (2) IO 비용 — Channel.read 가 native 호출이라 heap buffer 면 *임시 direct staging buffer* 거쳐 복사 후 syscall, direct 면 그대로 syscall. IO 잦으면 의미 있는 차이. (3) 트레이드오프 — direct 는 할당 비용 비싸고 누수 위험 → Netty 는 PooledByteBufAllocator 로 풀링.

### Q17. Zero-copy 가 뭔가요?
A. 일반 socket→file 전송은 4 번 복사 + 4 번 컨텍스트 스위치 (DMA → kernel → user → kernel → DMA). sendfile syscall 은 *유저 버퍼를 거치지 않고 커널 안에서만 복사* — 컨텍스트 스위치 2 번, 복사 3 번. SG-DMA 지원 NIC 면 더 줄어 진정한 zero-copy. Java 의 `FileChannel.transferTo()` 가 sendfile 매핑. Tomcat 정적 리소스 / Kafka 가 자동 활용.

### Q18. NIO.2 의 AsynchronousChannel 은 잘 쓰이나요?
A. 거의 안 씀. API 는 분면 (4) async 형태 (CompletionHandler) 지만 Linux 구현체가 *epoll + thread pool 시뮬레이션* 이라 진짜 async 가 아님. 추가 thread overhead 만 발생. Reactor / Netty 가 자체 callback chain 으로 더 효율적이라 NIO.2 의 async 부분은 사실상 deprecated.

### Q19. ByteBuffer 의 flip() 이 헷갈리는 이유는?
A. ByteBuffer 가 *write/read 모드 플래그가 따로 없음* — position/limit 만으로 구분. write 후 flip() = limit=position, position=0 으로 *읽기 모드* 전환. 안 하면 read 가 실제 쓴 데이터를 놓치고 그 이후 영역을 읽음. Netty 의 ByteBuf 는 readerIndex/writerIndex 분리로 flip 불필요 — 이게 ByteBuf 가 ByteBuffer 를 대체한 이유 중 하나.

---

## Phase 2 (c) — Reactor / Netty / WebFlux (10 카드)

### Q20. Netty 의 EventLoop 가 1 thread 인 이유는?
A. 네 가지. (1) thread-safe 코드가 *불필요* — 그 안에선 동시성 보호 0. (2) ThreadLocal/lock 안 써도 됨. (3) 컨텍스트 스위치 비용 0. (4) 한 Loop 가 처리할 수 있는 만큼만 부하 받음 → 자연스러운 backpressure. 단점은 Handler 안에서 blocking 호출하면 *그 EventLoop 의 모든 Channel 이 멈춤*. JDBC 같은 건 별도 EventExecutorGroup 으로 분리.

### Q21. Netty 의 Boss/Worker EventLoopGroup 은?
A. Boss = ServerSocketChannel 의 OP_ACCEPT 만 처리, 보통 thread 1~2 개. Accept 후 Channel 을 Worker 에 등록. Worker = 실제 connection IO, default CPU * 2. Doug Lea 의 Reactor pattern main+sub 모델 그대로. Accept 폭주가 IO thread 영향 안 주게 분리.

### Q22. ByteBuf 의 참조 카운팅이 왜 필요한가요?
A. Netty 의 ByteBuf 는 *PooledByteBufAllocator* 로 direct buffer 를 풀로 관리해서 할당 비용 거의 0 인 대신, *언제 풀로 반납할지* 를 호출자가 알려야 함. retain/release 로 카운트 ±. 0 되면 풀 반납. *release 빠뜨리면 direct memory 누수* — JVM heap 은 멀쩡한데 RSS 만 늘어 OOM. Netty 운영 사고 1 위 원인.

### Q23. Project Reactor 의 publishOn 과 subscribeOn 차이는?
A. **subscribeOn** = *체인 source* 가 어느 thread 에서 시작될지 결정 (한 체인에 여러 번 써도 첫 번째만 의미 있음). **publishOn** = *그 이후 단계* 가 어느 thread 에서 실행될지 결정 (여러 번 써서 단계별 분리 가능). 흔한 예: `Mono.fromCallable { jdbcQuery() }.subscribeOn(Schedulers.boundedElastic())` — blocking JDBC 를 elastic pool 로 옮겨 EventLoop 안 막히게.

### Q24. Reactor 의 Schedulers 종류는?
A. 네 가지. **parallel** = CPU-bound 작업, thread = CPU 수. **boundedElastic** = blocking IO, thread 동적 (상한 = CPU * 10). **single** = 순차 실행 (timer 등). **immediate** = 호출자 thread, overhead 0. 가장 흔히 쓰는 건 boundedElastic (blocking 분리) 와 parallel (CPU 작업).

### Q25. Backpressure 가 뭔가요?
A. 생산자가 소비자보다 빠를 때 *어딘가 데이터가 쌓이는 문제* 를 막는 메커니즘. Reactive Streams 의 `Subscription.request(n)` 신호로 *받을 수 있는 양* 표현. Reactor 가 자동 전파. 다만 backpressure 가 안 통하는 source (TCP packet, timer, Kafka push) 가 있어서 4 가지 overflow 전략: buffer / drop / latest / error. `subscribe { }` 가 unbounded request 라 backpressure 가 silent 무력화되는 게 흔한 안티패턴.

### Q26. WebFlux 가 항상 MVC 보다 빠른가요?
A. 아닙니다. 단순 CRUD + JDBC 시나리오에선 throughput 비슷, MVC 가 코드 단순. WebFlux 의 진짜 이득은 (1) thread pool 한계를 넘는 동접 (SSE, 50K), (2) 외부 API fan-out (`Mono.zip`), (3) streaming 응답, (4) 수직 backpressure. 반대로 손해: blocking 라이브러리 강제, CPU-bound, 디버깅 비용. 우리 msa 도 *Gateway 만 WebFlux*, 나머지는 MVC.

### Q27. Virtual Threads 가 나오면서 WebFlux 의 의미는?
A. 가치 영역이 줄어듦. VT 는 OS thread 가 아닌 user-space 스케줄링 — blocking 호출 시 carrier 에서 unmount. *thread-per-request 의 단순함 + WebFlux 와 비슷한 throughput*. 다만 함정 (synchronized 안 blocking 시 pinning, JNI native, ThreadLocal scaling) 이 있고 JDK 24~ 에서 해소 중. 우리 msa 의 MVC 서비스들은 `spring.threads.virtual.enabled=true` 한 줄로 큰 throughput 향상 가능.

### Q28. WebFlux EventLoop 안에서 Thread.sleep() 호출하면?
A. 그 EventLoop 의 *모든 connection 이 같이 멈춥니다*. EventLoop = single thread + Selector 모델이라 thread 가 sleep 하면 그 thread 가 처리하던 *모든* Channel 이 영향. WebFlux 의 default worker 가 CPU * 2 면 8 core 컨테이너에서 1/16 의 connection 이 한꺼번에 막힘. 절대 금지. 필요하면 `subscribeOn(Schedulers.boundedElastic())` 으로 분리.

### Q29. Netty Handler 안에서 JDBC 호출하면?
A. 동일 문제 — 그 EventLoop 가 막혀 모든 Channel 영향. 해결: *별도 EventExecutorGroup* 으로 Handler 등록 (`addLast(businessGroup, "biz", handler)`) 또는 자체 thread pool 에 위임 후 결과를 EventLoop 로 다시 보냄 (`channel.eventLoop().execute { ... }`). WebFlux 의 boundedElastic 분리와 같은 패턴.

---

## Phase 2 (d) — Coroutine / VT (3 카드)

### Q30. Coroutine 의 suspend 가 어떻게 비동기인가요?
A. `suspend` 함수는 컴파일러가 *Continuation 을 받는 일반 함수* 로 변환. suspend 점마다 함수가 끊어져 *state machine* 이 됨. 끊어진 후 JVM thread 는 자유 → 다른 coroutine 실행. 결과가 오면 임의의 thread 에서 resume. IO 자체는 분면 (3) — 같은 epoll Selector. Coroutine 은 *프로그래밍 모델 차원의 비동기* 일 뿐.

### Q31. Reactor vs Coroutine 어느 게 더 좋아요?
A. IO 모델은 같음 (분면 3). 차이는 표현력 / 디버깅 / 학습 비용. Reactor 는 operator chain 으로 *복잡 흐름 (retry/timeout/fallback/parallel)* 표현이 강함. Coroutine 은 imperative 코드 + stack trace 정상 → 디버깅 / 가독성 / 학습 비용 좋음. `kotlinx-coroutines-reactor` 로 다리 (`awaitSingle`, `mono { }`). 우리 msa 도 *아래 layer Reactor (WebClient), 위 layer suspend (Coroutine)* 로 섞음.

### Q32. VT 의 pinning 이 뭔가요?
A. VT 가 *carrier thread 에서 unmount 못하는* 상태. 원인: (1) synchronized 안에서 blocking 호출, (2) JNI native method 안에서 blocking, (3) `Object.wait()`. pinned 되면 carrier 가 점유 → 다른 VT 가 그 carrier 에 못 mount → throughput 손실. JDK 24~25 에서 synchronized pinning 거의 해소. 진단: `-Djdk.tracePinnedThreads=full`.

---

## Phase 3 — msa 코드베이스 (6 카드)

### Q33. 우리 회사는 왜 Gateway 만 WebFlux 를 쓰나요?
A. (1) 트래픽 입구라 동접이 가장 큼 — Tomcat thread pool 한계가 가장 빨리 노출. (2) 비즈니스 로직 없음, IO bound 만 (인증/라우팅/로깅) — reactive EventLoop 모델 자연스러움. (3) ReactiveRedisTemplate / Reactor Netty downstream 호출이 *전 구간 reactive* 로 일관. 다른 서비스는 JDBC + Kafka sync poll + 비즈니스 로직 디버깅 → MVC 가 단순.

### Q34. Lettuce 와 Jedis 의 차이는?
A. Jedis = thread-per-connection, instance 가 thread-unsafe → connection pool 필수. Lettuce = Netty 위 single-thread 모델, *한 connection 을 여러 thread 가 동시에 안전하게 multiplex*. command 가 호출자 thread 에서 enqueue 되고 Lettuce EventLoop 가 RESP 인코딩/디코딩. sync/async/reactive 3 가지 API 같은 connection 위. 우리 msa 는 Gateway 만 reactive, 나머지 sync.

### Q35. WebFlux + JDBC 면 어떻게 되나요?
A. 그대로 호출하면 EventLoop 막힘 → 모든 connection 멈춤. 해결은 두 갈래. (1) `Mono.fromCallable { jdbc.query() }.subscribeOn(Schedulers.boundedElastic())` 로 분리 — 코드 복잡도만 늘고 의미상 thread-per-request 와 동일. (2) **R2DBC** 사용 — 진짜 reactive DB driver. 다만 R2DBC 는 JOIN / lazy loading 이 JPA 만큼 성숙하지 않아 우리 msa 는 *MVC + JDBC* 선택.

### Q36. Kafka Producer 와 Consumer 의 IO 모델 차이는?
A. Producer = *internal async + callback*. `send()` 는 RecordAccumulator 에 enqueue 후 즉시 리턴, 별도 Sender thread 가 NIO Selector 로 broker 와 통신. Consumer = *sync poll loop*. `poll()` 호출이 thread 점유, 한 consumer = 한 thread. Spring Kafka 의 `@KafkaListener` 안에선 blocking IO 자연스러움 (vs WebFlux EventLoop 에선 절대 금지). 처리 시간 길면 `max.poll.interval.ms` 초과 → rebalance.

### Q37. WebClient + awaitSingle 패턴이 흔한 이유는?
A. (1) Spring 6 이전엔 modern API 가 WebClient 뿐. (2) Reactor 시그니처가 fan-out 표현력 좋음. (3) Coroutine 다리 (`awaitSingle`) 가 자연스러움. 단점: MVC 환경에선 `Mono.flatMap` 체인 overhead, 디버깅 복잡. *VT 활성화 후엔 RestClient + 일반 sync 가 단순 + 같은 throughput*. 우리 msa 의 점진 마이그레이션 후보.

### Q38. Gateway 의 fail-open 정책은 안전한가요?
A. 트레이드오프. `redisTemplate.hasKey("blacklist:$token").onErrorReturn(false)` — Redis 장애 시 통과. 장점: Redis 장애가 *전체 트래픽 차단* 으로 번지지 않음. 위험: blacklist 가 사실상 OFF 동안 revoked token 통과. 보강 필수: (1) 메트릭 카운터 + 알람, (2) access token 만료 시간 < 5분, (3) Redis 장애 시간 추적. 단순 fail-open 만으론 위험.

---

## 50 문항 인덱스 (회독용)

> 각 질문에 해당하는 글 번호 표기. 답이 막히면 그 글로 돌아가서 다시 학습.

### 기본 개념 (1-12)
1. C10K 문제와 thread-per-connection 한계 → [01]
2. C10K 와 C10M 차이 → [01]
3. IO 의 두 단계 → [02]
4. Blocking IO / Non-blocking IO / Multiplexing / Async IO 차이 → [02]
5. Sync/Async 와 Blocking/Non-blocking 4 분면 → [03]
6. "비동기" 라는 단어의 다층적 의미 → [03]
7. CompletableFuture 는 async 인가? → [03]
8. Coroutine / Reactor / VT 가 OS IO 모델에서 같은 분면? → [03]
9. Linux IO multiplexing 은 sync 인가? → [03]
10. Selector + epoll 이 분면 (3) 인 이유 → [03]
11. 비동기로 짜면 빠른가? → [01], [12]
12. CPU-bound vs IO-bound 의 비동기 효과 → [01], [12]

### Linux IO multiplexing (13-22)
13. select 의 fd 1024 한계 → [04]
14. select vs poll 차이 → [04]
15. epoll 의 ready list 모델 → [04]
16. ET vs LT 차이 → [04]
17. epoll 의 thundering herd → [04]
18. epoll vs kqueue → [04]
19. Windows IOCP 와 epoll 의 분면 차이 → [04]
20. io_uring 의 SQ/CQ ring buffer → [05]
21. SQPOLL 모드 → [05]
22. io_uring 의 보안 이슈 → [05]

### Java NIO + Zero-copy (23-30)
23. Channel/Buffer/Selector 3 축 → [06]
24. Buffer 의 4 포인터 + flip 패턴 → [06]
25. NIO.2 AsynchronousChannel 이 안 쓰이는 이유 → [06]
26. Direct Buffer vs Heap Buffer → [07]
27. Direct Buffer 누수 진단 → [07]
28. sendfile / FileChannel.transferTo → [07]
29. mmap (Memory-Mapped File) → [07]
30. Kafka 의 sendfile + mmap 활용 → [07]

### Reactor 패턴 + Netty (31-38)
31. Reactor 패턴의 4 변형 (Doug Lea) → [08]
32. Reactor vs Proactor → [08]
33. Netty EventLoop = 1 thread 이유 → [09]
34. Boss/Worker EventLoopGroup → [09]
35. ChannelPipeline 인바운드/아웃바운드 → [09]
36. ByteBuf 의 PooledAllocator + 참조 카운팅 → [09]
37. Netty Handler 안 blocking 위험 → [09]
38. HashedWheelTimer 가 일반 ScheduledExecutor 보다 빠른 이유 → [09]

### Project Reactor + Backpressure (39-44)
39. Cold vs Hot Publisher → [10]
40. Assembly time vs Subscription time → [10]
41. publishOn vs subscribeOn → [10]
42. Schedulers 4 종 → [10]
43. flatMap vs concatMap vs switchMap → [10]
44. Backpressure 의 4 가지 overflow 전략 → [11]

### WebFlux vs MVC + VT (45-50)
45. WebFlux 가 빠른 시나리오 → [12]
46. WebFlux 가 손해 보는 시나리오 → [12]
47. VT 의 동작 원리 (carrier + unmount) → [13]
48. VT pinning 의 원인과 해결 → [13]
49. Coroutine vs Reactor 표현력 비교 → [14]
50. msa Gateway WebFlux 의 의사결정 근거 → [12], [15]

---

## 회독 가이드

- **1 회독** (학습 직후): 모든 카드 답변 입으로 말하기. 막히면 글로 돌아감
- **2 회독** (1 주 후): 키워드만 보고 답 쓰기
- **3 회독** (2 주 후): 50 문항 인덱스에서 무작위 5 문항 → 5 분 답변

답변 시 *항상 분면 (3) vs (4) / 두 단계 IO 모델 / Reactor 패턴* 의 멘탈 모델에서 시작하면 80% 의 질문이 풀림.

---

## 마지막 한 마디

이 주제는 *깊이 들어가면 끝이 없다* — 운영체제 / JVM 내부 / 라이브러리 소스코드 모두 연결. 면접에서 깊이 가지 말고 **"이 정도까지 이해함" 의 선을 명확히 그어 답변** 하는 게 평가 좋음. 모르는 건 솔직히 "거기까진 안 봤습니다, 다만 키워드는 io_uring / epoll thundering herd / SQPOLL 이고 ..." 식으로 *지도 그리기* 가 답.

> **본인이 한 작업** ([18 글](18-improvements.md) 의 제안) 을 하나 골라서 *현황 → 문제 → 제안 → 효과* 순으로 말할 수 있도록 준비. 이게 면접 점수 가장 큼.
