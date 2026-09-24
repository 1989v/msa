# JVM · 런타임 — 커버리지 체크리스트

원천:
- study/docs/2-jvm-gc/ — 99-concept-catalog.md(§1-A 갭 21개 · §2 A~I 표) + 본문 노트 01~23
- study/docs/12-latency-numbers/ — 99-concept-catalog.md 의 메모리 계층 부분(§1-A #1~#4 · §2-A · §2-E) + 02-cpu-cache.md · 03-memory-vs-storage.md
- 볼트 claude/artifact/system-resources-cheatsheet.md — §01 메모리 용어 · §02 JVM 메모리 · §04 CPU(JVM 관련 행) · §06 커널(OOM · 종료 코드)
- 분야 표준 — HotSpot GC Tuning Guide(Oracle) · JVM 명세 4·5장 · JLS 12장 · 'The Garbage Collection Handbook' · 'Java Performance'(Oaks) · OpenJDK JEP(371·439·450·491)
- 레포 설정 — buildSrc Jib 컨벤션 · k8s/overlays/oci-arm JAVA_TOOL_OPTIONS · OpenSearch StatefulSet JVM 옵션(grep 확인)

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| rt-jvm-runtime | JVM · 런타임 | study/2 개요 | placed |
| rt-memory-areas | 메모리 영역 이해 | study/2 §01 · 카탈로그 A | placed |
| rt-java-heap | 힙 (Java heap) | study/2 §01 · 카탈로그 A · 치트시트 §02 | placed |
| rt-young-generation | Young 세대 (young generation) | study/2 §01·§02 | placed |
| rt-old-generation | Old 세대 (old generation) | study/2 §01·§02 | placed |
| rt-metaspace | Metaspace | study/2 §01 · 카탈로그 A · 치트시트 §02 | placed |
| rt-permgen | PermGen (Permanent Generation) | study/2 §01 | placed |
| rt-jvm-stack | 스레드 스택 (JVM stack) | study/2 §01 · 카탈로그 A · 치트시트 §02 | placed |
| rt-code-cache | Code Cache (code cache) | study/2 §10 · 카탈로그 A · 치트시트 §02 | placed |
| rt-direct-memory | 다이렉트 메모리 (direct buffer) | study/2 §01·§11 · 카탈로그 A · 치트시트 §02 | placed |
| rt-native-memory | 네이티브 메모리 (native memory) | study/2 §01·§11 · 치트시트 §02 | placed |
| rt-malloc-arena | malloc 아레나 (glibc arena) | 치트시트 §01(malloc 아레나) · 분야 표준(glibc) | placed |
| rt-heap-occupancy | 힙 점유율 (heap after GC) | study/2 §09·§20 | placed |
| rt-memory-footprint | 메모리 사용량(RSS) 지표 | study/2 §19·§20 | excluded — owned by observability (obs-rss) |
| rt-object-model | 객체 표현 | 분야 표준(HotSpot 객체 배치) | placed |
| rt-object-header | 객체 헤더 (object header) | study/3 §10 · 분야 표준 | placed |
| rt-object-alignment | 객체 정렬 · 패딩 (object alignment) | 분야 표준(JOL) | placed |
| rt-compressed-oops | Compressed OOPs (compressed oops) | 카탈로그 A·1-A #12 · 치트시트 §02 | placed |
| rt-compact-object-headers | Compact Object Headers (Project Lilliput) | 카탈로그 A · JEP 450 | placed |
| rt-reference-strength | 참조 강도 (reference types) | study/2 §03 | placed |
| rt-soft-reference | SoftReference | study/2 §03 | placed |
| rt-weak-reference | WeakReference | study/2 §03 | placed |
| rt-phantom-reference | PhantomReference | study/2 §03 | placed |
| rt-finalizer | finalize (finalize()) | study/2 §03 | placed |
| rt-cleaner | Cleaner (java.lang.ref.Cleaner) | study/2 §03 | placed |
| rt-string-interning | 문자열 풀 (String pool) | 분야 표준 | placed |
| rt-string-deduplication | 문자열 중복 제거 (UseStringDeduplication) | 카탈로그 G·1-A #9 | placed |
| rt-value-class | 값 클래스 (Project Valhalla) | 카탈로그 1-A #5·E | placed |
| rt-allocation | 객체 할당 | study/2 §02 | placed |
| rt-tlab | TLAB (Thread-Local Allocation Buffer) | study/2 §02 · 카탈로그 A | placed |
| rt-bump-pointer-allocation | 포인터 증가 할당 (bump-the-pointer) | study/2 §02 · 분야 표준 | placed |
| rt-object-promotion | 승격 (promotion) | study/2 §02 | placed |
| rt-humongous-object | Humongous 객체 (humongous allocation) | study/2 §06 · 카탈로그 A | placed |
| rt-premature-promotion | 조기 승격 (premature promotion) | study/2 §02·§23 | placed |
| rt-allocation-rate | 할당률 (allocation rate) | study/2 §02·§09 | placed |
| rt-promotion-rate | 승격률 (promotion rate) | study/2 §09 | placed |
| rt-garbage-collection | 가비지 수집 원리 | study/2 §04·§05 · 카탈로그 C | placed |
| rt-reachability-analysis | 도달성 분석 (reachability) | study/2 §03 · 카탈로그 C | placed |
| rt-reference-counting | 참조 카운팅 (reference counting) | 분야 표준(GC Handbook) | placed |
| rt-mark-sweep | Mark-Sweep (mark and sweep) | study/2 §04 | placed |
| rt-mark-compact | Mark-Compact (mark and compact) | study/2 §04 | placed |
| rt-copying-collection | 복사 수집 (copying GC) | study/2 §04 | placed |
| rt-generational-collection | 세대별 수집 (generational GC) | study/2 §04 | placed |
| rt-tri-color-marking | 삼색 마킹 (tri-color marking) | study/2 §03(Concurrent Marking) · 분야 표준 | placed |
| rt-satb | SATB (Snapshot-At-The-Beginning) | study/2 §06 | placed |
| rt-incremental-update | 증분 갱신 (incremental update) | 분야 표준(GC Handbook) | placed |
| rt-remembered-set | Remembered Set (remembered set) | study/2 §04·§06 · 카탈로그 C | placed |
| rt-card-table | 카드 테이블 (card table) | study/2 §04 · 카탈로그 C | placed |
| rt-gc-barrier | GC 배리어 (GC barrier) | 카탈로그 C · study/2 §06·§07 | placed |
| rt-write-barrier | 쓰기 배리어 (write barrier) | 카탈로그 C · study/2 §06 | placed |
| rt-load-barrier | 읽기 배리어 (load barrier) | study/2 §07 | placed |
| rt-safepoint | 세이프포인트 (safepoint) | study/2 §04 · 카탈로그 C·1-A #18 | placed |
| rt-concurrent-gc | 동시 · 병렬 수집 (concurrent GC) | study/2 §05 | placed |
| rt-heap-fragmentation | 힙 단편화 (fragmentation) | study/2 §04 | placed |
| rt-time-to-safepoint | 세이프포인트 도달 지연 (TTSP) | 카탈로그 C·1-A #18 | placed |
| rt-gc-pause-time | GC 정지 시간 (pause time) | study/2 §05·§09 · study/12 카탈로그 2-E | placed |
| rt-gc-throughput | GC 처리량 (GC throughput) | study/2 §05·§09 | placed |
| rt-collector-selection | 컬렉터 선택 | study/2 §05 · 카탈로그 B | placed |
| rt-serial-gc | Serial GC (SerialGC) | study/2 §05 · 카탈로그 B | placed |
| rt-parallel-gc | Parallel GC (ParallelGC) | study/2 §05 · 카탈로그 B | placed |
| rt-cms-gc | CMS (Concurrent Mark Sweep) | study/2 §04·§05 | placed |
| rt-g1-gc | G1 GC (Garbage-First) | study/2 §06 · 카탈로그 B | placed |
| rt-g1-region | G1 리전 (region) | study/2 §06 | placed |
| rt-g1-mixed-gc | G1 사이클 (Young GC) | study/2 §06 | placed |
| rt-zgc | ZGC (Z Garbage Collector) | study/2 §07 · 카탈로그 B | placed |
| rt-colored-pointer | 컬러 포인터 (colored pointer) | study/2 §07 · 카탈로그 C | placed |
| rt-generational-zgc | 세대별 ZGC (Generational ZGC) | study/2 §07 · 카탈로그 B·I(JEP 439) | placed |
| rt-shenandoah | Shenandoah (Shenandoah GC) | study/2 §08 · 카탈로그 B | placed |
| rt-brooks-pointer | Brooks 포인터 (Brooks forwarding pointer) | study/2 §08 · 카탈로그 C | placed |
| rt-epsilon-gc | Epsilon GC (No-Op GC) | study/2 §05 · 카탈로그 B | placed |
| rt-evacuation-failure | Evacuation 실패 (to-space exhausted) | study/2 §23 · 분야 표준(G1 튜닝 가이드) | placed |
| rt-allocation-stall | 할당 정지 (Allocation Stall) | study/2 §07·§09 | placed |
| rt-concurrent-mode-failure | 동시 모드 실패 (concurrent mode failure) | study/2 §04 · 분야 표준 | placed |
| rt-gc-tuning | GC 튜닝 | study/2 §09·§23 | placed |
| rt-gc-logging | GC 로그 (Unified Logging) | study/2 §09 · 카탈로그 F | placed |
| rt-gc-log-analysis | GC 로그 분석 (GCViewer) | study/2 §09·§14 | placed |
| rt-heap-sizing | 힙 크기 설정 (-Xms) | study/2 §01·§23 | placed |
| rt-pause-time-goal | 정지 목표 (MaxGCPauseMillis) | study/2 §06·§23 | placed |
| rt-young-gen-sizing | Young 크기 조절 (-Xmn) | study/2 §23 | placed |
| rt-ihop-tuning | IHOP 조절 (InitiatingHeapOccupancyPercent) | study/2 §23 · 분야 표준(G1 튜닝 가이드) | placed |
| rt-gc-thrashing | 연속 GC (back-to-back GC) | study/2 §23(back-to-back GC) | placed |
| rt-full-gc | Full GC | study/2 §06·§09 | placed |
| rt-execution | 실행 엔진 · JIT | study/2 §10 · 카탈로그 D | placed |
| rt-bytecode-interpreter | 인터프리터 (interpreter) | 카탈로그 D | placed |
| rt-jit-compilation | JIT 컴파일 (Just-In-Time compilation) | study/2 §10 · 카탈로그 D | placed |
| rt-c1-compiler | C1 컴파일러 | study/2 §10 · 카탈로그 D | placed |
| rt-c2-compiler | C2 컴파일러 | study/2 §10 · 카탈로그 D | placed |
| rt-tiered-compilation | 계층형 컴파일 (tiered compilation) | study/2 §10 · 카탈로그 D | placed |
| rt-graal-compiler | Graal JIT | study/2 §10 · 카탈로그 D | placed |
| rt-osr | OSR (On-Stack Replacement) | study/2 §10 | placed |
| rt-method-inlining | 인라이닝 (inlining) | study/2 §10 · 카탈로그 D | placed |
| rt-escape-analysis | 이스케이프 분석 (Escape Analysis) | study/2 §02·§10 · 카탈로그 1-A #13 | placed |
| rt-scalar-replacement | 스칼라 치환 (scalar replacement) | study/2 §10 | placed |
| rt-lock-elision | 락 제거 (lock elision) | study/2 §10 · study/3 §10 | placed |
| rt-lock-coarsening | 락 확장 (lock coarsening) | study/3 §10 | placed |
| rt-loop-optimization | 루프 최적화 (loop unrolling) | study/2 §10 | placed |
| rt-auto-vectorization | 자동 벡터화 (SIMD) | study/2 §10 · 카탈로그 E(Panama Vector API) | placed |
| rt-dead-code-elimination | 죽은 코드 제거 · 상수 접기 (DCE) | study/2 §10·§17 | placed |
| rt-intrinsic | 인트린식 (intrinsic) | 분야 표준(HotSpot) | placed |
| rt-deoptimization | 역최적화 (deoptimization) | study/2 §10 · 카탈로그 D | placed |
| rt-megamorphic-call | 메가모픽 호출 (megamorphic call site) | study/2 §10 | placed |
| rt-jvm-warmup | 워밍업 지연 (JIT warm-up) | study/2 §10 · study/12 카탈로그 2-E | placed |
| rt-code-cache-full | Code Cache 가득 참 (CodeCache is full) | study/2 §10 · 22 Q36 | placed |
| rt-microbenchmark-pitfall | 마이크로벤치마크 함정 (benchmark pitfall) | study/2 §17 | placed |
| rt-loom-project | Project Loom · 구조화된 동시성 · Scoped Values | 카탈로그 E·1-A #4 | excluded — owned by concurrency (conc-virtual-thread · conc-structured-task-scope · conc-scoped-value) |
| rt-jep-tracker | JEP 트래커(릴리스별 변경) | 카탈로그 I | excluded — 릴리스 목록이라 개념이 아니다 |
| rt-class-file-api | Class-File API · 멀티 파일 실행 · 마크다운 주석 | 카탈로그 I | excluded — 도구 · 언어 편의 기능이라 런타임 개념이 아니다(카탈로그도 skip) |
| rt-panama-ffi | Foreign Function & Memory API(Panama) | 카탈로그 E·1-A #6 | excluded — owned by language (외부 함수 호출은 언어 · 라이브러리 기능) |
| rt-jmh-benchmark | JMH 마이크로벤치마크 | study/2 §17 · 카탈로그 H | excluded — owned by observability (obs-microbenchmark · jmh) |
| rt-startup-optimization | 기동 최적화 | 카탈로그 D · study/12 카탈로그 1-A #24 | placed |
| rt-cds | CDS · AppCDS (Class Data Sharing) | 카탈로그 D·1-A #8 | placed |
| rt-aot-compilation | AOT 컴파일 (Ahead-Of-Time) | 카탈로그 D·1-A #3 · study/2 §21(Spring AOT) | placed |
| rt-crac | CRaC (Coordinated Restore at Checkpoint) | 카탈로그 D·1-A #2 | placed |
| rt-startup-time | 기동 · 준비 시간 (startup time) | study/12 카탈로그 2-E | placed |
| rt-class-loading | 클래스 로딩 | 카탈로그 1-A #15 · 분야 표준(JVM 명세 5장) | placed |
| rt-class-loading-process | 로딩 · 연결 · 초기화 (loading) | 분야 표준(JVM 명세 5장) | placed |
| rt-class-linking | 연결 (linking) | 분야 표준(JVM 명세 5.4) | placed |
| rt-class-initialization | 클래스 초기화 (<clinit>) | 분야 표준(JLS 12.4) | placed |
| rt-parent-delegation | 부모 위임 (parent delegation) | 분야 표준 | placed |
| rt-custom-classloader | 사용자 클래스로더 (custom ClassLoader) | 분야 표준 | placed |
| rt-hidden-class | 런타임 클래스 생성 (hidden class) | study/2 §01(Metaspace OOM 시나리오) · 분야 표준(JEP 371) | placed |
| rt-jpms | 모듈 시스템 (JPMS) | 카탈로그 1-A #15 | placed |
| rt-class-unloading | 클래스 언로딩 (class unloading) | study/2 §03(ClassLoader 누수) | placed |
| rt-classloader-leak | 클래스로더 누수 (classloader leak) | study/2 §03·§13 · 카탈로그 G | placed |
| rt-container-runtime | 컨테이너에서 JVM 운영 | study/2 §18·§19 · 카탈로그 G | placed |
| rt-container-awareness | 컨테이너 인식 (UseContainerSupport) | study/2 §18·§19 · 카탈로그 G · 치트시트 §02 | placed |
| rt-ram-percentage | MaxRAMPercentage | study/2 §18 · 카탈로그 G·1-A #21 | placed |
| rt-active-processor-count | ActiveProcessorCount (-XX:ActiveProcessorCount) | 카탈로그 G · 치트시트 §04 | placed |
| rt-jvm-ergonomics | JVM 에고노믹스 (ergonomics) | 카탈로그 G·1-A #17 | placed |
| rt-memory-budget | 메모리 예산 산정 (memory budget) | study/2 §19 · 치트시트 §02·§03 | placed |
| openjdk | OpenJDK (Eclipse Temurin) (HotSpot) | study/2 §18 · 레포(Jib 베이스 이미지) | placed |
| rt-cgroup-memory-limit | cgroup 메모리 한도(memory.max) | 치트시트 §01·§06 · study/2 §19 | excluded — owned by infrastructure (infra-cgroup) |
| rt-oom-killed | OOMKilled(컨테이너 한도 초과) | study/2 §12 · 치트시트 §01 | excluded — owned by infrastructure (infra-oom-killed) |
| rt-requests-limits | requests vs limits · QoS | 치트시트 §01 · study/2 §19 | excluded — owned by infrastructure |
| rt-cpu-throttling | CFS quota · CPU 스로틀링 | 치트시트 §04 | excluded — owned by infrastructure (infra-cpu-throttling) |
| rt-jib-jvm-flags | Jib jvmFlags 설정 | study/2 §18 | excluded — 빌드 도구 설정값이라 개념이 아니다(내용은 rt-ram-percentage · rt-container-awareness 코드 참조) |
| rt-os-memory | OS 메모리 이해 | 치트시트 §01·§06 · study/12 §03 | placed |
| rt-virtual-memory | 가상 메모리 (virtual memory) | 치트시트 §01 · study/12 카탈로그 1-A #2 | placed |
| rt-tlb | TLB (Translation Lookaside Buffer) | study/12 카탈로그 1-A #2·2-A | placed |
| rt-mmap | mmap | study/16 §07 · 치트시트 §01·§05 | placed |
| rt-oom-killer | OOM killer | 치트시트 §06 | placed |
| rt-major-fault-storm | major 페이지 폴트 폭증 (major page fault) | 치트시트 §01(페이지 폴트 → 112초 사례) | placed |
| rt-page-cache | 페이지 캐시 | 치트시트 §01·§03 | excluded — owned by data (data-page-cache) |
| rt-fsync | fsync 내구성 | 치트시트 §05 | excluded — owned by data (data-fsync) |
| rt-memory-high-min | memory.high · min · low | 치트시트 §01 | excluded — owned by infrastructure (cgroup 세부 손잡이) |
| rt-sysctl-knobs | sysctl 손잡이(vm.* · net.*) | 치트시트 §06 | excluded — 커널 설정값 목록이라 개념이 아니다(해당 개념은 rt-swap · rt-mmap · rt-dirty-page-writeback 에 있다) |
| rt-rss | RSS | 치트시트 §01 | excluded — owned by observability (obs-rss) |
| rt-vsz | VSZ · 가상 메모리 크기 | 치트시트 §01 | excluded — owned by observability (obs-vsz) |
| rt-anon-memory | 익명 메모리(anon) | 치트시트 §01 | excluded — owned by observability (obs-anon-memory) |
| rt-page-fault | 페이지 폴트(minor · major) | 치트시트 §01 | excluded — owned by observability (obs-page-fault) |
| rt-available-memory | available vs free | 치트시트 §01 | excluded — owned by observability (obs-memory-available) |
| rt-swap | 스왑 | 치트시트 §01 | excluded — owned by observability (obs-swap) |
| rt-transparent-huge-pages | Transparent Huge Pages | 치트시트 §01 | excluded — owned by observability (obs-huge-page) |
| rt-dirty-page-writeback | dirty 페이지 · writeback | 치트시트 §01·§05 | excluded — owned by observability (obs-dirty-page) |
| rt-memory-hierarchy | 메모리 계층 이해 | study/12 §02·§03 | placed |
| rt-cpu-cache-hierarchy | CPU 캐시 계층 (L1) | study/12 §02 · 카탈로그 2-A | placed |
| rt-cache-coherence | 캐시 일관성 (cache coherence) | study/3 §19 · 분야 표준 | placed |
| rt-numa | NUMA (Non-Uniform Memory Access) | study/12 카탈로그 1-A #4·2-A | placed |
| rt-data-locality | 데이터 지역성 (prefetch) | study/12 §02 · 분야 표준 | placed |
| rt-branch-prediction | 분기 예측 (branch prediction) | study/12 카탈로그 1-A #3·2-A | placed |
| rt-cache-miss | 캐시 미스 (cache miss) | study/12 §02 | placed |
| rt-branch-misprediction | 분기 예측 실패 (branch misprediction) | study/12 카탈로그 2-A | placed |
| rt-cache-miss-rate | 캐시 미스율 (cache-misses) | study/3 §19(perf c2c) · 분야 표준 | placed |
| rt-latency-numbers | 지연 자릿수 표(L1 · DRAM · SSD · RTT) | study/12 §01·§13 · 카탈로그 2 | excluded — owned by observability (obs-orders-of-magnitude · obs-lat-*) |
| rt-storage-media | DRAM · SSD · HDD 매체 특성 | study/12 §03 | excluded — owned by data (저장 매체 · IOPS) |
| rt-memory-bandwidth | 메모리 대역폭(DDR · HBM) | study/12 카탈로그 1-A #39 | excluded — owned by observability (하드웨어 자릿수) |
| rt-diagnostics | JVM 진단 | study/2 §13·§16 · 카탈로그 F | placed |
| rt-jcmd | jcmd | study/2 §13 · 카탈로그 F | placed |
| rt-thread-dump | 스레드 덤프 (thread dump) | study/3 §20 | placed |
| rt-heap-dump | 힙 덤프 (heap dump) | study/2 §13 · 카탈로그 F | placed |
| rt-heap-dump-analysis | 힙 덤프 분석 (Eclipse MAT) | study/2 §13·§15 | placed |
| rt-heap-dump-on-oom | OOM 시 자동 덤프 (HeapDumpOnOutOfMemoryError) | study/2 §12·§13·§18 | placed |
| rt-jfr | JFR (Java Flight Recorder) | study/2 §16 · 카탈로그 F·1-A #10 | placed |
| rt-async-profiler | async-profiler | study/3 §21 · 카탈로그 F | placed |
| rt-nmt | NMT (Native Memory Tracking) | study/2 §11 · 카탈로그 F · 치트시트 §02 | placed |
| rt-jstat | jstat | 카탈로그 F | placed |
| rt-flame-graph | 플레임 그래프 · CPU 프로파일링 | study/3 §21 · study/2 카탈로그 F | excluded — owned by observability (obs-flame-graph · obs-cpu-profiling) |
| rt-jvm-metrics | JVM 메트릭 · 대시보드(Micrometer · Prometheus) | study/2 §20 | excluded — owned by observability |
| rt-gc-alert-rules | GC · 메모리 알람 룰 | study/2 §20·§21 | excluded — owned by observability |
| rt-jfr-streaming | JFR 스트리밍 · 원격 기록 | 카탈로그 F·1-A #10 | excluded — rt-jfr 의 사용 방식이라 따로 두지 않는다 |
| rt-out-of-memory | 메모리 부족 대응 | study/2 §12 | placed |
| rt-exit-on-oom | OOM 뒤 종료 (ExitOnOutOfMemoryError) | study/2 §12·§18 | placed |
| rt-oom-heap-space | OOM: Java heap space (java.lang.OutOfMemoryError: Java heap space) | study/2 §12 | placed |
| rt-oom-metaspace | OOM: Metaspace (java.lang.OutOfMemoryError: Metaspace) | study/2 §12 | placed |
| rt-oom-gc-overhead | OOM: GC overhead limit exceeded | study/2 §12 | placed |
| rt-oom-direct-buffer | OOM: Direct buffer memory (java.lang.OutOfMemoryError: Direct buffer memory) | study/2 §12 | placed |
| rt-oom-native-thread | OOM: unable to create native thread | study/2 §12 | placed |
| rt-oom-array-size | OOM: Requested array size exceeds VM limit | 분야 표준(HotSpot OOM 메시지) | placed |
| rt-memory-leak | 메모리 누수 (memory leak) | study/2 §03·§13 | placed |
| runtime-glossary | JVM · 런타임 용어 사전 (glossary) | 구조 노드 | placed |
| rt-glossary-memory | 메모리 구조 용어 | 구조 노드 | placed |
| rt-pc-register | PC 레지스터 (Program Counter register) | study/2 §01 | placed |
| rt-stack-frame | 스택 프레임 (stack frame) | study/2 §01 | placed |
| rt-oop | OOP (ordinary object pointer) | 카탈로그 A(Compressed OOPs) | placed |
| rt-mark-word | Mark Word (mark word) | study/3 §10 | placed |
| rt-klass-pointer | Klass 포인터 (klass pointer) | 분야 표준 | placed |
| rt-shallow-retained-size | Shallow · Retained 크기 (shallow heap) | study/2 §13 | placed |
| rt-live-set | 라이브 셋 (live set) | study/2 §23 · 분야 표준 | placed |
| rt-glossary-gc | GC 용어 | 구조 노드 | placed |
| rt-gc-root | GC 루트 (GC roots) | study/2 §03 | placed |
| rt-mutator | 뮤테이터 (mutator) | 분야 표준(GC Handbook) | placed |
| rt-stop-the-world | Stop-The-World (STW) | study/2 §04 · 카탈로그 C | placed |
| rt-weak-generational-hypothesis | 약한 세대 가설 (weak generational hypothesis) | study/2 §04 | placed |
| rt-object-age | 객체 나이 (object age) | study/2 §02 | placed |
| rt-floating-garbage | 떠 있는 쓰레기 (floating garbage) | study/2 §06(SATB) · 분야 표준 | placed |
| rt-glossary-execution | 실행 용어 | 구조 노드 | placed |
| rt-bytecode | 바이트코드 (bytecode) | 분야 표준 | placed |
| rt-class-file | 클래스 파일 (.class) | 분야 표준(JVM 명세 4장) | placed |
| rt-hot-method | 핫 메서드 (hot spot) | study/2 §10 | placed |
| rt-speculative-optimization | 추측 최적화 (speculative optimization) | study/2 §10 | placed |
| rt-call-site-morphism | 호출 지점 형태 (monomorphic) | study/2 §10(Megamorphic) | placed |
| rt-glossary-os | OS 메모리 용어 | 구조 노드 | placed |
| rt-kernel-slab | slab | 치트시트 §01 | placed |
| rt-cache-line | 캐시 라인 (cache line) | study/12 §02 | placed |
| rt-exit-code-137 | 종료 코드 137 (exit 137) | 치트시트 §06 | placed |
