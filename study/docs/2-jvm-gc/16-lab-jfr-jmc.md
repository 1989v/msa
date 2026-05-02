---
parent: 2-jvm-gc
seq: 16
title: Lab 3 — JFR (Java Flight Recorder) + JMC
type: lab
created: 2026-05-01
---

# Lab 3. JFR + JMC

## 목표

JFR (Java Flight Recorder) 로 운영 영향 < 1% 의 프로파일링 데이터 수집 → JMC (JDK Mission Control) 로 hot method, allocation hotspot, GC, thread contention, lock 분석. **운영 환경에서 항상 켜둘 수 있는 프로파일러** 사용법.

## 소요 시간

3-4h

---

## 준비물

- Lab 1 환경 (k3d + product)
- JDK Mission Control: https://jdk.java.net/jmc/ 또는 `brew install --cask jdk-mission-control`
- 또는 IntelliJ IDEA Ultimate (JFR/JMC 통합)

---

## 1. JFR 가 뭔가

### 정의

> JVM 내부 이벤트(GC, allocation, lock, thread state, 메서드 호출 sample 등)를 **circular buffer** 에 기록하는 내장 프로파일러.

- JDK 11+ 부터 OpenJDK 무료 (이전 Oracle 상용 라이선스)
- 운영 영향 **< 1%** (default 설정)
- 컴팩트 바이너리 포맷 (.jfr)
- 100+ 종류의 이벤트 + 커스텀 이벤트 정의 가능

### 비교

| 도구 | 영향 | 운영 사용 | 깊이 |
|---|---|---|---|
| jstack / Thread.print | 0% (snapshot) | OK | thread state 만 |
| jstat / GC log | <1% | OK | GC만 |
| JFR | <1% | **OK** | 종합 (GC + allocation + method + lock + ...) |
| async-profiler | <1% | OK | flame graph 위주 |
| YourKit / JProfiler | 5-20% | risky | 깊지만 무거움 |

JFR 이 운영에서 **always-on** 으로 권장되는 이유.

---

## 2. JFR 시작 방법

### 부팅 시 옵션

```bash
-XX:StartFlightRecording=duration=60s,filename=/var/log/jvm/app.jfr,settings=profile
```

| 옵션 | 의미 |
|---|---|
| `duration=60s` | 60초 후 자동 dump (생략 시 무한) |
| `filename=...` | 출력 파일 |
| `settings=default` | 기본 (default 모드 ~0.5% 영향) |
| `settings=profile` | 더 상세 (~1-2% 영향, 메서드 sample 활성) |
| `name=myrecording` | 식별자 |
| `maxsize=100M` | 최대 파일 크기 |
| `maxage=1h` | 오래된 데이터 회전 |

### 운영 권장 (always-on)

```bash
-XX:StartFlightRecording=settings=default,maxage=24h,maxsize=200M,filename=/var/log/jvm/continuous.jfr,dumponexit=true
```

24시간 분량을 200MB 안에 회전. JVM 종료 시 자동 덤프.

### 런타임에 시작 (jcmd)

```bash
# 시작
jcmd <pid> JFR.start duration=120s filename=/tmp/snapshot.jfr settings=profile

# 진행 중 dump (continuous recording 의 일부 캡처)
jcmd <pid> JFR.dump name=myrecording filename=/tmp/snapshot.jfr

# 진행 중 recording 목록
jcmd <pid> JFR.check

# 정지
jcmd <pid> JFR.stop name=myrecording
```

K8s 에서:
```bash
kubectl exec -n commerce product-xxx -- jcmd 1 JFR.start duration=120s filename=/tmp/snapshot.jfr settings=profile

# 완료 후
kubectl cp commerce/product-xxx:/tmp/snapshot.jfr ./snapshot.jfr
```

---

## 3. 본 Lab 의 시나리오

### 부하 + JFR 동시 실행

Terminal 1: 부하
```bash
k6 run load-product.js
```

Terminal 2: JFR 시작
```bash
kubectl exec -n commerce product-xxx -- jcmd 1 JFR.start \
  duration=300s \
  filename=/tmp/load-test.jfr \
  settings=profile
```

5분 후 dump:
```bash
kubectl cp commerce/product-xxx:/tmp/load-test.jfr ./load-test.jfr
```

---

## 4. JMC 분석

### 4.1. JMC 실행

```bash
jmc       # JDK 25 이후 별도 다운로드
# 또는
open /Applications/JDK\ Mission\ Control.app
```

File → Open File → load-test.jfr. 인덱싱 30초~1분.

### 4.2. Outline View

JFR 파일이 열리면 좌측 Outline:

- **Java Application** — 스레드, 메서드 sample, IO
- **JVM Internals** — GC, JIT, Code Cache
- **Operating System** — CPU, Memory, Disk

### 4.3. Hot Methods (메서드 별 CPU)

Outline → Method Profiling → Hot Methods.

```
   Method                                                  Sample Count   %
   com.kgd.product.service.ProductService.search           23,456         15.2%
   org.hibernate.engine.spi.SessionImpl.flush              12,345          8.0%
   java.util.regex.Pattern.matcher                          8,901          5.8%
   ...
```

→ search() 가 hot path. 그 안에서 어떤 메서드가 시간 잡는지 stack trace 로 drill-down.

### 4.4. Allocation Hot Spots

Outline → Memory → Allocation in New TLAB / Outside TLAB.

```
   Allocation Class                       Total Allocation   Count
   byte[]                                       1.2 GB        500,000
   java.lang.String                             400 MB        2,000,000
   com.kgd.product.dto.ProductDto                250 MB          1,000,000
   ...
```

→ 어떤 객체가 가장 많이 할당되는지. ProductDto 가 100만 개 = 너무 많으면 캐싱/streaming 검토.

stack trace 로 **누가 그 객체를 할당하는가** 까지 추적.

### 4.5. GC 분석

Outline → Garbage Collections.

- GC 횟수 / 시간
- pause time histogram
- promotion 통계
- 로그와 같은 정보지만 시각화 우수

### 4.6. Thread / Lock Contention

Outline → Threads → Lock Instances.

```
   Lock Class                              Contention Count   Total Time
   java.util.concurrent.locks.ReentrantLock     1,234         5.2 s
   ProductService.cacheLock                       456         1.8 s
```

→ ProductService 의 cacheLock 이 1.8초간 경합. lock contention 탐지.

#3 동시성 plan 의 영역과 겹침 — JFR 은 GC + 동시성을 한꺼번에 본다.

### 4.7. JIT Compilation

Outline → Code → Compilations.

- 어떤 메서드가 C1/C2 컴파일됐는지
- deopt 빈도
- Code Cache 사용량

---

## 5. Custom JFR Event 작성

서비스 도메인 이벤트도 JFR 로 기록 가능 — 비즈니스 메트릭과 GC/CPU 를 한 화면에서 볼 수 있어 매우 강력.

```kotlin
import jdk.jfr.*

@Name("com.kgd.product.OrderEvent")
@Label("Order Processed")
@Category("Commerce")
@Description("Tracks order processing")
@StackTrace(false)
class OrderEvent : Event() {
    @Label("Order ID")
    var orderId: Long = 0
    @Label("Amount")
    var amount: Double = 0.0
}

// 사용
@Service
class OrderService {
    fun process(order: Order) {
        val event = OrderEvent()
        event.begin()
        try {
            event.orderId = order.id
            event.amount = order.amount.toDouble()
            // ... 비즈니스 로직 ...
        } finally {
            event.commit()
        }
    }
}
```

JMC 에서 OrderEvent 가 별도 카테고리로 보이고, 같은 timeline 위에서 GC/CPU 와 같이 분석 가능.

---

## 6. JFR 의 운영 활용 패턴

### 패턴 1 — Always-on continuous recording

```bash
-XX:StartFlightRecording=settings=default,maxage=24h,maxsize=300M,filename=/var/log/jvm/cont.jfr,dumponexit=true
```

장애 발생 시:
```bash
jcmd <pid> JFR.dump name=continuous filename=/tmp/incident.jfr
```

→ 직전 24시간 데이터 보존. 사후 분석.

### 패턴 2 — On-demand 30분 프로파일

문제 의심 시 잠깐 켰다 끄기:
```bash
jcmd <pid> JFR.start duration=30m filename=/tmp/diag.jfr settings=profile
```

### 패턴 3 — Spring Boot Actuator 통합

`spring-boot-starter-actuator` 의 startup endpoint 와 별개로 직접 JFR 컨트롤러 작성 가능:

```kotlin
@RestController
@RequestMapping("/actuator/jfr")
class JfrController {
    @PostMapping("/start")
    fun start() {
        // FlightRecorder.getFlightRecorder() ...
    }
}
```

권장: 직접 작성보다는 jcmd 로 충분.

---

## 7. msa 적용안

### 부분 적용 — analytics 서비스부터

analytics 는 Kafka Streams 가 돌아 throughput / allocation 패턴이 복잡 → JFR 로 hot allocation 추적이 큰 가치.

`commerce.jib-convention.gradle.kts` 에 옵션 추가:
```kotlin
container {
    jvmFlags = listOf(
        "-XX:+UseContainerSupport",
        "-XX:MaxRAMPercentage=70.0",
        "-XX:StartFlightRecording=settings=default,maxage=12h,maxsize=200M,filename=/var/log/jvm/cont.jfr,dumponexit=true",
    )
}
```

12h × 200MB → 일평균 한 번 dump 회전. 디스크 영향 작음.

### 영구 보존

JFR dump 를 PVC 에 두거나, 사이드카가 정기적으로 S3 업로드.

---

## 8. 면접 답변

### 질문: 운영에서 JVM 성능 모니터링 어떻게 하시나요?

> "기본은 Prometheus + Micrometer 의 JVM 메트릭 (메모리, GC, 스레드) 입니다. 평소엔 메트릭으로 추적하고 의심 상황에서 JFR 을 켭니다.
>
> JFR 은 영향이 < 1% 라 운영에서 always-on 으로도 가능합니다. msa 의 일부 서비스는 12시간 회전으로 켜두고 장애 시 직전 데이터를 dump 받습니다. JMC 에서 hot method, allocation hotspot, lock contention 을 한 화면에서 봐 매우 효율적입니다."

---

## 9. 함정

| 함정 | 대응 |
|---|---|
| settings=profile 이 너무 무거움 | settings=default 운영 권장. profile 은 단발 |
| 24h JFR 파일 200MB 넘침 | maxsize 명시 필수 |
| JMC 가 .jfr 파일 못 열음 (버전 mismatch) | JMC 9+ 권장. JDK 25 의 JFR 은 JMC 8.x 일부 호환 안 됨 |
| 메모리 영향 없다고 운영에 부주의 | settings=profile 이라면 1-2% 영향 — peak load 때 0.5% 가 critical 일 수도 |
| Custom Event 가 너무 많음 | 핫 코드의 모든 메서드에 박으면 의미 없음. 비즈니스 milestone 만 |

---

## 다음 학습

- [10-jit-compilation.md](10-jit-compilation.md) — JFR 의 Compilation 이벤트 이해
- [17-lab-jmh.md](17-lab-jmh.md) — micro 벤치마크
- [20-observability-prometheus.md](20-observability-prometheus.md) — 평상시 메트릭 모니터링
