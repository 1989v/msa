---
parent: 15-connection-pool
seq: 14
title: 풀 관측 — HikariCP MicroMeter / Lettuce metrics / Prometheus 알람 룰
type: deep
created: 2026-05-01
---

# 14. 풀 관측

풀은 *보이지 않으면 죽은 것* 과 같다. 메트릭 수집 + 대시보드 + 알람의 3축이 운영 안정성을 결정한다.

---

## HikariCP 의 MicroMeter 통합

Spring Boot 2.x 부터 `spring-boot-starter-actuator` + `micrometer-core` 만 있으면 자동.

### 노출되는 메트릭

```
hikaricp_connections                 # 풀 전체 connection 수
hikaricp_connections_active          # 사용 중
hikaricp_connections_idle            # idle
hikaricp_connections_pending         # borrow 대기 중인 thread 수
hikaricp_connections_max             # maxPoolSize
hikaricp_connections_min             # minimumIdle

hikaricp_connections_creation_seconds          # connection 생성 latency
hikaricp_connections_acquire_seconds           # borrow latency
hikaricp_connections_usage_seconds             # borrow → return 의 시간 (점유)
hikaricp_connections_timeout_total             # connectionTimeout 발생 횟수
```

각 메트릭은 `pool` 라벨로 분리 — pool-name 을 다르게 두면 master / replica 구분 가능.

### Prometheus scrape

```yaml
# application.yml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  metrics:
    tags:
      application: ${spring.application.name}
```

→ `/actuator/prometheus` 에서 노출. Prometheus operator 가 스크레이핑.

---

## 핵심 대시보드 (Grafana)

### 1. Active vs Idle 추이

```promql
hikaricp_connections_active{pool=~"$pool"}
hikaricp_connections_idle{pool=~"$pool"}
hikaricp_connections{pool=~"$pool"}    # total
```

해석:

- active 가 max 에 가까이 닿음 + idle 0 → 풀 압박
- idle 이 minIdle 에 머무름 → fillPool 동작 중
- total 이 흔들림 → maxLifetime 으로 교체 중

### 2. Pending (대기) 그래프

```promql
hikaricp_connections_pending{pool=~"$pool"}
```

이게 *지속적으로 > 0* 이면 사고. 알람 임계.

### 3. Acquire latency

```promql
histogram_quantile(0.99, 
  rate(hikaricp_connections_acquire_seconds_bucket[5m]))
```

P99 borrow latency 가 평소 1ms → 갑자기 1s 면 풀 contention.

### 4. Usage time 분포

```promql
histogram_quantile(0.99, 
  rate(hikaricp_connections_usage_seconds_bucket[5m]))
```

각 borrow → return 점유 시간. 이 값이 P99 200ms → 1s 로 늘면 트랜잭션 길이 또는 외부 IO 문제 ([08-pool-failure-patterns.md](08-pool-failure-patterns.md)).

### 5. timeout 발생

```promql
rate(hikaricp_connections_timeout_total[5m])
```

> 0 이면 connectionTimeout 발생 — 즉시 alert.

---

## Prometheus 알람 룰

```yaml
groups:
  - name: connection-pool
    interval: 30s
    rules:
      - alert: HikariPoolExhausted
        expr: |
          (hikaricp_connections_active / hikaricp_connections_max) > 0.9
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Hikari pool {{ $labels.pool }} > 90% utilization"
      
      - alert: HikariPoolPending
        expr: hikaricp_connections_pending > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Hikari pool {{ $labels.pool }} has waiting threads"
      
      - alert: HikariConnectionTimeout
        expr: rate(hikaricp_connections_timeout_total[5m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Hikari pool {{ $labels.pool }} timeout occurring"
      
      - alert: HikariUsageTimeHigh
        expr: |
          histogram_quantile(0.99, 
            rate(hikaricp_connections_usage_seconds_bucket[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Hikari pool {{ $labels.pool }} P99 usage > 500ms"
      
      - alert: HikariConnectionLeakWarn
        expr: |
          increase(logback_events_total{
            level="warn",
            logger=~"com.zaxxer.hikari.pool.ProxyLeakTask"
          }[10m]) > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Hikari leak detection triggered"
```

### 알람 우선순위

| 알람 | 의미 | 즉시 조치 |
|---|---|---|
| HikariConnectionTimeout | 사용자 영향 발생 중 | P0, 5분 내 |
| HikariPoolPending | 사용자 영향 임박 | P1, 30분 내 |
| HikariPoolExhausted | 압박 상태 | P2, 시간 내 |
| HikariUsageTimeHigh | 트랜잭션 길어짐 | P3, 다음날 |
| HikariConnectionLeakWarn | 코드 버그 의심 | P3, 다음날 |

---

## Lettuce 메트릭

Spring Boot 가 자동 노출 안 함. 명시 활성화 필요.

```kotlin
@Bean
fun lettuceClientResources(meterRegistry: MeterRegistry): ClientResources =
    ClientResources.builder()
        .commandLatencyRecorder(MicrometerCommandLatencyRecorder(
            meterRegistry,
            MicrometerOptions.create()
        ))
        .build()
```

### 노출 메트릭

```
lettuce_command_completion_count{command="GET", remote=...}
lettuce_command_completion_seconds{command, remote, quantile}
lettuce_command_firstresponse_seconds
```

### 알람

```yaml
- alert: LettuceCommandLatencyHigh
  expr: |
    histogram_quantile(0.99, 
      rate(lettuce_command_completion_seconds_bucket[5m])) > 0.05
  for: 5m
  annotations:
    summary: "Redis command P99 > 50ms — possible network or Redis issue"
```

---

## connection pool 전용 attribute (HikariMBean)

JMX 로 추가 정보:

```
com.zaxxer.hikari:type=Pool (HikariPool)
  - getActiveConnections
  - getIdleConnections
  - getThreadsAwaitingConnection
  - getTotalConnections
  - softEvictConnections   # 모든 connection markedEvicted
  - suspendPool            # borrow 일시 중단
  - resumePool
```

JMX exporter 사용해 Prometheus 에 추가 metric 으로 export 가능. 또는 Spring Actuator 의 `/actuator/metrics/hikaricp.connections.*` endpoint.

---

## 로그 기반 관측 — leak detection

leakDetectionThreshold 가 활성이면:

```
WARN  c.z.h.p.ProxyLeakTask - Apparent connection leak detected
java.lang.Exception: ...
```

이 로그를 ELK / Grafana Loki 로 수집해서 alert.

```promql
# Loki LogQL
{app="order"} |~ "Apparent connection leak detected"
```

---

## 트랜잭션 길이 측정

`hikaricp.connections.usage` 가 borrow → return 시간이지만, *transaction* 안의 외부 IO 시간은 별도 메트릭이 더 직관적.

```kotlin
@Aspect
@Component
class TransactionMetrics(private val registry: MeterRegistry) {
    
    @Around("@annotation(transactional)")
    fun measureTransaction(pjp: ProceedingJoinPoint, transactional: Transactional): Any? {
        val sample = Timer.start(registry)
        return try {
            pjp.proceed()
        } finally {
            sample.stop(registry.timer(
                "transaction.duration",
                "method", pjp.signature.toShortString(),
                "readOnly", transactional.readOnly.toString()
            ))
        }
    }
}
```

→ `transaction.duration{method="OrderService.placeOrder", readOnly="false"}` 로 메서드별 트랜잭션 길이 추적.

---

## DB-side 메트릭

서비스 측 메트릭만으로는 부족. DB 측도 동시에 봐야 4 패턴 ([08](08-pool-failure-patterns.md)) 진단 가능.

### MySQL (mysqld_exporter)

```
mysql_global_status_threads_connected           # 현재 연결 수
mysql_global_variables_max_connections          # 최대 (변경되면 알람)
mysql_global_status_aborted_connects            # 인증 실패 등
mysql_global_status_aborted_clients             # client 측 종료
mysql_global_status_questions                   # QPS
mysql_global_status_slow_queries                # slow query 카운터
mysql_slave_lag_seconds                         # replication lag
```

### 통합 dashboard 권장 패널

1. 서비스별 active / idle / pending (Hikari)
2. DB connection 수 (mysqld_exporter)
3. DB CPU / disk IOPS
4. replication lag
5. slow query rate
6. transaction duration P99 (서비스)
7. 외부 IO latency (payment 등)

이 7 패널이 한 화면에 있으면 진단 시간이 30분 → 5분.

---

## 운영 체크리스트

### 배포 전

- [ ] pool-name 이 서비스명 + 역할 (master/replica) 로 명시되어 있는가
- [ ] leakDetectionThreshold prod = 10000 인가
- [ ] connectionTimeout 이 gateway timeout 보다 짧은가
- [ ] keepaliveTime 활성 (30000) 인가

### 배포 후 1시간

- [ ] active / idle 안정적인가
- [ ] pending 0 인가
- [ ] timeout 0 인가
- [ ] usage P99 가 평소 수준인가

### 배포 후 24시간

- [ ] leak 로그 발생했는가
- [ ] maxLifetime 교체 사이클이 정상인가 (creation count 가 maxPool / 30min 정도)
- [ ] DB 측 connection count 가 예상 범위인가

---

## 핵심 포인트

- HikariCP 의 6 핵심 메트릭: connections, active, idle, pending, usage, timeout
- 알람 우선순위: timeout (P0) > pending (P1) > exhausted (P2) > usage (P3) > leak (P3)
- Lettuce 메트릭은 명시 활성 필요 — `MicrometerCommandLatencyRecorder`
- 서비스 + DB-side + 외부 IO 메트릭 *조합* 이 진단 능력
- pool-name 으로 master/replica 메트릭 분리 필수

## 다음 학습

- [08-pool-failure-patterns.md](08-pool-failure-patterns.md) — 위 메트릭으로 진단하는 4 패턴
- [16-pool-exhaustion-drill.md](16-pool-exhaustion-drill.md) — 알람 검증 시뮬레이션
- [15-codebase-audit.md](15-codebase-audit.md) — msa 메트릭 노출 현황
