---
parent: 2-jvm-gc
seq: 02
title: 객체 할당 흐름 — TLAB → Eden → Survivor → Old
type: deep
created: 2026-05-01
---

# 02. 객체 할당 흐름

## TL;DR

새 객체는 거의 다 **자기 스레드의 TLAB**(Thread-Local Allocation Buffer) 안에서 bump-pointer 로 할당된다. TLAB 가 차면 다른 TLAB 를 받거나 직접 Eden 에 할당. Minor GC 에서 살아남으면 Survivor → Old 로 promotion. **할당 99.9%는 Lock-free 한 포인터 증가 한 번**이라는 점이 JVM 의 핵심 성능 비결이다.

```
   ┌────────────────────────────────────────────────────────────────┐
   │                          Young Generation                       │
   │  ┌─────────── Eden ───────────┐  ┌─ Surv 0 ─┐  ┌─ Surv 1 ─┐ │
   │  │  TLAB(T1) │ TLAB(T2) │ ... │  │   from   │  │    to    │ │
   │  └────────────────────────────┘  └──────────┘  └──────────┘ │
   │                  │                                              │
   │                  │ TLAB full → 새 TLAB or Slow path             │
   │                  │ Eden full → Minor GC                          │
   │                  ▼                                              │
   │            (살아남으면 Survivor 로 복사)                          │
   └────────────────────────────────────────────────────────────────┘
                              │ age >= MaxTenuringThreshold
                              ▼
   ┌────────────────────────────────────────────────────────────────┐
   │                      Old Generation                              │
   │           promoted 객체, Humongous (G1 region 50%+)              │
   └────────────────────────────────────────────────────────────────┘
```

---

## 1. TLAB (Thread-Local Allocation Buffer)

### 왜 필요한가

힙은 모든 스레드가 공유 → 동시에 객체를 할당하면 **잠금 경쟁**이 일어난다. Java 에서 `new Foo()` 가 lock 을 잡으면 멀티스레드 throughput이 망가진다.

해법: 각 스레드에 **자기만의 작은 Eden 영역(TLAB)** 을 미리 떼어준다. 그 안에서는 *bump-pointer 한 줄짜리 포인터 증가* 만으로 할당. lock 도 CAS 도 필요 없음.

```
TLAB 내부:
   ┌─────────────────────────────────────┐
   │ obj1 │ obj2 │ obj3 │  free space ▶  │
   └─────────────────────────────────────┘
                       ↑ top pointer
                                 ↑ end
```

할당 로직 (의사코드):
```c
ptr = thread.tlab.top
if (ptr + size <= thread.tlab.end) {
    thread.tlab.top = ptr + size
    return ptr     // fast path: 인라인된 어셈블리 몇 줄
}
// slow path: 새 TLAB 받기 또는 Eden 직접 할당
```

### 옵션

| 옵션 | 의미 |
|---|---|
| `-XX:+UseTLAB` | 활성 (기본 ON) |
| `-XX:TLABSize=N` | 초기 TLAB 크기 (보통 자동 적응) |
| `-XX:+ResizeTLAB` | 사용 패턴에 따라 자동 조정 (기본 ON) |
| `-XX:-UseTLAB` | 끄면 모든 할당이 lock-contended slow path |

### 큰 객체

TLAB 크기를 넘는 객체는 TLAB 안에 못 들어감 → **Eden 에 직접 할당** (lock 동반). G1 region 의 **50% 를 넘으면 Humongous** 로 분류되어 Old 의 humongous region 으로 직행.

### 진단

```bash
# JFR 이벤트로 TLAB 통계
jcmd <pid> JFR.start duration=30s settings=default filename=alloc.jfr
# JMC 에서 "TLAB Allocations" 패널 — 어느 클래스가 얼마나 할당했는지
```

---

## 2. 객체 생애 사이클

### 단계별 추적

```kotlin
class Order(val id: Long, val items: List<OrderItem>)

fun handleRequest(): Order {
    val items = listOf(OrderItem("A"), OrderItem("B"))   // (1)
    return Order(1L, items)                              // (2)
}
```

1. **(1) 할당**: `OrderItem` 2개 + `ArrayList` 1개 → 호출 스레드의 TLAB top 에 bump
2. **(2) 또 할당**: `Order` 1개 → 같은 TLAB
3. **메서드 리턴 후**: 호출자가 참조 안 하면 reachability 끊김 → 죽은 객체
4. **다음 Minor GC**: Eden 에서 **살아있는 것만 Survivor 로 복사**, 나머지는 통째로 비움 (Copying GC 의 묘미)
5. **반복 생존**: age 가 `MaxTenuringThreshold` (G1 기본 15) 도달 → Old 로 promote

### Survivor 0 / 1 의 역할

Copying GC 는 항상 **두 영역**을 필요로 한다 — 하나는 from(소스), 하나는 to(목적지). Minor GC 마다 from↔to 가 swap.

```
Minor GC #1:
   Eden + Surv0(from) ───copy live──> Surv1(to)
                                       (from 은 비워짐)
Minor GC #2:
   Eden + Surv1(from) ───copy live──> Surv0(to)
```

이래서 항상 **두 Survivor 중 하나는 비어있어야 정상**. 둘 다 차있으면 G1/Parallel 이 옛날처럼 단순한 Copy 를 못 하고 promotion 압박 증가.

### age 와 TenuringThreshold

```
객체 age 카운터: Minor GC 살아남을 때마다 +1
age >= MaxTenuringThreshold (또는 TargetSurvivorRatio 채우면) → Old 로 promote
```

- Parallel GC: `-XX:MaxTenuringThreshold=15` (기본 15)
- G1: `-XX:MaxTenuringThreshold=15` (기본 15) — 단 G1 은 동적으로 줄이기도 함
- ZGC Generational: 비슷하나 region 단위로 관리

---

## 3. Promotion 트리거

객체가 Old 로 옮겨지는 경우는 4가지:

1. **Age 도달**: MaxTenuringThreshold 만큼 살아남음
2. **Survivor 부족**: 살아남은 객체가 Survivor 한 칸에 다 못 들어감 → 일부를 Old 로 직행 (premature promotion)
3. **Humongous**: G1 에서 region 50% 이상 크기의 배열/객체 → Old humongous region 으로 직행
4. **Allocation Failure**: Eden 도 가득, Survivor 도 가득 → 비상 promotion

**premature promotion**(2번) 이 자주 일어나면 Old 가 빠르게 차고 → Mixed GC / Full GC 빈도 증가 → 성능 저하. 흔한 튜닝 이슈.

---

## 4. Allocation Rate (할당률)

### 정의

**시간당 객체 할당량** (MB/s 또는 GB/s). GC 부담의 근본 지표. GC 로그에서:

```
[gc] Eden regions: 20->0(35)
```

→ 20개 region (region당 4MB 가정 → 80MB) 가 차서 Minor GC 발동, GC 후 35개로 확장.
**할당률 = (Eden 비워진 양) / (GC 간격)**

### 일반적 수치 감각

| 서비스 유형 | 할당률 |
|---|---|
| 작은 API | 50~200 MB/s |
| 일반 웹 서비스 | 200 MB/s ~ 1 GB/s |
| 데이터 처리 서비스 | 1~5 GB/s |
| 스트림/배치 | 5+ GB/s |

할당률이 높다고 무조건 나쁜 건 아니다. **얼마나 많은 객체가 살아남느냐**(survivor rate)가 더 중요. 1GB/s 할당해도 99% 가 죽는다면 Minor GC 가 빠르게 끝남.

### 측정

```
$ tail -f gc.log
[5.123s][info][gc] GC(42) Pause Young (Normal) (G1 Evacuation Pause) 800M->100M(1024M) 25.3ms
                                                                     ↑      ↑     ↑
                                                                Before  After  Total

# 직전 GC 가 N 초 전이었다면 할당률 ≈ (After[t-1]에서 Before[t]가 늘어난 양) / N
```

GCEasy.io 에 로그 업로드하면 자동 계산.

---

## 5. Escape Analysis & Stack Allocation (JIT 최적화)

C2 컴파일러는 **객체가 메서드를 escape 하지 않으면** 힙 할당을 생략하고 **스택 또는 레지스터에 풀어서**(scalar replacement) 처리한다.

```kotlin
fun sum(): Long {
    val pair = Pair(1L, 2L)   // 메서드 밖으로 안 나감
    return pair.first + pair.second
}
```

C2 가 인라이닝 후 분석 → `Pair` 객체는 만들지 않고 두 개의 long 변수로 분해. **객체 0개 할당.**

상세는 10번 파일.

---

## 6. msa 코드 예시

### 좋은 패턴 — 짧은 수명

```kotlin
@RestController
class ProductSearchController(private val service: ProductSearchService) {
    @GetMapping("/products/search")
    fun search(@RequestParam q: String, pageable: Pageable): ApiResponse<Page<ProductDto>> {
        val result = service.search(q, pageable)        // 결과 DTO 들 — Eden 에만 살았다 죽음
        return ApiResponse.ok(result)                   // Wrapper 도 Eden
    }
}
```

요청-응답 한 번에 객체 100~1000개 할당 → 99% 가 응답 직후 도달성 끊김 → Minor GC 에서 즉사. **이게 정상 패턴**.

### 나쁜 패턴 — 의도치 않은 캐시

```kotlin
@Service
class BadCacheService {
    private val cache = ConcurrentHashMap<String, Order>()  // 무한 증가 가능

    fun get(id: String): Order = cache.getOrPut(id) { loadFromDb(id) }
    // 만료/eviction 없음 → 객체가 영원히 Old 에 쌓임 → Old GC 빈도 증가 → 결국 OOM
}
```

해법: Caffeine, `@Cacheable(...)` + TTL, 명시적 사이즈 한도.

### 의외로 위험한 패턴 — 큰 컬렉션 한 방

```kotlin
fun loadAllProducts(): List<Product> = repository.findAll()  // DB row 100만 개
```

- `findAll()` 결과 List 가 4MB 를 넘으면 G1 에서 Humongous → Old 직행
- 100만 개 객체가 한꺼번에 Eden → Survivor 폭주 → premature promotion → Old 채움 → Mixed GC 빈발
- 해법: Pagination, Streaming (`@QueryHint org.hibernate.fetchSize` + `Stream<Product>`)

---

## 7. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "객체는 무조건 Eden 에 할당" | TLAB 라는 Eden 의 더 작은 단위에 들어감. 큰 객체만 Eden 직접 |
| "큰 객체는 무조건 Old" | Parallel 등에서는 그냥 Eden, G1 에서만 Humongous 룰 적용 |
| "TLAB 크기는 고정" | `ResizeTLAB` 가 동적 조정. 스레드별로 다를 수 있음 |
| "MaxTenuringThreshold 가 항상 15" | G1 은 동적으로 줄이기도. 로그에서 `Desired survivor size` 확인 |
| "Survivor 비우는 게 GC 임무" | 정확히는 Eden+Survivor(from) 의 살아있는 객체를 Survivor(to) 로 복사. 비우는 건 부수 효과 |
| "할당률만 낮으면 GC 안전" | 할당률 낮아도 모든 객체가 살아남으면 Old 압박. 살아남는 비율이 더 중요 |

---

## 다음 학습

- [03-gc-roots-reachability.md](03-gc-roots-reachability.md) — 어떤 객체가 살아있다고 판단하는가
- [04-gc-algorithms-basics.md](04-gc-algorithms-basics.md) — Mark-Sweep / Copy / Compact
- [06-g1gc-deep.md](06-g1gc-deep.md) — G1 에서 region 단위 할당
