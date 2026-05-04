---
parent: 11-k8s-deep-dive
seq: 03
title: 컨트롤러 패턴 + Reconciliation Loop
type: deep
created: 2026-05-01
---

# 03. 컨트롤러 패턴 + Reconciliation Loop

## 1. 한 문장 요약

> "K8s 의 모든 동작은 **'desired state(spec) 와 observed state(status) 의 차이를 좁히는 무한 루프'** 다. 그 루프 한 사이클을 reconcile 이라 부른다."

이 패턴 하나만 머릿속에 박히면, ReplicaSet, Deployment, HPA (Horizontal Pod Autoscaler, 수평 파드 오토스케일러), Operator, GitOps 가 같은 모양임을 알 수 있다.

## 2. 가장 단순한 의사코드

```text
loop forever:
    desired = api.get(MyResource).spec
    observed = api.get(MyResource).status
    if desired == observed:
        sleep
        continue
    diff = compute_diff(desired, observed)
    apply(diff)             # K8s API 호출
    update_status(...)
```

진짜 controller-runtime 코드는 위 루프를 직접 돌리지 않고 **Informer + Workqueue + Reconciler** 로 분리한다. 왜냐하면:
- 모든 리소스를 매번 LIST 하면 etcd 가 죽는다 → **Watch 로 변화만 받기**
- 같은 리소스 이벤트가 폭주하면 중복 작업 → **Workqueue 로 dedup + rate limit**
- 처리 실패 시 백오프 + 재큐 → **Workqueue 의 RateLimiter**

## 3. 정식 아키텍처

```
                  api-server
                     │ watch (HTTP/2 long poll)
                     ▼
              ┌────────────┐
              │  Informer  │  (in-memory cache + index)
              │  Reflector ◄──── List → Watch → in-memory store
              │  Indexer   │
              └─────┬──────┘
                    │ event handler (Add/Update/Delete)
                    ▼
              ┌────────────┐
              │ Workqueue  │  (rate-limited, dedup'd by key)
              └─────┬──────┘
                    │ Get(key)
                    ▼
              ┌────────────┐
              │ Reconciler │  Reconcile(ctx, req) → Result
              │  (your     │     - lookup from informer cache
              │   code)    │     - compute diff
              │            │     - api.Update / Create
              └────────────┘
```

### Informer 의 핵심

- 시작 시 **List** (전체 가져오기) → in-memory 캐시
- 그 후 **Watch** (서버가 변경 push)
- watch 끊기면 마지막 resourceVersion 부터 재개. 너무 오래 끊기면 410 Gone → 다시 List
- **DeltaFIFO** 로 이벤트 순서 보존
- **Indexer** 는 namespace/owner 기반 빠른 조회 제공

장점: 컨트롤러는 GET 안 해도 cache 에서 읽음 → API 부하 ↓.

### Workqueue 의 RateLimiter

- 동일 key 가 처리 중이면 새 이벤트는 큐에 쌓이지 않고 무시 (dedup)
- `AddRateLimited` 로 backoff 재큐 (5ms → 10ms → ... → 1000s)
- 실패 횟수 추적 → 너무 많으면 알람 가능

## 4. Level-triggered vs Edge-triggered

K8s 컨트롤러는 **Level-triggered** 다 — "이벤트를 놓쳐도 어차피 다음 List 때 reconcile 한다". 그래서:

- Reconcile 함수는 **idempotent** 해야 한다. 100번 불려도 결과 같아야 함.
- 함수 인자는 `(ns, name)` 키만. 안에서 직접 GET 해서 현재 상태 확인 → diff → update.
- **상태를 변수로 들고있지 말 것** — reconcile 호출 사이에 죽어도 멀쩡해야 한다.

## 5. Reconcile 의 표준 흐름 (Go controller-runtime)

```go
func (r *MyReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    // 1. 객체 조회
    var obj v1.MyResource
    if err := r.Get(ctx, req.NamespacedName, &obj); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }
    
    // 2. 삭제 처리 (DeletionTimestamp + Finalizer)
    if !obj.DeletionTimestamp.IsZero() {
        return r.handleDelete(ctx, &obj)
    }
    
    // 3. Finalizer 추가 (생성 직후)
    if !controllerutil.ContainsFinalizer(&obj, myFinalizer) {
        controllerutil.AddFinalizer(&obj, myFinalizer)
        return ctrl.Result{}, r.Update(ctx, &obj)
    }
    
    // 4. 자식 리소스 조회 (Deployment 등)
    var dep appsv1.Deployment
    err := r.Get(ctx, types.NamespacedName{...}, &dep)
    
    // 5. desired 계산 + 비교
    want := r.buildDeployment(&obj)
    if err != nil && errors.IsNotFound(err) {
        return ctrl.Result{}, r.Create(ctx, want)
    }
    if !equality.Semantic.DeepDerivative(want.Spec, dep.Spec) {
        dep.Spec = want.Spec
        return ctrl.Result{}, r.Update(ctx, &dep)
    }
    
    // 6. status subresource 갱신
    obj.Status.Phase = "Ready"
    obj.Status.ObservedGeneration = obj.Generation
    return ctrl.Result{RequeueAfter: 30 * time.Second}, r.Status().Update(ctx, &obj)
}
```

핵심 6단계: **조회 → 삭제? → Finalizer → 자식 → diff/apply → status**.

## 6. Finalizer — 삭제 hook

K8s 의 삭제는 2단계:
1. 사용자가 DELETE → api-server 가 `DeletionTimestamp` 설정 (실제 삭제 X)
2. **모든 finalizer 가 제거되면** garbage collector 가 진짜 삭제

```yaml
metadata:
  finalizers:
    - mycontroller.example.com/cleanup
```

내 컨트롤러가 외부 리소스(클라우드 LB, S3 버킷 등)를 만들었다면, Finalizer 안에서 그 리소스를 삭제한 뒤에야 finalizer 를 빼야 한다 — 안 그러면 누수.

```go
func (r *MyReconciler) handleDelete(ctx context.Context, obj *v1.MyResource) (ctrl.Result, error) {
    if controllerutil.ContainsFinalizer(obj, myFinalizer) {
        // 외부 정리
        if err := r.deleteCloudLB(obj); err != nil {
            return ctrl.Result{}, err  // 재시도
        }
        controllerutil.RemoveFinalizer(obj, myFinalizer)
        return ctrl.Result{}, r.Update(ctx, obj)
    }
    return ctrl.Result{}, nil
}
```

## 7. Status subresource

CRD 에 `subresources.status: {}` 를 켜면:
- `spec` 변경 → `metadata.generation` 증가
- `status` 변경 → generation 안 변함
- 사용자는 `status` 직접 수정 불가, `/status` 엔드포인트만 가능
- 컨트롤러는 `r.Status().Update()` 로 별도 호출

이 분리가 없으면 사용자가 status 를 덮어써서 컨트롤러를 혼란시킬 수 있다.

`observedGeneration` 패턴: `status.observedGeneration == metadata.generation` 이면 "최신 spec 까지 reconcile 완료" 의미. HPA, Deployment 가 모두 이 패턴.

## 8. Owner Reference & Cascading Delete

자식 리소스에 `ownerReferences` 를 붙이면:
- 부모 삭제 시 GC 가 자식도 삭제 (`Foreground` / `Background` / `Orphan` 정책)
- `controllerutil.SetControllerReference(&parent, &child, scheme)` 한 줄

Deployment → ReplicaSet → Pod 의 cascade 가 이것으로 동작.

## 9. controller-runtime 의 진입점

```go
mgr, _ := ctrl.NewManager(cfg, ctrl.Options{Scheme: scheme})
ctrl.NewControllerManagedBy(mgr).
    For(&v1.MyResource{}).                  // primary
    Owns(&appsv1.Deployment{}).             // 자식 변경도 reconcile 트리거
    Watches(&source.Kind{Type: &v1.OtherResource{}}, ...).
    Complete(&MyReconciler{Client: mgr.GetClient()})
mgr.Start(ctrl.SetupSignalHandler())
```

- `For` — 주 리소스
- `Owns` — owner reference 기반 자식 watch
- `Watches` — 임의 다른 리소스 watch (mapper 함수로 key 변환)

## 10. K8s 코어 컨트롤러도 같은 패턴

`kube-controller-manager` 안의 `DeploymentController` 도 위 코드의 응용판:
- `For: Deployment, Owns: ReplicaSet`
- spec 변경 → 새 RS 생성, 기존 RS scale down
- maxSurge/maxUnavailable 만큼만 동시에 변경
- 안정되면 status 갱신 (`updatedReplicas`, `availableReplicas`, `conditions`)

`HorizontalPodAutoscalerController` 도 같음:
- `For: HPA, Watches: Pod metrics`
- 매 15초마다 메트릭 조회 → desired replicas 계산 → Deployment scale subresource 호출

## 11. Operator 란?

> "도메인 지식이 들어간 컨트롤러 + CRD" = **Operator**.

차이:
- 코어 컨트롤러: 일반 리소스 (Deployment 등) 만 안다
- Operator: 특정 앱(예: Kafka, Postgres) 의 운영 절차(클러스터 부트스트랩, 백업, 업그레이드, 복구) 를 reconcile 안에 코드로 박는다

대표 Operator:
- **cert-manager** — `Certificate`, `Issuer`, `Order`, `Challenge` CRD. ACME 프로토콜 자동화.
- **Strimzi** — `Kafka`, `KafkaTopic`, `KafkaUser`. KRaft 클러스터 부트스트랩.
- **Percona Operator** — `PerconaServerMySQL`. group-replication, 백업.
- **Prometheus Operator** — `Prometheus`, `ServiceMonitor`. scrape config 자동 생성.
- **Argo CD** — `Application`, `AppProject`. Git → cluster 동기화.

msa 가 사용 중인 Operator:
- `k8s/infra/prod/cert-manager/` — TLS 자동 발급
- `k8s/infra/prod/strimzi/` — Kafka KRaft 3-broker
- `k8s/infra/prod/percona-mysql/` — MySQL group-replication
- `k8s/infra/prod/eck/` — Elasticsearch
- `k8s/infra/prod/clickhouse/` — Altinity ClickHouse
- `k8s/infra/prod/monitoring/` — kube-prometheus-stack
- `k8s/infra/prod/sealed-secrets/` — bitnami sealed-secrets

## 12. 왜 Operator 패턴이 이긴가

대안과 비교:

| 방식 | 장점 | 단점 |
|---|---|---|
| Helm chart 만 | 간단 | 운영 자동화 X (백업/복구/스케일은 사람이) |
| Ansible / Terraform | 일회성 OK | 클러스터 안에서 self-heal 안 됨 |
| **Operator** | 클러스터 안에서 자동화, 선언적, GitOps 친화 | 학습 곡선 ↑, 디버깅 어려움 |

운영 자동화의 endgame 은 Operator 라는 게 업계 합의 — 단, 만들기 쉽지 않으니 **이미 있는 Operator 를 쓰고, 정말 필요할 때만 직접 작성**.

## 13. 실수하기 쉬운 6가지

1. **Reconcile 안에서 sleep** — 안 됨. `RequeueAfter` 로 반환하면 controller-runtime 이 알아서 재큐.
2. **외부 호출 5분 걸림** — 큐가 막힘. 별도 워커 또는 `MaxConcurrentReconciles` 늘리기.
3. **무한 루프** — Reconcile 마다 어떤 필드를 바꿔서 또 watch event 가 발생. 항상 spec 의 generation 비교.
4. **부분 update 시 conflict** — `optimistic concurrency` 충돌. retry 또는 SSA.
5. **leader election 없음** — Operator 가 2개 떠 있으면 동시에 update → race. controller-runtime 의 `LeaderElection: true` 옵션.
6. **Status 를 spec 처럼 사용** — 사용자가 못 고치게 막아야 함. CRD 의 `subresources.status: {}`.

## 14. msa 시사점

msa 의 도메인에서 자체 Operator 가 가치 있을만한 후보:

- **Idempotent Consumer 정책** — Kafka 토픽별 dedup TTL, DLQ 정책을 CRD 로 표준화하면, 새 서비스가 추가되어도 일관성 유지 (현재는 ADR-0012 + 코드 컨벤션).
- **quant KEK 회전** — KEK 버전 관리, 회전 schedule 을 CRD 로 두고 Operator 가 OCI Vault 호출.
- **per-service 백업 정책** — Percona Operator 의 `BackupSchedule` 위에 도메인 정책 (RTO/RPO 등급) 을 한 단계 더 올리는 메타 Operator.

다만 모두 **"이미 있는 Operator + custom YAML"** 로 우선 해결 가능 → 직접 작성은 신중하게.

다음: [04-crd-operator.md](04-crd-operator.md) — CRD 직접 정의 + kubebuilder 스캐폴딩 + Conversion Webhook.
