---
parent: 11-k8s-deep-dive
seq: 01
title: 컨트롤 플레인 / 데이터 플레인 내부 동작
type: deep
created: 2026-05-01
---

# 01. 컨트롤 플레인 / 데이터 플레인 — "kubectl apply 한 줄이 무슨 일을 하나"

## 1. 한 장 그림

```
            ┌─────────── Control Plane (master) ───────────┐
            │                                              │
   user ──► │ kube-apiserver ◄──► etcd  (Raft consensus)   │
            │     ▲     ▲                                  │
            │     │     │                                  │
            │     │     ├─ kube-scheduler                  │
            │     │     │   (Pod → Node binding)           │
            │     │     │                                  │
            │     │     └─ kube-controller-manager         │
            │     │         (Deployment, ReplicaSet, ...)  │
            │     │                                        │
            │     └─ cloud-controller-manager              │
            │         (LoadBalancer, Node, Route)          │
            └────────────────────┬─────────────────────────┘
                                 │ watch + bind
                                 ▼
            ┌────────── Data Plane (worker node N대) ──────┐
            │  kubelet ──► CRI(containerd) ──► Pod          │
            │  kube-proxy (iptables / IPVS / eBPF)         │
            │  CNI plugin (Calico / Cilium / VPC CNI)      │
            └──────────────────────────────────────────────┘
```

핵심: **컨트롤 플레인의 모든 컴포넌트는 직접 etcd 를 만지지 않는다. 오직 api-server 만 만진다.** 이것이 RBAC/admission/audit 의 단일 게이트가 되는 이유다.

## 2. kube-apiserver — REST 게이트웨이

### 책임

1. RESTful API (`/api/v1`, `/apis/<group>/<version>`)
2. 인증 (Authentication) — x509 / token / OIDC / Webhook
3. 인가 (Authorization) — RBAC / ABAC / Webhook
4. **Admission** — Mutating → Validating → 저장
5. etcd persistence

### 요청 파이프라인

```
HTTP Request
   │
   ▼
[1] Authentication       → user identity
   │
   ▼
[2] Authorization (RBAC) → can this user do this verb on this resource?
   │
   ▼
[3] Mutating Admission   → defaulting, sidecar 주입 (Istio)
   │
   ▼
[4] Schema Validation    → OpenAPI v3 schema 검사
   │
   ▼
[5] Validating Admission → policy 강제 (Kyverno, OPA Gatekeeper)
   │
   ▼
[6] etcd write           → resourceVersion 증가, watch 이벤트 fan-out
   │
   ▼
HTTP 201 Created
```

운영 포인트:
- api-server 는 **stateless** — HA 를 위해 다중 인스턴스 + LB 앞에 둠
- **resourceVersion** 은 etcd 의 mod_revision 으로, watch + optimistic concurrency 의 핵심
- 대형 응답은 chunked transfer 로 streaming

### 면접 답변용 한 줄

> "api-server 는 K8s 의 단일 mutate 지점이다. 모든 컨트롤러/노드는 watch 로 변경을 받아간다. 따라서 etcd 백업 == 클러스터 백업이고, api-server 가 죽으면 새 변경은 막히지만 데이터 플레인은 (kubelet 캐시로) 잠시 동작한다."

## 3. etcd — 분산 KV 스토어 (Raft 합의)

- **모든 K8s 객체** 의 source of truth
- Raft 로 leader 선출, write 는 leader → quorum 복제
- 권장 클러스터 크기: **3, 5, 7 (홀수)** — 5가 일반적, fault tolerance = (N-1)/2
- 대용량/잦은 변경에 약함 — `Event` 객체는 별도 etcd 로 분리하는 옵션이 있음

### 백업

```bash
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-$(date +%F).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

복구: `etcdctl snapshot restore <db>` → static pod 재시작.

### at-rest 암호화 (EncryptionConfiguration)

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources: ["secrets"]
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <base64 32-byte>
      - identity: {}    # fallback for migration
```

- 기본은 `identity` (= 평문). Secret 은 etcd 를 dump 하면 그대로 보인다.
- AWS EKS / GKE 는 KMS provider 로 envelope 암호화 자동 제공.
- 이 항목은 [`#13 13-aws-kms.md`](../13-crypto-jwt-sso/13-aws-kms.md) 의 envelope 패턴과 정확히 동일한 구조.

## 4. kube-scheduler — Pod → Node 배치

2단계 스코어링:

1. **Filtering (Predicates)** — 후보 노드 필터: `NodeUnschedulable`, `NodeAffinity`, `Taint/Toleration`, `PodFitsResources`, `VolumeBinding`, `PodTopologySpread` 등
2. **Scoring (Priorities)** — 점수 매김: `LeastAllocated`, `BalancedAllocation`, `ImageLocality`, `InterPodAffinity` 등

```
   Unscheduled Pod
        │
        ▼
   ┌────────────┐
   │ Filtering  │   N개 노드 중 K개 통과
   └─────┬──────┘
         ▼
   ┌────────────┐
   │ Scoring    │   각 노드 0~100 점
   └─────┬──────┘
         ▼
   가장 높은 점수 노드 선택
         │
         ▼
   Pod 의 .spec.nodeName 설정 (= "binding")
         │
         ▼
   해당 노드의 kubelet 이 watch 로 감지 → 컨테이너 기동
```

스케줄러는 **bind 만** 한다. 실제 컨테이너 기동은 kubelet 이 한다 — 분리되어 있어 스케줄러가 죽어도 기존 Pod 는 영향 없음.

### Scheduling Framework (확장점)

`PreFilter / Filter / PostFilter / PreScore / Score / Reserve / Permit / PreBind / Bind / PostBind` 의 플러그인 체인. 자체 plugin 으로 Karpenter 식 동적 노드 프로비저닝, 토픽-aware 스케줄링 등을 구현 가능.

## 5. kube-controller-manager — 상태 수렴 엔진

여러 컨트롤러를 하나의 프로세스로 묶음:

| Controller | 역할 |
|---|---|
| Deployment | ReplicaSet 생성/롤링업데이트 |
| ReplicaSet | Pod 수 유지 |
| Node | Node 헬스 감시, 죽으면 Pod eviction |
| Endpoint(Slice) | Service 의 selector → 실제 Pod IP 매핑 |
| Job / CronJob | 배치 실행 |
| ServiceAccount / Token | 토큰 자동 생성 |
| HorizontalPodAutoscaler | 메트릭 기반 replica 조정 |
| Namespace | 삭제 시 cascading |
| PV / PVC binder | 동적 프로비저닝 |
| GarbageCollector | ownerReferences 기반 cascading 삭제 |

각 컨트롤러는 같은 패턴: **"informer 로 watch → workqueue → reconcile → desired vs actual diff → API 호출"**. 자세한 패턴은 [03-controller-pattern.md](03-controller-pattern.md).

## 6. cloud-controller-manager (CCM)

클라우드 의존 로직만 분리:

- `Service.spec.type=LoadBalancer` → AWS NLB / GCP TCP LB / Azure LB 생성
- Node 등록 시 클라우드 메타데이터로 zone/region label 부여
- 라우트 테이블 갱신 (legacy, 이제 CNI 책임)

EKS/GKE/AKS 는 CCM 을 자체 구현체로 교체. self-hosted (kubeadm) 는 cloud-provider 플래그로 활성화.

## 7. 데이터 플레인 — kubelet

각 워커 노드에 1개. 책임:

1. api-server 의 `assignedPods` watch → 자기 노드에 떨어진 Pod spec 수신
2. **CRI** (Container Runtime Interface, gRPC) 로 containerd 에 컨테이너 생성/제거 명령
3. **CNI** plugin 호출 → Pod 네트워크 네임스페이스 + IP 할당
4. **CSI** plugin 호출 → 볼륨 마운트
5. **PLEG** (Pod Lifecycle Event Generator) — 주기적으로 컨테이너 상태 확인, 변화 감지 시 PodStatus 업데이트
6. probes 실행 (liveness/readiness/startup)
7. cgroups 로 cpu/memory 제한 강제 (`Guaranteed/Burstable/BestEffort` QoS)

### 면접 빈출

- "Pod 가 ContainerCreating 에서 멈췄어요" → kubelet event 봐라. 보통 image pull 실패, CSI mount 실패, CNI IP 부족.
- "MaxRAMPercentage=75 인데 OOMKilled" → kubelet 이 cgroup memory limit 으로 종료. JVM heap 외 metaspace/direct buffer/스레드 스택을 잊지 말 것 ([#2 JVM 학습 cross-ref](../02-jvm-deep-dive/)).

## 8. 데이터 플레인 — kube-proxy

Service 의 가상 IP 를 실제 Pod IP 로 라우팅. 모드:

| 모드 | 메커니즘 | 비고 |
|---|---|---|
| **iptables** (기본) | NAT 규칙 N개 | Service 수 ↑ → 규칙 수 O(N), 매칭 O(N) |
| **IPVS** | 커널 L4 LB | Hash table O(1), rr/lc/sh 알고리즘 지원 |
| **eBPF (Cilium)** | kube-proxy 대체 | conntrack 우회, 가장 빠름 |

자세한 비교는 [05-networking-deep.md](05-networking-deep.md).

## 9. 컨테이너 런타임 (CRI)

- **containerd** (de facto, 1.20+ dockershim 제거 후 표준)
- **CRI-O** (Red Hat 진영)
- Docker 는 더 이상 K8s 가 직접 지원하지 않음 (cri-dockerd 어댑터 필요)

CRI gRPC API 의 핵심 메서드: `RunPodSandbox`, `CreateContainer`, `StartContainer`, `Exec`, `ContainerStatus`.

## 10. 단일 노드 변종 — k3s / k3d (msa 의 k3s-lite)

- **k3s**: Rancher 가 만든 single-binary K8s. etcd 대신 SQLite (옵션으로 etcd 가능). 컨트롤 플레인 + 워커가 한 프로세스.
- **k3d**: k3s 를 도커 컨테이너로 띄움. 로컬 개발용.
- msa 는 `k8s/overlays/k3s-lite` 로 단일 노드 운영을 1급 시민으로 유지 (ADR-0019 §5).

## 11. kubectl apply 의 전체 흐름 (정리)

```
$ kubectl apply -f deploy.yaml
   │
   ├─[client] kubeconfig 로드 → auth token / cert 결정
   ├─[client] OpenAPI 스키마로 default 적용 + dry-run validation
   ├─[client] last-applied-configuration annotation 계산 → 3-way merge
   │
   ├─[net] HTTPS PUT/POST /apis/apps/v1/namespaces/default/deployments
   │
   ├─[apiserver] AuthN → AuthZ → Admission(M) → Validation → Admission(V) → etcd write
   │
   ├─[etcd] resourceVersion 증가 → watch 이벤트 fan-out
   │
   ├─[controller-manager] Deployment 컨트롤러 watch → ReplicaSet 생성 (api-server 호출)
   │   └─ ReplicaSet 컨트롤러 watch → Pod N개 생성 (api-server 호출)
   │
   ├─[scheduler] 새 Pod (nodeName=빈값) watch → Filter+Score → bind (api-server 호출)
   │
   └─[kubelet] 자기 노드 Pod watch → CRI 로 컨테이너 시작 → CNI IP → CSI 볼륨 → probe → Ready
```

이 8단계가 머리에 박히면 다음 주제(컨트롤러 패턴) 이해가 쉽다.

## 12. 자주 헷갈리는 포인트 5개

1. **scheduler 가 컨테이너를 시작하지 않는다** — bind 만. 시작은 kubelet.
2. **Service 는 객체일 뿐, 트래픽을 흘리는 건 kube-proxy 또는 CNI(eBPF)**.
3. **ReplicaSet 을 직접 만들 일은 없다** — Deployment 가 만든다. 직접 건드리면 Deployment 와 충돌.
4. **etcd 는 K8s 가 알아서 관리해주지 않는다** — 백업/복구는 운영자 책임. 매니지드(EKS/GKE)는 클라우드가 함.
5. **HPA 는 컨트롤러 매니저 안에 있다** — 별도 컴포넌트 아님. metrics-server 또는 custom adapter 가 메트릭 제공.

## 13. msa 매핑 한 줄씩

- `k8s/overlays/prod-k8s/` 는 managed K8s (EKS/GKE/AKS) 가정 — 컨트롤 플레인은 클라우드가 운영.
- `k8s/overlays/k3s-lite/` 는 k3d 단일 컨테이너 — 컨트롤 플레인이 한 프로세스.
- `k8s/infra/prod/cert-manager/` 는 CRD 기반 컨트롤러 (Operator 의 일종) — 다음 글의 사례.
- ServiceMonitor (`k8s/infra/prod/monitoring/`) 도 CRD — Prometheus Operator 가 watch 해서 scrape config 갱신.

다음: [02-core-resources.md](02-core-resources.md) — Pod/Deployment/Service/Ingress/CM/Secret 의 구조와 kubectl 흐름 상세.
