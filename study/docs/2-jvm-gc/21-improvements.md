---
parent: 2-jvm-gc
seq: 21
title: msa JVM 튜닝 개선 후보 + ADR-0028 후보 초안
type: improvements
created: 2026-05-01
---

# 21. msa JVM 튜닝 개선 후보 + ADR 후보

## TL;DR

학습 결과를 바탕으로 msa 의 JVM/GC 운영을 개선할 **10개 제안** 을 우선순위로 정리. **현재 ADR 없음** → ADR-0028 (가칭) 신설 후보. 핵심: (1) GC 로그 / 자동 dump 가 빠진 게 가장 큰 운영 risk. (2) MaxRAMPercentage=75 가 1Gi limit 에선 빠듯. (3) 모니터링 인프라는 이미 완비 — **알람 룰만 추가 필요**.

---

## 1. 개선 제안 매트릭스

| # | 제안 | 우선순위 | 영향 범위 | 작업량 | ADR 필요 |
|---|---|---|---|---|---|
| 1 | GC 로그 / 자동 Heap Dump / NMT 활성화 | **P0** (즉시) | 모든 JVM 서비스 | S (1일) | Yes |
| 2 | MaxRAMPercentage 75 → 70 + 영역 한도 명시 | **P0** | 모든 JVM 서비스 | S | Yes |
| 3 | JVM 핵심 알람 룰 8개 추가 | **P0** | monitoring | XS | No (운영) |
| 4 | quant 에 ZGC 적용 검토 | P1 | quant | M (PoC + 부하) | Yes |
| 5 | 메모리 한도 산정 표 → ADR 부록 | P1 | docs | S | Yes |
| 6 | analytics 의 RocksDB native footprint 측정 + limit 조정 | P1 | analytics | M | No (운영) |
| 7 | gateway 의 AOT (Spring Boot Native) PoC | P2 | gateway | L | Yes |
| 8 | JFR continuous recording 활성화 | P2 | 우선 1-2개 서비스 | S | Yes |
| 9 | JMH 회귀 측정 CI 통합 | P2 | benchmark 모듈 | L | Yes |
| 10 | Grafana JVM dashboard 패널 보강 (7개) | P2 | monitoring | S | No |

---

## 2. P0 제안 상세

### 제안 1: GC 로그 / 자동 Dump / NMT 활성화

#### 현 문제

현 `commerce.jib-convention.gradle.kts` 의 `jvmFlags`:
```kotlin
jvmFlags = listOf(
    "-XX:+UseContainerSupport",
    "-XX:MaxRAMPercentage=75.0",
    "-Djava.security.egd=file:/dev/./urandom"
)
```

장애 발생 시:
- GC 패턴 forensic 불가능 (로그 X)
- OOM 원인 분석 불가능 (dump X)
- native 영역 분해 불가능 (NMT X)

#### 변경안

```kotlin
jvmFlags = listOf(
    // 기존
    "-XX:+UseContainerSupport",
    "-XX:MaxRAMPercentage=70.0",                   // ↓ 70 (제안 2 와 함께)
    "-Djava.security.egd=file:/dev/./urandom",
    
    // GC 명시
    "-XX:+UseG1GC",
    
    // 진단 (P0 추가)
    "-Xlog:gc*::time,uptime,level,tags",            // stdout → Loki 수집
    "-XX:+HeapDumpOnOutOfMemoryError",
    "-XX:HeapDumpPath=/var/log/jvm/heapdump-%t.hprof",
    "-XX:+ExitOnOutOfMemoryError",
    "-XX:NativeMemoryTracking=summary",
)
```

#### K8s 변경

`k8s/base/{service}/deployment.yaml` 에 emptyDir + securityContext.fsGroup:

```yaml
spec:
  template:
    spec:
      securityContext:
        fsGroup: 1000      # user 1000 의 파일 생성 권한
      containers:
        - name: app
          volumeMounts:
            - name: jvm-dumps
              mountPath: /var/log/jvm
      volumes:
        - name: jvm-dumps
          emptyDir:
            sizeLimit: 2Gi
```

prod overlay 는 PVC 권장 (장애 후에도 dump 보존).

#### 영향

- 운영 진단성 즉시 ↑
- GC 로그 ~1% 부가 부담 (무시)
- NMT summary ~5% 부가 (수용 가능)

#### 작업

1. `commerce.jib-convention.gradle.kts` 수정 (PR 1)
2. `k8s/base/*/deployment.yaml` 에 volume/securityContext (PR 2)
3. 한 서비스 (product) lab 검증 → 전체 적용

---

### 제안 2: MaxRAMPercentage 70 + 영역 한도

#### 현 문제

1Gi limit + MaxRAMPercentage=75 → heap 768MB → native 예산 256MB. 19번 파일의 산정에 따르면 **빠듯**:

```
힙 (-Xmx)         : 768 MB
Metaspace          : ~150 MB (동적 클래스 사용 시 200MB+)
Code Cache (default): 240 MB
Thread (50개)      : 50 MB
GC Internal (G1)   : ~50 MB
Direct (default=Xmx): 768 MB ← 폭주 가능
                     ──────
            합계: 2 GB+ 가능 → OOMKilled 위험
```

#### 변경안

`commerce.jib-convention.gradle.kts`:

```kotlin
jvmFlags = listOf(
    // ... 기존 ...
    "-XX:MaxRAMPercentage=70.0",            // 75 → 70
    "-XX:MaxMetaspaceSize=256m",
    "-XX:ReservedCodeCacheSize=128m",
    "-XX:MaxDirectMemorySize=64m",
)
```

#### 작은 서비스 override

gateway 같이 limit 768Mi 인 경우:

```kotlin
// build.gradle.kts (gateway/build.gradle.kts) 에서 override
configure<JibExtension> {
    container {
        jvmFlags = baseJvmFlags + listOf(
            "-XX:MaxRAMPercentage=65.0",
            "-XX:MaxMetaspaceSize=192m",
            "-XX:ReservedCodeCacheSize=64m",
        )
    }
}
```

(현재 `commerce.jib-convention.gradle.kts` 는 단일 매핑이므로 per-service override 패턴 추가 필요)

#### 검증

배포 후 30분 부하 → NMT diff:

```bash
kubectl exec -n commerce product-xxx -- jcmd 1 VM.native_memory baseline
# 30분 후
kubectl exec -n commerce product-xxx -- jcmd 1 VM.native_memory summary.diff
```

각 영역이 한도 안에 머무는지.

---

### 제안 3: 핵심 알람 룰 8개

20번 파일의 알람을 그대로 PrometheusRule 로 등록. 작업량 가장 작음. P0.

`k8s/infra/prod/monitoring/jvm-alerts.yaml` 신설:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: jvm-alerts
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  groups:
    - name: jvm-platform
      rules:
        - alert: ContainerMemoryNearLimit
          expr: container_memory_working_set_bytes{namespace="commerce"} / kube_pod_container_resource_limits{resource="memory", namespace="commerce"} > 0.9
          for: 5m
        # ... 7 more (20번 파일 참조) ...
```

---

## 3. P1 제안 상세

### 제안 4: quant ZGC 검토

트레이딩 서비스 → latency 절대 우선. 7번 파일의 분석에 따라 PoC 가치.

#### PoC 계획

1. quant lab 환경 구축 (k3d)
2. 합성 가격 데이터 부하
3. G1 vs ZGC 비교 (Lab 1 와 동일 패턴)
4. 결과: P99 응답 latency 차이, throughput 차이

#### 의사결정 기준

- ZGC 가 P99 latency 50% 이상 개선 + throughput 손실 < 10% → 채택
- 그 미만 → G1 유지

#### ADR

**ADR-0028 의 부속 또는 별도 ADR-0029** (quant GC 선택). quant 자체 docs 에 위치 (서비스 local ADR, ADR-0016 정책 따름).

---

### 제안 5: 메모리 산정 표 ADR 부록

19번 파일의 서비스별 메모리 산정 표를 ADR-0028 의 부록으로:

```markdown
## 부록 A: 서비스별 메모리 산정 (1Gi limit 기준)

| 서비스 | -XX:MaxRAMPercentage | MaxMetaspaceSize | ReservedCodeCacheSize | MaxDirectMemorySize | 비고 |
|---|---|---|---|---|---|
| product | 70 | 256m | 128m | 64m | default |
| order | 70 | 256m | 128m | 64m | default |
| search | 70 | 256m | 128m | 128m | ES client |
| gateway | 65 | 192m | 64m | 32m | router |
| analytics | 55 | 256m | 128m | 128m | RocksDB |
| quant | 60 | 256m | 128m | 64m | ZGC |
```

표만 있으면 새 서비스 추가 시 즉시 참조 가능.

---

### 제안 6: analytics RocksDB 측정

Kafka Streams state store → RocksDB native. 별도 한도 산정 필요.

```bash
# RocksDB block cache, write buffer, etc 의 native 사용
# JMX: io.confluent.metrics.kafka:type=stream-rocksdb-state-id-store-metrics
```

부하 후 RSS - (heap + metaspace + code + thread + direct + gc internal) = RocksDB + 기타 → 측정 후 limit 조정.

---

## 4. P2 제안 상세

### 제안 7: gateway AOT (Spring Boot Native)

GraalVM Native Image / Spring Boot AOT (JDK 25 의 Project Leyden 일부) → 부팅 시간 ↓, Metaspace ↓.

gateway 는 라우팅만 하므로 reflection 의존성 적어 AOT 후보. PoC 가치 있음.

위험: dynamic proxy 사용 spots 에 hint 추가 필요. 작업량 큼.

### 제안 8: JFR continuous recording

```kotlin
"-XX:StartFlightRecording=settings=default,maxage=12h,maxsize=200M,filename=/var/log/jvm/cont.jfr,dumponexit=true"
```

product / analytics 부터 시작 → 장애 시 직전 12h 데이터 자동 보존.

### 제안 9: JMH CI 통합

17번 파일의 JMH 환경 → CI 에서 PR 별 회귀 측정.

```yaml
# .github/workflows/jmh.yml
- run: ./gradlew :benchmark:jmh
- run: jmh-compare baseline.json result.json --threshold 5%
```

기준선(baseline) 관리 + Drift 감지.

### 제안 10: Grafana 패널 보강

20번 파일의 7 패널을 jvm-dashboard.json 에 추가:

```bash
# Grafana UI 에서 export 또는 직접 JSON 편집
```

---

## 5. ADR-0028 초안

```markdown
# ADR-0028: JVM Tuning Convention (G1 default + 영역 한도 + 진단 활성화)

## Status
Proposed (2026-05-01)

## Context
msa 는 모든 JVM 서비스가 `commerce.jib-convention.gradle.kts` 의 단일 convention 으로
컨테이너 이미지를 빌드한다. 현 jvmFlags 는 컨테이너 인식 + 힙 75% 만 박혀있고
GC 로그 / 자동 Heap Dump / NMT / 영역별 한도 가 모두 빠져있다.

운영 영향:
- 장애 발생 시 GC forensic 불가
- OOM 원인 분석 불가
- 1Gi limit + MaxRAMPercentage=75 가 native 예산 빠듯 (OOMKilled 위험)

## Decision
1. base jvmFlags 에 GC 로그 (stdout), 자동 dump, NMT, 영역 한도, ExitOnOOM 추가
2. MaxRAMPercentage 75 → 70 (안전 마진)
3. per-service override 패턴 추가 (gateway 65%, quant ZGC 등)
4. K8s deployment 에 fsGroup 1000 + emptyDir / PVC for /var/log/jvm

## Consequences
+ 장애 진단성 즉시 ↑
+ OOMKilled 위험 ↓
+ NMT 5% 오버헤드 (수용 가능)
- jvmFlags 길어져 read 부담 (트레이드오프 가치 있음)
- per-service override 가 빌드 컨벤션 복잡도 ↑

## Alternatives
- env 기반 JAVA_TOOL_OPTIONS — 빌드 재실행 없이 변경 가능하지만 코드 추적성 ↓ → reject
- JVM 옵션 전부 K8s overlay 에 — Jib convention 의 일관성 ↓ → reject
- 현 상태 유지 — 진단성 부족 risk 너무 큼 → reject

## Implementation
- PR 1: commerce.jib-convention.gradle.kts 수정 (P0)
- PR 2: k8s/base 의 deployment.yaml 에 volume/securityContext (P0)
- PR 3: monitoring/jvm-alerts.yaml 신설 (P0)
- 부록 A: 서비스별 메모리 산정 표 (위 제안 5)

## References
- study/docs/2-jvm-gc/00-plan.md
- study/docs/2-jvm-gc/18-msa-jib-config.md
- study/docs/2-jvm-gc/19-k8s-memory-vs-heap.md
```

---

## 6. 우선순위 로드맵

### Week 1 (P0)

- [ ] PR 1: jib-convention 수정
- [ ] PR 2: K8s volume/securityContext
- [ ] PR 3: PrometheusRule jvm-alerts
- [ ] 검증: product / order 부하 + NMT diff
- [ ] 다른 서비스 점진 적용

### Week 2-3 (P1)

- [ ] PR: per-service override 패턴
- [ ] quant ZGC PoC
- [ ] analytics RocksDB 측정 + limit 조정
- [ ] ADR-0028 작성 + 머지

### Week 4+ (P2)

- [ ] gateway AOT PoC
- [ ] JFR continuous (product, analytics)
- [ ] JMH CI 통합
- [ ] Grafana 패널 보강

---

## 7. 비-개선 (의도적 보류)

| 항목 | 보류 이유 |
|---|---|
| Shenandoah 도입 | ZGC 가 Oracle 본가 + JDK 25 안정. Red Hat 의존도 ↓ |
| 모든 서비스 ZGC | 일반 API 는 G1 200ms 충분. ZGC 는 latency 민감 서비스만 |
| `-XX:+AlwaysPreTouch` | 부팅 시간 trade. K8s 환경에선 readinessProbe 가 여유 줘서 무가치 |
| `-XX:+UseLargePages` 전체 적용 | 노드 sysctl 설정 + cluster-wide DaemonSet. quant 만 |
| Custom NMT collector | 사이드카 복잡도. 일단 jcmd ad-hoc 으로 운영 |

---

## 8. 측정 결과 기록 (ADR 머지 전)

각 PR 머지 전 30분 부하로 측정한 KPI 표 (ADR 의 evidence 섹션):

| 서비스 | 변경 전 RSS | 변경 후 RSS | 변경 전 P99 latency | 변경 후 P99 latency | OOMKilled (1주) |
|---|---|---|---|---|---|
| product | TBD | TBD | TBD | TBD | TBD |
| order | TBD | TBD | TBD | TBD | TBD |

(실측 후 채움)

---

## 9. 다음 학습

- [22-interview-qa.md](22-interview-qa.md) — 면접 Q&A
- [09-gc-log-analysis.md](09-gc-log-analysis.md) — 변경 후 로그 검증
- [20-observability-prometheus.md](20-observability-prometheus.md) — 알람 검증
