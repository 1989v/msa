---
parent: 11-k8s-deep-dive
type: preview
created: 2026-05-01
---

# K8s 심화 + 배포 전략 — Preview

> 학습자 수준: 중급(intermediate, 이미 K8s 기반 운영 — ADR-0019) · 전체 예상 시간: 20h · 목표: 면접 대비 + msa 후속 개선 ADR 도출
> 계획서: [00-plan.md](00-plan.md) · 깊이 패키지: P3 풀팩 · 학습 순서: Top-down (Control Plane → Resource → Operator → Network → Deploy → GitOps → Security)

---

## 멘탈 모델: "K8s 7층 사다리"

ADR (Architecture Decision Record, 아키텍처 결정 기록)-0019 로 이미 K8s 위에 올라온 msa 를 **운영 수준** 으로 끌어올리려면 7층을 모두 알아야 한다.

```
┌──────────────────────────────────────────────┐
│  L7: GitOps & Delivery                       │
│      Argo CD / Flux / Sealed Secrets / SOPS  │
└──────────────────┬───────────────────────────┘
                   │ "변경을 어떻게 묶어 배포하나"
┌──────────────────┴───────────────────────────┐
│  L6: Deploy Strategy                         │
│      Rolling / Blue-Green / Canary / Shadow  │
│      Argo Rollouts / Flagger                 │
└──────────────────┬───────────────────────────┘
                   │ "런타임에 어떻게 흘려보내나"
┌──────────────────┴───────────────────────────┐
│  L5: Service Mesh & Security                 │
│      Istio / Linkerd / mTLS / RBAC / OPA     │
└──────────────────┬───────────────────────────┘
                   │ "Pod 끼리 어떻게 통신하나"
┌──────────────────┴───────────────────────────┐
│  L4: Networking                              │
│      CNI (Calico/Cilium) / kube-proxy /      │
│      Service / Ingress / Gateway API / DNS   │
└──────────────────┬───────────────────────────┘
                   │ "어떤 노드에 떨어지나"
┌──────────────────┴───────────────────────────┐
│  L3: Scheduling & Scaling                    │
│      Affinity / Taint / PDB / HPA / VPA / CA │
└──────────────────┬───────────────────────────┘
                   │ "리소스를 어떻게 추상화하나"
┌──────────────────┴───────────────────────────┐
│  L2: Resource & Controller                   │
│      Pod / Deployment / StatefulSet / CRD    │
│      Reconciliation Loop / Operator          │
└──────────────────┬───────────────────────────┘
                   │ "선언적 상태를 누가 만드나"
┌──────────────────┴───────────────────────────┐
│  L1: Control Plane                           │
│      api-server / etcd / scheduler / CM /    │
│      kubelet / kube-proxy / runtime          │
└──────────────────────────────────────────────┘
```

---

## 핵심 5문장만 외운다

1. **K8s 의 본질은 "원하는 상태(spec)" 와 "현재 상태(status)" 의 차이를 좁히는 컨트롤러 루프** — 모든 것이 reconciliation.
2. **api-server 만이 etcd 를 만진다** — 인증/인가/admission/validation 의 단일 게이트.
3. **Service 는 가상 IP, 실제 트래픽은 kube-proxy(iptables/IPVS) 또는 eBPF 가 라우팅** — DNS A 레코드는 ClusterIP 를 가리킬 뿐.
4. **HPA + Cluster Autoscaler 는 짝** — HPA 가 Pod 를 늘리려는데 노드가 모자라면 CA 가 노드를 추가, 둘이 분리되어 있어 5분 지연 가능.
5. **Rolling 은 동시성 보장 안 됨, Canary 는 트래픽 비율로 검증, Blue-Green 은 롤백이 가장 빠름** — 셋의 조합이 GitOps 의 무기.

---

## 소주제 지도

> 17개 deep file 로 분할. 각 파일 평균 ~1.2h. 학습 순서는 1 → 17 직진 권장.

### Phase 1: 기본기 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | 컨트롤 플레인 / 데이터 플레인 | [01-control-plane.md](01-control-plane.md) | api-server 단일 게이트, etcd Raft, scheduler 2단계, kubelet 의 PLEG |
| 02 | 핵심 리소스 + kubectl 흐름 | [02-core-resources.md](02-core-resources.md) | Pod/Deployment/Service/Ingress/CM/Secret, kubectl apply 의 전체 파이프라인, kubeconfig |

### Phase 2: 컨트롤러 / Operator (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 03 | 컨트롤러 패턴 + Reconciliation | [03-controller-pattern.md](03-controller-pattern.md) | Informer/Workqueue, controller-runtime, level-triggered |
| 04 | CRD + Operator (kubebuilder) | [04-crd-operator.md](04-crd-operator.md) | Finalizer / Status subresource / Conversion webhook / scaffold |

### Phase 3: Networking (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 05 | CNI / kube-proxy / Service / EndpointSlice | [05-networking-deep.md](05-networking-deep.md) | iptables vs IPVS vs eBPF, Headless + gRPC LB (#18 cross-ref) |
| 06 | Ingress / Gateway API / NetworkPolicy / CoreDNS | [06-ingress-gateway-api.md](06-ingress-gateway-api.md) | Ingress 한계 → Gateway API, ndots:5 함정, deny-default NetPol |

### Phase 4: 인프라 운영 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 07 | Storage (PV/PVC/StorageClass/CSI/StatefulSet) | [07-storage.md](07-storage.md) | RWO/RWX, dynamic provisioning, volumeClaimTemplates, RetainPolicy |
| 08 | Scheduling (affinity / taint / PDB / topology) | [08-scheduling.md](08-scheduling.md) | nodeAffinity required vs preferred, anti-affinity 분산, PDB minAvailable |
| 09 | Autoscaling (HPA/VPA/CA/KEDA + Custom Metric) | [09-autoscaling.md](09-autoscaling.md) | Prometheus Adapter, KEDA Kafka lag, behavior 안정화, VPA + HPA 충돌 |

### Phase 5: 배포 / 패키징 / GitOps (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 10 | 배포 전략 (Rolling/Blue-Green/Canary/Shadow) | [10-deployment-strategies.md](10-deployment-strategies.md) | maxSurge/maxUnavailable, Argo Rollouts AnalysisRun, Flagger metric 자동 분석 |
| 11 | Helm vs Kustomize | [11-helm-vs-kustomize.md](11-helm-vs-kustomize.md) | Chart 구조, hook, library chart, kustomize patches strategicMerge vs json6902 |
| 12 | GitOps (Argo CD / Flux / Secrets) | [12-gitops.md](12-gitops.md) | App-of-Apps, sync wave, drift detection, Sealed Secrets vs SOPS vs External Secrets |

### Phase 6: 보안 / Mesh (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 13 | Service Mesh (Istio / Linkerd) | [13-service-mesh.md](13-service-mesh.md) | Sidecar vs Ambient, mTLS 자동화, traffic split, 비용/복잡도 트레이드오프 |
| 14 | K8s 보안 (RBAC / PSS / OPA / etcd 암호화) | [14-k8s-security.md](14-k8s-security.md) | RBAC 4-tuple, PSS baseline/restricted, Kyverno 정책 예시 |

### Phase 7: 산출물 (3개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 15 | msa 코드베이스 K8s 점검 | [15-msa-k8s-grep.md](15-msa-k8s-grep.md) | k3s-lite vs prod-k8s overlay 차이, HPA/PDB 적용 현황, NetworkPolicy gap |
| 16 | 개선 제안 + ADR 후보 | [16-improvements.md](16-improvements.md) | Argo CD 도입, Operator 직접 작성, Custom Metric HPA, Argo Rollouts 도입 |
| 17 | 면접 Q&A 카드 | [17-interview-qa.md](17-interview-qa.md) | "Deployment vs StatefulSet", "kubectl apply 의 전체 흐름", "GitOps 차별점" 등 30+ |

---

## 개념 관계도

```
              ┌──────────────────────────────────┐
              │  L1: Control Plane               │
              │  api-server 가 모든 변경의 게이트   │
              └─────────────┬────────────────────┘
                            │ "선언 → 저장(etcd)"
                            ▼
              ┌──────────────────────────────────┐
              │  L2: Controller / Operator        │
              │  Watch → Diff → Reconcile        │
              └─────────────┬────────────────────┘
                            │ "Pod 를 어디에 둘까"
                            ▼
              ┌──────────────────────────────────┐
              │  L3: Scheduler + HPA + CA        │
              │  자원 / 토폴로지 / 디스럽션         │
              └─────────────┬────────────────────┘
                            │ "Pod 가 어떻게 묶이나"
                            ▼
              ┌──────────────────────────────────┐
              │  L4: Network (CNI/Service/DNS)   │
              │  ClusterIP / NodePort / LB / Ing │
              └─────────────┬────────────────────┘
                            │ "트래픽을 어떻게 보호하나"
                            ▼
              ┌──────────────────────────────────┐
              │  L5: Mesh + Security (mTLS/RBAC) │
              └─────────────┬────────────────────┘
                            │ "어떻게 흘려보내나"
                            ▼
              ┌──────────────────────────────────┐
              │  L6: Rollout (Rolling/Blue/Canary)│
              └─────────────┬────────────────────┘
                            │ "Git → 클러스터 동기화"
                            ▼
              ┌──────────────────────────────────┐
              │  L7: GitOps (Argo CD / Flux)     │
              └──────────────────────────────────┘
```

---

## msa 적용 우선순위 치트시트

> 자세한 근거는 [16-improvements.md](16-improvements.md). 여기서는 한 장 요약.

| 우선순위 | 제안 | 근거 |
|---|---|---|
| 즉시 | NetworkPolicy deny-default + namespace 격리 | 현재 NetPol 0건, 프로덕션 보안 gap |
| 즉시 | kube-prometheus-stack 의 ServiceMonitor 활용 → HPA Custom Metric (RPS / Kafka lag) | 이미 ServiceMonitor 존재, CPU 70% 만으로는 부족 |
| 단기 | Argo CD 도입 — `kubectl apply -k` → GitOps 전환 | 운영 변경 추적/롤백/drift 차단 |
| 단기 | Sealed Secrets 사용처 명확화 (현재 `infra/prod/sealed-secrets/` 폴더만) | Percona/Strimzi 가 placeholder Secret 사용 중 |
| 중기 | Argo Rollouts 도입으로 Canary + AnalysisRun | gateway/order 같은 Tier 1 서비스 점진 배포 |
| 중기 | Strimzi/Percona/ECK 외에 자체 도메인 Operator 작성 검토 | quant 의 KEK 회전, idempotent consumer 정책 등 |
| 장기 | Service Mesh (Linkerd 우선) — mTLS + 분산 추적 | 비용/복잡도 vs 보안 이득 저울질 필요 |

---

## 학습 진행 가이드

- 권장 순서: **01 → 02 → ... → 17** (Top-down 직진), 산출물(15-17) 은 마지막
- Phase 1-2 (01-04) 는 의존성 있음 → 순서대로
- Phase 3-4 (05-09) 는 독립적 → 관심 영역 먼저 가능
- Phase 5 (10-12) 는 msa 후속 ADR 직결 → 학습 후 [16-improvements.md](16-improvements.md) 작성 시 활용
- Phase 6 (13-14) 는 면접 빈출 → 5문장 요약만 외워도 답변 가능
- **15-msa-k8s-grep.md** 는 직접 `kubectl apply -k --dry-run=server -o yaml` 로 결과를 보면 머리에 잘 남음
- **17-interview-qa.md** 는 회독용 — 학습 종료 후 1주일 간격으로 2-3회 회독

각 파일 호출:
```
/study:start 11           # 다음 deep file 자동 선택
/study:start 11 04        # 04-crd-operator.md 직접 지정
```

---

## 기존 학습과의 cross-reference

| 연결 주제 | 본 학습에서 어떻게 쓰는가 |
|---|---|
| #2 JVM (`MaxRAMPercentage=75.0`) | 02-core-resources, 09-autoscaling 의 requests/limits 와 컨테이너 메모리 회계 |
| #15 Connection Pool | 09-autoscaling 의 HPA scale-out 시 Pod 당 connection 폭증 이슈 |
| #16 Async (Lettuce/Netty) | 05-networking-deep 의 Headless Service + Lettuce 와 비교 |
| #18 gRPC | 05-networking-deep 의 Headless Service + client-side LB 케이스 |
| #13 Crypto/JWT/SSO | 12-gitops, 14-k8s-security 의 Sealed Secrets / SOPS / External Secrets / etcd at-rest 암호화 |
