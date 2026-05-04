---
parent: 11-k8s-deep-dive
seq: 99
title: K8s 개념 카탈로그 — Full-Coverage + 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - https://kubernetes.io/docs/
  - https://kubernetes.io/docs/concepts/
  - https://kubernetes.io/docs/reference/
  - https://operatorframework.io/
  - https://gateway-api.sigs.k8s.io/
  - https://argo-cd.readthedocs.io/
---

# 99. Kubernetes 개념 카탈로그

> **목적** — 11-k8s-deep-dive 의 17+ deep file + Kubernetes 공식 docs 기준 빠진 영역 발굴 (Gateway API, EndpointSlices, ResourceClaim/DRA, ValidatingAdmissionPolicy(CEL), Topology Spread Constraints, PodDisruptionBudget, KEDA, Karpenter, Cilium, ArgoCD/Flux 등).

---

## 1. 기존 커버 매트릭스

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| 워크로드 | Deployment / StatefulSet / DaemonSet / Job / CronJob | ✅ |
| 네트워킹 | Service / Ingress / NetworkPolicy | ✅ |
| 스토리지 | PV / PVC / StorageClass | ✅ |
| 설정 | ConfigMap / Secret | ✅ |
| 운영 | HPA / VPA / PDB | ✅ |
| 배포 전략 | Rolling / Blue-Green / Canary | ✅ |
| Operator / CRD | controller pattern | ✅ |
| GitOps | ArgoCD / Flux | 🟡 |
| 보안 | RBAC / ServiceAccount | ✅ |

### 1-A. 갭 진단 (k8s 공식 트리 기준)

1. **Gateway API** (sigs.k8s.io/gateway-api) — Ingress 후속, GatewayClass / Gateway / HTTPRoute / GRPCRoute / TLSRoute / TCPRoute / UDPRoute
2. **EndpointSlices** — Endpoints 의 후속 (1.21+ stable)
3. **Topology Aware Routing** — `service.kubernetes.io/topology-aware-hints`
4. **Topology Spread Constraints** — 노드/존 분산
5. **PodDisruptionBudget** (PDB) 디테일 + maxUnavailable vs minAvailable
6. **DRA (Dynamic Resource Allocation)** — 1.31+ — GPU/리소스 동적 할당
7. **Pod Topology / nodeAffinity / podAffinity / podAntiAffinity / taints / tolerations**
8. **Resource requests/limits 의 QoS class** (Guaranteed / Burstable / BestEffort)
9. **VerticalPodAutoscaler (VPA)** — recommender / updater / admission
10. **HPA v2 (resource / external / pods / object metric)**
11. **KEDA** — event-driven autoscaling (Kafka lag, SQS, Cron, Prometheus query)
12. **Karpenter** — node 자동 프로비저닝 (AWS / GKE)
13. **Cluster Autoscaler** vs Karpenter
14. **CSI / CRI / CNI** 인터페이스
15. **CRI-O / containerd**
16. **CNI 종류** — Calico / Cilium / Flannel / Weave / AWS VPC CNI
17. **Cilium / eBPF** — L3-L7 + observability
18. **Service Mesh** (Istio / Linkerd) — sidecar / sidecarless (Ambient)
19. **Multi-cluster** (Cluster API, Karmada, Submariner, Liqo)
20. **Federation** — KubeFed (deprecated)
21. **CRD 작성** + OpenAPI v3 schema + validation
22. **Admission Controllers** — MutatingAdmissionWebhook / ValidatingAdmissionWebhook / **ValidatingAdmissionPolicy (CEL)**
23. **OPA Gatekeeper / Kyverno** — policy engines
24. **NetworkPolicy** L3/L4 + Cilium 의 L7
25. **PSA (Pod Security Admission)** — Restricted / Baseline / Privileged
26. **PSP (deprecated)** vs **PSA**
27. **Pod Security Context / runAsUser / fsGroup / capabilities / seccomp / AppArmor**
28. **Workload Identity** (GKE / AKS) / IRSA (EKS)
29. **External Secrets Operator** + Vault / AWS Secrets Manager
30. **SealedSecrets / SOPS** — git-friendly secret
31. **GitOps deep** — ArgoCD App of Apps / ApplicationSet / Sync waves / hooks
32. **Flux** — Source / Kustomization / HelmRelease / Image automation
33. **Helm** — Chart / Values / hooks / lifecycle
34. **Kustomize** — overlay / base / generators / patches (strategic merge / JSON 6902)
35. **Operator framework** (operator-sdk) + Kubebuilder
36. **OperatorHub.io** + popular operators (Strimzi, Postgres operators (Zalando/CloudNativePG), Redis operators, ES operator)
37. **Backup** — Velero / Stash
38. **DR** — multi-cluster + Velero + PV snapshot
39. **Storage** — CSI snapshots + PVC clone + WaitForFirstConsumer
40. **StatefulSet 의 ordering + headless service + PVC retention policy**
41. **Job 의 backoffLimit / activeDeadlineSeconds / completionMode (Indexed)**
42. **CronJob 의 concurrencyPolicy (Allow/Forbid/Replace) + startingDeadlineSeconds**
43. **Resource quota + LimitRange** — namespace governance
44. **PriorityClass + Preemption**
45. **Node lifecycle** — NotReady / cordon / drain / uncordon
46. **Cluster API** — k8s 자체 자동 프로비저닝
47. **Talos / k3s / k0s / kind / k3d** — 경량 distro
48. **API conventions / status sub-resource / spec drift** — controller 작성
49. **Reconciliation loop / Workqueue / RateLimiter (controller-runtime)**
50. **Server-Side Apply** — field manager
51. **Lease / Coordination API** — leader election
52. **Aggregated APIServer** — extension API
53. **Audit log** — k8s API 감사
54. **etcd backup / compaction / defrag**
55. **kubelet 의 cgroup v2 / topology manager**

---

## 2. 카테고리별 개념 트리

### A. 워크로드

| 개념 | 정의 | 상태 |
|---|---|---|
| Deployment / ReplicaSet / Pod | 표준 워크로드 | ✅ |
| StatefulSet | ordered + 안정 ID | ✅ |
| DaemonSet | per-node | ✅ |
| Job / CronJob | batch | ✅ |
| **Job concurrencyPolicy / completionMode (Indexed)** | 배치 패턴 | ★ 신규 |
| HPA v2 / VPA | autoscaling | ✅ / 🟡 |
| **KEDA** (event-driven) | Kafka lag / SQS / Prom query | ★ 신규 |
| **PriorityClass + Preemption** | 우선순위 | ★ 신규 |
| **PDB (PodDisruptionBudget)** | 드레인 시 보호 | ✅ |
| **Topology Spread Constraints** | zone/node 분산 | ★ 신규 |
| nodeAffinity / podAffinity / podAntiAffinity | 배치 정책 | 🟡 |
| Taints / Tolerations | 분리 | 🟡 |

### B. 네트워킹

| 개념 | 정의 | 상태 |
|---|---|---|
| Service (ClusterIP / NodePort / LoadBalancer / ExternalName) | 4종 | ✅ |
| Headless Service | StatefulSet + DNS SRV | 🟡 |
| **EndpointSlices** | Endpoints 후속 | ★ 신규 |
| **Topology Aware Routing** | 동일 zone 우선 | ★ 신규 |
| Ingress (Controller: nginx/traefik/AWS LB Controller) | L7 routing | ✅ |
| **Gateway API** (GatewayClass / Gateway / HTTPRoute / TLSRoute / TCPRoute / UDPRoute / GRPCRoute) | Ingress 후속 표준 | ★ 신규 |
| NetworkPolicy (L3/L4) | 격리 | ✅ |
| **Cilium / eBPF** | L7 NetworkPolicy + observability | ★ 신규 |
| Service Mesh (Istio / Linkerd / Ambient) | sidecar / sidecarless | ★ 신규 |
| CoreDNS | cluster DNS | 🟡 |
| Multi-cluster Service / Submariner / Liqo | cross-cluster | ★ 신규 |

### C. 스토리지

| 개념 | 정의 | 상태 |
|---|---|---|
| PV / PVC / StorageClass | 표준 | ✅ |
| Access modes (RWO/ROX/RWX/RWOP) | 4종 | ✅ |
| WaitForFirstConsumer | 토폴로지 친화 | 🟡 |
| **CSI snapshots / PVC clone** | 스냅샷 | ★ 신규 |
| StatefulSet PVC retention policy | 스토리지 정책 | ★ 신규 |
| **DRA (Dynamic Resource Allocation)** | GPU/특수자원 | ★ 신규 |

### D. 보안

| 개념 | 정의 | 상태 |
|---|---|---|
| RBAC (Role / ClusterRole / Binding) | 권한 | ✅ |
| ServiceAccount | pod 신원 | ✅ |
| **PSA (Pod Security Admission)** — Restricted / Baseline / Privileged | PSP 후속 | ★ 신규 |
| Pod Security Context (runAsUser / fsGroup / capabilities / seccomp / AppArmor) | 격리 | 🟡 |
| **Workload Identity / IRSA** (EKS) | cloud IAM ↔ k8s SA | ★ 신규 |
| **External Secrets Operator** + Vault | secret 외부화 | ★ 신규 |
| **SealedSecrets / SOPS** | git-friendly | ★ 신규 |
| **OPA Gatekeeper / Kyverno** | policy as code | ★ 신규 |
| Audit log | API audit | ★ 신규 |

### E. Admission / Extension

| 개념 | 정의 | 상태 |
|---|---|---|
| MutatingAdmissionWebhook / ValidatingAdmissionWebhook | webhook 기반 | 🟡 |
| **ValidatingAdmissionPolicy (CEL)** | webhook 없는 policy (1.30+) | ★ 신규 |
| CRD + OpenAPI v3 + validation | extension API | ✅ |
| Aggregated APIServer | extension API server | ★ 신규 |
| Server-Side Apply + field manager | declarative ownership | ★ 신규 |

### F. Operator

| 개념 | 정의 | 상태 |
|---|---|---|
| Controller pattern (reconcile loop) | controller-runtime | ✅ |
| Workqueue + RateLimiter | re-queue 안정성 | ★ 신규 |
| Operator-SDK / Kubebuilder | scaffold | ✅ |
| Status sub-resource | spec/status 분리 | ★ 신규 |
| Finalizers | 삭제 보호 | 🟡 |
| OperatorHub.io | 공개 operator | ✅ |
| 인기 Operator: Strimzi (Kafka) / CloudNativePG / Postgres Operator (Zalando) / Redis Operator / Elastic Operator | 운영 표준 | 🟡 |

### G. GitOps / 배포

| 개념 | 정의 | 상태 |
|---|---|---|
| ArgoCD — App of Apps / ApplicationSet / Sync waves / hooks | 배포 표준 | ★ 신규 |
| Flux — Source / Kustomization / HelmRelease / Image automation | 동등 표준 | ★ 신규 |
| Helm — Chart / Values / hooks | 패키징 | ✅ |
| Kustomize — overlay / patches | overlay | ✅ |
| Image automation (Flux) | tag bump → PR | ★ 신규 |
| Progressive Delivery (Argo Rollouts / Flagger) | canary/blue-green 자동 | ★ 신규 |

### H. 노드 / 자동 프로비저닝

| 개념 | 정의 | 상태 |
|---|---|---|
| Cluster Autoscaler | node group 기반 | 🟡 |
| **Karpenter** (AWS / 다른 cloud) | bin-packing + just-in-time | ★ 신규 |
| Node lifecycle (cordon / drain / uncordon) | 운영 | 🟡 |
| **Cluster API** | k8s 자체 프로비저닝 | ★ 신규 |
| Talos / k3s / k0s / kind / k3d | 경량 distro | 🟡 |

### I. 백업 / DR

| 개념 | 정의 | 상태 |
|---|---|---|
| **Velero** | namespace + PV snapshot 백업 | ★ 신규 |
| etcd backup + compaction + defrag | cluster 자체 | ★ 신규 |
| Multi-cluster DR | active/passive | 🟡 |

### J. 관측

| 개념 | 정의 | 상태 |
|---|---|---|
| Liveness / Readiness / Startup probes | health 표준 | ✅ |
| Events | kubectl get events | ✅ |
| Metrics Server / Prom adapter | resource metric | 🟡 |
| Audit log | API audit | ★ 신규 |
| **Cilium Hubble** | L7 observability (eBPF) | ★ 신규 |

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **Gateway API** | Ingress 후속 표준 — 새 클러스터는 Gateway API 권장 |
| 2 | **KEDA + HPA v2** | event-driven scaling 표준 |
| 3 | **Karpenter (또는 Cluster API)** | 노드 프로비저닝 자동화 |
| 4 | **ValidatingAdmissionPolicy (CEL)** | webhook 없는 policy |
| 5 | **Cilium / eBPF + Hubble** | 네트워크 + observability |
| 6 | **Topology Spread Constraints + PDB + Topology Aware Routing** | 가용성 표준 묶음 |
| 7 | **External Secrets Operator + Workload Identity** | 시크릿/신원 표준 |
| 8 | **GitOps deep — ArgoCD ApplicationSet + Argo Rollouts** | 배포 자동화 |
| 9 | **Kyverno / OPA Gatekeeper** | policy as code |
| 10 | **CRD + Operator-SDK 작성 패턴 (workqueue, status, finalizer)** | 자체 operator 작성 |

---

## 4. 표준 심화 스터디 템플릿

`19/99 §4` 사용. K8s 특화:
- §3 → "관련 API group / version / Kind" 표
- §6 → "K8s vs OpenShift vs EKS/GKE/AKS 차이"
- §7 → kubectl debug 명령 모음 / events / describe pattern

---

## 5. 참고 자료

- Kubernetes docs: https://kubernetes.io/docs/
- Gateway API: https://gateway-api.sigs.k8s.io/
- Operator Framework: https://operatorframework.io/
- ArgoCD: https://argo-cd.readthedocs.io/
- Flux: https://fluxcd.io/
- Cilium: https://docs.cilium.io/
- KEDA: https://keda.sh/
- Karpenter: https://karpenter.sh/
- "Kubernetes in Action" (Marko Lukša)
- "Programming Kubernetes" (Michael Hausenblas, Stefan Schimanski)
- "Production Kubernetes" (Josh Rosso 외)
