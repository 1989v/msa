---
id: 11
title: K8s 심화 + 배포 전략
status: draft
created: 2026-04-16
updated: 2026-04-16
tags: [kubernetes, operator, crd, helm, gitops, deployment-strategy, canary]
difficulty: intermediate
estimated-hours: 20
codebase-relevant: true
---

# K8s 심화 + 배포 전략

## 1. 개요

K8s 의 컨트롤 플레인 내부 동작, Operator / CRD 패턴, 고급 네트워킹, 배포 전략 (Rolling / Blue-Green / Canary), Helm, GitOps (ArgoCD / Flux) 까지 10년차 수준으로 학습한다. ADR-0019 (K8s 전환) 이후의 실무 심화.

msa 프로젝트가 이미 K8s 기반 (`prod-k8s`, `k3s-lite`) 이라 직접 적용 가능.

## 2. 학습 목표

- K8s 컨트롤 플레인 (API Server, etcd, Controller Manager, Scheduler) 동작 이해
- Pod / ReplicaSet / Deployment / StatefulSet / DaemonSet 차이와 선택 기준
- CRD + Operator 패턴의 개념과 예시 (cert-manager, AWS LB Controller)
- K8s 네트워킹 심화: CNI, Service, Ingress, NetworkPolicy
- Pod Scheduling: affinity, taints/tolerations, topology spread
- Resource 관리: requests/limits, HPA, VPA, Cluster Autoscaler
- 배포 전략: Rolling / Blue-Green / Canary 구현 방식과 트레이드오프
- Helm Chart 작성과 template 전략
- GitOps (ArgoCD / Flux) 의 동작 원리와 장점
- 면접 "Deployment 와 StatefulSet 차이?" "GitOps 장점?" "Canary 배포 어떻게?" 방어

## 3. 선수 지식

- Docker 기본
- 컨테이너 오케스트레이션 기본
- AWS 네트워크 (1번 주제) — 이미 완료

## 4. 학습 로드맵

### Phase 1: 기본 개념
- K8s 컨트롤 플레인: API Server, etcd, Scheduler, Controller Manager, Cloud Controller Manager
- 데이터 플레인: kubelet, kube-proxy, Container Runtime (containerd)
- 기본 리소스: Pod, ReplicaSet, Deployment, Service, ConfigMap, Secret
- 고급 리소스: StatefulSet, DaemonSet, Job, CronJob
- Namespace, Label, Annotation
- kubectl 기본
- Helm 기본 (Chart, Release, Template)

### Phase 2: 심화
**컨트롤 플레인 심화**
- API Server 인증/인가 (RBAC)
- etcd: Raft 기반 합의, 백업/복구
- Admission Controller (ValidatingWebhook, MutatingWebhook)
- Custom Resource Definition (CRD)
- Operator 패턴: CRD + Controller → 도메인 로직 자동화
- 대표 Operator: cert-manager, AWS Load Balancer Controller, Prometheus Operator, Strimzi (Kafka)

**네트워킹 심화**
- CNI Plugin: Calico, Cilium, VPC CNI (EKS)
- Service 타입: ClusterIP, NodePort, LoadBalancer, ExternalName
- Ingress + IngressClass
- NetworkPolicy (기본 deny + allow 패턴)
- Service Mesh (Istio, Linkerd) - mTLS, traffic splitting

**Scheduling**
- nodeSelector, nodeAffinity
- podAffinity / podAntiAffinity
- taints / tolerations
- Topology Spread Constraints (Pod 균등 배치)
- PriorityClass, PreemptionPolicy

**Resource & Scaling**
- requests / limits (QoS class: Guaranteed / Burstable / BestEffort)
- HPA (CPU/Memory/Custom Metric)
- VPA (Vertical Pod Autoscaler)
- Cluster Autoscaler / Karpenter
- Pod Disruption Budget (PDB)

**배포 전략**
- Rolling Update (기본): maxSurge, maxUnavailable
- Blue-Green: 두 환경 병행, Service selector 전환
- Canary: Ingress 가중치 조정, Flagger 자동화
- Shadow / Dark Launch
- Feature Flag 와 연동

**Helm**
- Chart 구조 (Chart.yaml, values.yaml, templates/)
- 템플릿 함수 (Sprig), 조건부 렌더링
- Helm Hook (pre-install, post-upgrade)
- Library Chart vs Application Chart
- Kustomize vs Helm (msa 는 Kustomize 기반)

**GitOps**
- ArgoCD: Pull 기반, App of Apps 패턴
- Flux: 유사, 다른 철학
- Git Repo 구조 (env branch vs folder)
- 보안 고려사항 (Sealed Secrets, SOPS)

**기타**
- StatefulSet + Headless Service (DB 등)
- Persistent Volume / PVC / StorageClass
- Init Container, Sidecar Container
- Pod Security Standards (PSS)

### Phase 3: 실전 적용
- msa 프로젝트 K8s 구조 점검
  - `k8s/base/` (공통)
  - `k8s/overlays/prod-k8s/` (프로덕션)
  - `k8s/overlays/k3s-lite/` (로컬)
  - `k8s/infra/local/` vs `k8s/infra/prod/`
- HPA + PDB 적용 현황 (Phase 3 AWS network 탐색 결과 활용)
- NetworkPolicy 미적용 Gap (주제 1번 Phase 4 에서 식별)
- cert-manager 도입 방식 (prod-k8s TLS)
- Kustomize overlay 전략 심화
- ArgoCD 도입 가능성 검토
- Canary 배포 전략 설계 (Flagger 등)
- ADR-0019 K8s 전환 후속 개선 포인트 식별

### Phase 4: 면접 대비
- "Deployment 와 StatefulSet 차이는?"
- "HPA 와 Cluster Autoscaler 의 관계는?"
- "Rolling / Blue-Green / Canary 언제 쓰나요?"
- "GitOps 가 뭐고 기존 CD 와 뭐가 다른가요?"
- "Operator 와 Controller 의 차이는?"
- "kubectl apply 를 할 때 API Server 에서 어떤 일이 일어나나요?"
- "Service type=LoadBalancer 를 EKS 에서 쓰면 어떻게 동작하나요?"

## 5. 코드베이스 연관성

- **ADR-0019**: `docs/adr/ADR-0019-k8s-migration.md`
- **K8s 매니페스트**: `k8s/` 전체
- **CLAUDE.md Local Dev / Deployment Modes**: 이미 K8s 기반 정리됨
- **Runbook**: `docs/runbooks/k8s-deployment.md`
- **1번 주제 AWS 네트워크 Phase 3**: 현재 K8s → AWS 매핑 이미 완료

## 6. 참고 자료

- "Kubernetes in Action" - Marko Lukša
- Kubernetes 공식 문서
- CNCF Landscape
- Kelsey Hightower 의 kubernetes-the-hard-way

## 7. 미결 사항

- Operator 패턴 실습 (간단한 Controller 작성?) 포함 여부
- GitOps 실제 도입 검토까지 포함?
- Service Mesh (Istio) 깊이
- Helm vs Kustomize 선택 근거 심화

## 8. 원본 메모

K8s 심화 + 배포 전략 (Operator/CRD, Networking 심화, Rolling/Blue-Green/Canary, Helm, GitOps)
