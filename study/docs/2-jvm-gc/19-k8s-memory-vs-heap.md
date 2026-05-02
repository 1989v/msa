---
parent: 2-jvm-gc
seq: 19
title: K8s 메모리 리밋 ↔ JVM 힙 비율 — 정확한 산정 공식
type: deep
created: 2026-05-01
---

# 19. K8s 메모리 리밋 ↔ JVM 힙 비율

## TL;DR

K8s `limits.memory` 는 **컨테이너 RSS 의 한도**. JVM 의 RSS = **힙 + 모든 native 영역**. 힙을 limit 의 X% 로만 잡으면 (1-X)% 가 native 예산이 된다. **이 공식이 OOMKilled 방지의 핵심**. 보통 70-75% 가 안전 영역. msa 의 1Gi limit 기준 권장은 **힙 70% (~715MB) + Metaspace 256MB + Thread 80MB + Code Cache 128MB + Direct 64MB + GC Internal 50MB + 여유 30MB**. 정확한 산정 없이 75% 박으면 250MB 의 native 예산이 빠듯해 OOMKilled 가능.

```
   Container Memory Limit (1 Gi)
   ┌────────────────────────────────────────────────────────────────┐
   │  JVM Heap (X%)                                                  │
   │  ┌─────────────────────────────────────────────────────────┐  │
   │  │  -Xmx (Eden + Survivor + Old)                            │  │
   │  └─────────────────────────────────────────────────────────┘  │
   │                                                                  │
   │  Native (1-X%)                                                  │
   │  ┌─────────┬─────────┬─────────┬─────────┬─────────┬─────┐  │
   │  │Metaspace│ Thread  │CodeCache│ Direct  │GC Intnl │여유 │  │
   │  └─────────┴─────────┴─────────┴─────────┴─────────┴─────┘  │
   └────────────────────────────────────────────────────────────────┘
                          │
                          ▼ RSS 가 limit 초과시
                 ┌────────────────────┐
                 │  K8s OOMKiller      │
                 │  → SIGKILL          │
                 │  → Pod restart      │
                 └────────────────────┘
```

---

## 1. 산정 공식

### 메모리 예산

```
Container Limit
   = Heap (-Xmx)
   + Metaspace
   + Thread Stacks (스레드 수 × -Xss)
   + Code Cache
   + Direct Memory
   + GC Internal (G1 RSet 등)
   + Symbol / Internal / 여유
```

### Conservative 공식

```
Heap         = limit × 0.65 ~ 0.70
Metaspace    = limit × 0.10  (최소 128MB)
Thread       = 스레드수 × 1MB  (보통 50-80MB)
Code Cache   = limit × 0.10  (64-128MB)
Direct       = limit × 0.05  (32-64MB)
GC Internal  = limit × 0.05
여유         = limit × 0.05
   ─────────────────────────────────
            ≈ 100% (한도 내)
```

### Aggressive (작은 limit)

작은 서비스 (gateway 256MB) 는 옵션 한도 더 작게:

```
Heap         = limit × 0.65 = 166MB
Metaspace    = 96MB
Code Cache   = 48MB
Direct       = 16MB
Thread       = 30MB
여유         = 0
```

빠듯 — 측정으로 검증 필수.

---

## 2. msa 서비스별 산정

### 2.1 product / order / search / member / wishlist (1Gi limit)

```kotlin
// 권장
"-XX:MaxRAMPercentage=70.0",          // 717 MB heap
"-XX:MaxMetaspaceSize=256m",
"-XX:ReservedCodeCacheSize=128m",
"-XX:MaxDirectMemorySize=64m",
// Thread: ~50개 × 1MB = 50MB
// GC Internal: ~50MB (G1)
// 합계: 717 + 256 + 128 + 64 + 50 + 50 = 1,265 MB
//                                        ↑ 1Gi (1024MB) 초과!
```

→ **1Gi limit 으론 부족**. 옵션 줄이거나 limit 1.5Gi 권장:

```yaml
resources:
  requests:
    memory: 768Mi
  limits:
    memory: 1.5Gi    # 1Gi → 1.5Gi
```

또는 옵션 더 보수적:

```kotlin
"-XX:MaxRAMPercentage=65.0",      // 666 MB
"-XX:MaxMetaspaceSize=192m",
"-XX:ReservedCodeCacheSize=96m",
"-XX:MaxDirectMemorySize=32m",
// Thread: 40MB
// GC: 40MB
// 합계: 666 + 192 + 96 + 32 + 40 + 40 = 1,066 MB → 1Gi 빠듯
```

실측 후 fine-tune.

### 2.2 gateway (512Mi limit)

```kotlin
"-XX:MaxRAMPercentage=65.0",      // 333 MB
"-XX:MaxMetaspaceSize=128m",
"-XX:ReservedCodeCacheSize=64m",
"-XX:MaxDirectMemorySize=32m",
// Thread: 30MB (router 가 thread 적음)
// GC: 20MB (G1 작은 힙)
// 합계: 333 + 128 + 64 + 32 + 30 + 20 = 607 MB → 512Mi 초과!
```

→ 512Mi limit 도 부족. 권장:
- limit 768Mi 로 올리기 OR
- Spring Boot AOT 컴파일 (JDK 25 Project Leyden) 으로 Metaspace 줄이기 OR
- Quarkus / Spring Native 검토

### 2.3 analytics (Kafka Streams, 1Gi)

Kafka Streams 가 RocksDB 사용 → **off-heap 추가 점유** (수백 MB 가능).

```kotlin
"-XX:MaxRAMPercentage=55.0",      // 562 MB heap (낮춤)
"-XX:MaxMetaspaceSize=256m",
"-XX:ReservedCodeCacheSize=128m",
"-XX:MaxDirectMemorySize=128m",   // Kafka client direct buffer
// RocksDB native: ~200MB (Streams state store)
```

분석 서비스는 **메모리 한도 2Gi+ 필요** 가 일반적.

### 2.4 quant (트레이딩)

ZGC 후보 — ZGC 는 native footprint 더 큼 (compressed oops 못 씀).

```kotlin
"-XX:+UseZGC",
"-XX:MaxRAMPercentage=60.0",      // ZGC footprint 고려해 더 낮춤
"-XX:MaxMetaspaceSize=256m",
"-XX:SoftMaxHeapSize=600m",       // soft 한도
"-XX:MaxDirectMemorySize=64m",
```

힙 1Gi → 빠듯. **2Gi limit 추천** (실시간 거래 안전성 우선).

---

## 3. cgroup v2 의 차이

### v1 vs v2

| | cgroup v1 | cgroup v2 |
|---|---|---|
| 메모리 한도 파일 | `/sys/fs/cgroup/memory/memory.limit_in_bytes` | `/sys/fs/cgroup/memory.max` |
| Soft limit | `memory.soft_limit_in_bytes` | `memory.high` |
| 사용량 | `memory.usage_in_bytes` | `memory.current` |
| OOM | `memory.oom_control` | `memory.events` |

JDK 17+ 부터 cgroup v2 인식. K8s 1.25+ 에서 cgroup v2 default.

### JVM 인식 검증

```bash
kubectl exec -n commerce product-xxx -- jcmd 1 VM.flags | grep -i ram
# -XX:MaxHeapSize=750000000 (727 MB)   ← limit × 0.75
```

값이 0 이거나 호스트 메모리 기반이면 cgroup 인식 실패.

### Container Awareness 강제

```kotlin
"-XX:+UseContainerSupport",   // 강제 활성 (default 라도 명시)
```

---

## 4. K8s requests 와 limits

### 차이

| | 의미 |
|---|---|
| `requests.memory` | 스케줄러가 보장하는 최소 메모리 — 노드 선택 기준 |
| `limits.memory` | 컨테이너 RSS 한도 — 초과 시 OOMKilled |

JVM 입장에서는 `limits` 만 본다 (cgroup 한도). `requests` 는 K8s 스케줄링용.

### Burstable vs Guaranteed

```yaml
# Burstable (requests < limits)
resources:
  requests:
    memory: 512Mi    # 보장
  limits:
    memory: 1Gi      # 한도

# Guaranteed (requests == limits)
resources:
  requests:
    memory: 1Gi
  limits:
    memory: 1Gi
```

**Guaranteed 가 운영 권장** — 노드 메모리 압박 시 guaranteed pod 가 우선 보호. 단 메모리 효율 ↓.

---

## 5. msa 의 현재 K8s 설정

### `k8s/base/product/deployment.yaml`

```yaml
resources:
  requests:
    cpu: 100m
    memory: 512Mi
  limits:
    memory: 1Gi
```

### `k8s/overlays/prod-k8s/patches/resources.yaml`

```yaml
resources:
  requests:
    cpu: 200m
    memory: 1Gi
  limits:
    cpu: "2"
    memory: 2Gi
```

prod overlay 에서 **2Gi limit + 1Gi request** (Burstable). 위 산정에 따르면 2Gi 가 더 안전한 값.

### k3s-lite overlay

```yaml
# k8s/overlays/k3s-lite/patches/resources-reduce.yaml
resources:
  requests:
    memory: 256Mi
  limits:
    memory: 512Mi
```

로컬 k3d 용 축소 overlay. 빠듯하므로 lab 외 운영 부하 X.

---

## 6. 모니터링 / 알람

### Prometheus 쿼리

```promql
# 컨테이너 RSS
container_memory_working_set_bytes{namespace="commerce"}

# limit 대비 사용률
container_memory_working_set_bytes{namespace="commerce"} 
  / on(pod, namespace) kube_pod_container_resource_limits{resource="memory"}

# JVM 힙 사용량
jvm_memory_used_bytes{area="heap", namespace="commerce"}

# JVM Metaspace
jvm_memory_used_bytes{id="Metaspace"}

# 힙 / RSS 비율 (이상치 감지)
jvm_memory_used_bytes{area="heap"} / container_memory_working_set_bytes
```

### 알람

```yaml
- alert: ContainerMemoryNearLimit
  expr: |
    container_memory_working_set_bytes / kube_pod_container_resource_limits{resource="memory"} > 0.9
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Pod {{ $labels.pod }} RSS > 90% of limit"

- alert: JvmMetaspaceUnboundedGrowth
  expr: |
    deriv(jvm_memory_used_bytes{id="Metaspace"}[1h]) > 0
    and on() time() - jvm_memory_used_bytes{id="Metaspace"} offset 24h > 0
  for: 24h
  annotations:
    summary: "Metaspace continuously growing — ClassLoader leak suspected"
```

---

## 7. 실측 검증 절차

### 단계 1. 배포

옵션 적용한 이미지 배포.

### 단계 2. Warm-up

부하 5-10분 → JIT 안정.

### 단계 3. 메모리 스냅샷

```bash
kubectl exec -n commerce product-xxx -- jcmd 1 VM.native_memory summary > nmt-base.txt
kubectl exec -n commerce product-xxx -- jcmd 1 VM.flags > flags.txt
```

### 단계 4. 부하 30분 + 스냅샷

```bash
kubectl exec -n commerce product-xxx -- jcmd 1 VM.native_memory summary > nmt-after.txt
kubectl exec -n commerce product-xxx -- jcmd 1 VM.native_memory baseline
# 추가 30분
kubectl exec -n commerce product-xxx -- jcmd 1 VM.native_memory summary.diff > nmt-diff.txt
```

### 단계 5. 분석

- 각 영역 committed 합 vs limit
- diff 에서 단조 증가하는 영역 (누수 후보)
- RSS 수렴 여부

---

## 8. 흔한 실수

### 실수 1 — 힙만 보고 limit 결정

```
"우리 힙이 500MB 이니 limit 도 500MB 면 충분"
```

→ Metaspace + Thread + Code Cache 가 추가 200MB+. RSS 700MB 가 500MB limit 에 부딪혀 OOMKilled.

### 실수 2 — limit 변경 시 -Xmx 안 따라감

```yaml
limits:
  memory: 2Gi    # 1Gi → 2Gi 증가
```

`MaxRAMPercentage=75` 면 자동 추적. 단 절대값 `-Xmx1g` 박혀있으면 변경 안 됨. **무조건 비율 사용**.

### 실수 3 — request == limit 만 안전하다고 믿음

K8s OOMKiller 는 limit 기준만 본다. request 가 작아도 RSS 가 limit 안이면 OK.

### 실수 4 — Direct buffer 한도 안 박음

Netty / Kafka 사용 서비스에서 `MaxDirectMemorySize` 안 박으면 default = `Xmx`. 힙 750MB + direct 750MB = 1.5GB → OOMKilled.

---

## 9. 권장 메모리 한도 표

| 서비스 유형 | request | limit | -XX:MaxRAMPercentage | 비고 |
|---|---|---|---|---|
| 작은 라우터 (gateway) | 256Mi | 768Mi | 60 | AOT 검토 |
| 일반 API (product/order/etc) | 1Gi | 1.5Gi | 70 | |
| 검색 (search) | 1Gi | 2Gi | 70 | ES client buffer 고려 |
| 분석 (analytics) | 1.5Gi | 3Gi | 55 | RocksDB native 큼 |
| 트레이딩 (quant) | 1.5Gi | 2Gi | 60 | ZGC, latency 우선 |

prod-k8s overlay 의 default 인 2Gi limit 이 대부분 적절. 더 줄이면 산정해서 검증 필수.

---

## 10. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "limits.memory = 힙 크기" | RSS 한도. 힙 + native 모두 |
| "-Xmx 만 박으면 충분" | Metaspace, Code Cache 등 별도 한도 필요 |
| "MaxRAMPercentage=75 가 항상 안전" | 작은 limit (< 1Gi) 에선 65-70 권장 |
| "OOMKilled 는 JVM 가 던진 OOM" | 다름. OS / cgroup 이 죽임 |
| "request 메모리가 보장이라 안전" | request 가 큰 게 노드 선택 기준일 뿐, OOMKiller 는 limit 만 봄 |
| "request == limit 가 무조건 좋다" | 메모리 효율 trade. burstable 도 OK (운영 노드 압박 적으면) |

---

## 다음 학습

- [11-nmt-native-memory.md](11-nmt-native-memory.md) — 영역 분해
- [20-observability-prometheus.md](20-observability-prometheus.md) — 메트릭 알람 설정
- [21-improvements.md](21-improvements.md) — ADR 초안 (메모리 산정 표 포함)
