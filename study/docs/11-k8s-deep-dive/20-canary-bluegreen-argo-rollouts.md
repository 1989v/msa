---
parent: 11-k8s-deep-dive
seq: 20
title: 배포 전략 심화 — Argo Rollouts Canary / Blue-Green + AnalysisTemplate + Traffic Shaping
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 10-deployment-strategies.md
  - 13-service-mesh.md
  - 19-gitops-argocd-flux.md
  - 18-operator-pattern-crd.md
  - 15-msa-k8s-grep.md
sources:
  - https://argoproj.github.io/argo-rollouts/
  - https://argoproj.github.io/argo-rollouts/features/canary/
  - https://argoproj.github.io/argo-rollouts/features/bluegreen/
  - https://argoproj.github.io/argo-rollouts/features/analysis/
  - https://docs.flagger.app/
  - https://gateway-api.sigs.k8s.io/
catalog-row: "§G (Progressive Delivery) — Argo Rollouts Canary / BlueGreen / AnalysisTemplate / Flagger 비교"
---

# 20. 배포 전략 심화 — Argo Rollouts Canary / Blue-Green + AnalysisTemplate + Traffic Shaping

> 카탈로그 매핑: §99 §G — `Progressive Delivery (Argo Rollouts / Flagger)` (★ → ✅).
> 학습 시간 예상: ~2.5h · 자가평가 입구 레벨: B
>
> §10 (배포 전략 기본) 위에 쌓는 자동화 심화. Argo Rollouts CRD 의 Canary / BlueGreen 전략 정의, AnalysisTemplate 으로 Prometheus / Datadog / NewRelic / Job 을 쿼리해서 자동 promote/abort 하는 메커니즘, Istio / Linkerd / NGINX / ALB / SMI 5 traffic shaping 옵션, session affinity / DB schema / breaking API 의 함정, msa 의 18+ 서비스에 단계적 도입하는 Tier 별 전략 매트릭스. Argo Rollouts vs Flagger 의 생태계 차이 + msa 권장 + ADR 후보까지.

---

## 1. 한 줄 핵심

> **Progressive Delivery = "트래픽 가중치를 단계적으로 늘리면서 자동 메트릭 검증으로 promote/abort 결정."**
>
> Canary 는 **가중치 기반 점진 전환** (5% → 25% → 50% → 100%), Blue-Green 은 **즉시 swap + 사전 검증**. Argo Rollouts 는 K8s Deployment 를 대체하는 `Rollout` CRD 로 두 전략을 코드화 + AnalysisTemplate 으로 Prometheus 등 쿼리해서 자동 결정. Native (kubectl rollout undo) 의 manual rollback 을 자동 rollback 으로 격상. msa 는 Tier 1 (gateway/order/payment) Canary + AnalysisTemplate, Tier 2 Auto-promote, Tier 3 일반 Rolling, Special (quant) Recreate 의 4 등급 매트릭스가 권장.

---

## 2. 등장 배경 — 왜 Argo Rollouts 가 필요한가

### 2-1. 수동 Canary 의 한계

§10 의 native canary (두 Deployment 같은 Service selector 에 묶기):

```yaml
# stable Deployment - replicas: 9
# canary Deployment - replicas: 1
# Service selector { app: gateway } 에 둘 다 매칭 → 트래픽 자동 10% canary
```

**한계**:
1. **정확한 % 제어 ❌** — Pod 수 비율 = 트래픽 비율 가정 (실제론 connection 단위 imbalance).
2. **메트릭 자동 분석 ❌** — 사람이 Grafana 보고 결정.
3. **자동 rollback ❌** — 사람이 `kubectl scale --replicas=0 canary` 수동.
4. **단계적 진행 ❌** — 5% → 25% → 50% 전환을 사람이 차례로 트리거.

→ **자동화의 4 요건** = (1) 트래픽 가중치 정확 제어 + (2) 메트릭 쿼리 + (3) 자동 promote/abort + (4) 단계 정의.

### 2-2. 실패 시나리오 — 메트릭 검증 없는 canary

```
[수동 canary, 검증 부재]
  v2 deploy (10%) → 사람이 Grafana 5분 봄 → 괜찮아 보여서 100% 전환
  → 30분 후 alert: 5xx 폭증
  → 알고 보니 v2 가 특정 path (예: 결제) 에서만 broken
  → readiness probe 는 `/health` 만 체크 → 통과
  → 사용자 피해 30분 + 매뉴얼 rollback

[자동 canary + AnalysisTemplate]
  v2 deploy (5%, weight=5) → 5분 대기 → AnalysisRun:
      success rate < 99% → auto abort → setWeight(0) → v2 정리
  → 사용자 피해 5분 + 자동 rollback
```

### 2-3. Argo Rollouts 가 해결하는 4 가지

| 문제 | Argo Rollouts 해결 |
|---|---|
| 트래픽 가중치 정확 제어 | `trafficRouting` (Istio / Linkerd / NGINX / ALB / SMI 위임) |
| 단계 정의 | `steps: [setWeight, pause, analysis, ...]` |
| 메트릭 자동 분석 | `AnalysisTemplate` (Prometheus / Datadog / NewRelic / Wavefront / Job) |
| 자동 promote/abort | analysis fail → 즉시 setWeight 0 + rollback |

---

## 3. 배포 전략 한 장 비교 (확장판)

| 전략 | 동시 가용 | 자원 비용 | 롤백 속도 | 메트릭 검증 | 복잡도 |
|---|---|---|---|---|---|
| **Recreate** | X (다운타임) | 1× | 빠름 (재시작) | 사전 staging 만 | 가장 단순 |
| **Rolling** (기본) | O (옛+새 혼재) | ~1.25× | ~1분 (`kubectl rollout undo`) | 헬스체크 의존 | 단순 |
| **Blue-Green** | O (한쪽만 활성) | 2× | 즉시 (selector swap) | switch 전 사람 검증 | 중간 |
| **Blue-Green + Argo Rollouts** | O | 2× | 즉시 + 자동 | prePromotionAnalysis 자동 | 중간-높음 |
| **Canary** (native) | O (가중치) | 1.1×~ | 즉시 (가중치 0) | 사람 분석 | 높음 |
| **Canary + Argo Rollouts** | O | 1.1×~ | 즉시 + 자동 | 단계별 AnalysisRun | 가장 높음 |
| **Shadow / Dark** | O (mirror) | 2× | n/a (검증 only) | 실제 트래픽 복제 | 가장 높음 |
| **A/B testing** | O (header/cookie 기반) | 1.1×~ | 즉시 | 사용자 segment 분리 | 높음 |

→ **Canary + Argo Rollouts + AnalysisTemplate** 가 progressive delivery 의 표준 조합.

---

## 4. Argo Rollouts CRD — Canary 전략

### 4-1. Rollout 의 위치

```
Deployment 의 위치 (기존)            Rollout 의 위치 (Argo Rollouts)
┌────────────────────┐               ┌────────────────────┐
│ Deployment         │               │ Rollout            │
│  + RollingUpdate   │               │  + canary/blueGreen│
│  + maxSurge/Unavail│               │  + steps           │
└─────────┬──────────┘               │  + analysis        │
          │                          │  + trafficRouting  │
          ▼                          └─────────┬──────────┘
       ReplicaSet                              │
                                               ▼
                                       ReplicaSet (stable + canary)
                                               +
                                       AnalysisRun (자동 검증)
```

→ Deployment 를 **`Rollout`** CRD 로 대체. spec.template 은 Deployment 와 동일한 Pod 정의.

### 4-2. 기본 Canary Rollout

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: gateway
  namespace: commerce
spec:
  replicas: 6
  selector:
    matchLabels: { app: gateway }
  template:
    metadata: { labels: { app: gateway } }
    spec:
      containers:
        - name: gateway
          image: registry.commerce.example.com/gateway:v1.2.3
          ports: [{ containerPort: 8080 }]
  strategy:
    canary:
      canaryService: gateway-canary       # canary 트래픽용 Service
      stableService: gateway              # stable 트래픽용 Service (기존)
      trafficRouting:
        nginx:
          stableIngress: gateway-ingress
      steps:
        - setWeight: 5                    # 5%
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: success-rate
            args:
              - { name: service-name, value: gateway-canary }
        - setWeight: 25
        - pause: { duration: 10m }
        - analysis:
            templates:
              - templateName: success-rate
              - templateName: latency-p99
        - setWeight: 50
        - pause: { duration: 10m }
        - setWeight: 100
```

### 4-3. Steps 의 6 종 명령

| step | 의미 |
|---|---|
| `setWeight: N` | canary 트래픽 비율을 N% 로 |
| `pause: {}` | 무기한 (사람이 promote) |
| `pause: { duration: 5m }` | 5분 대기 후 자동 진행 |
| `analysis: {}` | AnalysisRun 시작 — fail 시 즉시 abort |
| `experiment: {}` | 실험적 ReplicaSet (canary 와 별도) |
| `setCanaryScale: { weight: 100 }` | canary replicas 를 weight × replicas / 100 로 scale (트래픽 가중치와 분리) |

### 4-4. Pause 의 두 모드

```yaml
- pause: {}                   # ← 무기한, 사람이 `kubectl argo rollouts promote gateway`
- pause: { duration: 5m }     # ← 5분 후 자동 진행
```

**Tier 권장**:
- Tier 1 (사용자 직접 영향 — gateway/order/payment) — 마지막 단계 (50% → 100%) 만 무기한 pause + 사람 confirm.
- Tier 2 (search/product) — 모두 duration 으로 자동.
- Tier 3 — 일반 Rolling 으로 충분.

### 4-5. 자동 promote vs manual

```yaml
# 자동 promote (모두 duration)
steps:
  - setWeight: 5
  - pause: { duration: 5m }
  - setWeight: 25
  - pause: { duration: 10m }
  - setWeight: 50
  - pause: { duration: 10m }
  - setWeight: 100

# 마지막에 사람 confirm
steps:
  - setWeight: 5
  - pause: { duration: 5m }
  - setWeight: 50
  - pause: {}                      # ← 무기한, 100% 전환은 사람 결정
  - setWeight: 100
```

→ Tier 1 의 표준은 **마지막 단계 manual confirm** + Slack 통합으로 promote 명령을 채널에서.

### 4-6. canaryService / stableService

```yaml
# stable Service (기존 — 모든 사용자 트래픽)
apiVersion: v1
kind: Service
metadata: { name: gateway }
spec:
  selector: { app: gateway }   # selector 는 Argo Rollouts 가 자동 patch
  ports: [{ port: 8080 }]
---
# canary Service (검증용 — Argo Rollouts 가 weight % 만)
apiVersion: v1
kind: Service
metadata: { name: gateway-canary }
spec:
  selector: { app: gateway }   # 동일
  ports: [{ port: 8080 }]
```

→ Argo Rollouts controller 가 두 Service 의 `selector` 에 `rollouts-pod-template-hash` label 을 동적으로 주입해서 stable/canary Pod 을 분리. trafficRouting (NGINX / Istio / ALB) 가 weight % 를 두 Service 사이에 분배.

---

## 5. Blue-Green 전략

### 5-1. Blue-Green Rollout

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: order }
spec:
  replicas: 4
  strategy:
    blueGreen:
      activeService: order               # 기존 트래픽 받는 Service
      previewService: order-preview      # green 검증용 Service
      autoPromotionEnabled: false        # 사람이 promote
      scaleDownDelaySeconds: 600         # promote 후 10분 후 옛것 종료
      prePromotionAnalysis:
        templates:
          - templateName: success-rate
        args:
          - { name: service-name, value: order-preview }
      postPromotionAnalysis:
        templates:
          - templateName: success-rate
        args:
          - { name: service-name, value: order }
```

### 5-2. Blue-Green 의 흐름

```
1. v1 (blue) replicas=4, activeService selector → blue
2. v2 deploy → green replicas=4 생성, previewService selector → green
3. prePromotionAnalysis: green 의 success rate 검증
   ├── 성공 → autoPromotionEnabled: false 면 사람 confirm 대기
   └── 실패 → 자동 abort, green 종료
4. promote: activeService selector → green (트래픽 swap, 즉시)
5. postPromotionAnalysis: green 으로 활성화 후 success rate 검증
   └── 실패 → undo (selector → blue 복원, 즉시 rollback)
6. scaleDownDelaySeconds 후 blue 종료
```

### 5-3. Blue-Green vs Canary — 언제 어떤?

| 케이스 | 권장 |
|---|---|
| **단일 replica 강제** (msa 의 quant) | Recreate 또는 Blue-Green (replicas=1, 일시 2배 OK) |
| **session sticky 필요** | Blue-Green (한쪽만 활성, 사용자 일관성 유지) |
| **DB schema breaking change** | Blue-Green (둘 다 같은 schema 보장) — 단 schema 자체 마이그는 별개 |
| **사용자 직접 영향 + 메트릭 자동 검증** | Canary (단계 진행 + 빠른 abort) |
| **트래픽 패턴 점진 전환** | Canary |
| **자원 여유 부족** | Canary (1.1× vs Blue-Green 의 2×) |

---

## 6. AnalysisTemplate — 자동 메트릭 검증

### 6-1. 5 provider

| Provider | 입력 | 사용 케이스 |
|---|---|---|
| **Prometheus** | PromQL | 가장 일반 — success rate / latency / error rate |
| **Datadog** | DataDog query | 매니지드 환경 |
| **NewRelic** | NRQL | 매니지드 |
| **Wavefront** | Wavefront query | 매니지드 |
| **CloudWatch** | metric stat | AWS |
| **Web** (HTTP) | URL + JSON path | 사용자 정의 endpoint |
| **Job** (K8s Job) | 임의 검증 스크립트 | smoke test / e2e |
| **Kayenta** (Spinnaker) | Netflix Kayenta | Spinnaker 통합 |

### 6-2. Prometheus AnalysisTemplate

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
  namespace: commerce
spec:
  args:
    - name: service-name
  metrics:
    - name: success-rate
      interval: 1m                  # 1분마다 쿼리
      count: 5                      # 5번 측정
      successCondition: "result[0] >= 0.99"
      failureCondition: "result[0] < 0.95"
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_server_requests_seconds_count{
                service="{{args.service-name}}", status!~"5.."
            }[5m]))
            /
            sum(rate(http_server_requests_seconds_count{
                service="{{args.service-name}}"
            }[5m]))
```

**3가지 결과**:
| 조건 | 의미 |
|---|---|
| `successCondition` 만 만족 | Successful — 진행 |
| `failureCondition` 만 만족 | Failed — 즉시 abort |
| 둘 다 아님 | Inconclusive — pause / 사람 결정 |

### 6-3. Latency p99 AnalysisTemplate

```yaml
metrics:
  - name: latency-p99
    interval: 1m
    count: 5
    successCondition: "result[0] <= 0.5"     # 500ms
    failureCondition: "result[0] > 1.0"      # 1s
    provider:
      prometheus:
        address: http://prometheus.monitoring:9090
        query: |
          histogram_quantile(0.99,
            sum(rate(http_server_requests_seconds_bucket{
                service="{{args.service-name}}"
            }[5m])) by (le)
          )
```

### 6-4. Job AnalysisTemplate — e2e 검증

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata: { name: e2e-checkout }
spec:
  args:
    - name: service-name
  metrics:
    - name: e2e-test
      provider:
        job:
          spec:
            template:
              spec:
                containers:
                  - name: e2e
                    image: commerce/e2e:latest
                    command: ["pytest", "tests/checkout.py"]
                    env:
                      - name: TARGET
                        value: "{{args.service-name}}"
                restartPolicy: Never
            backoffLimit: 0
```

→ Job 의 exit code 0 = success. 결제 e2e flow 처럼 메트릭으론 잡기 어려운 시나리오.

### 6-5. 다중 metric — AND 조합

```yaml
analysis:
  templates:
    - templateName: success-rate
    - templateName: latency-p99
    - templateName: e2e-checkout
  args:
    - { name: service-name, value: gateway-canary }
```

→ 모든 metric 이 success 여야 진행. 하나라도 fail 이면 abort.

### 6-6. 비즈니스 metric — CTR / CVR

검색 / 추천 같은 도메인은 success rate 만으론 부족:

```yaml
metrics:
  - name: search-ctr
    successCondition: "result[0] >= 0.05"   # 5% CTR (Click-Through Rate, 클릭률)
    provider:
      prometheus:
        query: |
          sum(rate(search_clicks_total{version="canary"}[10m]))
          /
          sum(rate(search_impressions_total{version="canary"}[10m]))
```

→ analytics 서비스의 비즈니스 metric 을 canary 검증의 기준으로. msa 의 search / product 에 적합.

---

## 7. Traffic Shaping — 5 옵션

### 7-1. NGINX Ingress (msa 가 채택)

```yaml
strategy:
  canary:
    trafficRouting:
      nginx:
        stableIngress: gateway-ingress
```

→ Argo Rollouts 가 자동으로 canary Ingress (`gateway-ingress-canary`) 를 생성:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gateway-ingress-canary
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "5"      # 자동 갱신
spec:
  rules: ...
  backend: { service: { name: gateway-canary } }
```

**장점**: msa 의 ingress-nginx 와 자연스럽게. 추가 인프라 없음.
**단점**: connection 단위 라우팅 — 한 번 잡힌 connection 은 그 backend 유지. WebSocket / gRPC 면 효과 미미.

### 7-2. Istio (Service Mesh)

```yaml
strategy:
  canary:
    trafficRouting:
      istio:
        virtualService:
          name: gateway-vs
          routes: [primary]
        destinationRule:
          name: gateway-dr
          canarySubsetName: canary
          stableSubsetName: stable
```

```yaml
# VirtualService — Argo Rollouts 가 weight 자동 갱신
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata: { name: gateway-vs }
spec:
  hosts: [gateway]
  http:
    - name: primary
      route:
        - destination: { host: gateway, subset: stable }
          weight: 95
        - destination: { host: gateway, subset: canary }
          weight: 5
```

**장점**: request-level routing (connection 단위 X) → 정확한 % 제어. mTLS / retries / timeouts 등 mesh 기능 활용.
**단점**: Istio 도입 자체가 큰 비용.

### 7-3. Linkerd

```yaml
trafficRouting:
  smi: {}
```

→ SMI (Service Mesh Interface) TrafficSplit 으로. Linkerd 가 사실상 SMI 표준.

### 7-4. ALB (AWS Load Balancer Controller)

```yaml
trafficRouting:
  alb:
    ingress: gateway-alb
    servicePort: 8080
```

→ AWS ALB (Application Load Balancer, 애플리케이션 로드 밸런서) 의 weighted target group. EKS 환경 표준.

### 7-5. SMI (Service Mesh Interface)

```yaml
trafficRouting:
  smi:
    rootService: gateway
    trafficSplitName: gateway-split
```

→ vendor-neutral. Linkerd / Open Service Mesh 등이 구현.

### 7-6. msa 권장 — 단계별

```
Phase 1: NGINX Ingress (이미 도입) — gateway / order / search
Phase 2 (선택): Istio 도입 시 — gRPC / WebSocket 기반 서비스 (member, gifticon)
Phase 3 (선택): Gateway API (Ingress 후속 표준) — NGINX / Istio 모두 Gateway API 호환
```

---

## 8. Rollback 자동화

### 8-1. Analysis fail → 즉시 rollback

```
[Step 진행]
  setWeight: 5 → pause 5m → analysis (success-rate)
                                ├── success → setWeight: 25 → ...
                                └── fail    → abort:
                                              setWeight: 0
                                              canary ReplicaSet 종료
                                              stable 100%
                                              status: Degraded
                                              알림: Slack
```

### 8-2. Manual abort

```bash
kubectl argo rollouts abort gateway       # canary 즉시 0
kubectl argo rollouts undo gateway        # 이전 stable revision 으로
kubectl argo rollouts retry gateway       # 다시 시도 (이전 setWeight 부터)
```

### 8-3. Rollback 의 함정 — DB schema

```
[Forward-only schema]
v1: SELECT id, name FROM products
v2: ALTER TABLE products ADD COLUMN price_v2; SELECT id, name, price_v2 FROM products
   (v2 deploy 후 v1 도 v2 schema 위에서 동작 OK)

v2 가 canary 5% → fail → rollback to v1
   v1 은 price_v2 모름, 그러나 SELECT 에 price_v2 없음 → OK

[Breaking schema]
v2: ALTER TABLE products DROP COLUMN name; ADD COLUMN display_name
v2 canary 5% → fail → rollback to v1
   v1: SELECT name FROM products → ERROR (column not exists)
   → rollback 불가능
```

→ **expand-contract 패턴** 필수: (1) 새 column 추가 → (2) 둘 다 사용 (dual write) → (3) 옛 column 제거 의 3 deploy 분리. 각 deploy 가 forward + backward 호환.

### 8-4. Automated rollback 의 미발동 케이스

```
- analysis 가 inconclusive (data 부족) → 자동 promote 안 됨, pause 상태 유지
- 메트릭 source (Prometheus) 가 down → analysis Error → rollback 미발동
- promote 후 (100% 전환) 발견된 문제는 자동 rollback 없음 → 새 deploy 또는 manual undo
```

→ postPromotionAnalysis 로 100% 전환 후에도 검증 권장.

---

## 9. Argo Rollouts vs Flagger

### 9-1. 기능 비교

| 항목 | Argo Rollouts | Flagger |
|---|---|---|
| 본가 | Argo (Intuit) | Weaveworks |
| CRD | `Rollout` | `Canary` |
| Deployment 대체 | ✅ (Rollout 이 대체) | ❌ (Deployment 는 그대로, Canary CR 이 wrap) |
| Blue-Green | ✅ | △ (mainPrimary swap) |
| Canary | ✅ | ✅ |
| AnalysisTemplate | ✅ (Prometheus / DD / NR / Wavefront / Job / Web / Kayenta) | ✅ (Prometheus / DD / NR / CloudWatch / Dynatrace / Stackdriver / Graphite) |
| Service Mesh 통합 | NGINX / ALB / Istio / Linkerd / SMI / Traefik / AppMesh / Contour | Istio / Linkerd / NGINX / Contour / Gloo / SMI / Skipper / OSM |
| GitOps native | ✅ (Argo CD 와 자연 통합) | △ (Flux 와 자연, Argo CD 와 가능) |
| K8s notifications | argocd-notifications-cm 활용 | 자체 alert/Slack 내장 |
| 한국 대기업 도입 | 우세 (Argo CD 와 함께) | 보조적 |
| Web UI | ✅ (Argo CD UI 통합 + dashboard) | ❌ (CLI 위주) |
| CRD 진입 비용 | Deployment → Rollout 마이그레이션 | annotation only — 진입 낮음 |

### 9-2. 선택 기준

```
Argo CD 사용 + UI 친화 + Deployment → Rollout 마이그 가능   → Argo Rollouts
Service Mesh 우선 + annotation only + Deployment 그대로     → Flagger
EKS + AWS App Mesh                                           → 둘 다 가능, 팀 선호
```

→ **msa 권장: Argo Rollouts** — Argo CD 도입 시 자연 통합 + UI 일관 + 한국 대기업 채택 우세.

### 9-3. Flagger 의 차별점

```yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata: { name: gateway }
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment              # ← Deployment 그대로
    name: gateway
  service:
    port: 8080
  analysis:
    interval: 1m
    threshold: 5                  # 5번 fail 시 abort
    maxWeight: 50
    stepWeight: 5
    metrics:
      - name: request-success-rate
        thresholdRange: { min: 99 }
        interval: 1m
```

→ Deployment 그대로 + `Canary` CR 만 추가. 진입 비용 낮음. 단점은 GitOps 통합 시 Argo CD 와의 어색함.

---

## 10. msa 적용 — Tier 별 전략 매트릭스

### 10-1. 현재 (Argo Rollouts 미도입)

- 모든 서비스 Deployment + RollingUpdate 25%/25% (`k8s/base/`).
- HPA + PDB (`k8s/overlays/prod-k8s/{hpa.yaml,pdb.yaml}`) — rolling 중 가용성 보장.
- quant 만 Recreate (`patches/quant-phase2.yaml`) — single replica 강제.
- Canary / Blue-Green / AnalysisTemplate 부재.

### 10-2. Tier 별 권장 매트릭스

```
Tier 1 — 사용자 직접 영향 (gateway / order / payment 미래 / member 인증 path)
  전략: Argo Rollouts Canary
  Steps: setWeight 5 → 5m → analysis → setWeight 25 → 10m → analysis
         → setWeight 50 → pause:{} (manual confirm) → setWeight 100
  AnalysisTemplate: success-rate (>= 99.5%) + latency-p99 (<= 500ms)
  Rollback: 자동
  
Tier 2 — 간접 영향 (search / product / wishlist / gifticon)
  전략: Argo Rollouts Canary (자동 promote)
  Steps: setWeight 10 → 5m → analysis → setWeight 50 → 10m → analysis
         → setWeight 100
  AnalysisTemplate: success-rate (>= 99%)
  Rollback: 자동
  
Tier 3 — 백엔드 / 비동기 (analytics / experiment / search-consumer / search-batch)
  전략: 일반 Rolling (현 상태 유지)
  검증: 헬스체크 + smoke test (Argo CD PostSync hook §19)
  
Special — 단일 인스턴스 (quant — KEK 경합 + 포지션 중복 위험)
  전략: Recreate (현 상태 유지) 또는 Blue-Green (autoPromotionEnabled: false)
  Blue-Green 시: replicas=1 → 일시 2 OK (10분), 이후 옛것 종료
  검증: 사전 staging + Blue-Green 시 prePromotionAnalysis
  
Frontend — 6 FE 서비스 (admin / charting / quant-fe / gifticon-fe / code-dictionary-fe / agent-viewer-fe)
  전략: Rolling (정적 파일이라 위험 ↓)
  검증: smoke test (페이지 200 응답)
```

### 10-3. 도입 단계 (Phase plan)

```
Phase 1 (1주): Argo Rollouts controller 설치
  helm install argo-rollouts argo/argo-rollouts -n argo-rollouts
  argo-rollouts dashboard 노출

Phase 2 (1주): AnalysisTemplate 라이브러리 작성
  k8s/base/argo-rollouts/templates/
    success-rate.yaml      — Prometheus rate(http_..._count) by status
    latency-p99.yaml       — histogram_quantile(0.99, ...)
    error-rate.yaml        — 5xx ratio
    ctr-canary.yaml        — search/product 비즈니스 metric
  Prometheus query 검증 (현 데이터로 5분간 rule eval)

Phase 3 (1-2주): gateway 만 Canary 도입 (PoC)
  Deployment → Rollout 마이그레이션 (gateway 만)
  manifests: k8s/base/gateway/rollout.yaml
  staging 환경에서 1주 운영 — analysis fail 시나리오 테스트

Phase 4 (2주): order / search 확장 (Tier 1 / Tier 2)
  Deployment → Rollout
  analysis args 서비스별 customize
  Slack 통합 (promote 알림 + abort 알림)

Phase 5 (1주): Tier 1 의 마지막 단계 manual confirm
  setWeight 50 후 pause:{} → 사람이 `kubectl argo rollouts promote`
  Slack 의 promote 명령 통합 (slash command)

Phase 6 (1-2주): quant 의 Blue-Green 도입
  replicas=1 + autoPromotionEnabled:false + scaleDownDelaySeconds:600
  prePromotionAnalysis: KEK 검증 / outbox lag / Telegram dispatcher health

Phase 7 (1주): postPromotionAnalysis 도입 (모든 Tier 1)
  100% 전환 후 5분간 추가 검증 → 자동 rollback 발동 가능 영역 확장
```

### 10-4. Rollout 매니페스트 디렉토리 구조

```
msa/
├── k8s/
│   ├── base/
│   │   ├── argo-rollouts/
│   │   │   ├── templates/
│   │   │   │   ├── success-rate.yaml
│   │   │   │   ├── latency-p99.yaml
│   │   │   │   └── error-rate.yaml
│   │   │   └── kustomization.yaml
│   │   ├── gateway/
│   │   │   ├── rollout.yaml          # ← Deployment 대체
│   │   │   ├── service.yaml
│   │   │   ├── canary-service.yaml   # ← 추가
│   │   │   └── ingress.yaml
│   │   ├── order/
│   │   │   └── ... (동일 패턴)
│   │   └── ...
│   └── overlays/
│       └── prod-k8s/
│           └── patches/
│               └── canary-args.yaml  # 환경별 analysis args
```

---

## 11. 트레이드오프 / 함정

### 11-1. Session sticky 의 UX 함정

```
사용자 A:
  request 1 → stable (95%)
  request 2 → canary (5%)   ← 같은 사용자가 다른 버전
  request 3 → stable
  → UX 깨짐 (페이지 layout 다름, session 깨짐)
```

**해결**:
1. Cookie 기반 sticky:
   ```yaml
   nginx.ingress.kubernetes.io/canary-by-cookie: "canary-user"
   nginx.ingress.kubernetes.io/canary-by-header: "X-Canary"
   ```
2. Istio 의 consistent hash routing.
3. 사용자별 segment 분리 (일부 user_id % 100 < 5).

### 11-2. WebSocket / gRPC 의 connection 단위 함정

```
NGINX canary-weight: 5
WebSocket connection 한 번 잡히면 30분 유지
→ 트래픽 % 제어 효과 미미 (connection 비율 ≠ 트래픽 비율)
```

**해결**: Istio / Linkerd 의 request-level routing 또는 connection drain 짧게.

### 11-3. DB schema breaking change

```
v2 가 새 column 강제 사용 → v1 와 같이 못 살음
v2 canary 5% → 일부 트래픽 v1, 일부 v2 → DB 양쪽에서 다른 schema 기대
```

**해결 — expand-contract**:
```
Deploy 1: schema 추가 (옛 column 유지)
Deploy 2: 코드가 둘 다 사용 (dual write/read)
Deploy 3: 옛 column 제거
```

각 deploy 사이에 충분한 시간 (24h+) + monitoring.

### 11-4. Breaking API change

```
v1 API: GET /products → { id, name, price }
v2 API: GET /products → { id, displayName, priceCents }
사용자: v1 응답 캐시 → v2 가 응답하면 parse 실패
```

**해결**:
1. **API versioning** — `/v1/products`, `/v2/products` 분리.
2. **Tolerant reader** — 클라이언트가 모르는 필드 무시.
3. **Backward compat** 1-2 release — 옛 필드 유지.

### 11-5. Argo Rollouts × HPA 충돌

```
HPA scaleTargetRef:
  apiVersion: apps/v1
  kind: Deployment
  name: gateway
  
→ Rollout 이 Deployment 를 대체 → HPA 가 target 못 찾음
```

**해결**:
```yaml
scaleTargetRef:
  apiVersion: argoproj.io/v1alpha1
  kind: Rollout
  name: gateway
```

→ Argo Rollouts 가 HPA 호환. msa 의 18개 HPA 마이그레이션 필요 (Phase 4).

### 11-6. AnalysisTemplate 의 source 장애

```
Prometheus down → analysis Error
  ├── failureLimit 이 있으면 → abort
  └── 없으면 → inconclusive → pause 무한
```

**해결**: `failureLimit: 3` 설정 + Prometheus 자체의 HA / DR.

### 11-7. Rollout 자체의 metric

```
Argo Rollouts controller metrics:
  rollout_phase{phase="Healthy|Degraded|Paused"}
  rollout_info{...}
  experiment_phase{...}

→ Argo Rollouts 자체를 모니터링해야 함 (controller pod down 시 promote 멈춤)
```

→ kube-prometheus-stack 의 ServiceMonitor 로 자동 수집.

### 11-8. Inconclusive 처리

```yaml
metrics:
  - name: success-rate
    successCondition: "result[0] >= 0.99"
    failureCondition: "result[0] < 0.95"
    # 0.95 ~ 0.99 사이 → inconclusive
```

→ 명시적 처리 안 하면 무한 pause. 운영 정책: inconclusive = abort 또는 inconclusive = continue.

---

## 12. ADR 후보 (msa Progressive Delivery 도입)

> **ADR-XXXX-C: Argo Rollouts 도입 — Tier 별 Canary / Blue-Green 단계 마이그레이션**
>
> **Context**: 현재 msa 는 Deployment + RollingUpdate 만 사용. canary / blue-green / 메트릭 자동 검증 부재 — 사람이 Grafana 5분 보고 100% 전환 → P0 장애 발견은 사후. ADR-0019 Phase 4 의 HPA / PDB 가 가용성을 보장하지만 **버그 배포 차단** 은 없음.
>
> **Decision**:
> 1. **Argo Rollouts 도입** — Argo CD (ADR-XXXX-B) 와 자연 통합.
> 2. **Tier 별 전략 매트릭스**:
>    - Tier 1 (gateway/order/auth/member 인증) — Canary + AnalysisTemplate (success-rate ≥ 99.5%, latency-p99 ≤ 500ms) + 마지막 단계 manual confirm
>    - Tier 2 (search/product/wishlist/gifticon) — Canary + 자동 promote
>    - Tier 3 (analytics/experiment/search-consumer) — Rolling (현 상태)
>    - Special (quant) — Blue-Green + autoPromotionEnabled:false + KEK / outbox lag prePromotionAnalysis
> 3. **AnalysisTemplate 라이브러리** — `k8s/base/argo-rollouts/templates/` 에 success-rate / latency-p99 / error-rate / ctr-canary 4 표준.
> 4. **Traffic shaping** — NGINX (이미 도입). Istio 도입 시 gRPC/WebSocket 서비스만 단계 마이그.
> 5. **HPA 호환** — 18개 HPA 의 scaleTargetRef 를 Deployment → Rollout 으로 일괄 마이그.
> 6. **Slack 통합** — promote/abort 알림 + slash command 로 manual promote.
>
> **Consequences**:
> - (+) 사용자 피해 시간 단축 (사후 발견 → 5분 안 자동 rollback).
> - (+) 비즈니스 metric (CTR / CVR (Conversion Rate, 전환율)) 까지 검증 가능.
> - (+) Tier 별 정책 분리로 운영 부담 균형.
> - (-) Deployment → Rollout 마이그레이션 비용 (~2주, 18 서비스).
> - (-) AnalysisTemplate 의 Prometheus 쿼리 정합성 검증 비용.
> - (-) DB schema 의 expand-contract 강제 — 개발 곡선.
>
> **Alternatives 검토**:
> - Flagger — Deployment 그대로 + annotation only. 진입 낮으나 GitOps 통합 (Argo CD) 어색. 채택 ❌.
> - 수동 canary (native Service selector) — % 부정확 + 자동 검증 ❌. 채택 ❌.
> - 도입 보류 — 사용자 피해 시간 못 줄임. 채택 ❌.

---

## 13. 면접 한 줄 답변

### Q. RollingUpdate 와 Canary 의 본질적 차이는?

> "RollingUpdate 는 maxSurge/maxUnavailable 비율로 점진 교체하지만 트래픽은 모든 새 Pod 에 즉시 같은 비율로 갑니다 — 검증이 readiness probe 뿐. Canary 는 트래픽 가중치 자체를 5% → 25% → 50% → 100% 로 점진 늘리고 매 단계 메트릭 검증 → fail 시 즉시 가중치 0 으로 rollback. 결과적으로 'Canary = RollingUpdate + 트래픽 가중치 제어 + 자동 메트릭 검증'."

### Q. Argo Rollouts 의 Rollout 이 Deployment 를 대체하는 이유는?

> "Deployment 의 strategy 필드는 RollingUpdate / Recreate 만 지원합니다. Canary / Blue-Green / AnalysisTemplate / trafficRouting 같은 progressive delivery 기능은 표현 못해서 별도 CRD (Rollout) 로 확장한 것입니다. spec.template 부분은 Deployment 와 동일하지만 spec.strategy 가 canary/blueGreen 로 확장. HPA 의 scaleTargetRef 도 Rollout 을 가리키게 마이그 필요."

### Q. Canary 의 단계 (5% → 25% → 50% → 100%) 를 어떻게 자동 검증하나요?

> "각 단계 사이에 AnalysisRun 을 끼워서 Prometheus 쿼리로 success rate / latency-p99 / error rate 를 측정합니다. successCondition (예: >= 99%) 만족하면 다음 단계, failureCondition (예: < 95%) 면 즉시 abort 후 setWeight 0 + 이전 stable revision 으로 복귀. 사이 영역은 inconclusive — 운영 정책에 따라 abort 또는 continue."

### Q. AnalysisTemplate 의 provider 5가지는?

> "Prometheus (PromQL — 가장 일반), Datadog / NewRelic / Wavefront / CloudWatch (매니지드), Web (HTTP endpoint + JSON path), Job (K8s Job 의 exit code — e2e 테스트), Kayenta (Spinnaker 통합) 입니다. msa 는 Prometheus 가 표준이고, 결제 같은 도메인은 Job + e2e 테스트 결합 권장. 비즈니스 metric (CTR / CVR) 도 PromQL 로 검증 가능."

### Q. Blue-Green 과 Canary 의 선택 기준은?

> "단일 replica 강제 (msa 의 quant) / session sticky 필요 / 자원 2배 OK 면 Blue-Green. 점진 전환 + 자원 절약 (1.1×) + 메트릭 자동 검증 강조면 Canary. quant 는 KEK 경합 + 포지션 중복 위험으로 Blue-Green + autoPromotionEnabled:false 권장. Tier 1 (gateway/order) 는 Canary + 마지막 단계 manual confirm 권장."

### Q. Traffic shaping 의 5 옵션은?

> "NGINX Ingress (msa 가 이미 채택, connection 단위 — WebSocket 효과 미미), Istio (request-level, mTLS / retries 등 mesh 기능), Linkerd / SMI (vendor-neutral), ALB (AWS EKS 표준), Gateway API (Ingress 후속 표준). Argo Rollouts 가 5종 모두 trafficRouting 으로 위임. msa 권장은 NGINX 우선, gRPC/WebSocket 비중 ↑ 시 Istio 도입."

### Q. DB schema breaking change 는 canary 에 어떤 영향을?

> "v1 v2 가 같은 DB 를 다른 schema 로 보면 한쪽이 깨집니다. expand-contract 패턴 필수 — Deploy 1 schema 추가 (옛 column 유지) → Deploy 2 dual write/read → Deploy 3 옛 column 제거. 각 deploy 가 forward + backward 호환. 또는 release toggle 로 새 코드 path 를 deploy 후 별도 enable. 결국 'API/schema 호환은 코드 책임, infra 의 canary 는 그 책임을 회피하지 못함'."

### Q. Argo Rollouts × HPA 충돌과 해결은?

> "HPA scaleTargetRef 가 Deployment 를 가리키는데 Argo Rollouts 가 Deployment 를 Rollout 으로 대체하면 HPA 가 target 못 찾습니다. 해결은 scaleTargetRef.apiVersion 을 argoproj.io/v1alpha1, kind 를 Rollout 으로 변경. msa 의 18개 HPA (`k8s/overlays/prod-k8s/hpa.yaml`) 의 일괄 마이그레이션이 도입 Phase 4 의 작업 항목."

### Q. Argo Rollouts vs Flagger 의 차이는?

> "Argo Rollouts 는 Rollout CRD 로 Deployment 를 대체 + Argo CD 와 자연 통합 + Web UI. Flagger 는 Canary CR 이 Deployment 를 wrap (Deployment 그대로) + annotation 진입 낮음 + Flux native. 핵심 기능 (Canary / Blue-Green / AnalysisTemplate) 비슷. msa 는 Argo CD 와 일관성 + UI 친화 + 한국 대기업 채택 우세 → Argo Rollouts 권장."

### Q. msa 의 Tier 별 배포 전략은?

> "Tier 1 (gateway/order/auth/member) Canary + AnalysisTemplate + 마지막 단계 manual confirm. Tier 2 (search/product/wishlist/gifticon) Canary + 자동 promote. Tier 3 (analytics/experiment/search-consumer) 일반 Rolling. Special (quant) Blue-Green + KEK / outbox lag prePromotionAnalysis. Frontend 6종 Rolling (정적 파일이라 위험 ↓). 도입은 Argo Rollouts controller 설치 → AnalysisTemplate 라이브러리 → gateway PoC → 단계 확장 의 7 Phase 8-10주 1인."

---

## 14. 흔한 오해 정정

> **"Canary 5% 면 정확히 5% 트래픽이 새 버전으로 간다"**

- ⚠ NGINX / 다른 connection 단위 router 는 connection 비율 — 한 번 잡힌 connection 은 그 backend 유지. WebSocket / gRPC 면 효과 미미. Istio 의 request-level routing 만 정확.

> **"Argo Rollouts 가 readiness probe 를 대체한다"**

- ❌ readiness 는 여전히 필요. Argo Rollouts 의 검증은 그 위에 추가되는 메트릭 검증. readiness 통과 + analysis success 둘 다 필요.

> **"AnalysisTemplate 이 fail 하면 즉시 setWeight 0"**

- ⚠ failureCondition 명시적 만족 시에만. inconclusive (사이 영역) 면 pause 무한. 운영 정책으로 inconclusive = abort 명시 권장.

> **"Blue-Green 은 자원 2배라 무조건 Canary 가 낫다"**

- ❌ 단일 replica 강제 / session sticky / DB schema 동일 보장 시 Blue-Green 이 더 안전. 자원 vs 안전성의 trade-off.

> **"rollback = git revert 면 Argo Rollouts 가 알아서"**

- ⚠ git revert + Argo CD sync 는 새 deploy 트리거. Argo Rollouts 의 rollback 은 `kubectl argo rollouts undo` (이전 stable revision 으로 즉시) 또는 abort + setWeight 0. 두 메커니즘 분리.

> **"AnalysisTemplate 만 있으면 자동 rollback 모든 케이스 잡는다"**

- ❌ 100% 전환 후 발견된 문제는 자동 rollback 미발동. postPromotionAnalysis 또는 새 deploy/manual undo. 또 메트릭 source 자체 down 시 inconclusive.

> **"Argo Rollouts 와 Service Mesh 둘 다 필요"**

- ❌ Argo Rollouts 가 trafficRouting 으로 NGINX / ALB 도 지원. Service Mesh 는 mTLS / retries / observability 등 추가 가치가 있을 때만. canary 만 위해선 NGINX 충분.

> **"Canary 는 무조건 메트릭 자동 검증"**

- ⚠ 단순 canary (가중치만) 도 가능. AnalysisTemplate 없이 setWeight + pause + manual promote 로 진행 가능. 단 자동화 가치 ↓.

---

## 15. 회독 체크리스트

> §20 회독 체크리스트:
> - [ ] 배포 전략 8 비교 (Recreate / Rolling / Blue-Green / Blue-Green+Argo / Canary / Canary+Argo / Shadow / A/B)
> - [ ] Rollout CRD 가 Deployment 를 대체하는 이유 (canary / blueGreen / steps / analysis 표현)
> - [ ] Steps 6 명령 (setWeight / pause / pause-duration / analysis / experiment / setCanaryScale)
> - [ ] Pause 의 manual vs duration 모드 + Tier 권장
> - [ ] canaryService / stableService 의 동적 selector patching
> - [ ] Blue-Green 의 prePromotionAnalysis / postPromotionAnalysis / scaleDownDelaySeconds
> - [ ] AnalysisTemplate 의 5 provider (Prometheus / Datadog / NewRelic / Job / Web)
> - [ ] 3 결과 (success / failure / inconclusive) + Condition 운영
> - [ ] Traffic shaping 5 옵션 (NGINX / Istio / Linkerd-SMI / ALB / Gateway API)
> - [ ] NGINX 의 connection 단위 함정 + WebSocket/gRPC 영향
> - [ ] Rollback 의 expand-contract DB schema 패턴 (3 deploy)
> - [ ] HPA × Rollout 의 scaleTargetRef 마이그 (Deployment → Rollout)
> - [ ] Argo Rollouts vs Flagger (Rollout CRD vs Canary wrap, GitOps 통합)
> - [ ] msa Tier 매트릭스 (Tier 1 Canary+manual, Tier 2 Canary+auto, Tier 3 Rolling, Special Blue-Green)
> - [ ] Session sticky 함정 + cookie/header 기반 해결
> - [ ] Inconclusive 운영 정책 (abort vs continue 명시)
> - [ ] Argo Rollouts controller 자체 모니터링 (controller pod down 시 promote 멈춤)

---

## 16. 연결 학습

- §10 배포 전략 기본 — Recreate / Rolling / Blue-Green / Canary / Shadow 정의 (이 파일은 자동화 + AnalysisTemplate + Tier 매트릭스)
- §13 Service Mesh — Istio / Linkerd 의 mTLS / sidecar (이 파일은 Service Mesh 의 traffic shaping 활용)
- §18 Operator 패턴 — CRD + Controller (이 파일은 Argo Rollouts 도 Operator 패턴 — Rollout CRD + controller)
- §19 GitOps Argo CD — Application / Sync (이 파일은 Argo Rollouts 가 Argo CD 와 자연 통합 — Rollout 도 Application 의 자원으로 sync)
- §15 msa K8s grep — `k8s/base/{gateway,order,...}` 의 Deployment (이 파일은 그것들을 Rollout 으로 마이그하는 설계)
- §08 scheduling — HPA / PDB 의 scaleTargetRef (이 파일은 Rollout 으로 마이그하는 패치)
