---
parent: 11-k8s-deep-dive
seq: 09
title: Autoscaling — HPA / VPA / Cluster Autoscaler / KEDA / Custom Metric
type: deep
created: 2026-05-01
---

# 09. Autoscaling 심화

## 1. 한 장 요약

```
                     desired replicas
                          ▲
                          │ scale subresource
                ┌─────────┴──────────┐
                │  HorizontalPodAutoscaler (HPA)  │   replicas 조정
                └─────────┬──────────┘
                          │ metrics
              ┌───────────┴────────────┐
              │  metrics.k8s.io        │  CPU/Memory (metrics-server)
              │  custom.metrics.k8s.io │  Prometheus Adapter / KEDA
              │  external.metrics      │  Kafka lag, SQS depth, ...
              └────────────────────────┘

  ┌────────────────┐                       ┌──────────────────────┐
  │  VPA           │── requests/limits ──► │  Pod (Deployment)    │
  │  (vertical)    │                       └──────────────────────┘
  └────────────────┘

  Pod Pending  ─►  Cluster Autoscaler  ─►  Node 추가
                  Karpenter (AWS)
```

## 2. HPA — Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: gateway }
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: gateway
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 70 }
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Pods
          value: 2
          periodSeconds: 30
        - type: Percent
          value: 100
          periodSeconds: 30
      selectPolicy: Max
```

### 알고리즘

매 15초:
```
desired = ceil(currentReplicas × (currentMetric / targetMetric))
```

예: 현재 4 Pod, CPU 80%, 목표 70% → desired = ceil(4 × 80/70) = ceil(4.57) = 5.

**"무엇을 측정할 것인가" 가 항상 핵심**. CPU 70% 기본은 안전하지만 실제 부하 패턴 (RPS, p99, queue depth) 과 연결 안 될 수 있음.

### `behavior` 의 의미 (1.18+)

- `scaleDown.stabilizationWindowSeconds: 300` — 5분간 metric 이 작을 때만 scale down (flapping 방지)
- `scaleUp.stabilizationWindowSeconds: 0` — 즉시 scale up (장애 시 빠른 대응)
- `policies` — scale-up 속도 제한 (`Pods: 2 / 30s` = 30초당 최대 2개 추가)
- `selectPolicy: Max` — 여러 정책 중 가장 큰 변화량 채택

## 3. metrics-server

CPU / Memory 같은 Resource metrics 의 source. kubelet 의 cAdvisor → summary API → metrics-server 가 1분 간격으로 수집 → `metrics.k8s.io` API 로 노출.

```bash
kubectl top pods -n commerce
kubectl top nodes
```

운영 포인트:
- **EKS 는 자동 설치 안 됨** — 별도 helm install 필요
- HPA 가 동작하려면 metrics-server 가 반드시 떠 있어야 함
- HPA 가 "missing metrics" 에러 나면 99% metrics-server 문제

## 4. Custom Metric — Prometheus Adapter

CPU 외에 RPS, p99 latency, Kafka lag 으로 scale 하고 싶을 때.

### 구조

```
[your app] ─ /actuator/prometheus ─► Prometheus
                                        │
                                        │ scrape
                                        ▼
                               Prometheus Adapter
                                        │ exposes
                                        ▼
                            custom.metrics.k8s.io
                                        │ HPA reads
                                        ▼
                                       HPA
```

### 설정 예시

```yaml
# Prometheus Adapter ConfigMap
rules:
  - seriesQuery: 'http_server_requests_seconds_count{namespace!="",pod!=""}'
    resources:
      overrides:
        namespace: { resource: namespace }
        pod: { resource: pod }
    name:
      matches: "^(.*)_count"
      as: "${1}_per_second"
    metricsQuery: 'sum(rate(<<.Series>>{<<.LabelMatchers>>}[2m])) by (<<.GroupBy>>)'
```

### HPA 가 그 metric 을 사용

```yaml
metrics:
  - type: Pods
    pods:
      metric: { name: http_server_requests_seconds_per_second }
      target:
        type: AverageValue
        averageValue: "100"   # Pod 당 100 RPS 목표
```

### 추천: msa 의 진짜 메트릭

CPU 70% 보다 의미 있는 후보:
- **gateway**: RPS / Pod, p95 latency
- **search-consumer**: Kafka consumer lag
- **search**: ES query latency
- **product**: cache hit ratio (낮으면 DB 부하 ↑)
- **analytics**: Kafka lag

ServiceMonitor (`k8s/infra/prod/monitoring/servicemonitor-apps.yaml`) 가 이미 actuator/prometheus 를 scrape 중 → Prometheus Adapter 만 추가하면 즉시 가능.

## 5. KEDA — Event-driven Autoscaling

> "0 → N 으로 스케일하고, N → 0 까지" 가 가능한 K8s autoscaler.

HPA 와 다른 점:
- **0 까지 스케일 다운 가능** (HPA 는 최소 1)
- 30+ scaler 빌트인: Kafka, Redis Streams, RabbitMQ, AWS SQS, Azure Service Bus, GCP Pub/Sub, Prometheus, ...
- `ScaledObject` CRD 로 선언

### 예시 — Kafka lag 기반

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: search-consumer-scaler }
spec:
  scaleTargetRef: { name: search-consumer }
  minReplicaCount: 0          # 0 까지 가능
  maxReplicaCount: 8
  pollingInterval: 30
  cooldownPeriod: 300
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka:29092
        consumerGroup: search-consumer
        topic: product.changed
        lagThreshold: "100"   # Pod 당 100 lag
```

### 작동 방식

내부적으로 KEDA controller 가 위 ScaledObject 를 보고 → HPA 객체를 만들어 → HPA 가 metric 으로 scale. KEDA 는 metric provider 역할 + 0 ↔ 1 의 활성/비활성 전환을 담당.

### msa 적합도

- **search-consumer / analytics** — Kafka lag 기반 가치 큼
- **search-batch** — 스케줄 + 종료 후 0. 그러나 이미 Job/CronJob 패턴이라 별 효과 없음
- **gateway / product** — 사용자 트래픽이 sustained → 일반 HPA 가 적합

## 6. VPA — Vertical Pod Autoscaler

> "Pod 의 requests/limits 를 동적으로 조정"

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata: { name: product-vpa }
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: product
  updatePolicy:
    updateMode: Auto    # Off | Initial | Recreate | Auto
  resourcePolicy:
    containerPolicies:
      - containerName: app
        minAllowed: { cpu: 100m, memory: 256Mi }
        maxAllowed: { cpu: 2,   memory: 4Gi }
```

### updateMode

- `Off` — 권장값만 status 에 기록 (사람이 보고 결정). **운영 추천**.
- `Initial` — Pod 생성 시점에만 적용
- `Recreate` — 기존 Pod 삭제 후 재생성하며 적용
- `Auto` — Recreate 와 동일 (in-place update 는 1.27+ 의 InPlacePodVerticalScaling 알파)

### HPA 와 충돌

HPA 가 CPU 기반이고 VPA 도 CPU 를 만지면 둘이 싸움. 룰:
- **HPA 와 VPA 를 같이 쓰려면**, HPA 는 custom metric (RPS) 으로, VPA 는 메모리만 (또는 Off 모드 추천).

### 실용

VPA 는 **Off 모드로 권장값만 받아서 ConfigMap/manifest 갱신** 의 RIGHT-SIZING 도구로 쓰는 게 안전. msa 처럼 GitOps 지향이면 코드로 sizing 결정.

## 7. Cluster Autoscaler / Karpenter

[08-scheduling.md §9](08-scheduling.md) 참고. 핵심:
- HPA 가 Pod 추가 → 노드 부족 → CA 가 노드 추가
- 두 단계라 latency: HPA 15초 + CA 30초 + 노드 join 1-2분 = **2-5분**
- 그래서 운영은 **항상 headroom** (preemptible / over-provisioning placeholder Pod)

### Over-provisioning 패턴

```yaml
# pause Pod 으로 노드 미리 확보
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: { name: overprovisioning }
value: -10
globalDefault: false
preemptionPolicy: Never
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: overprovisioning, namespace: kube-system }
spec:
  replicas: 5
  template:
    spec:
      priorityClassName: overprovisioning
      containers:
        - name: pause
          image: registry.k8s.io/pause:3.9
          resources: { requests: { cpu: 500m, memory: 1Gi } }
```

→ pause Pod 5개가 노드 자리 차지 → 진짜 워크로드 폭증 시 pause 가 즉시 evict (priority 낮음) → 노드 자리 즉시 활용.

## 8. 함정 모음

### 8.1 HPA + Connection Pool 충돌 (#15 cross-ref)

HPA 가 Pod 4 → 8 로 scale 하면, 각 Pod 의 HikariCP `maximum-pool-size: 20` 가 그대로 → DB connection 80 → 160. DB max_connections 도달 시 새 Pod 가 connection 못 받음 → readiness 실패 → HPA 가 더 scale → 무한 루프.

해결:
- HikariCP 작게 (Pod 당 10-15)
- DB max_connections 상향
- ProxySQL / RDS Proxy 도입 (connection multiplexing)

### 8.2 OOM 으로 인한 false scale

Pod 가 메모리 leak → OOMKilled → 재기동 → CPU spike 측정됨 → HPA scale up. 근본 원인은 leak. CPU metric 만 보면 영원히 sclae up. → custom metric (RPS, error rate) 병행 필요.

### 8.3 stabilizationWindow 오해

scaleDown 의 window 가 5분 → 5분간 metric 이 낮아도 scale down 안 함 (정확): "metric 이 낮은 값으로 5분 sustained 되어야 scale down". flapping 방지 의도.

### 8.4 minReplicas: 0 + cold start

KEDA 로 0 까지 scale 가능하지만 cold start latency 가 사용자 트래픽에 영향. user-facing 은 minReplicas: 2 유지. 비동기 워커는 0 OK.

### 8.5 Java 앱의 CPU metric

JVM warmup 단계에 CPU 100% 찍힘 → HPA 가 즉시 scale up → 새 Pod 도 warmup → CPU 100% → 또 scale up. 해결: `behavior.scaleUp.stabilizationWindowSeconds: 60` 또는 startupProbe 로 warmup 종료 표시.

## 9. 추천 의사결정 트리

```
질문: 워크로드의 스케일 트리거가 무엇인가?

CPU bound (compute heavy)
   └─► HPA + CPU
       └─ 부족하면 custom metric (RPS) 추가

I/O bound (DB / network 대기)
   └─► HPA + custom metric (active connections, RPS)
       └─ CPU 는 보조

Event-driven (Kafka / Queue)
   └─► KEDA + lag/length 기반
       └─ minReplicas: 0 OK (워커성)

Latency-critical (p99 SLA)
   └─► HPA + custom metric (p99) + over-provisioning
       └─ scale-up 빠르게, scale-down 느리게

User-facing (sustained traffic)
   └─► HPA + RPS or CPU
       └─ minReplicas >= 2
       └─ 항상 PDB minAvailable: 1
```

## 10. msa 매핑 + 개선 후보

현재 (`prod-k8s/hpa.yaml`):
- 모든 17개 서비스 CPU 70% / minReplicas 2 / maxReplicas 4-8
- search-batch / agent-viewer-api 는 의도적 제외 (single instance batch)

개선 후보 ([16-improvements.md](16-improvements.md) 후보):

| 서비스 | 현재 | 권장 | 근거 |
|---|---|---|---|
| gateway | CPU 70% | + RPS / Pod | 트래픽 패턴 직접 반영 |
| search-consumer | CPU 70% | KEDA + Kafka lag | 메시지 처리율이 진짜 부하 |
| analytics | CPU 70% | KEDA + Kafka lag | 동일 |
| product | CPU 70% | + cache hit ratio (custom) | cache miss 폭증이 진짜 시그널 |
| order | CPU 70% | + p95 latency | tier-1 SLA |
| quant | (HPA 없음) | replicas=1 유지 | Recreate 전략, scale 불가 |

## 11. 면접 빈출 6

1. **"HPA 와 VPA 같이 써도 되나?"** → 같은 metric 충돌 시 안 됨. HPA = custom metric, VPA = memory off-mode 같은 분리가 필요.
2. **"HPA 가 0 까지 스케일 다운 안 되는 이유?"** → 표준 HPA 는 minReplicas >= 1 강제. KEDA 가 그 한계 우회.
3. **"Cluster Autoscaler 와 HPA 의 latency?"** → HPA 15초, CA 30초+, 노드 join 1-2분. 합쳐 2-5분. user-facing 은 over-provisioning 으로 흡수.
4. **"Kafka lag 으로 scale 하려면?"** → Prometheus Adapter 로 lag exporter → custom metric, 또는 KEDA 의 kafka scaler.
5. **"VPA 의 위험?"** → Recreate 모드는 Pod 재시작 → 트래픽 끊김. Off 모드로 권장값만 받는 게 안전.
6. **"왜 HPA 메트릭이 metrics-server 에서 안 보이나?"** → metrics-server 미설치, kubelet `--read-only-port=0` 와 인증 문제, Pod metric path 다름. `kubectl top pod` 로 1차 확인.

## 12. 정리

```
HPA  (Pod 수)           ← CPU / Memory / Custom / External metric
VPA  (Pod 자원)         ← 권장값 산출 (Off 모드 추천)
KEDA (Event-driven)     ← 0 → N → 0, Kafka/SQS/Redis Streams
CA / Karpenter (노드 수) ← Pending Pod → 노드 추가
```

다음: [10-deployment-strategies.md](10-deployment-strategies.md) — Rolling / Blue-Green / Canary / Shadow + Argo Rollouts / Flagger.
