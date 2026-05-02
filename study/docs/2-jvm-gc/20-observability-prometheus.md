---
parent: 2-jvm-gc
seq: 20
title: 관측성 — Prometheus + Micrometer JVM 메트릭
type: deep
created: 2026-05-01
---

# 20. 관측성 — Prometheus + Micrometer

## TL;DR

msa 의 모든 JVM 서비스는 이미 **Spring Boot Actuator + Micrometer Prometheus** 통합이 끝나있다 (`common/build.gradle.kts` 의 `spring-boot-starter-actuator`, `product/app/build.gradle.kts` 의 `micrometer-registry-prometheus`). 그리고 `k8s/infra/prod/monitoring/servicemonitor-apps.yaml` 의 ServiceMonitor 가 모든 commerce 라벨 pod 의 `/actuator/prometheus` 를 자동 수집. **수집 인프라는 다 있다 — 활용도가 부족할 뿐**. 본 절은 JVM 핵심 메트릭 시리즈, 알람 룰, Grafana 패널, 그리고 운영에서 봐야 하는 7개 panel 을 정리한다.

---

## 1. 현재 msa 인프라 (확인)

### `common/build.gradle.kts`

```kotlin
implementation(libs.spring.boot.starter.actuator)
```

→ 모든 서비스가 actuator 자동 포함 (common 의존).

### `product/app/build.gradle.kts`

```kotlin
implementation("io.micrometer:micrometer-registry-prometheus")
```

→ `/actuator/prometheus` 엔드포인트 활성화. JVM 메트릭 자동 노출.

### `k8s/infra/prod/monitoring/servicemonitor-apps.yaml`

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: commerce-platform-apps
  namespace: monitoring
spec:
  namespaceSelector:
    matchNames:
      - commerce
  selector:
    matchLabels:
      app.kubernetes.io/part-of: commerce-platform
  endpoints:
    - port: http
      path: /actuator/prometheus
      interval: 30s
      scrapeTimeout: 10s
```

→ 자동 수집. 30초 간격.

### `k8s/infra/prod/monitoring/dashboards/jvm-dashboard.json`

JVM 전용 Grafana 대시보드 이미 존재 — 메모리 사용량, GC, threads.

**즉, 인프라는 완비.**

---

## 2. JVM 핵심 메트릭

### 2.1 메모리 영역별

```promql
# Heap (Young + Old)
jvm_memory_used_bytes{area="heap", application="product"}
jvm_memory_max_bytes{area="heap"}
jvm_memory_committed_bytes{area="heap"}

# Heap 세부 영역 (G1)
jvm_memory_used_bytes{id="G1 Eden Space"}
jvm_memory_used_bytes{id="G1 Survivor Space"}
jvm_memory_used_bytes{id="G1 Old Gen"}

# Metaspace
jvm_memory_used_bytes{id="Metaspace"}
jvm_memory_used_bytes{id="Compressed Class Space"}

# Code Cache (3분할)
jvm_memory_used_bytes{id=~"CodeHeap.*"}

# Direct Buffer
jvm_buffer_memory_used_bytes{id="direct"}
jvm_buffer_count_buffers{id="direct"}
```

### 2.2 GC

```promql
# GC 횟수
rate(jvm_gc_pause_seconds_count[5m])

# GC pause 시간 (per minute)
rate(jvm_gc_pause_seconds_sum[5m]) * 60

# GC 종류별
jvm_gc_pause_seconds_count{action="end of minor GC", gc="G1 Young Generation"}
jvm_gc_pause_seconds_count{action="end of major GC", gc="G1 Old Generation"}

# Allocation rate
rate(jvm_gc_memory_allocated_bytes_total[5m])

# Promotion rate
rate(jvm_gc_memory_promoted_bytes_total[5m])

# pause histogram (P99)
histogram_quantile(0.99, rate(jvm_gc_pause_seconds_bucket[5m]))
```

### 2.3 Thread

```promql
jvm_threads_live_threads
jvm_threads_peak_threads
jvm_threads_states_threads{state="runnable"}
jvm_threads_states_threads{state="blocked"}
jvm_threads_states_threads{state="waiting"}
jvm_threads_started_threads_total
```

### 2.4 Class Loading

```promql
jvm_classes_loaded_classes
jvm_classes_unloaded_classes_total
```

### 2.5 JIT

```promql
process_cpu_usage              # 전체 CPU
system_cpu_count               # core 수
# JIT compile 별도 메트릭은 Micrometer 기본에 없음 → JFR / jcmd
```

### 2.6 RSS (외부)

`process_resident_memory_bytes` 는 Spring Boot Actuator 에 없고 `kube-state-metrics` 또는 `cAdvisor` 에서:

```promql
# cAdvisor (kubelet)
container_memory_working_set_bytes{namespace="commerce", container="app"}

# Prometheus node-exporter (host)
process_resident_memory_bytes
```

---

## 3. 운영에서 봐야 하는 7 패널

### Panel 1 — 메모리 영역별 스택드

```promql
# Stacked area chart
jvm_memory_used_bytes{area="heap", id="G1 Eden Space"}
jvm_memory_used_bytes{area="heap", id="G1 Survivor Space"}
jvm_memory_used_bytes{area="heap", id="G1 Old Gen"}
jvm_memory_used_bytes{id="Metaspace"}
jvm_memory_used_bytes{id="Compressed Class Space"}
jvm_memory_used_bytes{id=~"CodeHeap.*"}
jvm_buffer_memory_used_bytes{id="direct"}
```

→ 합이 RSS 와 비슷한지 확인. 차이가 크면 native 누수.

### Panel 2 — GC pause time (P50/P95/P99)

```promql
histogram_quantile(0.5, sum by (le) (rate(jvm_gc_pause_seconds_bucket[5m])))
histogram_quantile(0.95, sum by (le) (rate(jvm_gc_pause_seconds_bucket[5m])))
histogram_quantile(0.99, sum by (le) (rate(jvm_gc_pause_seconds_bucket[5m])))
```

목표 라인 (G1 default 200ms) 그리기.

### Panel 3 — GC throughput

```promql
1 - (rate(jvm_gc_pause_seconds_sum[5m]))
# 99% 이상이면 OK
```

### Panel 4 — Allocation rate

```promql
rate(jvm_gc_memory_allocated_bytes_total[5m])
```

급증 시 트래픽 증가 또는 비효율 코드 신호.

### Panel 5 — Old 세대 점유 추이

```promql
jvm_memory_used_bytes{area="heap", id="G1 Old Gen"}
jvm_memory_max_bytes{area="heap", id="G1 Old Gen"}
```

우상향 = 누수 의심.

### Panel 6 — 활성 스레드

```promql
jvm_threads_live_threads
jvm_threads_states_threads{state="blocked"}
```

blocked 가 평소보다 많으면 lock contention.

### Panel 7 — 컨테이너 RSS vs limit

```promql
container_memory_working_set_bytes{namespace="commerce"}
kube_pod_container_resource_limits{resource="memory", namespace="commerce"}
```

90% 넘으면 알람.

---

## 4. 핵심 알람 룰

```yaml
groups:
  - name: jvm-alerts
    rules:
      # OOMKilled 직전
      - alert: ContainerMemoryNearLimit
        expr: |
          container_memory_working_set_bytes{namespace="commerce"} 
            / kube_pod_container_resource_limits{resource="memory", namespace="commerce"} > 0.9
        for: 5m
        labels:
          severity: warning

      # Heap 거의 가득
      - alert: JvmHeapNearMax
        expr: |
          jvm_memory_used_bytes{area="heap"} 
            / jvm_memory_max_bytes{area="heap"} > 0.85
        for: 10m
        labels:
          severity: warning

      # GC 너무 잦음
      - alert: JvmHighGcPause
        expr: |
          rate(jvm_gc_pause_seconds_sum[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "GC time > 5% for 5 min"

      # Old 세대 무한 증가 (누수 후보)
      - alert: JvmOldGenContinuousGrowth
        expr: |
          deriv(jvm_memory_used_bytes{area="heap", id=~".*Old.*"}[30m]) > 0
        for: 2h
        labels:
          severity: warning
        annotations:
          summary: "Old gen growing for 2h — leak suspected"

      # Metaspace 무한 증가
      - alert: JvmMetaspaceUnboundedGrowth
        expr: |
          deriv(jvm_memory_used_bytes{id="Metaspace"}[1h]) > 0
        for: 6h
        annotations:
          summary: "Metaspace continuously growing — ClassLoader leak"

      # 스레드 폭증
      - alert: JvmThreadCount
        expr: jvm_threads_live_threads > 500
        for: 5m

      # Direct buffer 누수
      - alert: JvmDirectBufferLeak
        expr: |
          deriv(jvm_buffer_memory_used_bytes{id="direct"}[30m]) > 0
        for: 1h

      # Full GC 발생
      - alert: JvmFullGCOccurred
        expr: |
          increase(jvm_gc_pause_seconds_count{action="end of major GC"}[5m]) > 0
        labels:
          severity: warning
        annotations:
          summary: "Full GC happened — tuning needed"
```

---

## 5. ServiceMonitor 검증

### 현재 동작 확인

```bash
# Prometheus targets 확인
kubectl port-forward -n monitoring svc/prometheus 9090:9090
open http://localhost:9090/targets

# product 가 UP 인지
```

### Pod 직접 호출

```bash
kubectl port-forward -n commerce svc/product 8081:80
curl http://localhost:8081/actuator/prometheus | grep jvm_memory
```

### 누락된 메트릭

기본 Micrometer 가 노출 안 하는 것:
- JIT compile time → JFR 통합 필요
- NMT 영역 별 → 직접 collect 필요 (custom collector)

---

## 6. Custom 메트릭 (NMT 통합)

```kotlin
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.stereotype.Component
import javax.annotation.PostConstruct
import java.lang.management.ManagementFactory

@Component
class NmtMetricsCollector(private val registry: MeterRegistry) {
    @PostConstruct
    fun init() {
        // NMT summary 파싱은 jcmd 호출 필요 → 별도 사이드카 또는 ProcessBuilder
        // 간단 버전: JMX 제공 메트릭만
        val mx = ManagementFactory.getMemoryMXBean()
        registry.gauge("jvm.nonheap.used", mx.nonHeapMemoryUsage.used.toDouble())
    }
}
```

상세는 NMT 의 `jcmd VM.native_memory` 출력 파싱 필요. 사이드카 컨테이너로 분리 권장.

---

## 7. Grafana 대시보드

### 기존 (`k8s/infra/prod/monitoring/dashboards/jvm-dashboard.json`)

확인:
```bash
cat k8s/infra/prod/monitoring/dashboards/jvm-dashboard.json | jq '.title, .panels[].title'
```

기본 패널들:
- Heap memory (used/max)
- GC duration
- Threads
- HTTP P99 (별도 dashboard)

### 추가 권장 패널

위 7 패널 중 누락된 것 추가. JSON 직접 수정 또는 Grafana UI 에서 export.

---

## 8. 활용 워크플로우

### 일일 점검

1. JVM dashboard 의 7개 패널 빠르게 훑기
2. Old 세대 우상향 / Metaspace 증가 / Full GC 알람 확인
3. 이상 시 JFR snapshot

### 알람 발생 시

1. 알람 컨텍스트 (어느 pod, 어느 메트릭) 파악
2. dashboard 에서 시간대 zoom-in
3. 같은 시간대 트래픽 / 에러율 cross-check
4. 필요 시 JFR 트리거 (pre-인시던트 데이터 dump)
5. 누수 의심 시 heap dump

### 회귀 감지

- 신규 배포 후 30분간 GC pause P99 가 이전 배포 대비 +20% → 회귀
- CI 에 JMH 통합 (17번 lab)

---

## 9. 면접 답변

### 질문: 운영 JVM 모니터링 어떻게 하시나요?

> "Spring Boot Actuator + Micrometer Prometheus 가 기본입니다. msa 의 모든 JVM 서비스가 `/actuator/prometheus` 로 메트릭 노출하고, ServiceMonitor 가 30초 주기로 수집합니다. Grafana JVM 대시보드에 7개 패널 — heap 영역별 / GC pause P99 / GC throughput / allocation rate / Old 추이 / 스레드 / RSS vs limit — 을 띄워두고, 알람 8개 — 메모리 한도 90% / 힙 max 85% / Old 무한 증가 / Metaspace 누수 / Full GC 발생 / 스레드 폭증 등 — 으로 자동 트리거합니다.
>
> 알람 발생 시엔 JFR 으로 직전 데이터를 dump 받고, 누수 의심 시 heap dump → MAT 으로 분석합니다."

---

## 10. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "actuator 만 켜면 끝" | ServiceMonitor / scrape config 도 필요 |
| "JVM 메트릭 = 힙만" | Metaspace, Direct, Thread, JIT 모두 |
| "Prometheus 만 보면 OOM 진단 가능" | JFR + heap dump 조합 필수 |
| "Micrometer 가 NMT 자동 수집" | 일부만. 영역별 분해는 별도 collector |
| "actuator endpoint 보안 위험" | management.server.port 분리 + ingress 차단 권장 |
| "30초 scrape 가 너무 듬" | 운영 표준. 더 잦으면 카디널리티 폭발 |

---

## 다음 학습

- [21-improvements.md](21-improvements.md) — 알람 룰을 ADR 후보로
- [22-interview-qa.md](22-interview-qa.md) — 모니터링 관련 Q&A
- [09-gc-log-analysis.md](09-gc-log-analysis.md) — 메트릭과 GC 로그 cross-check
