---
parent: 11-k8s-deep-dive
seq: 08
title: 스케줄링 — Affinity / Taint / PDB / Topology Spread
type: deep
created: 2026-05-01
---

# 08. 스케줄링 심화

## 1. 한 장 요약

스케줄러의 결정에 영향을 주는 6개 무기:

| 도구 | 누가 정의 | 역할 |
|---|---|---|
| `nodeSelector` | Pod | 가장 단순. label 매칭. |
| `nodeAffinity` | Pod | required/preferred + 표현식 |
| `podAffinity / podAntiAffinity` | Pod | 다른 Pod 와의 위치 관계 |
| `taints` | Node | "이 노드는 특별, 명시적 toleration 가진 Pod 만 받음" |
| `tolerations` | Pod | taint 우회 |
| `topologySpreadConstraints` | Pod | zone/노드 균등 분산 |

추가:
- `priorityClass` — 자원 부족 시 누가 살아남나
- `PodDisruptionBudget` (PDB) — voluntary disruption 시 최소 가용 보장

## 2. nodeSelector — 가장 단순한 매칭

```yaml
spec:
  nodeSelector:
    kubernetes.io/arch: arm64
    workload-tier: tier-1
```

Pod 는 모든 label 이 맞는 노드만 후보. label 은 `kubectl label node node-1 workload-tier=tier-1` 또는 자동 (kubeadm/cloud-provider).

자동 채워지는 표준 label:
- `kubernetes.io/hostname`
- `kubernetes.io/arch` (amd64 / arm64)
- `kubernetes.io/os`
- `topology.kubernetes.io/zone` (us-east-1a)
- `topology.kubernetes.io/region`
- `node.kubernetes.io/instance-type` (m5.large)

## 3. nodeAffinity — 표현력

```yaml
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: workload-tier
                operator: In
                values: [tier-1, tier-2]
              - key: topology.kubernetes.io/zone
                operator: In
                values: [us-east-1a, us-east-1b]
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          preference:
            matchExpressions:
              - { key: instance-type, operator: In, values: [m5.large] }
```

### 4가지 모드

| 모드 | 의미 |
|---|---|
| `requiredDuringSchedulingIgnoredDuringExecution` | 스케줄 시점 hard 조건. 한번 떨어지면 노드 label 이 바뀌어도 Pod 안 옮김. |
| `preferredDuringSchedulingIgnoredDuringExecution` | 스케줄 시점 soft (점수 가산). |
| `requiredDuringSchedulingRequiredDuringExecution` | (제안 단계, 아직 GA 아님) 실행 중에도 검사. |

operator: `In`, `NotIn`, `Exists`, `DoesNotExist`, `Gt`, `Lt`.

## 4. podAffinity / podAntiAffinity

같은 노드/zone/topology 에 다른 Pod 와 함께 또는 떨어뜨림.

### 예시 1 — gateway 끼리 다른 노드에 (HA)

```yaml
spec:
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        - labelSelector:
            matchLabels: { app.kubernetes.io/name: gateway }
          topologyKey: kubernetes.io/hostname
```

→ 같은 hostname 에는 다른 gateway Pod 두 개 못 들어감.

### 예시 2 — gateway 끼리 다른 zone 에 (DR)

```yaml
topologyKey: topology.kubernetes.io/zone
```

### 예시 3 — product 와 redis 를 같은 노드 (locality)

```yaml
podAffinity:
  preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector: { matchLabels: { app: redis } }
        topologyKey: kubernetes.io/hostname
```

### 함정

- **required + 작은 클러스터** → 스케줄 실패 빈번. 보통 preferred 가 안전.
- **계산 복잡도 O(N²)** — 1k Pod 클러스터에서 podAffinity 가 많으면 스케줄러 latency 급증.
- 같은 효과를 **Topology Spread Constraints** 로 더 깔끔히 표현 가능 (다음 §6).

## 5. Taint / Toleration

> "이 노드는 GPU 전용이라 다른 Pod 받기 싫어" 같은 의도를 표현.

```bash
kubectl taint nodes gpu-node-1 nvidia.com/gpu=true:NoSchedule
```

```yaml
spec:
  tolerations:
    - key: nvidia.com/gpu
      operator: Equal
      value: "true"
      effect: NoSchedule
```

### effect 3가지

| effect | 의미 |
|---|---|
| `NoSchedule` | toleration 없으면 스케줄 안 됨 (실행 중 Pod 영향 X) |
| `PreferNoSchedule` | soft 회피 |
| `NoExecute` | 기존 Pod 도 evict (`tolerationSeconds` 까지만) |

K8s 자체가 자동으로 거는 taint:
- `node.kubernetes.io/not-ready` — 노드가 NotReady 가 되면
- `node.kubernetes.io/unreachable` — 네트워크 끊김
- `node.kubernetes.io/disk-pressure`, `memory-pressure`, `pid-pressure`
- `node.kubernetes.io/unschedulable` — `kubectl cordon` 시
- `node.kubernetes.io/network-unavailable`

대부분 Pod 는 not-ready/unreachable 에 대해 5분 (`tolerationSeconds: 300`) 기본 toleration 자동 부여 → 5분 후 evict.

### dedicated node 패턴

```bash
kubectl taint nodes batch-node-1 dedicated=batch:NoSchedule
```

→ batch 전용 toleration 가진 Pod 만 스케줄. analytics / search-batch 같은 무거운 워크로드 격리에 유용.

## 6. Topology Spread Constraints

zone/노드 별 균등 분산을 declarative 하게 표현:

```yaml
spec:
  topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: topology.kubernetes.io/zone
      whenUnsatisfiable: DoNotSchedule
      labelSelector: { matchLabels: { app.kubernetes.io/name: gateway } }
    - maxSkew: 1
      topologyKey: kubernetes.io/hostname
      whenUnsatisfiable: ScheduleAnyway
      labelSelector: { matchLabels: { app.kubernetes.io/name: gateway } }
```

의미: **gateway Pod 끼리** zone 별 차이가 1을 넘지 않게 분산 (3 zone × 2 replicas → zone 당 0~1 차이만 허용, 즉 2-2-2 또는 2-2-1 같은 분포).

`whenUnsatisfiable`:
- `DoNotSchedule` — 만족 못 하면 Pending
- `ScheduleAnyway` — soft

podAntiAffinity 보다 표현이 명확하고 계산 효율적 → **신규 워크로드는 topologySpreadConstraints 권장**.

## 7. PriorityClass + Preemption

자원 부족 시 누가 살아남나:

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: { name: tier-1 }
value: 1000
globalDefault: false
description: "User-facing critical services"
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata: { name: batch }
value: 100
description: "Batch / async / lower priority"
preemptionPolicy: Never   # 다른 Pod 를 evict 하지 않음
```

```yaml
# Pod
spec:
  priorityClassName: tier-1
```

높은 priority Pod 가 스케줄될 자리가 없으면 → 낮은 priority Pod 를 **evict** (preempt) 해서 자리 만듦. PDB 도 고려 (PDB 위반 시 evict 보류).

기본 시스템 클래스: `system-cluster-critical` (2 billion), `system-node-critical` (2 billion + 1).

## 8. Pod Disruption Budget (PDB)

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: gateway }
spec:
  minAvailable: 1     # 또는 maxUnavailable: 1
  selector:
    matchLabels: { app.kubernetes.io/name: gateway }
```

### 무엇을 막나

PDB 는 **voluntary disruption** 만 막는다:
- `kubectl drain <node>` (cluster autoscaler/upgrade)
- Cluster Autoscaler 가 노드 삭제하려 할 때
- Operator 가 강제 삭제 시도

**involuntary disruption** 은 못 막음:
- 노드 OS crash
- kubelet 죽음
- 리소스 부족 OOM (Out Of Memory, 메모리 부족)
- 클라우드 spot 회수

### msa 패턴

`k8s/overlays/prod-k8s/pdb.yaml`:
```yaml
spec:
  minAvailable: 1
```

HPA `minReplicas: 2` 와 결합해서 **rolling 중에도 최소 1개는 살아있게**.

함정:
- `minAvailable: 100%` → drain 영원히 못 함
- replicas=1 + `minAvailable: 1` → drain 불가
- 그래서 운영의 황금 비율: `replicas >= 2 && minAvailable: replicas - 1` 또는 `maxUnavailable: 1`

## 9. Cluster Autoscaler 와의 상호작용

```
Pod Pending (스케줄 실패: 자원 부족)
   │
   ▼
Cluster Autoscaler watch
   │
   ▼
1. Pending Pod 의 affinity/taint 분석
2. 어떤 ASG/MIG/NodePool 이 만족 가능한지 판정
3. 그 그룹의 desired count +1
4. 새 노드 join → kubelet ready
5. 기존 Pending Pod 가 새 노드로 스케줄
```

스케일 다운:
- 노드 utilization < 50% & 모든 Pod 가 다른 노드로 이주 가능 → drain → terminate
- PDB 가 막으면 보류
- DaemonSet / mirror pod / system pod 무시

### Karpenter (AWS 진영)

- ASG 없이 EC2 인스턴스 직접 생성
- Pod 의 요구사항(architecture, gpu, zone) 보고 적절한 instance type 동적 선택
- 더 빠른 scale up (~30s) + bin-packing 효율 ↑

EKS 운영 표준은 점차 CA → Karpenter 로 이동 중.

## 10. msa 매핑

현재 (`k8s/base/`):
- nodeSelector 미사용
- affinity 미사용
- tolerations 미사용
- topologySpreadConstraints 미사용
- PDB: `prod-k8s` overlay 의 `pdb.yaml` 에 `minAvailable: 1` 일괄 (gateway/product/order/search/search-consumer/auth/member/wishlist/gifticon/inventory/fulfillment/warehouse/analytics/experiment/chatbot/code-dictionary)
- HPA: `prod-k8s` 의 `hpa.yaml` 에 같은 17개. CPU 70%. minReplicas: 2.

→ HA 에 가장 부족한 것: **AZ 분산**. 현재 replicas=2 가 같은 AZ 에 떨어질 수 있음. AZ 장애 시 동시에 사라짐.

추천 패치 ([16-improvements.md](16-improvements.md) 후보):

```yaml
# patches/topology-spread.yaml
spec:
  template:
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app.kubernetes.io/part-of: commerce-platform
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app.kubernetes.io/part-of: commerce-platform
```

## 11. 면접 빈출 6

1. **"nodeAffinity required vs preferred?"** → required 는 hard 조건, 못 만족하면 Pending. preferred 는 점수 가산만, 다른 노드라도 스케줄.
2. **"podAntiAffinity 와 topologySpread 차이?"** → 후자가 더 표현력 있고 효율적. 기본은 spread 추천.
3. **"PDB 가 노드 crash 도 막나?"** → 안 막음. voluntary disruption 만. crash 는 PriorityClass + replica 분산 + readiness 로 대응.
4. **"Cluster Autoscaler 와 HPA 의 차이?"** → HPA 는 Pod 수, CA 는 노드 수. HPA 가 Pod 늘리려는데 노드 부족하면 CA 가 노드 추가. 둘이 분리되어 있어 전체 scale up 까지 5분+ 걸릴 수 있다.
5. **"taint 와 NetworkPolicy 의 차이?"** → 완전히 다른 층. taint 는 스케줄러 입력, NetworkPolicy 는 트래픽 제어. 둘은 직교.
6. **"Spot 인스턴스 운영 팁?"** → spot toleration + nodeAffinity preferred + Spot termination handler DaemonSet (2분 전 SIGTERM 으로 graceful drain). PDB 와 결합.

## 12. 정리

```
                        ┌──────────────────────────────┐
                        │  Pod                          │
                        │   nodeAffinity / nodeSelector │
                        │   tolerations                 │
                        │   topologySpreadConstraints   │
                        │   priorityClassName           │
                        └─────────────┬─────────────────┘
                                      │
                                      ▼
                        ┌──────────────────────────────┐
                        │  Scheduler                    │
                        │   Filter → Score → Bind       │
                        └─────────────┬─────────────────┘
                                      │
                                      ▼
                        ┌──────────────────────────────┐
                        │  Node                         │
                        │   labels                      │
                        │   taints                      │
                        │   capacity / allocatable      │
                        └──────────────────────────────┘
```

다음: [09-autoscaling.md](09-autoscaling.md) — HPA / VPA / Cluster Autoscaler / KEDA + Custom Metric.
