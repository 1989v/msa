---
parent: 11-k8s-deep-dive
seq: 18
title: Operator 패턴 + CRD 심화 — Reconcile / Finalizer / 인기 Operator (Strimzi / ECK / Percona)
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 03-controller-pattern.md
  - 04-crd-operator.md
  - 14-k8s-security.md
  - 15-msa-k8s-grep.md
  - 16-improvements.md
sources:
  - https://kubernetes.io/docs/concepts/extend-kubernetes/operator/
  - https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/
  - https://operatorframework.io/operator-capabilities/
  - https://book.kubebuilder.io/
  - https://strimzi.io/docs/operators/latest/overview
  - https://www.elastic.co/guide/en/cloud-on-k8s/current/index.html
  - https://docs.percona.com/percona-operator-for-mysql/
catalog-row: "§F (Operator) — controller pattern / status / finalizer / OperatorHub / 인기 Operator (Strimzi / ECK / CloudNativePG / Redis / Percona)"
---

# 18. Operator 패턴 + CRD 심화 — Reconcile / Finalizer / 인기 Operator

> 카탈로그 매핑: §99 §F — `Controller pattern (reconcile loop)` (✅), `Workqueue + RateLimiter` (★ → ✅), `Status sub-resource` (★ → ✅), `Finalizers` (🟡 → ✅), `OperatorHub.io 인기 Operator` (🟡 → ✅).
> 학습 시간 예상: ~3h · 자가평가 입구 레벨: B
>
> "Operator 패턴 = Controller + CRD (Custom Resource Definition, 커스텀 리소스 정의) 의 결합 = 사람이 손으로 하던 운영 절차를 K8s (Kubernetes, 쿠버네티스) 컨트롤러로 코드화한 것." 본 deep file 은 §03 controller pattern 과 §04 CRD/kubebuilder 를 베이스로 하되, **운영 관점의 Operator** — reconcile loop 의 4가지 함정 (무한 루프 / status conflict / leader election 부재 / observed generation 누락), finalizer 의 cleanup hook 디자인, msa 가 실제 사용 중인 Strimzi / ECK / Percona / OpenSearch / Altinity / SealedSecrets 6종 Operator 의 책임 분리, 자체 Operator 작성을 결정하는 비용 모델을 다룬다.

---

## 1. 한 줄 핵심

> **Operator = "사람의 운영 지식을 K8s controller 로 코드화한 것."**
>
> 핵심 분리: **CRD = 도메인 객체의 schema** (etcd 의 KV 저장소에 새 종류의 리소스 등록), **Controller = reconcile loop** (CR 의 desired state 를 actual state 와 비교 + 일치시키는 작업 단위), **Operator = CRD + Controller 패키지 + 도메인 지식**. 표준 K8s 가 다루지 못하는 stateful 자원 (Kafka / DB / 검색 클러스터) 의 백업·rolling upgrade·failover 를 자동화하는 것이 일차 목적. msa 는 직접 Operator 를 작성하지 않고 ADR-0019 Phase 4 에서 Strimzi / ECK / Percona / OpenSearch / Altinity / SealedSecrets 6종 외부 Operator 를 도입.

---

## 2. 등장 배경 — 왜 Operator 가 필요한가

### 2-1. K8s built-in controller 만으로 부족한 이유

K8s 가 기본 제공하는 controller (Deployment / StatefulSet / Job / CronJob ...) 는 **stateless / 약한 stateful** 워크로드만 안전하게 다룬다. 그러나 프로덕션의 backing service 는 다음과 같은 **운영 지식** 을 요구한다:

| 운영 절차 | StatefulSet 만으로? | 필요 Operator |
|---|---|---|
| Kafka broker rolling upgrade — controller 먼저, broker 는 ISR (In-Sync Replicas) 보장하며 1 by 1 | ❌ 순서 모름 | Strimzi |
| MySQL group replication failover — primary 죽으면 replica promote + binlog 위치 동기 | ❌ 단순 재시작 | Percona / CloudNativePG |
| Elasticsearch zone-aware shard allocation + rolling restart | ❌ shard 인지 없음 | ECK |
| ClickHouse shard / replica 추가 시 zookeeper 메타데이터 갱신 | ❌ | Altinity |
| Sealed Secret 의 클러스터 키 회전 → 모든 SealedSecret 재암호화 | ❌ | SealedSecrets controller |

→ "**도메인 지식 = controller 코드**" 가 본질. K8s 는 이걸 표현하는 확장 메커니즘 (CRD + controller-runtime) 만 제공한다.

### 2-2. 실패 시나리오 — Operator 없는 Kafka 운영

```
[사람이 직접 운영]
  Kafka 3 broker → broker-2 OS 패치 필요 → kubectl drain node-2
  → broker-2 evict → 이때 broker-2 가 갖고 있던 partition 의 leader 가 0/1 로 이전
  → 동시에 broker-1 이 (관계없이) GC pause → ISR 축소 → min.insync.replicas 미달
  → producer 가 NotEnoughReplicasException → 메시지 발행 중단
```

문제의 본질:
1. **순서 무지** — `kubectl drain` 이 partition leadership 을 모름.
2. **상태 무지** — broker 의 ISR / log offset / under-replicated partitions 를 K8s 가 모름.
3. **복구 무지** — drain 실패 시 어떻게 회복할지 사람이 결정.

**Operator 도입 후**:
- Strimzi 가 `KafkaNodePool` CR 의 spec 변경 (예: image version 업그레이드) 을 감지.
- 각 broker 에 대해 (a) ISR 안정 확인 → (b) controlled shutdown → (c) Pod 재시작 → (d) ISR 재확인 → (e) 다음 broker 진행.
- broker 가 미달이면 **rolling 자체를 멈춤** (사람의 휴리스틱이 코드화).

### 2-3. Operator 의 4단계 성숙도 (Operator Capability Levels)

OperatorHub 는 Operator 의 성숙도를 5단계로 정의한다 (Operator Framework):

| Level | 의미 | 예시 |
|---|---|---|
| **L1** Basic Install | CR 1개 → 단순 install | 초보 Operator |
| **L2** Seamless Upgrades | minor / patch 자동 업그레이드 | 대부분 OSS Operator |
| **L3** Full Lifecycle | 백업 / 복원 / 장애 재해 복구 | Strimzi / Percona / ECK |
| **L4** Deep Insights | metrics / alerts / horizontal scaling 자동 | ECK 8.x, Strimzi (Cruise Control) |
| **L5** Auto Pilot | abnormal detection / auto-tuning / capacity 예측 | (일부 vendor 만) |

→ msa 가 채택한 6종은 L3~L4 수준. Auto Pilot (L5) 는 아직 산업 표준 아님.

---

## 3. 동작 원리 — Reconcile Loop 5단계

### 3-1. controller-runtime 의 표준 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│  Manager (한 프로세스)                                          │
│   ├── Cache (informer)  ← K8s API server watch                  │
│   ├── Workqueue (rate-limited)                                  │
│   └── Reconciler                                                │
│        ▼                                                        │
│   1. Workqueue 에서 namespace/name 1건 dequeue                  │
│   2. Cache 에서 CR + 의존 자원 (CronJob / Pod / PVC) 조회       │
│   3. desired state 계산 (CR.spec → 자원 정의)                   │
│   4. actual state 와 diff → CRUD 호출 (Create/Update/Patch)     │
│   5. status subresource update (관찰값)                         │
│   6. err 반환 시 RateLimiter 가 backoff requeue                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3-2. 6 키워드 — Operator 작성 시 반드시 알아야 할 것

| 개념 | 정의 | 필수 이유 |
|---|---|---|
| **Informer** | K8s API server 의 watch 결과를 in-memory cache 로 유지 | API server 부하 감소 + delta 이벤트 정확 |
| **Workqueue** | 처리할 reconcile 요청 큐 (namespace/name) | duplicate suppression + rate limit |
| **RateLimiter** | err 시 backoff 재큐 (exponential) | hot loop 방지 |
| **Predicate** | 어떤 이벤트만 enqueue 할지 필터 | 무관한 이벤트 무시 (status-only update 등) |
| **OwnerReference** | 부모 → 자식 관계 (CR → CronJob) | GC (Garbage Collection) 자동 |
| **Status Subresource** | spec 과 분리된 status 갱신 경로 | spec 무한 reconcile 방지 |

### 3-3. desired vs actual — level-triggered

> **edge-triggered (이벤트 한 번)** 이 아니라 **level-triggered (현재 상태 비교)**.

```
[edge-triggered, 잘못된 모델]
  CR 생성 이벤트 → CronJob 생성
  CR 수정 이벤트 → CronJob 수정
  CR 삭제 이벤트 → CronJob 삭제

  문제: 이벤트 1건 누락 시 영구 drift.

[level-triggered, K8s 의 모델]
  Reconcile(CR) {
    desired = computeDesired(CR.spec)
    actual  = getActual(CR.namespace, CR.name)
    if desired != actual: apply(desired)  ← 매번 비교
  }

  → 이벤트 누락이 있어도 다음 reconcile 에서 회복.
  → "현재 상태" 만 보고 결정 = 더 단순 + 강건.
```

**핵심 mental model**: Reconcile 함수는 **idempotent** 해야 하고, 같은 입력으로 여러 번 호출돼도 결과가 같아야 한다.

### 3-4. Requeue 의 3가지 모드

```go
// 1. 즉시 재시도 (err 반환)
return ctrl.Result{}, fmt.Errorf("transient: %w", err)
   → RateLimiter 가 backoff 으로 재큐 (5ms → 10ms → 20ms ... 최대 1000s)

// 2. 명시적 시간 후 재큐 (status refresh)
return ctrl.Result{RequeueAfter: 30 * time.Second}, nil
   → 30s 후 강제 reconcile (예: external API 폴링)

// 3. 종료 (성공)
return ctrl.Result{}, nil
   → 외부 이벤트 (CR 변경 / 자식 자원 변경) 가 올 때까지 잠잠
```

### 3-5. Predicate — 무관한 이벤트 거르기

```go
ctrl.NewControllerManagedBy(mgr).
    For(&platformv1alpha1.BackupPolicy{}).
    WithEventFilter(predicate.Funcs{
        UpdateFunc: func(e event.UpdateEvent) bool {
            // status 만 바뀐 이벤트는 무시 (무한 루프 방지)
            return e.ObjectOld.GetGeneration() != e.ObjectNew.GetGeneration()
        },
    }).
    Complete(r)
```

→ generation 은 spec 변경 시에만 증가. status update 시엔 그대로 → predicate 가 무시.

### 3-6. Status Subresource — 무한 루프 방지의 핵심

```yaml
spec:
  versions:
    - name: v1alpha1
      subresources:
        status: {}                      # 별도 endpoint
```

**효과**:
- `kubectl apply -f cr.yaml` 가 spec 만 갱신, status 는 무시 (사용자 실수 방지).
- 컨트롤러가 `Status().Update()` 로만 status 변경 → spec generation 변하지 않음 → predicate 가 update 이벤트 무시 → 무한 루프 차단.

```go
// 잘못된 코드 — 무한 루프 발생
bpol.Spec.SomeField = "computed"
bpol.Status.Phase = "Active"
r.Update(ctx, &bpol)   // spec + status 같이 → 다음 reconcile 트리거 → 무한 루프

// 올바른 코드
bpol.Status.Phase = "Active"
r.Status().Update(ctx, &bpol)   // status 전용 endpoint
```

---

## 4. CRD 심화 — 스키마 / validation / printer columns

### 4-1. OpenAPI v3 schema 의 표현력

```yaml
spec:
  versions:
    - name: v1alpha1
      schema:
        openAPIV3Schema:
          type: object
          required: [spec]
          properties:
            spec:
              type: object
              required: [target, schedule]
              properties:
                target:
                  type: string
                  enum: [product, order, member, gifticon]   # 도메인 enum
                schedule:
                  type: string
                  pattern: '^[0-9*/, -]+( [0-9*/, -]+){4}$'  # cron 형식 정규식
                retentionDays:
                  type: integer
                  minimum: 1
                  maximum: 365
                  default: 14
                rpoMinutes:
                  type: integer
                  default: 60
              x-kubernetes-validations:
                - rule: "self.retentionDays * 1440 >= self.rpoMinutes"
                  message: "retentionDays must cover at least one RPO window"
```

**4가지 검증 레벨**:
1. **type / required / enum / pattern / minimum** — OpenAPI v3 표준
2. **default** — 누락 필드의 기본값 (서버 측 주입)
3. **x-kubernetes-validations (CEL)** — 1.25+, 필드 간 관계 검증 (예: retentionDays × 1440 ≥ rpoMinutes)
4. **Validating Admission Webhook** — 외부 시스템 조회 필요 시 (예: target 이 실제 등록된 서비스인지)

→ 가능한 한 **하위 레벨** 에서 검증 끝내기. webhook 은 마지막 수단.

### 4-2. Printer Columns — kubectl get 출력 디자인

```yaml
additionalPrinterColumns:
  - name: Target
    type: string
    jsonPath: .spec.target
  - name: Schedule
    type: string
    jsonPath: .spec.schedule
  - name: Phase
    type: string
    jsonPath: .status.phase
  - name: Last
    type: date
    jsonPath: .status.lastBackupTime
  - name: Age
    type: date
    jsonPath: .metadata.creationTimestamp
```

```bash
$ kubectl get bpol
NAME            TARGET    SCHEDULE      PHASE    LAST                  AGE
product-daily   product   0 3 * * *     Active   2026-05-05T03:00:00Z  3d
order-hourly    order     0 * * * *     Active   2026-05-05T08:00:00Z  3d
```

→ 사람이 `kubectl get` 만으로 운영 상태 한눈에. ECK / Strimzi / Percona 의 CR 들도 모두 이 패턴.

### 4-3. 멀티 버전 — storage version 1개 + conversion webhook

```yaml
spec:
  versions:
    - name: v1alpha1
      served: true
      storage: false   # 더 이상 etcd 저장본 아님
    - name: v1
      served: true
      storage: true    # etcd 저장본
  conversion:
    strategy: Webhook  # v1alpha1 ↔ v1 변환 webhook
    webhook:
      conversionReviewVersions: ["v1"]
      clientConfig: { service: { ... }, caBundle: ... }
```

**원칙**:
- `served: true` 가 여러 개여도 **`storage: true` 는 단 하나**.
- 사용자가 v1alpha1 으로 GET → conversion webhook 이 v1 (etcd 저장본) → v1alpha1 변환.
- conversion webhook 없이 멀티 버전 도입하면 마이그레이션 영구 막힘.

cert-manager / Istio 가 사용 중인 패턴. msa 의 (가상) `BackupPolicy` 가 v1alpha1 → v1 으로 진화한다면 동일.

### 4-4. CRD 의 Scope — Namespaced vs Cluster

| Scope | 용도 | 예시 |
|---|---|---|
| `Namespaced` | 테넌트별 분리 + RBAC 정밀 제어 | `BackupPolicy`, `KafkaTopic`, `Elasticsearch` |
| `Cluster` | 클러스터 전역 정책 | `ClusterIssuer` (cert-manager), `ClusterPolicy` (Kyverno), `StorageClass` |

**기본**: Namespaced. Cluster scope 는 보안 영향 큼 — RBAC 으로 cluster-admin 만 만들 수 있게.

---

## 5. Finalizer — 삭제 전 cleanup hook

### 5-1. 왜 finalizer 가 필요한가

CR 삭제 시 K8s 는 ownerReference 로 묶인 자식 자원 (CronJob / Pod 등) 을 자동 GC 한다. 그러나 **클러스터 외부 자원** 은 K8s 가 모름:

```
BackupPolicy CR 삭제
   ↓
CronJob 자동 삭제 (ownerReference)
   ↓
이미 만들어진 S3 버킷의 백업 파일들은? — 그대로 남음 (orphan)
```

→ Operator 가 **"삭제 직전 cleanup"** 을 수행할 hook 이 필요. = Finalizer.

### 5-2. Finalizer 의 메커니즘

```
사용자: kubectl delete bpol product-daily
   ↓
K8s API server: deletionTimestamp = now() 설정
   (실제로 etcd 에서 제거 X — finalizers 가 비어야 제거)
   ↓
Operator reconcile:
   if !DeletionTimestamp.IsZero() {
       if Contains(Finalizers, "platform.commerce.kgd/cleanup") {
           cleanupExternalResources(...)   // S3 파일 / KMS key / Kafka topic
           RemoveFinalizer(bpol, "platform.commerce.kgd/cleanup")
           Update(bpol)                    // finalizers 제거
       }
   }
   ↓
finalizers 비면 K8s 가 etcd 에서 제거
```

### 5-3. Finalizer 작성 패턴 (Go)

```go
const finalizerName = "platform.commerce.kgd/backup-cleanup"

func (r *BackupPolicyReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    var bpol platformv1alpha1.BackupPolicy
    if err := r.Get(ctx, req.NamespacedName, &bpol); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }

    // 1. 삭제 진행 중인가
    if !bpol.DeletionTimestamp.IsZero() {
        if controllerutil.ContainsFinalizer(&bpol, finalizerName) {
            if err := r.cleanupS3(ctx, &bpol); err != nil {
                return ctrl.Result{}, err            // 실패 시 retry — finalizer 유지
            }
            controllerutil.RemoveFinalizer(&bpol, finalizerName)
            return ctrl.Result{}, r.Update(ctx, &bpol)
        }
        return ctrl.Result{}, nil
    }

    // 2. 정상 reconcile — finalizer 등록 보장
    if !controllerutil.ContainsFinalizer(&bpol, finalizerName) {
        controllerutil.AddFinalizer(&bpol, finalizerName)
        if err := r.Update(ctx, &bpol); err != nil {
            return ctrl.Result{}, err
        }
    }

    // 3. desired state 계산 + apply
    ...
}
```

### 5-4. Finalizer 의 함정 — "stuck terminating"

```
$ kubectl get bpol
NAME            PHASE        AGE
product-daily   Terminating  10m
```

`Terminating` 이 영원히 안 끝나는 경우:
1. **Operator pod 가 죽었다** → finalizer 제거할 controller 가 없음 → 영구 stuck.
2. **cleanup 함수가 항상 err** → 무한 retry.
3. **finalizer 이름 typo** → controller 가 자기 finalizer 라고 인식 못함.

**응급 처치**:
```bash
# 위험 — 외부 자원 cleanup 안 됨, 마지막 수단
kubectl patch bpol product-daily -p '{"metadata":{"finalizers":[]}}' --type=merge
```

→ 운영 룰: "Operator 가 정상 동작 중인지 먼저 확인. patch 로 finalizer 제거는 외부 자원 누수를 의미한다."

### 5-5. 다중 finalizer

```yaml
metadata:
  finalizers:
    - platform.commerce.kgd/backup-cleanup
    - platform.commerce.kgd/notify-slack
```

여러 controller 가 각자 finalizer 를 등록 → 각각 자기 cleanup 끝내고 자기 것만 제거. **모두 비어야** etcd 제거.

---

## 6. controller-runtime / Kubebuilder / Operator SDK — 프레임워크 선택

### 6-1. 3 옵션 비교

| 항목 | controller-runtime (raw) | Kubebuilder | Operator SDK |
|---|---|---|---|
| 출신 | sig-apimachinery | sig-cluster-lifecycle | Red Hat (OpenShift) |
| 베이스 | (자기 자신) | controller-runtime | controller-runtime |
| 스캐폴딩 | ❌ (수동) | ✅ `kubebuilder init / create api` | ✅ `operator-sdk init / create api` |
| Helm/Ansible 모드 | ❌ | ❌ (Go 만) | ✅ (3가지: Go / Helm / Ansible) |
| OLM (Operator Lifecycle Manager) 통합 | ❌ | ❌ | ✅ |
| 학습 곡선 | 가장 가파름 | 중간 | 중간 |
| 한국 대기업 도입 | 드뭄 | 가장 일반 | OpenShift 기반에서 일반 |

### 6-2. 언제 어떤 도구를?

```
"Go + 처음부터 통제 + 가벼운 의존성"      → Kubebuilder
"기존 Helm chart 를 Operator 로 wrap"   → Operator SDK (Helm 모드)
"OpenShift / OLM 생태계"                → Operator SDK (Go 모드)
"Java / Kotlin"                          → fabric8 java-operator-sdk
"raw 로 배움 목적"                       → controller-runtime + sample-controller
```

### 6-3. Java/Kotlin Operator — fabric8 java-operator-sdk

msa 가 이미 Kotlin/Spring 생태계라 매력적이지만:

```kotlin
@ControllerConfiguration
class BackupPolicyReconciler(
    private val cronJobBuilder: CronJobBuilder,
) : Reconciler<BackupPolicy> {
    override fun reconcile(
        resource: BackupPolicy,
        context: Context<BackupPolicy>,
    ): UpdateControl<BackupPolicy> {
        val cronJob = cronJobBuilder.build(resource)
        context.client.batch().v1().cronjobs()
            .inNamespace(resource.metadata.namespace)
            .resource(cronJob)
            .serverSideApply()

        resource.status = BackupPolicyStatus(phase = "Active", observedGeneration = resource.metadata.generation)
        return UpdateControl.patchStatus(resource)
    }
}
```

**현실 평가**:
- (+) msa 의 Kotlin 코드 / 빌드 도구 / 모니터링과 자연스럽게 통합.
- (-) Go 대비 메모리 풋프린트 ~3-5x (JVM (Java Virtual Machine, 자바 가상 머신) 자체).
- (-) 커뮤니티 자료 / 예제 / OperatorHub 패키징 부족.
- (-) **K8s Operator 는 Go 가 산업 표준** — 채용 / 외부 협업 시 이질감.

→ **결론**: 자체 Operator 작성 결정이 나면 Kubebuilder (Go) 가 안전. fabric8 은 PoC 또는 매우 단순한 in-house Operator 한정.

---

## 7. 인기 Operator 카탈로그 — msa 가 사용 중인 6종

### 7-1. Strimzi (Kafka)

**책임**: Kafka cluster 의 lifecycle (install / upgrade / scale / topic / user) 자동화.

**msa 적용** (`k8s/infra/prod/strimzi/kafka-cluster.yaml`):

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaNodePool
metadata: { name: controller, namespace: commerce }
spec:
  replicas: 3
  roles: [controller]
  storage: { type: persistent-claim, size: 10Gi }
---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaNodePool
metadata: { name: broker, namespace: commerce }
spec:
  replicas: 3
  roles: [broker]
  storage: { type: persistent-claim, size: 20Gi }
---
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: commerce
  annotations:
    strimzi.io/node-pools: enabled
    strimzi.io/kraft: enabled
spec:
  kafka:
    version: 3.8.0
    metadataVersion: "3.8"
    config:
      default.replication.factor: 3
      min.insync.replicas: 2
  entityOperator:
    topicOperator: {}    # KafkaTopic CR 도 관리
    userOperator: {}     # KafkaUser CR 도 관리
```

**Operator 가 자동화하는 운영 절차**:
1. **KRaft 모드 (zookeeper-less)** — Strimzi 가 controller / broker 분리 + KRaft 메타데이터 관리.
2. **Rolling upgrade** — image 변경 시 broker 1개씩 controlled shutdown → 재시작 → ISR 재확인.
3. **KafkaTopic CR 동기화** — `KafkaTopic` 매니페스트 적용 → Topic Operator 가 broker API 호출 (사람이 `kafka-topics.sh` 안 써도 됨).
4. **KafkaUser CR + ACL** — 자격증명 + ACL 자동 생성.

**msa 가 얻는 것**:
- `kafka-topics.sh` 수동 호출 제거 (16개 토픽 모두 CR).
- broker 추가 / 제거 시 partition reassignment 자동 (Cruise Control 통합).
- KEK (Key Encryption Key) 회전 대비 Kafka 자체 인증 자동 갱신.

### 7-2. ECK — Elastic Cloud on Kubernetes (Elasticsearch)

**책임**: Elasticsearch / Kibana / APM Server / Beats 의 lifecycle.

**msa 적용** (`k8s/infra/prod/eck/elasticsearch.yaml`):

```yaml
apiVersion: elasticsearch.k8s.elastic.co/v1
kind: Elasticsearch
metadata: { name: commerce-es, namespace: commerce }
spec:
  version: 8.15.3
  nodeSets:
    - name: master
      count: 3
      config: { node.roles: [master] }
    - name: data
      count: 2
      config: { node.roles: [data, ingest] }
```

**Operator 가 자동화**:
1. **Master quorum 보호** — master count 변경 시 voting config exclusion → 재시작 → 재포함.
2. **Shard-aware rolling upgrade** — `_cluster/health` GREEN 확인 → 한 노드씩 재시작 → re-allocation 안정 후 다음.
3. **Auto TLS** — 자가 서명 cert 생성 + ECK 클러스터 간 자동 갱신.
4. **License 관리** — Enterprise / Platinum license CR 으로 적용.

**msa 가 얻는 것**:
- search 서비스 / search-batch 가 사용하는 `elasticsearch:9200` 호스트 이름이 ECK 알고리즘으로 항상 health 한 data 노드만 가리킴.
- ES 8.x → 8.y minor 업그레이드 시 manifests 의 `version` 한 줄 변경 → ECK 가 알아서.

### 7-3. Percona Operator for MySQL

**책임**: MySQL group replication / XtraBackup / orchestrator 통합.

**msa 적용** (`k8s/infra/prod/percona-mysql/mysql-clusters.yaml`):

```yaml
apiVersion: ps.percona.com/v1alpha1
kind: PerconaServerMySQL
metadata: { name: commerce-mysql, namespace: commerce }
spec:
  crVersion: 0.11.0
  mysql:
    clusterType: group-replication
    size: 3
  proxy:
    router: { enabled: true, size: 2 }   # MySQL Router (read/write split)
  backup:
    enabled: true
    image: percona/percona-xtrabackup:8.0
```

**Operator 가 자동화**:
1. **Group replication bootstrap** — primary 자동 선출 + secondary 등록.
2. **Failover** — primary 죽으면 secondary 중 1명 자동 승격 (binlog GTID 기반).
3. **MySQL Router** — read 쿼리는 secondary, write 는 primary 로 분배 (port 6447 vs 6446).
4. **XtraBackup CronJob** — `BackupSchedule` CR 으로 일정 + 보관 정책 (msa 는 현재 별도 CronJob, 향후 마이그 예정).

**msa 가 얻는 것**:
- 서비스별 MySQL 인스턴스 (product / order / member / gifticon ...) 를 1개 cluster + alias Service 로 분리 (router 가 routing).
- ADR-0008 (백업/복구) 의 XtraBackup + binlog PITR (Point-In-Time Recovery, 시점 복구) 자동화.

### 7-4. OpenSearch Operator (opster)

**책임**: OpenSearch cluster + Dashboards.

**msa 적용** (`k8s/infra/prod/opensearch/opensearch-cluster.yaml`):

```yaml
apiVersion: opensearch.opster.io/v1
kind: OpenSearchCluster
metadata: { name: commerce-opensearch, namespace: commerce }
spec:
  general:
    version: "2.19.1"
    httpPort: 9200
  security:
    config:
      adminCredentialsSecret: { name: commerce-opensearch-admin }
    tls:
      transport: { generate: true }
      http:      { generate: true }
  nodePools:
    - component: master-data
      replicas: 1
      diskSize: "5Gi"
      roles: [cluster_manager, data, ingest]
```

**msa 가 얻는 것**: code-dictionary 서비스 (IT 개념 사전 검색) 의 OpenSearch backing — ECK 와 같은 패턴.

### 7-5. Altinity ClickHouse Operator

**책임**: ClickHouse shard / replica / zookeeper 통합.

**msa 적용** (`k8s/infra/prod/clickhouse/clickhouse-installation.yaml`): analytics / experiment / quant 가 의존하는 ClickHouse 단일 노드 (현재 PoC 단계, 향후 shard 도입 시 Operator 가 zookeeper 메타데이터 자동 관리).

### 7-6. Bitnami SealedSecrets

**책임**: SealedSecret CR → 실제 Secret 객체 복호화.

**msa 적용** (`k8s/infra/prod/sealed-secrets/`): controller 가 클러스터에 RSA 키쌍 보관 → 사용자가 `kubeseal` 로 git-safe 암호문 생성 → controller 가 cluster 안에서 복호화.

**Operator 가 자동화**:
- 클러스터 전용 키쌍 자동 생성 / 회전.
- 키 회전 시 모든 SealedSecret 재암호화 (블랙박스 — 사용자 개입 X).

### 7-7. msa 6종 Operator 의 책임 분리 표

| Operator | CR | 책임 | msa 의존 서비스 |
|---|---|---|---|
| Strimzi | `Kafka`, `KafkaNodePool`, `KafkaTopic`, `KafkaUser` | Kafka cluster + topic + ACL | 모든 서비스 (이벤트 발행/구독) |
| ECK | `Elasticsearch` | ES cluster + rolling upgrade | search, search-batch, search-consumer |
| OpenSearch | `OpenSearchCluster` | OS cluster | code-dictionary |
| Percona | `PerconaServerMySQL` | MySQL group replication + router | product, order, member, gifticon, ... (대부분) |
| Altinity | `ClickHouseInstallation` | ClickHouse shard/replica | analytics, experiment, quant |
| SealedSecrets | `SealedSecret` | git-safe secret | 전체 (DB password / API key) |

추가로 **cert-manager** (TLS cert 자동 발급) 도 Operator 패턴이지만 backing service 가 아닌 횡단 관심사로 별도 관리.

---

## 8. 트레이드오프 / 운영 함정

### 8-1. Reconcile 무한 루프 (가장 흔한 함정)

```go
// 잘못된 코드
func (r *Reconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    cr := getCR(...)
    cr.Spec.LastReconciledAt = time.Now()   // ← spec 수정
    cr.Status.Phase = "Active"
    r.Update(ctx, cr)                        // ← spec + status 같이
    return ctrl.Result{}, nil
}
```

**원인**: spec generation 증가 → predicate 통과 → 다음 reconcile 또 트리거 → 무한.

**원칙**:
1. **Reconcile 안에서 spec 수정 ❌** — annotation/label 도 신중히.
2. **Status 만 `Status().Update()` 로** — 별도 endpoint.
3. **Predicate 로 status-only update 무시** — `ObjectOld.GetGeneration() != ObjectNew.GetGeneration()`.

### 8-2. Status update conflict

```go
r.Status().Update(ctx, &cr)  // → "Operation cannot be fulfilled... resource version conflict"
```

**원인**: cache 의 cr 이 stale → API server 의 최신 resourceVersion 과 불일치.

**해결**:
1. **Get → modify → Update** 패턴: reconcile 시작 시 fresh GET.
2. **Conflict 시 retry** — controller-runtime 의 default behavior 가 RateLimiter 로 backoff 재큐 → 다음 cycle 에서 fresh GET 후 재시도. err 반환 = OK.
3. **Optimistic concurrency** — 같은 resource 를 여러 controller 가 다투면 특히 빈번 → leader election 또는 controller 분리.

### 8-3. Leader election 부재

```go
// 잘못된 설정
mgr, _ := ctrl.NewManager(cfg, ctrl.Options{
    LeaderElection: false,    // ← 위험
})
```

**증상**: Operator pod replicas=2 일 때 두 instance 가 동시에 같은 CR 처리 → Update 충돌 + 자식 자원 중복 생성.

**올바른 설정**:
```go
mgr, _ := ctrl.NewManager(cfg, ctrl.Options{
    LeaderElection:          true,
    LeaderElectionID:        "backup-policy-operator-leader",
    LeaderElectionNamespace: "commerce-system",
})
```

→ Lease API (coordination.k8s.io) 로 leader 1명 결정. follower 는 standby.

### 8-4. observedGeneration 누락

```yaml
status:
  phase: Active
  # observedGeneration: 누락
```

**증상**: 사용자가 `kubectl wait --for=condition=Ready` 했을 때 "내 변경이 처리됐나?" 알 길이 없음.

**올바른 패턴**:
```go
cr.Status.ObservedGeneration = cr.Generation   // spec generation 기록
cr.Status.Conditions = append(cr.Status.Conditions, metav1.Condition{
    Type:               "Ready",
    Status:             metav1.ConditionTrue,
    ObservedGeneration: cr.Generation,
    LastTransitionTime: metav1.Now(),
    Reason:             "Reconciled",
})
```

→ 사용자가 `cr.metadata.generation == cr.status.observedGeneration` 으로 "최신 spec 이 처리됐다" 확신 가능.

### 8-5. 의존 자원 watch 누락

```go
// 잘못된 코드
ctrl.NewControllerManagedBy(mgr).
    For(&platformv1alpha1.BackupPolicy{}).
    Complete(r)   // ← CronJob 변경 watch 안 함
```

**증상**: 누군가 `kubectl edit cronjob` 으로 자식 CronJob 수정 → Operator 가 모름 → drift.

**올바른 패턴**:
```go
ctrl.NewControllerManagedBy(mgr).
    For(&platformv1alpha1.BackupPolicy{}).
    Owns(&batchv1.CronJob{}).      // ← 자식 CronJob 변경도 reconcile 트리거
    Complete(r)
```

### 8-6. CRD 삭제 시 모든 CR 삭제

```bash
kubectl delete crd backuppolicies.platform.commerce.kgd
   ↓
모든 BackupPolicy CR 삭제 → 모든 자식 CronJob 삭제 → 백업 중단
```

**예방**:
1. CRD 에 `metadata.finalizers: [kubernetes]` (자동 추가).
2. 운영 룰: CRD 삭제는 cluster-admin + 협의 후.
3. CRD 변경은 항상 **추가 (additive)** — 필드 제거는 conversion webhook + storage version migration 거침.

### 8-7. 자식 자원 GC — ownerReference 의 함정

```go
controllerutil.SetControllerReference(&bpol, desired, r.Scheme)
```

→ desired (CronJob) 의 `ownerReferences[0].controller=true` 설정 → bpol 삭제 시 GC.

**함정**: ownerReference 는 **같은 namespace** 만. cluster-scoped CR 이 namespaced 자식을 만들면 ownerReference 무시 → orphan. 이 경우 finalizer + 명시적 cleanup 필수.

### 8-8. RBAC 최소 권한

```yaml
# 잘못된 패턴
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["*"]
```

**올바른 패턴** — 정확히 필요한 것만:
```yaml
rules:
  - apiGroups: ["platform.commerce.kgd"]
    resources: ["backuppolicies", "backuppolicies/status", "backuppolicies/finalizers"]
    verbs: ["get", "list", "watch", "update", "patch"]
  - apiGroups: ["batch"]
    resources: ["cronjobs"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
```

→ kubebuilder 의 `+kubebuilder:rbac` 마커가 자동 생성.

---

## 9. msa 적용 — 자체 Operator 작성을 결정하는 비용 모델

### 9-1. 현재 (외부 Operator 6종 도입 완료, 자체 Operator 0)

ADR-0019 Phase 4 에서 외부 Operator 만 도입. 자체 Operator 는 PoC 후보로만 존재 (ADR-0012, ADR-0027 후속).

### 9-2. 자체 Operator 후보 3선

| 후보 | 도메인 가치 | 외부 대안 | 작성 비용 |
|---|---|---|---|
| **`BackupPolicy`** — 서비스별 RTO/RPO 정책 일관 적용 | 높음 (백업 누락 = 비즈니스 리스크) | Percona BackupSchedule + per-service CronJob 조합 | 1인 1-2주 (Go + kubebuilder + CI) |
| **`KekRotation`** — quant 의 KEK 회전 자동화 (OCI Vault API + Secret 갱신 + 회전 주기 enforce) | 중간 (휴먼 에러 방지) | External Secrets Operator + 수동 회전 | 1인 2-3주 (OCI SDK + 회전 검증) |
| **`IdempotencyPolicy`** — Kafka consumer dedup TTL/DLQ 정책 표준화 (ADR-0012 의 정적 컨벤션을 동적으로 강제) | 낮음 (정책 drift 미연 방지) | annotation + admission webhook | 1인 1주 |

### 9-3. 비용 모델 — "직접 작성 vs 외부 도입" 결정 트리

```
1. 외부 Operator (Strimzi / ECK / Percona / 커뮤니티) 가 80% 충족하는가?
   ├─ Yes → 도입 + (필요 시) thin wrapper 만 자체 작성
   └─ No → 다음

2. 자체 도메인 지식이 명확하고 코드 50줄 미만으로 표현 가능한가?
   ├─ Yes → admission webhook (CEL or Validating) 으로 충분
   └─ No → 다음

3. reconcile loop / 자식 자원 lifecycle / 외부 시스템 연동이 필요한가?
   ├─ Yes → 자체 Operator (Kubebuilder + Go)
   └─ No → 운영 스크립트 (CronJob + Job) 충분
```

### 9-4. 자체 Operator 의 운영 비용 (현실)

| 항목 | 비용 |
|---|---|
| 초기 개발 (kubebuilder scaffold + reconcile + e2e test) | 1인 2-4주 |
| CI/CD (image build + chart + bundle) | 1인 1주 |
| 모니터링 (controller metrics: reconcile latency / err rate / workqueue depth) | 1인 1주 |
| 릴리스 / 마이그레이션 (CRD storage version migration) | 분기 1회, 1인 1일 |
| **연간 유지보수** | 1인 2-3주 / 년 (k8s minor upgrade 대응 포함) |

→ "운영 가치 ≥ 연간 유지보수" 가 명확할 때만 자체 작성. msa 의 3 후보 중 BackupPolicy 만 가치가 명확하고, 나머지는 외부 솔루션 + thin script 로 충분.

### 9-5. 도입 단계 (가상 BackupPolicy Phase plan)

```
Phase 1: PoC — kubebuilder scaffold + 단일 CR → 단일 CronJob 매핑 (1주)
Phase 2: external 자원 cleanup (S3 / OCI Object Storage) + finalizer (1주)
Phase 3: status conditions + observedGeneration + Prometheus metrics (1주)
Phase 4: e2e test (envtest + 실제 cluster) + CI 통합 (1주)
Phase 5: SealedSecret 으로 OCI 자격증명 관리 + 운영 도큐먼트 (1주)
Phase 6: 운영 1개월 관찰 — reconcile latency / err rate 측정 + 튜닝
```

→ **6 주** = 1인 풀타임 6주 + 운영 안정화 1개월. 이 비용을 정당화할 ROI (Return On Investment, 투자 대비 수익) 가 있는지가 결정 기준.

---

## 10. ADR 후보 (Operator 정책)

> **ADR-XXXX-A: 자체 Operator 작성 정책 — "외부 Operator 우선, 자체 Operator 는 ROI 검증 후"**
>
> **Context**: ADR-0019 Phase 4 에서 Strimzi / ECK / Percona / OpenSearch / Altinity / SealedSecrets 6종 외부 Operator 도입 완료. 운영 중 "msa 도메인에 특화된 운영 절차 (백업 정책 / KEK 회전 / Kafka dedup 정책) 를 코드화" 하고 싶은 욕구 발생. 자체 Operator 작성은 매력적이지만 연간 유지보수 비용이 ↑ (k8s minor upgrade 대응 등).
>
> **Decision**:
> 1. **외부 Operator 우선** — Strimzi / Percona / ECK 등이 80% 충족하면 채택 + thin wrapper.
> 2. **자체 Operator 작성 기준 4 충족 시에만**:
>    - 외부 Operator 가 도메인 절차를 표현 못함.
>    - reconcile loop (단순 CronJob 으로 부족) 가 필요.
>    - 운영 가치 ≥ 연간 1인 2-3주 유지보수 비용.
>    - PoC (4주) 로 검증 완료.
> 3. **작성 시 표준 스택**: Kubebuilder (Go) + controller-runtime + envtest. fabric8 Java SDK 는 PoC 한정.
> 4. **필수 품목**: Status subresource, observedGeneration, Conditions, Finalizer, LeaderElection, Prometheus metrics, RBAC 최소 권한.
>
> **Consequences**:
> - (+) 외부 Operator 의 안정성 / 커뮤니티 / 보안 패치 활용.
> - (+) 자체 Operator 작성을 함부로 시작하지 않음 → 연간 유지보수 비용 통제.
> - (-) 도메인 특화 자동화의 부재 (예: BackupPolicy) — 운영 스크립트로 대체.
>
> **Alternatives 검토**:
> - 모든 운영 절차를 자체 Operator 로 — 유지보수 폭증. 채택 ❌.
> - admission webhook 만으로 — reconcile loop 표현 불가. 일부 정책엔 채택.

---

## 11. 면접 한 줄 답변

### Q. CRD 와 Operator 의 차이는?

> "CRD 는 도메인 객체의 schema 만 정의해서 K8s API 에 새 종류의 리소스를 등록합니다. CRD 단독으론 etcd 의 KV 저장소일 뿐입니다. Operator = CRD + Controller 패키지 + 도메인 지식 — Controller 의 reconcile loop 가 CR 을 watch 해서 desired state 를 actual state 와 비교 + 일치시키는 코드를 실행합니다. 결국 'CRD 는 데이터 모양, Operator 는 동작' 입니다."

### Q. Reconcile loop 가 level-triggered 인 이유는?

> "edge-triggered (이벤트 한 번) 로 했다가 이벤트 1건 누락하면 영구 drift 입니다. level-triggered 는 매 reconcile 마다 desired 와 actual 을 비교 + diff apply 라서 누락이 있어도 다음 cycle 에서 회복합니다. 결과적으로 reconcile 함수가 idempotent 해야 하고, 같은 입력이면 결과가 같아야 합니다. 이는 K8s 컨트롤러 디자인의 가장 핵심 원칙입니다."

### Q. Status subresource 가 왜 필요한가요?

> "subresource 가 없으면 spec + status 가 같은 객체로 합쳐져서 Update 시 spec generation 이 증가하고 무한 reconcile 루프가 발생할 수 있습니다. subresource 는 status 전용 endpoint 를 제공해서 컨트롤러가 `Status().Update()` 호출 시 spec 은 건드리지 않습니다. 추가로 사용자가 `kubectl apply` 로 status 를 실수로 덮어쓰는 것도 방지합니다."

### Q. Finalizer 의 동작 메커니즘은?

> "사용자가 CR 삭제 요청하면 K8s 가 deletionTimestamp 를 설정하지만 finalizers 가 비어있어야 etcd 에서 실제 제거됩니다. 컨트롤러는 deletionTimestamp 가 있으면 자기 finalizer 가 등록돼 있는지 확인 → 외부 자원 cleanup 수행 → 자기 finalizer 제거 → finalizers 가 비면 K8s 가 etcd 에서 제거. ownerReference 로 다룰 수 없는 클러스터 외부 자원 (S3 파일, KMS key 등) 의 정리에 필수입니다."

### Q. Kubebuilder 와 Operator SDK 의 차이는?

> "Kubebuilder 는 sig-cluster-lifecycle 가 만든 K8s 공식 스캐폴딩 도구로 Go 만 지원합니다. Operator SDK 는 Red Hat 발 도구로 Go / Helm / Ansible 3 모드를 지원하고 OLM (Operator Lifecycle Manager) 통합이 있습니다. 둘 다 controller-runtime 위에 있어 핵심은 비슷하고, OpenShift 생태계가 아니면 Kubebuilder 가 단순합니다."

### Q. Operator 의 reconcile 무한 루프를 어떻게 방지하나요?

> "3가지 원칙입니다. 첫째, Reconcile 함수 안에서 spec 을 수정하지 않습니다. 둘째, status 는 별도 subresource 로 `Status().Update()` 만 호출합니다. 셋째, Predicate 로 status-only update 이벤트 (즉 generation 변경 없는 update) 는 무시합니다. 추가로 leader election 을 켜서 두 인스턴스가 동시에 같은 CR 을 처리하지 않게 막습니다."

### Q. msa 가 사용하는 Operator 는?

> "ADR-0019 Phase 4 에서 6종을 외부 Operator 로 도입했습니다. Strimzi (Kafka cluster + topic + user), ECK (Elasticsearch), OpenSearch Operator (code-dictionary 용), Percona Operator for MySQL (group replication + router + XtraBackup), Altinity ClickHouse Operator (analytics/experiment/quant 용), Bitnami SealedSecrets (git-safe secret). cert-manager 도 Operator 패턴이지만 횡단 관심사로 별도. 자체 Operator 는 작성하지 않았고, BackupPolicy / KekRotation 이 PoC 후보입니다."

### Q. 자체 Operator 를 작성할지 결정 기준은?

> "4가지 충족 시에만 작성합니다. 첫째, 외부 Operator 가 도메인 절차를 표현 못 함. 둘째, reconcile loop 가 필요 (단순 CronJob/Job 으로 부족). 셋째, 운영 가치가 연간 1인 2-3주 유지보수 비용을 넘음. 넷째, PoC (4주) 로 검증 완료. msa 의 3 후보 (BackupPolicy / KekRotation / IdempotencyPolicy) 중 BackupPolicy 만 가치 명확이고, 나머지는 external secrets + admission webhook + 운영 스크립트로 충분합니다."

### Q. CRD 를 삭제하면 어떻게 되나요?

> "CRD 를 삭제하면 그 CRD 를 따르는 모든 CR 이 함께 삭제되고, ownerReference 로 묶인 자식 자원들도 GC 됩니다. 운영에서 CRD 삭제는 사실상 'restoration 불가능한 cascading delete' 라서 cluster-admin + 협의 후에만 합니다. CRD 변경은 항상 additive 가 원칙 — 필드 제거는 conversion webhook + storage version migration 을 거쳐야 안전합니다."

---

## 12. 흔한 오해 정정

> **"CRD 만 정의하면 Operator 가 동작한다"**

- ❌ CRD 는 schema 만. Controller (reconcile loop) 가 watch 하고 desired state 를 실현해야 의미가 생김. CRD 만 있으면 etcd 의 새 KV store.

> **"Operator 는 무조건 직접 작성해야 한다"**

- ❌ 외부 Operator (Strimzi / ECK / Percona / cert-manager) 를 도입하는 게 표준. 자체 Operator 는 마지막 수단.

> **"reconcile 은 이벤트 기반"**

- ❌ K8s 는 level-triggered. 이벤트는 enqueue 트리거일 뿐, 실제 로직은 'desired vs actual 비교'. idempotent 가 핵심.

> **"Operator 가 죽으면 클러스터가 멈춘다"**

- ❌ Operator 가 죽어도 이미 만들어진 자원 (StatefulSet / CronJob 등) 은 K8s built-in controller 가 계속 관리. drift 가 누적될 뿐. 다만 finalizer cleanup 이 멈춰서 CR 삭제는 stuck terminating 발생 가능.

> **"Status update 를 spec 과 같이 하면 빠르다"**

- ❌ spec generation 증가 → 무한 reconcile 루프. status 는 반드시 `Status().Update()` 별도 호출.

> **"Java/Kotlin 으로 Operator 작성해도 똑같다"**

- ⚠ 가능하지만 산업 표준은 Go. 메모리 풋프린트 / 커뮤니티 자료 / 채용 측면에서 Go 가 유리. fabric8 Java SDK 는 PoC 한정.

> **"OperatorHub 의 모든 Operator 가 production-ready"**

- ⚠ Operator Capability Level 1-2 짜리도 있음. L3 이상 (Full Lifecycle) 만 production 권장. 도입 전 README + capability level + 최근 커밋 확인 필수.

> **"Finalizer 만 제거하면 stuck terminating 풀린다"**

- ⚠ 풀리지만 외부 자원 누수. Operator pod 가 죽었는지 / cleanup 함수가 err 인지 먼저 확인. patch 는 마지막 수단.

> **"Operator 가 cluster-admin 권한 필요하다"**

- ❌ RBAC 최소 권한 원칙. 정확히 필요한 apiGroups + resources + verbs 만. cluster-admin 은 보안 사고 1순위.

---

## 13. 회독 체크리스트

> §18 회독 체크리스트:
> - [ ] Operator = CRD + Controller + 도메인 지식의 패키지 — 3 분리 명확히
> - [ ] Reconcile loop 5단계 (dequeue → fetch → desired/actual diff → apply → status update)
> - [ ] level-triggered vs edge-triggered 차이 + idempotent 의 의미
> - [ ] 6 키워드 (Informer / Workqueue / RateLimiter / Predicate / OwnerReference / Status Subresource)
> - [ ] Status subresource 가 무한 루프 방지하는 메커니즘 (spec generation 분리)
> - [ ] OpenAPI v3 schema 4 검증 레벨 (type/required/enum/pattern → default → CEL → webhook)
> - [ ] Finalizer 의 deletionTimestamp 흐름 (etcd 제거 직전 cleanup hook)
> - [ ] Finalizer stuck terminating 의 3가지 원인 (operator pod down / cleanup err / 이름 typo)
> - [ ] 멀티 버전 + storage version 1개 + conversion webhook
> - [ ] kubebuilder vs Operator SDK vs raw controller-runtime 의 선택 기준
> - [ ] msa 6종 외부 Operator (Strimzi / ECK / OpenSearch / Percona / Altinity / SealedSecrets) 의 책임 분리
> - [ ] 자체 Operator 작성 결정 트리 4단계 (외부 80% / 단순 webhook / reconcile loop / 운영 스크립트)
> - [ ] 8 운영 함정 (무한 루프 / status conflict / leader election 부재 / observedGeneration 누락 / 의존 자원 watch 누락 / CRD 삭제 cascade / ownerReference 한계 / RBAC 과다)

---

## 14. 연결 학습

- §03 controller pattern — reconcile loop 의 기본 (이 파일은 reconcile loop 의 운영 함정 + msa 6종 Operator 응용)
- §04 CRD/kubebuilder — CRD 작성 + kubebuilder 스캐폴딩 (이 파일은 CRD 의 멀티버전 + finalizer + 운영 정책)
- §14 K8s 보안 — RBAC 최소 권한 (이 파일은 Operator 의 RBAC 작성 패턴)
- §15 msa K8s grep — k8s/infra/prod/ 의 각 Operator 매니페스트 (이 파일은 그 매니페스트의 운영 의미)
- §19 (다음) GitOps + Argo CD — Operator 들도 GitOps 로 배포 (Argo CD ApplicationSet 으로 sync wave 분리: CRD → Operator → CR)
- §20 (다음) Argo Rollouts — Operator 자체의 rolling upgrade (Strimzi 가 Kafka 를 rolling upgrade 하는 패턴과 비교)
