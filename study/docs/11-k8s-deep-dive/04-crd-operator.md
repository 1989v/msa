---
parent: 11-k8s-deep-dive
seq: 04
title: CRD + Operator 직접 구현 (kubebuilder / Operator SDK)
type: deep
created: 2026-05-01
---

# 04. CRD + Operator 직접 구현

## 1. CRD 가 무엇인가

> CRD (CustomResourceDefinition) = "내 클러스터에 새 종류(kind) 의 리소스를 등록하는 명령".

등록 후에는 `kubectl get mykind` 가 동작하고, watch / RBAC / OpenAPI / kubectl describe 까지 모두 K8s 가 처리해준다. 컨트롤러 없이도 CRD 만으로는 "값을 저장하는 객체" 가 되며, 컨트롤러를 붙여야 의미가 생긴다.

핵심 분리:
- **CRD** = 스키마 정의
- **CR** (Custom Resource) = CRD 인스턴스 (실제 YAML)
- **Controller / Operator** = CR 을 watch 해서 desired state 실현

## 2. 가장 단순한 CRD 예시

msa 도메인에서 만들 법한 가상 예시 — `BackupPolicy` (서비스별 백업 RTO/RPO 정책):

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: backuppolicies.platform.commerce.kgd
spec:
  group: platform.commerce.kgd
  names:
    kind: BackupPolicy
    listKind: BackupPolicyList
    plural: backuppolicies
    singular: backuppolicy
    shortNames: [bpol]
  scope: Namespaced
  versions:
    - name: v1alpha1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          required: [spec]
          properties:
            spec:
              type: object
              required: [target, schedule, retentionDays]
              properties:
                target:
                  type: string
                  description: "Target service name (e.g. product, order)"
                schedule:
                  type: string
                  pattern: '^[0-9*/, -]+( [0-9*/, -]+){4}$'
                retentionDays:
                  type: integer
                  minimum: 1
                  maximum: 365
                rpoMinutes:
                  type: integer
                  default: 60
            status:
              type: object
              properties:
                phase:
                  type: string
                  enum: [Pending, Active, Failed]
                lastBackupTime:
                  type: string
                  format: date-time
                observedGeneration:
                  type: integer
                conditions:
                  type: array
                  items:
                    type: object
                    properties:
                      type: { type: string }
                      status: { type: string }
                      lastTransitionTime: { type: string, format: date-time }
                      reason: { type: string }
                      message: { type: string }
      subresources:
        status: {}
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
```

이걸 apply 하면 즉시 `kubectl get bpol` 이 동작한다.

CR 인스턴스:

```yaml
apiVersion: platform.commerce.kgd/v1alpha1
kind: BackupPolicy
metadata: { name: product-daily, namespace: commerce }
spec:
  target: product
  schedule: "0 3 * * *"
  retentionDays: 14
  rpoMinutes: 30
```

## 3. CRD 작성 시 챙길 7가지

1. **scope: Namespaced vs Cluster** — 보안 격리는 Namespaced 가 기본.
2. **OpenAPI v3 schema** — required, enum, pattern, default, x-kubernetes-validations(CEL) 까지 활용. 강력할수록 admission 단계 검증 무료.
3. **subresources.status: {}** — 필수. spec/status 분리.
4. **subresources.scale** — HPA 가 붙을 수 있게 됨.
5. **additionalPrinterColumns** — `kubectl get` 출력에 보일 컬럼.
6. **shortNames** — `kubectl get bpol`.
7. **versions[].deprecated / deprecationWarning** — 마이그레이션 시작 시 표시.

## 4. 멀티 버전 + Conversion Webhook

CRD 가 운영되다 보면 spec 이 바뀐다. 새 버전(v1) 을 추가하면서 v1alpha1 도 잠시 둬야 한다.

```yaml
spec:
  versions:
    - name: v1alpha1
      served: true
      storage: false       # 더 이상 etcd 저장본 아님
    - name: v1
      served: true
      storage: true        # etcd 는 v1 형태로 저장
  conversion:
    strategy: Webhook
    webhook:
      conversionReviewVersions: ["v1"]
      clientConfig:
        service:
          namespace: commerce-system
          name: backup-policy-webhook
          path: /convert
        caBundle: <base64>
```

conversion webhook 의 책임: v1alpha1 ↔ v1 양방향 변환.
- v1 에 새 필드가 있으면 v1alpha1 → v1 시 default 값
- v1 에서 사라진 필드는 annotation 으로 보존 (round-trip)

cert-manager, Istio 가 사용 중인 패턴.

## 5. 컨트롤러 = Reconciler 작성 (kubebuilder)

### 스캐폴딩

```bash
# kubebuilder
mkdir backup-policy-operator && cd $_
kubebuilder init --domain commerce.kgd --repo github.com/commerce/backup-policy-operator
kubebuilder create api --group platform --version v1alpha1 --kind BackupPolicy
```

→ `api/v1alpha1/backuppolicy_types.go`, `internal/controller/backuppolicy_controller.go` 가 생성됨.

### Reconciler 핵심

```go
//+kubebuilder:rbac:groups=platform.commerce.kgd,resources=backuppolicies,verbs=get;list;watch;create;update;patch;delete
//+kubebuilder:rbac:groups=platform.commerce.kgd,resources=backuppolicies/status,verbs=get;update;patch
//+kubebuilder:rbac:groups=platform.commerce.kgd,resources=backuppolicies/finalizers,verbs=update
//+kubebuilder:rbac:groups=batch,resources=cronjobs,verbs=get;list;watch;create;update;patch;delete

func (r *BackupPolicyReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    log := log.FromContext(ctx)
    
    var bpol platformv1alpha1.BackupPolicy
    if err := r.Get(ctx, req.NamespacedName, &bpol); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }
    
    // 1. 삭제 처리
    if !bpol.DeletionTimestamp.IsZero() {
        if controllerutil.ContainsFinalizer(&bpol, finalizerName) {
            // 자식 CronJob 은 ownerReference 로 자동 GC, 외부 자원만 처리
            if err := r.cleanupExternal(ctx, &bpol); err != nil {
                return ctrl.Result{}, err
            }
            controllerutil.RemoveFinalizer(&bpol, finalizerName)
            return ctrl.Result{}, r.Update(ctx, &bpol)
        }
        return ctrl.Result{}, nil
    }
    
    // 2. Finalizer 등록
    if !controllerutil.ContainsFinalizer(&bpol, finalizerName) {
        controllerutil.AddFinalizer(&bpol, finalizerName)
        return ctrl.Result{}, r.Update(ctx, &bpol)
    }
    
    // 3. desired CronJob 생성
    desired := r.buildCronJob(&bpol)
    if err := controllerutil.SetControllerReference(&bpol, desired, r.Scheme); err != nil {
        return ctrl.Result{}, err
    }
    
    // 4. 자식 CronJob upsert
    var cur batchv1.CronJob
    err := r.Get(ctx, client.ObjectKeyFromObject(desired), &cur)
    switch {
    case errors.IsNotFound(err):
        if err := r.Create(ctx, desired); err != nil {
            return ctrl.Result{}, err
        }
    case err == nil:
        if !equality.Semantic.DeepDerivative(desired.Spec, cur.Spec) {
            cur.Spec = desired.Spec
            if err := r.Update(ctx, &cur); err != nil {
                return ctrl.Result{}, err
            }
        }
    default:
        return ctrl.Result{}, err
    }
    
    // 5. 상태 갱신
    bpol.Status.Phase = "Active"
    bpol.Status.ObservedGeneration = bpol.Generation
    bpol.Status.LastBackupTime = cur.Status.LastScheduleTime
    if err := r.Status().Update(ctx, &bpol); err != nil {
        return ctrl.Result{}, err
    }
    
    return ctrl.Result{RequeueAfter: 1 * time.Minute}, nil
}

func (r *BackupPolicyReconciler) SetupWithManager(mgr ctrl.Manager) error {
    return ctrl.NewControllerManagedBy(mgr).
        For(&platformv1alpha1.BackupPolicy{}).
        Owns(&batchv1.CronJob{}).
        Complete(r)
}
```

요점:
- `+kubebuilder:rbac` 마커로 RBAC 자동 생성 (`make manifests`)
- `Owns(&batchv1.CronJob{})` 로 자식 변경도 watch
- `RequeueAfter` 로 주기적 status refresh

### kubebuilder 디렉토리 구조

```
backup-policy-operator/
├── api/v1alpha1/
│   ├── backuppolicy_types.go
│   └── zz_generated.deepcopy.go     (make generate)
├── config/
│   ├── crd/                          (make manifests → CRD YAML)
│   ├── rbac/
│   ├── manager/
│   └── samples/
├── internal/controller/
│   └── backuppolicy_controller.go
└── main.go
```

배포: `make docker-build docker-push IMG=commerce/backup-policy-operator:v1alpha1` → `make deploy IMG=...`.

## 6. kubebuilder vs Operator SDK

| 항목 | kubebuilder | Operator SDK (Go) |
|---|---|---|
| 출신 | sig-cluster-lifecycle (K8s 공식) | Red Hat / OpenShift |
| 베이스 | controller-runtime | controller-runtime |
| Helm/Ansible operator | X (Go 만) | O (3가지 모드) |
| OLM (Operator Lifecycle Manager) | X | O |
| 학습곡선 | 단순 | 약간 더 큼 |

**Go 만 쓸 거면 kubebuilder 가 표준**. Helm 차트 wrapping 으로 빨리 만들고 싶으면 Operator SDK 의 helm-operator 모드. msa 의 자체 Operator 후보(BackupPolicy, KEK 회전 등) 는 Go + kubebuilder 가 적합.

## 7. Java/Kotlin 으로 Operator 만들 수 있나

가능. **fabric8 java-operator-sdk**:

```kotlin
@ControllerConfiguration
class BackupPolicyReconciler : Reconciler<BackupPolicy> {
    override fun reconcile(
        resource: BackupPolicy,
        context: Context<BackupPolicy>
    ): UpdateControl<BackupPolicy> {
        val target = resource.spec.target
        val cronJob = buildCronJob(resource)
        context.client.batch().v1().cronjobs()
            .inNamespace(resource.metadata.namespace)
            .resource(cronJob)
            .serverSideApply()
        
        resource.status = BackupPolicyStatus(phase = "Active", ...)
        return UpdateControl.patchStatus(resource)
    }
}
```

장점: msa 가 이미 Kotlin/Spring 생태계. 단점: Go 대비 메모리 풋프린트 ↑, 커뮤니티 자료 적음. **K8s 운영 도메인은 Go 가 사실상 표준** — 학습/유지보수 비용을 따져 결정.

## 8. Validating / Mutating Webhook

CRD 의 OpenAPI schema 로 표현 못 하는 검증 (예: `target` 이 실제 존재하는 서비스인지) 은 webhook 에서:

```go
//+kubebuilder:webhook:path=/validate-platform-commerce-kgd-v1alpha1-backuppolicy,mutating=false,failurePolicy=fail,sideEffects=None,groups=platform.commerce.kgd,resources=backuppolicies,verbs=create;update,versions=v1alpha1,name=vbackuppolicy.kb.io,admissionReviewVersions=v1

func (r *BackupPolicy) ValidateCreate() (admission.Warnings, error) {
    if !isKnownService(r.Spec.Target) {
        return nil, field.Invalid(field.NewPath("spec.target"), r.Spec.Target, "unknown service")
    }
    return nil, nil
}
```

cert-manager 가 발급한 cert 로 webhook 의 TLS 가 보장 → admission 단계에서 거부.

CEL (Common Expression Language) 가 OpenAPI schema 안에서 가능해진 1.25+ 부터는 간단한 규칙은 webhook 없이 처리 가능:

```yaml
properties:
  spec:
    x-kubernetes-validations:
      - rule: "self.retentionDays >= self.rpoMinutes / 1440"
        message: "retentionDays must cover at least one full RPO window"
```

## 9. RBAC — Operator 의 권한 모델

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata: { name: backup-policy-operator }
rules:
  - apiGroups: ["platform.commerce.kgd"]
    resources: ["backuppolicies", "backuppolicies/status", "backuppolicies/finalizers"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: ["batch"]
    resources: ["cronjobs"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["create", "patch"]
```

원칙: **최소 권한**. cluster-admin 은 절대 X. namespace-scoped Operator 는 RoleBinding 으로 한정.

## 10. 운영상 함정 5가지

1. **CRD 삭제 시 모든 CR 도 같이 삭제** — Production 에서 CRD 를 함부로 지우면 큰일.
2. **Operator 가 동시에 2개 떠 있으면 race** — `LeaderElection: true` + `--leader-elect-resource-name` 로 리더 1명만.
3. **status.observedGeneration 누락** — 외부에서 "내 변경이 처리됐나" 알 길이 없음. 항상 채울 것.
4. **CR 의 spec 변경이 무한 reconcile** — Reconcile 내에서 spec 을 수정하지 말 것 (status 만).
5. **conversion webhook 없는 멀티 버전** — etcd 저장본은 storage version 1개. served versions 는 그냥 보여주기. conversion 없으면 마이그레이션 막힘.

## 11. msa 후보 시나리오

[16-improvements.md](16-improvements.md) 에 들어갈 ADR 후보 한 줄씩:

- **`BackupPolicy` Operator** — 위 예시. Percona Operator 의 `BackupSchedule` 위에 도메인 등급(RTO/RPO) 정책. 가치: 서비스 추가 시 백업 정책 일관 적용.
- **`KekRotation` Operator** — quant 의 KEK 회전 자동화. OCI Vault API 호출 + Secret 갱신 + 회전 주기 enforce. 가치: 수동 회전 휴먼 에러 방지.
- **`IdempotencyPolicy` Operator** — Kafka consumer dedup TTL/DLQ 정책 표준화. 가치: ADR-0012 의 정적 컨벤션을 동적으로 강제.

직접 구현 비용 (러프): 1인 1-2주 (Go + kubebuilder + CI). 비용 대비 가치 측정이 어려우니 **PoC 후 결정**.

## 12. 면접 답변 카드

- **"CRD 와 Operator 의 차이?"** → CRD 는 데이터 모양만, Operator 는 그걸 watch 해서 desired state 를 실현. CRD 만 있으면 그냥 etcd 의 KV 저장소.
- **"왜 Webhook 안 쓰고 OpenAPI 로 검증?"** → schema 검증은 빠르고 의존성 X. webhook 은 외부 시스템 조회 등 동적 검증 필요할 때. CEL 로 표현 가능하면 schema 가 우선.
- **"Operator 만들 때 고려사항?"** → leader election, RBAC 최소 권한, finalizer 누수, status observedGeneration, conversion webhook, idempotent reconcile. 6개 외워두면 즉답 가능.

다음: [05-networking-deep.md](05-networking-deep.md) — CNI / kube-proxy 모드 / Service / EndpointSlice / Headless gRPC.
