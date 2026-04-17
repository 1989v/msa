---
id: 2
title: JVM 내부 + GC 튜닝
status: ready
created: 2026-04-16
updated: 2026-04-16
tags: [jvm, gc, g1, zgc, memory, performance, oom]
difficulty: advanced
estimated-hours: 35
codebase-relevant: true
learner-level: intermediate
---

# JVM 내부 + GC 튜닝

## 1. 개요

JVM 의 메모리 구조, GC 알고리즘, 튜닝 기법을 10년차 수준으로 정리한다. G1/ZGC/Shenandoah 등 현대 GC 의 동작 원리를 이해하고, GC 로그를 해석하여 실제 프로덕션 이슈를 진단할 수 있는 수준을 목표로 한다. OOM 원인 분석, Heap/Metaspace/Direct Buffer 이해, JIT 최적화 기법까지 포함한다.

msa 프로젝트의 모든 JVM 서비스 (product, order, search, gateway, common, analytics, experiment, member, wishlist, auth, chatbot, gifticon, inventory, fulfillment, warehouse) 에 직접 적용 가능.

## 2. 학습 목표

- JVM 메모리 구조(Heap/Metaspace/Stack/Native)를 설명할 수 있다
- G1/ZGC/Shenandoah 의 동작 차이와 선택 근거를 설명할 수 있다
- GC 로그를 읽고 STW 시간, Throughput, Latency 를 분석할 수 있다
- OutOfMemoryError 5가지 유형을 구분하고 원인을 진단할 수 있다
- `-Xms/-Xmx`, `-XX:+UseG1GC`, `-XX:MaxGCPauseMillis` 등 튜닝 파라미터를 근거 기반으로 선택할 수 있다
- JIT 최적화 (인라이닝, 이스케이프 분석) 기본 개념을 설명할 수 있다
- 면접에서 "GC 로그 보신 적 있나요? 어떻게 튜닝하셨나요?" 에 실무 스토리로 답변

## 2.1 학습자 프로필

- **현재 수준**: 중급 (B)
- **아는 영역**: 메모리 영역 구분 명확, Minor/Major GC 구분 가능, G1 이 기본이라는 것 인지, GC 로그 파일 열어본 경험, OOM 원인 대략 추측 가능
- **자신 없는 영역**: GC 로그 정밀 해석 (pause time / throughput / allocation rate), G1 내부 (Region / RSet / Humongous / Mixed GC), ZGC / Shenandoah 내부, Heap Dump 분석(MAT), JIT, OOM 5가지 유형 체계화, 실제 튜닝 파라미터 선택 근거
- **학습 전략**: Phase 1 기본은 빠른 리마인더 (3-4h), Phase 2 심화에 집중 (10-12h), Phase 3 실무 설정 점검 (2-3h), Phase 4 면접 대비 (3-4h)

## 2.2 학습 깊이

- **방식**: 개념 + 실습 풀 세트 (GC 로그 분석 + Heap Dump + JFR + JMH)
- **실습 계획**:
  1. **GC 로그 실습 (Phase 2 말~Phase 3)**
     - msa 서비스 하나 (예: product) 를 로컬 K8s 에 띄우고 `-Xlog:gc*:file=gc.log` 옵션으로 로그 수집
     - GCEasy.io / GCViewer 로 분석: pause time, throughput, allocation rate, promotion rate
     - `-XX:+UseG1GC -XX:MaxGCPauseMillis=200`, `-XX:+UseZGC` 등 옵션 바꿔가며 영향 측정
  2. **Heap Dump + MAT (Phase 3)**
     - `jcmd <pid> GC.heap_dump` / `jmap -dump:live,format=b,file=heap.hprof <pid>`
     - Eclipse MAT 로 Dominator Tree, Leak Suspects, Retained Heap 분석
     - 의도적으로 OOM 재현 후 덤프 해석 (메모리 누수 시나리오)
  3. **JFR (Java Flight Recorder) + JMC**
     - `-XX:StartFlightRecording=duration=60s,filename=app.jfr` 로 레코딩
     - JDK Mission Control (JMC) 로 hot method, allocation hot spots, thread contention 분석
  4. **JMH (Java Microbenchmark Harness)**
     - Escape Analysis / Inlining / Tiered Compilation 효과 측정 샘플 작성
     - Warm-up, iteration, fork 파라미터 조정 실습
- **예상 시간**: 35h
- **근거**: 10년차 면접에서 "직접 튜닝해봤냐" 꼬리 질문 방어 + 프로덕션 장애 대응 역량 확보

## 2.3 JVM 버전 범위

- **대상 버전**: JDK 21 (LTS) ~ JDK 25 (LTS, 현 msa 기준)
- **포함 주제**:
  - G1GC 의 최신 개선 (Region Pinning, Full GC 병렬화)
  - ZGC Generational (JDK 21 GA)
  - Virtual Threads (JDK 21 GA, JDK 25 개선)
  - Project Loom pinning 문제와 JDK 25 의 개선 (synchronized 개선)
  - JFR 의 최신 이벤트
  - `-XX:MaxRAMPercentage` (컨테이너 환경)
- **제외**: JDK 17 이하 의 레거시 GC (CMS deprecated 는 히스토리 수준으로만 언급)
- **근거**: msa 프로젝트 JDK 25 기준 + 실무 대부분은 JDK 21 사용 → 두 LTS 커버로 실용성 극대화

## 2.4 면접 대비 비중

- **비중**: 높음 (~40%, 14h / 35h)
- **목표**: 이직/면접 임박 수준의 준비도
- **구성**:
  - 꼬리 질문 3단계 (Q → Q-1 → Q-1-1 → Q-1-1-1)
  - 함정 질문 / 오해 포인트 상세 정리
  - 실무 스토리 (GC 로그 분석 / JFR / MAT 실습 경험을 면접 답변으로 변환)
  - 시스템 설계 연결 (1-2개): "메모리 사용량이 급증하는 서비스 설계"

## 2.5 면접 컨텍스트 · 시간 · 출력 형태 (1번 주제 결정 계승)

- **면접 대상**: 한국 대기업/중견 (정형화된 기술 면접, CS 기반 꼬리 질문, 한국어)
- **주당 학습 시간**: 15-20h → 예상 2주 내 완료 (35h / ~17h 주)
- **출력 형태**: 노트 (서사형) + Q&A 카드 (Phase 5) + 각 Phase 끝 1-페이지 치트시트

## 3. 선수 지식

- Java/Kotlin 기본 (객체 할당, 참조)
- 메모리 기본 (Stack/Heap 구분)
- Linux 기본 (메모리 확인 명령어: `top`, `free`)

## 4. 학습 로드맵

### Phase 1: 기본 개념
- JVM 메모리 영역: Heap (Young/Old), Metaspace, Stack, PC Register, Native
- 객체 할당 흐름: TLAB → Eden → Survivor → Old
- GC Root, Reachability 분석
- Mark-Sweep, Mark-Compact, Copy 알고리즘
- Serial GC, Parallel GC, CMS (deprecated), G1GC, ZGC, Shenandoah 개요
- Stop-The-World (STW) 와 Concurrent
- Throughput vs Latency (Pause Time) 트레이드오프

### Phase 2: 심화
- G1GC 상세: Region 기반, Remembered Set, Humongous Object, Mixed GC
- ZGC 상세: Colored Pointers, Load Barrier, sub-ms pause
- Shenandoah: Brooks Pointer, Concurrent Compaction
- GC 로그 분석: `-Xlog:gc*`, GCViewer, GCEasy
- JIT 최적화: C1/C2 컴파일러, Tiered Compilation, Inlining, Escape Analysis
- Native Memory Tracking (NMT)
- OOM 유형: Java heap space / Metaspace / GC overhead / Direct buffer / Unable to create native thread
- Heap Dump 분석: MAT (Memory Analyzer Tool), jhat, jcmd

### Phase 3: 실전 적용
- msa 프로젝트 JVM 서비스의 기본 JVM 옵션 확인 (`jib` 빌드 설정, k8s Deployment 의 JVM_OPTS)
- `docker/Dockerfile` / `jib.gradle.kts` / `k8s/base/*/deployment.yaml` 의 메모리 리밋과 JVM 힙 비율 점검
- 컨테이너 환경에서 `-XX:MaxRAMPercentage` 사용 검토
- 관측성 연동: Prometheus JMX exporter, Micrometer 로 GC 메트릭 수집

### Phase 4: 면접 대비
- "Minor GC 와 Major GC 의 차이"
- "G1 과 ZGC 를 언제 쓰나요?"
- "OOM 이 발생하면 어떻게 디버깅하나요?"
- "GC 로그에서 어떤 지표를 봐야 하나요?"
- "힙 크기를 어떻게 정하나요?"
- "컨테이너 메모리 리밋과 JVM 힙 설정의 관계는?"

## 5. 코드베이스 연관성

- **모든 JVM 서비스의 빌드 설정**: `{service}/app/build.gradle.kts` (Jib config)
- **K8s Deployment 메모리 리소스**: `k8s/base/{service}/deployment.yaml`
- **공통 라이브러리**: `common/` (JVM 성능에 영향)
- **관련 ADR**: 현재 JVM 튜닝 관련 ADR 없음 (Phase 4에서 ADR 제안 가능)

## 6. 참고 자료

- Oracle JVM Specification
- "Java Performance" - Scott Oaks
- OpenJDK G1GC / ZGC 공식 문서
- GCEasy.io (GC 로그 분석 서비스)

## 7. 미결 사항

없음. 모든 사항은 2026-04-16 브레인스토밍 세션에서 결정 (섹션 2.1-2.5 참조).

## 8. 원본 메모

JVM 내부 + GC 튜닝 (G1/ZGC 차이, GC 로그 해석, OOM 원인 분석)
