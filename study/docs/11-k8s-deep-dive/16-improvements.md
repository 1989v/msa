---
parent: 11-k8s-deep-dive
seq: 16
title: 개선 제안 + ADR 후보 종합
type: deep
created: 2026-05-01
---

# 16. msa 코드베이스 K8s 개선 제안 종합

## 1. 우선순위 매트릭스

| # | 제안 | 영역 | 영향도 | 노력 | 우선 | ADR |
|---|---|---|---|---|---|---|
| 1 | NetworkPolicy deny-default + allowlist | 보안 | **높음** | 낮음 | **즉시** | Y (마이너) |
| 2 | imagePullPolicy / latest tag 정책 | 운영 | 낮음 | 매우 낮음 | 즉시 | N |
| 3 | CronJob.spec.timeZone 명시 | 운영 | 낮음 | 매우 낮음 | 즉시 | N |
| 4 | ClusterIssuer.email 실값 | 운영 | 낮음 | 매우 낮음 | 즉시 | N |
| 5 | HPA Custom Metric (Prometheus Adapter) | 자원 | **높음** | 중간 | 단기 | Y (마이너) |
| 6 | KEDA Kafka lag 기반 scale (search-consumer/analytics) | 자원 | **높음** | 중간 | 단기 | Y |
| 7 | topologySpreadConstraints (AZ 분산) | HA | **높음** | 낮음 | 단기 | Y (마이너) |
| 8 | strategy.maxSurge/Unavailable 명시 (Tier 1) | 가용성 | 중간 | 낮음 | 단기 | N |
| 9 | Argo CD 도입 (GitOps) | 운영 | **매우 높음** | 중간 | 단기 | **Y (L3)** |
| 10 | PSS warn → audit → enforce 단계 도입 | 보안 | 중간 | 중간 | 단기-중기 | Y (마이너) |
| 11 | Argo Rollouts (Canary) — gateway/order | 안전성 | 중간 | 높음 | 중기 | **Y (L3)** |
| 12 | Kyverno admission 정책 set | 운영 | 중간 | 중간 | 중기 | Y (마이너) |
| 13 | trivy in CI (이미지 CVE 스캔) | 보안 | 중간 | 낮음 | 중기 | N |
| 14 | External Secrets Operator + AWS/OCI Vault | 보안 | 높음 | 중간 | 중기 | **Y (L3)** |
| 15 | 분산 추적 (OpenTelemetry → Tempo/Jaeger) | 관측성 | 중간 | 높음 | 중기 | Y |
| 16 | NodeLocal DNSCache | 성능 | 낮음 | 낮음 | 중기 | N |
| 17 | etcd 암호화 명시 (KMS provider) | 보안 | 낮음 | 낮음 | 중기 | N |
| 18 | StorageClass + reclaimPolicy=Retain 명시 | 운영 | 낮음 | 낮음 | 중기 | N |
| 19 | 자체 도메인 Operator (BackupPolicy / KekRotation) | 자동화 | 중간 | **높음** | 장기 | **Y (L3)** |
| 20 | Service Mesh (Linkerd) — mTLS + 분산 추적 통합 | 보안+관측 | 매우 높음 | 매우 높음 | 장기 | **Y (L3)** |

## 2. TOP 5 — 즉시 추진 가치

### #1. NetworkPolicy deny-default

**현재**: `grep -rn "NetworkPolicy" k8s/` → **0건**. 같은 namespace 내 모든 Pod 가 무제한 통신 가능.

**제안**:

```yaml
# k8s/base/network-policy/default-deny.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: deny-all-default, namespace: commerce }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
# DNS allow
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-dns, namespace: commerce }
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to:
        - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: kube-system } }
          podSelector: { matchLabels: { k8s-app: kube-dns } }
      ports: [{ port: 53, protocol: UDP }, { port: 53, protocol: TCP }]
---
# ingress-nginx → gateway
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-ingress-to-gateway, namespace: commerce }
spec:
  podSelector: { matchLabels: { app.kubernetes.io/name: gateway } }
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: ingress-nginx } }
      ports: [{ port: 8080, protocol: TCP }]
---
# gateway → 백엔드 일괄
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-gateway-to-backends, namespace: commerce }
spec:
  podSelector:
    matchExpressions:
      - { key: app.kubernetes.io/part-of, operator: In, values: [commerce-platform] }
      - { key: app.kubernetes.io/name, operator: NotIn, values: [gateway] }
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector: { matchLabels: { app.kubernetes.io/name: gateway } }
---
# 백엔드 → 인프라 (kafka/mysql/redis/es/...) — 별도 정책
```

**전제**: CNI 가 NetworkPolicy 지원해야 함. EKS 의 VPC CNI 는 옵션 활성 필요. Calico/Cilium 은 자동.

**ADR**: ADR-NEW "NetworkPolicy 도입과 default-deny 정책".

### #5+#6. HPA Custom Metric / KEDA

**현재**: 모든 HPA CPU 70% 단일.

**제안 A — gateway 의 RPS 기반**:

```yaml
# Prometheus Adapter rule
- seriesQuery: 'http_server_requests_seconds_count{namespace="commerce"}'
  resources:
    overrides:
      namespace: { resource: namespace }
      pod: { resource: pod }
  name:
    matches: "^(.*)_count"
    as: "${1}_per_second"
  metricsQuery: 'sum(rate(<<.Series>>{<<.LabelMatchers>>}[2m])) by (<<.GroupBy>>)'
---
# HPA
spec:
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 70 } }
    - type: Pods
      pods:
        metric: { name: http_server_requests_seconds_per_second }
        target: { type: AverageValue, averageValue: "100" }
```

**제안 B — search-consumer / analytics 의 KEDA**:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: search-consumer, namespace: commerce }
spec:
  scaleTargetRef: { name: search-consumer }
  minReplicaCount: 2
  maxReplicaCount: 8
  pollingInterval: 30
  cooldownPeriod: 300
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: kafka:29092
        consumerGroup: search-consumer
        topic: product.changed
        lagThreshold: "100"
```

**ADR**: ADR-NEW "Autoscaling 메트릭 다양화 — RPS / Kafka lag".

### #7. topologySpreadConstraints

**현재**: replicas=2 가 같은 AZ 에 떨어질 수 있음 (확률 1/zone_count). AZ 장애 시 동시 사라짐.

**제안**:

```yaml
# k8s/overlays/prod-k8s/patches/topology-spread.yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: placeholder }
spec:
  template:
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels: { app.kubernetes.io/part-of: commerce-platform }
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels: { app.kubernetes.io/part-of: commerce-platform }
```

`labelSelector` 가 같은 서비스만 잡도록 `app.kubernetes.io/name` 으로 좁히는 변형도 가능 (서비스마다 별도 spread).

**ADR**: 마이너 (ADR-0019 보강).

### #9. Argo CD 도입

**현재**: `kubectl apply -k` 수동. drift 감시 없음. 변경 추적은 git history 만.

**제안**:

1. `helm install argocd` (`infra/prod/argocd/values.yaml`)
2. 자기 자신을 `Application` 으로 등록 (self-managing)
3. `argocd/apps/` 디렉토리에 root Application + commerce-prod / commerce-infra 분리
4. selfHeal: true 는 단계적 (먼저 dev → stage → prod)

```yaml
# argocd/apps/commerce-prod.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: commerce-prod, namespace: argocd }
spec:
  project: default
  source:
    repoURL: https://github.com/kgd/msa
    path: k8s/overlays/prod-k8s
    targetRevision: main
  destination: { server: https://kubernetes.default.svc, namespace: commerce }
  syncPolicy:
    automated: { prune: true, selfHeal: true }
    syncOptions: [CreateNamespace=true, ServerSideApply=true]
```

**ADR**: ADR-NEW "GitOps 도입 (Argo CD)" — L3 (운영 모델 변경)

## 3. 단기 추진 — TOP 6-10 상세

### #10. PSS 단계적

```yaml
# k8s/base/namespace-pss.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: commerce
  labels:
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/audit: restricted
    # 1단계: warn + audit
    # 2단계 (수정 후): enforce: baseline
    # 3단계 (수정 후): enforce: restricted
```

수정 필요:
- 모든 Deployment 에 `securityContext.runAsNonRoot: true`, `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]`, `readOnlyRootFilesystem: true` (+ `/tmp` emptyDir)
- ECK / OpenSearch 의 `runAsUser: 0` 은 별도 ns (operator-managed) 에 격리

**ADR**: 마이너 (Pod Security 컨벤션).

### #11. Argo Rollouts (Canary)

대상: gateway, order (Tier 1)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: gateway, namespace: commerce }
spec:
  replicas: 4
  strategy:
    canary:
      canaryService: gateway-canary
      stableService: gateway
      trafficRouting:
        nginx: { stableIngress: gateway }
      steps:
        - setWeight: 5
        - pause: { duration: 5m }
        - analysis: { templates: [{ templateName: success-rate }] }
        - setWeight: 25
        - pause: { duration: 10m }
        - analysis: { templates: [{ templateName: success-rate }] }
        - setWeight: 50
        - pause: { duration: 10m }
        - setWeight: 100
  selector: { matchLabels: { app.kubernetes.io/name: gateway } }
  template: ...                               # 기존 Deployment.spec.template 그대로
```

```yaml
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
            }[5m])) /
            sum(rate(http_server_requests_seconds_count{
                service="{{args.service-name}}"
            }[5m]))
```

전제: Argo CD 도입 (#9) 가 선행.

**ADR**: ADR-NEW "Tier 1 서비스 Canary 배포 전략" — L3.

### #14. External Secrets Operator

대상: 현재 placeholder Secret + JWT key (common/security) + OCI Vault token (quant)

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata: { name: aws-secretsmanager }
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-northeast-2
      auth: { jwt: { serviceAccountRef: { name: external-secrets } } }
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata: { name: gateway-jwt-key, namespace: commerce }
spec:
  refreshInterval: 1h
  secretStoreRef: { name: aws-secretsmanager, kind: ClusterSecretStore }
  target: { name: gateway-secret }
  data:
    - { secretKey: jwt-key, remoteRef: { key: prod/gateway/jwt-key } }
```

OCI Vault 통합은 ADR-0027 의 KEK 모델 그대로 → ESO 의 `oraclevault` provider 사용.

**ADR**: ADR-NEW "Secret 관리 — Sealed Secrets → External Secrets Operator 마이그레이션" — L3.

## 4. 중기 — TOP 11-18 요약

### #12. Kyverno 정책 set

```yaml
# k8s/infra/prod/kyverno-policies/
- require-resource-limits.yaml
- require-pdb-when-replicas-gt-1.yaml
- disallow-default-sa.yaml
- restrict-image-registry.yaml      # commerce/* 만
- require-network-policy.yaml       # ns 마다 deny-default 존재
- require-non-root.yaml
```

**ADR**: 마이너.

### #13. trivy

CI 에 단계 추가:
```yaml
# .github/workflows/build.yml (또는 GitLab CI)
- name: Trivy scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: commerce/${{ matrix.service }}:${{ env.SHA }}
    severity: HIGH,CRITICAL
    exit-code: 1
```

**ADR**: 불필요 (CI 변경).

### #15. 분산 추적

OpenTelemetry SDK 의존성 추가 + Tempo/Jaeger Operator 설치 + Grafana 연동.

```kotlin
// build.gradle.kts (common)
implementation("io.opentelemetry.instrumentation:opentelemetry-spring-boot-starter:2.x")
```

```yaml
# Deployment env
- { name: OTEL_EXPORTER_OTLP_ENDPOINT, value: http://tempo.monitoring:4317 }
- { name: OTEL_RESOURCE_ATTRIBUTES, value: "service.name=gateway,deployment.environment=prod" }
```

**ADR**: ADR-NEW "분산 추적 도입" — L2.

### #16. NodeLocal DNSCache

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/kubernetes/master/cluster/addons/dns/nodelocaldns/nodelocaldns.yaml
```

(템플릿에서 `__PILLAR__*` 를 클러스터 값으로 치환)

**ADR**: 불필요.

### #17. etcd 암호화 명시 (self-hosted 만 해당)

EKS / GKE / AKS 는 자동. self-hosted 라면:
```yaml
# /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources: [secrets]
    providers:
      - kms: { name: aws-kms, endpoint: ... }
      - identity: {}
```

**ADR**: 불필요 (운영 procedure).

### #18. StorageClass 명시 + Retain

```yaml
# infra/prod/storage-classes.yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: { name: gp3-retain }
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  encrypted: "true"
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Retain
allowVolumeExpansion: true
```

DB 류 PVC 가 이 SC 를 사용하도록 Operator CR 갱신.

**ADR**: 불필요 (운영 보강).

## 5. 장기 — TOP 19-20

### #19. 자체 Operator 후보

[04-crd-operator.md §11](04-crd-operator.md) 의 3개 후보:

| Operator | 가치 | 비용 |
|---|---|---|
| **BackupPolicy** | 서비스별 RTO/RPO 표준화 | 1-2주 |
| **KekRotation** (quant) | KEK 회전 자동화 | 2-3주 |
| **IdempotencyPolicy** (Kafka consumer) | 정책 enforce | 2-3주 |

PoC 전 **"이미 있는 Operator + custom YAML"** 로 우회 가능한지 점검:
- BackupPolicy → Percona Operator 의 `BackupSchedule` + Kyverno 정책 강제로 80% 해결 가능?
- KekRotation → CronJob + ESO 로 50% 해결 가능?
- IdempotencyPolicy → 코드 컨벤션(ADR-0012) + 런타임 lib 강제로 70% 해결 가능?

→ **PoC 후 결정**. 직접 작성은 신중.

**ADR**: PoC 단계는 불필요. 의사결정 시점에 ADR-NEW.

### #20. Service Mesh

[13-service-mesh.md §9](13-service-mesh.md) 의 분석: **현시점 비용 > 이득**. 도입 시점 시그널은:
- 멀티 클러스터
- B2B mTLS 의무
- 서비스 50+ 로 복잡

도입 시 후보: **Linkerd 우선** (단순 + Rust sidecar 메모리 효율).

**ADR**: 도입 시점에 ADR-NEW (L3, 매우 큰 변경).

## 6. 작업 묶음 (mini-roadmap)

### Sprint 1 (1주)
- #1 NetworkPolicy
- #2 imagePullPolicy 정책
- #3 CronJob timeZone
- #4 ClusterIssuer email
- #16 NodeLocal DNSCache
- #18 StorageClass + Retain

### Sprint 2 (2주)
- #5 HPA Custom Metric (gateway)
- #6 KEDA (search-consumer / analytics)
- #7 topologySpreadConstraints
- #8 strategy.maxSurge/Unavailable

### Sprint 3 (2-3주)
- #9 Argo CD 도입
- #10 PSS warn/audit 단계
- #12 Kyverno 정책 set
- #13 trivy CI

### Sprint 4 (3-4주)
- #11 Argo Rollouts (gateway → order)
- #14 External Secrets Operator
- #15 분산 추적 (OpenTelemetry)

### Sprint 5+ (장기)
- #19 자체 Operator PoC (선별)
- #20 Service Mesh (도입 시점 도래 시)

## 7. ADR 후보 정리

| ADR 번호(가) | 제목 | 영향 등급 |
|---|---|---|
| ADR-0028 | NetworkPolicy 도입과 default-deny 정책 | L2 |
| ADR-0029 | Autoscaling 메트릭 다양화 (RPS / Kafka lag) | L2 |
| ADR-0030 | GitOps 도입 (Argo CD) | **L3** |
| ADR-0031 | Tier 1 서비스 Canary 배포 (Argo Rollouts) | **L3** |
| ADR-0032 | Secret 관리 마이그레이션 (Sealed Secrets → ESO) | **L3** |
| ADR-0033 | Pod Security Standards 단계적 적용 | L2 |
| ADR-0034 | 분산 추적 (OpenTelemetry) | L2 |
| (장기) | 자체 Operator (BackupPolicy / KekRotation) | L3 |
| (장기) | Service Mesh (Linkerd) | L3 |

ADR 번호는 현재 ADR-0027 까지 — 공식 발번은 별도 협의.

## 8. 정리

- **즉시 가치 큰 5개 (Sprint 1)** 만 적용해도 보안/운영 점수 크게 ↑
- **GitOps + Canary + ESO 의 트리오 (Sprint 3-4)** 가 운영 모델 변경의 핵심
- **자체 Operator / Service Mesh 는 신중** — PoC 후 도입 결정
- 본 학습의 결과물로 **ADR-0028 ~ ADR-0034** 7건의 후속 ADR 후보가 도출됨

다음: [17-interview-qa.md](17-interview-qa.md) — 면접 빈출 질문 카드 30+.
