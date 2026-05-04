---
parent: 11-k8s-deep-dive
seq: 14
title: K8s 보안 — RBAC / PSS / OPA / Kyverno / etcd 암호화
type: deep
created: 2026-05-01
---

# 14. K8s 보안 심화

## 1. 5층 보안 모델

```
   L5: Audit / Logging        ────► 누가 무엇을 했나
   L4: Admission Policy       ────► OPA Gatekeeper / Kyverno
   L3: Pod Security Standards ────► privileged / baseline / restricted
   L2: RBAC / SA              ────► 누가 무엇을 할 수 있나
   L1: TLS / etcd encryption  ────► 통신/저장 보호
```

각 층은 보완재. RBAC (Role-Based Access Control, 역할 기반 접근 제어) 만으로 부족하고, PSS 만으로 부족함.

## 2. RBAC — Role-Based Access Control

### 4-tuple 모델

```
[Subject] (사용자/SA/그룹)
   ↓ has
[Role / ClusterRole]
   ↓ binds via
[RoleBinding / ClusterRoleBinding]
   ↓ grants
[Verbs] on [Resources]
```

### 예시

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: { namespace: commerce, name: pod-reader }
rules:
  - apiGroups: [""]
    resources: [pods, pods/log, pods/exec]
    verbs: [get, list, watch]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: { name: alice-pod-reader, namespace: commerce }
subjects:
  - kind: User
    name: alice@example.com
    apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

### Role vs ClusterRole

| Role | ClusterRole |
|---|---|
| namespace 단위 | cluster 단위 |
| RoleBinding 으로 묶음 | ClusterRoleBinding (cluster 전체) 또는 RoleBinding (특정 ns 에 cluster role) |

### Verb 목록

`get / list / watch / create / update / patch / delete / deletecollection / exec / portforward / log` 등.

### ServiceAccount

각 Pod 는 ServiceAccount 를 가지며, SA 의 토큰으로 K8s API 호출.

```yaml
apiVersion: v1
kind: ServiceAccount
metadata: { name: gateway, namespace: commerce }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: gateway }
spec:
  template:
    spec:
      serviceAccountName: gateway
```

토큰은 1.24+ 부터 자동 mount 비활성 추세. 필요 시 `automountServiceAccountToken: true` 또는 별도 projected volume.

### IRSA (EKS) — SA 와 IAM 결합

EKS 에서:
```yaml
metadata:
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456:role/MyAppRole
```

→ Pod 가 SA 토큰으로 STS AssumeRoleWithWebIdentity → AWS API 호출. 자세한 건 [#13 13-aws-kms.md](../13-crypto-jwt-sso/13-aws-kms.md) 의 IAM + Key Policy 모델.

### 최소 권한 원칙 (PoLP)

피해야 할 anti-pattern:
- `cluster-admin` 직접 부여
- `verbs: ["*"]`, `resources: ["*"]`
- `default` SA 사용 (모든 Pod 가 같은 권한)

권장:
- 각 앱 SA 분리
- ClusterRole 은 정말 cluster 광역인 것만 (Operator, ingress controller)
- `audit-policy.yaml` 로 권한 사용 추적

## 3. Pod Security Standards (PSS)

K8s 1.25+ 의 표준. 3단계:

| 단계 | 의미 |
|---|---|
| `privileged` | 제한 없음 (가장 위험) |
| `baseline` | 흔한 권한 회피 (privileged 컨테이너, hostNetwork 등 차단) |
| `restricted` | 강한 제한 (runAsNonRoot, readOnly RootFS, capabilities 제거) |

### 적용 — Pod Security Admission

namespace 단위:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: commerce
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: v1.28
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

→ 위반하는 Pod 는 admission 단계에서 거부.

### restricted 가 강제하는 항목 (요약)

- `securityContext.runAsNonRoot: true`
- `securityContext.allowPrivilegeEscalation: false`
- `capabilities: { drop: [ALL] }`
- `seccompProfile: { type: RuntimeDefault }`
- volume types 제한 (hostPath 차단)

### Spring Boot 앱이 restricted 를 만족시키려면

```yaml
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile: { type: RuntimeDefault }
      containers:
        - name: app
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: [ALL] }
          volumeMounts:
            - { name: tmp, mountPath: /tmp }
      volumes:
        - { name: tmp, emptyDir: {} }
```

msa 의 Jib base image 가 `eclipse-temurin:25-jre-alpine` + `user = "1000:1000"` 을 적용 (`buildSrc/.../jib-convention.gradle.kts:85`) → runAsUser 만족. 다른 항목은 Deployment 에 명시 필요.

## 4. Admission Policy — OPA Gatekeeper / Kyverno

PSS 가 못 표현하는 정책 (e.g. "Image 는 ECR 에서만", "label 의 owner 필수") 을 강제.

### Kyverno 가 더 단순 (YAML 만)

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: { name: require-resource-limits }
spec:
  validationFailureAction: Enforce
  rules:
    - name: validate-resources
      match:
        any:
          - resources: { kinds: [Pod] }
      validate:
        message: "All containers must have CPU and memory requests/limits."
        pattern:
          spec:
            containers:
              - name: "*"
                resources:
                  requests:
                    cpu: "?*"
                    memory: "?*"
                  limits:
                    memory: "?*"
```

→ resources 미지정 Pod 는 admission 거부.

### OPA Gatekeeper — Rego 기반 (강력하지만 학습곡선)

```rego
package k8srequiredlabels
violation[{"msg": msg}] {
    not input.review.object.metadata.labels.owner
    msg := "missing required label: owner"
}
```

ConstraintTemplate + Constraint 로 적용.

### 권장 정책 set (msa 도입 시)

1. **resources 필수** (위 예시)
2. **image registry 화이트리스트** (`commerce/*` 만)
3. **namespace label 강제** (`team`, `owner`)
4. **hostPath 금지**
5. **privileged 금지**
6. **default SA 사용 금지**
7. **NetworkPolicy 강제** — namespace 마다 deny-default NetPol 존재 확인
8. **HPA 강제** (Tier 1 서비스)
9. **PDB 강제** (replicas >= 2 인 Deployment)
10. **livenessProbe / readinessProbe 강제**

## 5. etcd 암호화 (at-rest)

[01-control-plane.md §3](01-control-plane.md) 에서 다룬 EncryptionConfiguration 다시 정리:

```yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources: [secrets, configmaps]
    providers:
      - kms:
          name: aws-kms
          endpoint: unix:///var/run/kmsplugin/socket.sock
          cachesize: 1000
          timeout: 3s
      - aescbc:
          keys:
            - { name: key1, secret: <base64-32B> }
      - identity: {}
```

provider 순서가 우선:
- **읽기**: 모든 provider 시도 → 첫 매칭
- **쓰기**: 첫 provider 사용

마이그레이션:
1. provider 추가 (identity 가 첫번째에 있으면 새 데이터는 평문)
2. 새 provider 를 첫번째로 (새 데이터 암호화)
3. 기존 데이터 재암호화: `kubectl get secrets --all-namespaces -o json | kubectl replace -f -` → 모든 secret 을 다시 쓰면서 암호화 적용

EKS 는 자체 KMS provider 가 자동. self-hosted 는 위 설정.

## 6. 감사 (Audit Logging)

```yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
  - level: Metadata
    resources:
      - { group: "", resources: [secrets, configmaps] }
  - level: RequestResponse
    resources:
      - { group: "", resources: [pods, pods/exec] }
    verbs: [create, update, delete, patch, exec]
  - level: None
    users: [system:serviceaccount:kube-system:*]
```

Level:
- `None` — 기록 안 함
- `Metadata` — 메타만 (누가/언제/뭐를)
- `Request` — request body
- `RequestResponse` — request + response

위험한 작업(secret 생성, exec, delete) 은 RequestResponse 로 추적.

## 7. Image Security

### 컨테이너 이미지 스캔

- **trivy** — 정적 스캔. CVE / 의존성 / Dockerfile lint
- **Snyk / Anchore** — 상용

CI 통합:
```bash
trivy image --severity HIGH,CRITICAL --exit-code 1 commerce/gateway:latest
```

### Image Policy — Sigstore / cosign

```yaml
# Kyverno 정책 — signed image 만 허용
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: { name: verify-images }
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-image
      match: { any: [{ resources: { kinds: [Pod] } }] }
      verifyImages:
        - imageReferences: ["commerce/*"]
          attestors:
            - count: 1
              entries:
                - keys:
                    publicKeys: |
                      -----BEGIN PUBLIC KEY-----
                      ...
                      -----END PUBLIC KEY-----
```

→ 서명되지 않은 이미지는 admission 거부.

## 8. NetworkPolicy 보안 (다시)

[06-ingress-gateway-api.md §4](06-ingress-gateway-api.md) 의 deny-default 패턴이 가장 큰 보안 win. 현재 msa 의 0건 → 즉시 도입 가치.

추가:
- namespace 간 격리 (`default-deny` + `allow-from-same-ns`)
- egress 제한 (외부 인터넷 접근 명시 endpoint 만)
- DNS / Metric / Logging 트래픽 명시 allow

## 9. Secret 보안 정리

- etcd 평문 → EncryptionConfiguration (KMS provider)
- git 평문 금지 → Sealed Secrets / SOPS / ESO ([12-gitops.md §6](12-gitops.md))
- Pod 안 환경변수 노출 → `kubectl exec` 시 보임. volume mount + readOnly 추천
- log 에 출력 → 로그 마스킹 또는 Vault dynamic secret 으로 짧은 수명

## 10. Image Pull Secret + Private Registry

```yaml
apiVersion: v1
kind: Secret
metadata: { name: registry-cred }
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: <base64>
---
apiVersion: v1
kind: ServiceAccount
metadata: { name: gateway }
imagePullSecrets:
  - name: registry-cred
```

EKS / GKE 는 IAM 으로 ECR / GCR 접근 → Secret 불필요.

## 11. 보안 점검 체크리스트 (msa 적용)

| 항목 | 현재 | 목표 |
|---|---|---|
| RBAC | per-service SA 있음 | ClusterRole 사용처 점검 |
| PSS | 미설정 (privileged) | `restricted` (단계적: warn → audit → enforce) |
| NetworkPolicy | **0건** | deny-default + allow 매트릭스 |
| etcd 암호화 | 클러스터 의존 (EKS 면 자동) | KMS provider 명시 |
| Image scan | 미설정 | trivy in CI |
| Image signing | 미설정 | cosign + Kyverno (선택) |
| Audit log | 클러스터 의존 | Policy 명시 |
| Secret in git | placeholder 만 | ESO 도입 |
| Pod runAsNonRoot | Jib `user=1000:1000` | Deployment SecurityContext 명시 |

## 12. 면접 빈출 7

1. **"RBAC 의 4-tuple?"** → Subject + Role + Binding + Verbs/Resources.
2. **"Role vs ClusterRole 언제?"** → namespace 한정이면 Role, cluster 광역(노드 / namespace / CRD) 이면 ClusterRole.
3. **"Pod Security Standards 의 3단계?"** → privileged / baseline / restricted. namespace label 로 enforce.
4. **"OPA 와 Kyverno 차이?"** → OPA 는 Rego (학습곡선), Kyverno 는 YAML (단순). 단순 정책은 Kyverno, 복잡한 비즈니스 정책은 OPA.
5. **"etcd 의 Secret 이 평문이라는데?"** → EncryptionConfiguration 으로 KMS 연동. EKS / GKE 는 자동.
6. **"`kubectl exec` 보안?"** → audit policy 로 RequestResponse 추적. Pod 안 secret 보일 수 있어 별도 관리. PSS restricted 면 컨테이너 capability 제한.
7. **"image signature 검증?"** → cosign + Kyverno 의 verifyImages. 서명되지 않은 이미지 admission 거부.

## 13. 정리 + 도입 순서

```
즉시:
   - NetworkPolicy deny-default
   - Kyverno 의 resources/PDB/HPA 강제 정책
   - PSS warn → audit → enforce 단계적

단기:
   - etcd KMS 암호화 명시
   - Audit policy 정의
   - trivy in CI

중기:
   - cosign + Kyverno verifyImages
   - ESO 도입 (Secret in git → KMS)
   - PSS restricted enforce

장기:
   - mTLS (mesh 또는 cert-manager + SPIFFE)
   - Vault dynamic secrets
```

다음: [15-msa-k8s-grep.md](15-msa-k8s-grep.md) — msa 코드베이스 K8s 매니페스트 직접 점검.
