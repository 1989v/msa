---
parent: 11-k8s-deep-dive
seq: 10
title: 배포 전략 — Rolling / Blue-Green / Canary / Shadow / Argo Rollouts / Flagger
type: deep
created: 2026-05-01
---

# 10. 배포 전략 심화

## 1. 한 장 비교

| 전략 | 동시 가용 | 자원 비용 | 롤백 속도 | 검증 | 복잡도 |
|---|---|---|---|---|---|
| **Recreate** | X (다운타임) | 1× | 빠름 | 사전 staging 만 | 가장 단순 |
| **Rolling** (기본) | O (옛+새 혼재) | 1.25× | ~1분 | 헬스체크 의존 | 단순 |
| **Blue-Green** | O (한쪽만 활성) | 2× | 즉시 | switch 전 검증 | 중간 |
| **Canary** | O (가중치) | 1.1×~ | 즉시 | 점진 확장 + 메트릭 분석 | 높음 |
| **Shadow** | O (mirror) | 2× | n/a (검증 only) | 실제 트래픽 복제 | 가장 높음 |

## 2. Recreate

```yaml
spec:
  strategy: { type: Recreate }
```

- 기존 Pod 모두 종료 → 새 Pod 시작
- **다운타임 발생** (몇 십 초)
- 단일 인스턴스만 허용되는 워크로드 (singleton, in-memory state) 에 사용

msa 사용 사례: `k8s/overlays/k3s-lite/patches/quant-phase2.yaml` 의 `strategy.type: Recreate`. 이유: replicas=1 가정, 일시적 replicas=2 가 KEK 경합/포지션 중복으로 위험 (TG-P2-15).

## 3. Rolling Update (기본)

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%        # 기존 + 새 pod 합쳐 최대 +25%
      maxUnavailable: 25%  # 기존 중 사라져도 되는 비율
```

### 동작

```
초기:    v1 ✓✓✓✓        (replicas=4)
배포:    v1 ✓✓✓✓ + v2 ✓        (surge: +1)
        v1 ✓✓✓ + v2 ✓✓         (unavailable 1)
        ...
종료:    v2 ✓✓✓✓
```

### maxSurge / maxUnavailable 조합

| 조합 | 동작 |
|---|---|
| `maxSurge=25%, maxUnavailable=25%` | 기본. 빠르지만 잠시 +1 자원 |
| `maxSurge=0, maxUnavailable=1` | 1개씩 교체, 추가 자원 X. 가용성 영향 큼 |
| `maxSurge=1, maxUnavailable=0` | 새거 1개 띄우고 옛거 1개 죽임 (안전) |
| `maxSurge=100%, maxUnavailable=0` | 전부 새로 띄우고 한꺼번에 swap (Blue-Green 흉내) |

### 한계

- **두 버전이 동시 가동** → API 호환성 깨지면 깨짐. DB 마이그레이션 필요 시 expand-contract 패턴 (= 새 컬럼 추가 → 둘 다 사용 → 옛 컬럼 제거 의 3 deploy)
- **검증이 헬스체크 뿐** — readiness 통과해도 실제로는 broken 일 수 있음 (P0 코드 경로가 health probe 와 무관)
- **롤백** — `kubectl rollout undo` 로 가능. 이전 ReplicaSet 이 살아있으니 빠름.

### msa 가 사용 중인 패턴

Deployment 의 기본값 (RollingUpdate, 25%/25%). 별도 `strategy` 명시는 quant 의 Recreate 만.

## 4. Blue-Green

> "옛/새 두 환경을 동시에 운영. Service 의 selector 만 바꿔 트래픽 전환."

### 매니페스트 예시

```yaml
# Deployment 2개 (blue / green)
apiVersion: apps/v1
kind: Deployment
metadata: { name: gateway-blue }
spec:
  replicas: 4
  selector: { matchLabels: { app: gateway, version: blue } }
  template: { metadata: { labels: { app: gateway, version: blue } }, spec: ... }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: gateway-green }
spec:
  replicas: 4
  selector: { matchLabels: { app: gateway, version: green } }
  template: { metadata: { labels: { app: gateway, version: green } }, spec: ... }
---
# Service — selector 의 version 만 바꾸면 트래픽 전환
apiVersion: v1
kind: Service
metadata: { name: gateway }
spec:
  selector:
    app: gateway
    version: blue        # ← 이걸 green 으로 바꾸면 트래픽 swap
  ports: [{ port: 8080 }]
---
# 검증용 Service (green 만 노출)
apiVersion: v1
kind: Service
metadata: { name: gateway-canary }
spec:
  selector: { app: gateway, version: green }
```

### 절차

1. green 배포 (트래픽 0)
2. `gateway-canary` 로 직접 호출, smoke test
3. Service.selector → `green` 으로 patch
4. 트래픽 100% green
5. 문제 없으면 blue 종료 (자원 회수). 문제 있으면 selector 다시 blue 로 → **즉시 롤백**.

### 장점

- **롤백이 가장 빠름** (selector 한 번 patch)
- 두 버전이 동시 트래픽 받지 않음 → API 호환 부담 ↓ (단, DB 는 여전히 조심)

### 단점

- **자원 2배** — 일시적이지만 비싸다
- 큰 장점인 "검증" 도 결국 사람이 smoke test → 자동화 부족

### Argo Rollouts 의 Blue-Green 자동화

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: gateway }
spec:
  replicas: 4
  strategy:
    blueGreen:
      activeService: gateway
      previewService: gateway-preview
      autoPromotionEnabled: false   # 수동 promote
      scaleDownDelaySeconds: 600    # promote 후 10분 후 옛것 종료
      prePromotionAnalysis:
        templates:
          - templateName: success-rate
        args:
          - { name: service-name, value: gateway-preview }
      postPromotionAnalysis:
        templates:
          - templateName: success-rate
        args:
          - { name: service-name, value: gateway }
  selector: { matchLabels: { app: gateway } }
  template: ...
```

`prePromotionAnalysis` 가 Prometheus 쿼리로 success rate 검증 → fail 시 자동 abort.

## 5. Canary

> "트래픽의 일부 (5% → 25% → 50% → 100%) 를 새 버전으로 점진 전환, 메트릭으로 검증."

### Native Canary (서비스 selector 트릭)

가중치를 아주 쉽게 흉내내는 방법: **두 Deployment 를 같은 Service selector 에 묶기**.

```yaml
# stable Deployment - replicas: 9
# canary Deployment - replicas: 1
# 같은 Service selector { app: gateway } 에 매칭
# → 트래픽이 Pod 수 비율로 자동 분배 (10%)
```

단점: 정확한 % 제어 어려움, 메트릭 자동 분석 X. PoC 만.

### Ingress 가중치 (ingress-nginx 의 annotation 기반)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gateway-canary
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"  # 10% → canary
spec:
  rules: ...
  backend: { service: { name: gateway-canary } }
```

ingress-nginx 가 라우팅 시 10% 만 canary backend 로. annotation 으로 header/cookie 기반 라우팅도 가능 (`canary-by-header`).

### Argo Rollouts (자동화)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: gateway }
spec:
  strategy:
    canary:
      canaryService: gateway-canary
      stableService: gateway
      trafficRouting:
        nginx:
          stableIngress: gateway-ingress
      steps:
        - setWeight: 5
        - pause: { duration: 5m }
        - analysis:
            templates: [{ templateName: success-rate }]
        - setWeight: 25
        - pause: { duration: 10m }
        - analysis:
            templates: [{ templateName: success-rate }]
        - setWeight: 50
        - pause: { duration: 10m }
        - setWeight: 100
```

```yaml
# AnalysisTemplate
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata: { name: success-rate }
spec:
  args: [{ name: service-name }]
  metrics:
    - name: success-rate
      successCondition: "result[0] >= 0.99"
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

→ 5% 트래픽 → 5분 대기 → success rate 99% 미만이면 abort (자동 롤백) → 25% → ... .

### Flagger (대안)

- Linkerd / Istio / nginx-ingress / Contour / Gloo / SMI 와 통합
- 자체 `Canary` CRD
- Prometheus / Datadog / NewRelic / CloudWatch 메트릭 분석
- Argo Rollouts 보다 mesh 친화적, Argo CD 와의 통합은 Argo Rollouts 가 자연스러움

선택:
- Argo CD 사용 + Ingress 가중치 → **Argo Rollouts**
- Service Mesh 사용 → Flagger
- (msa 는 Argo CD 가 미도입 → 둘 다 가능, Argo 생태계 우선 권장)

## 6. Shadow / Dark Launch

> "실제 프로덕션 트래픽을 새 버전에 mirror, 응답은 버림."

```yaml
# Istio VirtualService
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata: { name: gateway }
spec:
  hosts: [gateway]
  http:
    - route:
        - destination: { host: gateway, subset: stable }
          weight: 100
      mirror: { host: gateway, subset: shadow }
      mirrorPercentage: { value: 10.0 }   # 10% mirror
```

- shadow 가 실패해도 사용자 영향 없음 (응답 버림)
- 새 버전의 성능/에러를 실제 트래픽으로 검증
- 비용: 서비스 자원 2배 + 데이터 쓰기 (DB) 시 별도 격리 필요 (이중 쓰기 방지)

가치 큰 케이스: **DB 쿼리 패턴이 크게 바뀌는 변경** — 실제 트래픽으로만 미리 알 수 있는 회귀를 잡음.

## 7. Feature Flag 와의 결합

배포 != 노출. 두 단계를 분리:

1. **배포** — 코드 변경을 Production 에 100% 배포 (Rolling)
2. **노출** — Feature flag 로 사용자 5% 만 새 코드 path 진입

장점:
- 인프라 배포의 위험 ↓ (이미 검증된 빈 path)
- A/B 테스트 / 점진 출시가 코드 안에서 결정 (msa 의 `experiment` 서비스가 이걸 담당)
- 롤백이 깃 커밋 없이 flag toggle 만으로 가능

단점: 코드 안에 flag 분기가 쌓이면 기술 부채. 정기 cleanup 필요.

## 8. msa 적용 시나리오

### 현재

- 모든 서비스: `RollingUpdate` 25%/25% (기본값)
- quant: `Recreate` (single replica 강제)
- HPA + PDB 가 있어 rolling 중 가용성 보장
- Canary / Blue-Green / Shadow 미적용

### 권장 (점진)

| 단계 | 도입 | 대상 | 도구 |
|---|---|---|---|
| 1 | Argo CD | 전체 | GitOps 기반 마련 |
| 2 | Argo Rollouts (Canary) | gateway, order | nginx-ingress weighted |
| 3 | AnalysisTemplate (success rate, p95) | gateway, order | Prometheus 활용 |
| 4 | Blue-Green | quant (단일 replica → 잠시 2배 자원 OK) | autoPromotionEnabled: false |
| 5 | Shadow | 새 검색 알고리즘, 새 추천 모델 | Istio (or 개발 환경 선)  |

### Tier 별 기본 전략 매트릭스

```
Tier 1 (사용자 직접 영향 — gateway/order/payment)
   → Canary + AnalysisRun + Manual approve
   
Tier 2 (간접 영향 — search/product)
   → Canary + Auto promote on success
   
Tier 3 (백엔드 / 비동기 — analytics/search-consumer)
   → Rolling 만으로 충분
   
Special (single instance — quant)
   → Recreate, 사전 staging 검증 강화
```

## 9. 흔한 함정 7개

1. **DB 마이그레이션 후 롤백 불가** — 새 버전이 새 컬럼을 사용 → 옛 코드 모름 → expand-contract 로 회피
2. **Ingress 가중치는 connection 단위** — 한 번 잡힌 connection 은 그 backend 유지. WebSocket / gRPC 면 효과 미미
3. **session sticky** — Canary 비율과 별개로 같은 사용자가 옛/새 사이 왔다갔다 (UX 깨짐). cookie 기반 sticky 필요
4. **헬스체크 통과 후 진짜 장애** — readiness 가 실제 비즈니스 path 검증 못 함. AnalysisRun 의 success-rate 가 진짜 검증
5. **Blue-Green 인데 DB 1개** — 옛/새 둘 다 같은 DB 쓰면 schema 변경이 둘 다 영향. DB 도 Blue-Green 은 어렵다
6. **Argo Rollouts 와 HPA 동시 사용** — Rollout 이 Deployment 를 대체. HPA 의 scaleTargetRef 는 Deployment 가 아닌 Rollout 으로 변경 필요 (Argo 가 지원)
7. **자동 promote 가 무서움** — `autoPromotionEnabled: false` + Slack 통합으로 사람이 confirm 추천

## 10. 면접 빈출 7

1. **"Rolling vs Blue-Green vs Canary 언제?"** → 위 §1 표.
2. **"Canary 로 5% → 25% → 100% 어떻게 검증?"** → AnalysisRun 의 success rate / p95 latency Prometheus 쿼리 → fail 시 auto rollback.
3. **"DB 마이그레이션이 배포 전략에 미치는 영향?"** → expand-contract 패턴 (3 deploy: add column → dual-write → drop old). 또는 release toggle.
4. **"Argo Rollouts 와 Flagger 차이?"** → Argo CD 친화 vs Service Mesh 친화. 핵심 기능은 비슷.
5. **"maxSurge / maxUnavailable 어떻게 정해?"** → 자원 여유 + 가용성 SLA. 메모리 부족 클러스터면 maxSurge=0, maxUnavailable=1. user-facing 은 maxSurge 1+ 권장.
6. **"롤백은 어떻게?"** → Rolling: `kubectl rollout undo`. Blue-Green: selector 복원. Canary: setWeight 0 (Argo). Shadow: n/a.
7. **"Feature flag 와 Canary 의 차이?"** → flag 는 코드 안 분기, Canary 는 트래픽 라우팅. flag 는 사용자 단위 정밀 제어, Canary 는 인프라 단위 안전성. 둘은 보완.

## 11. 정리

```
   배포 = 인프라 변경
   노출 = 사용자 경험 변경
   
   배포 전략 (Rolling/B-G/Canary) 은 "인프라 변경의 안전성" 을 다룸.
   Feature flag 는 "사용자 경험의 점진 출시" 를 다룸.
   둘은 직교, 함께 쓸 때 가장 강력.
```

다음: [11-helm-vs-kustomize.md](11-helm-vs-kustomize.md) — 패키징 전략과 두 도구의 트레이드오프.
