---
parent: 11-k8s-deep-dive
seq: 12
title: GitOps — Argo CD / Flux / Secret 관리
type: deep
created: 2026-05-01
---

# 12. GitOps

## 1. GitOps 정의 (CNCF, 2021)

> 4원칙:
> 1. **Declarative** — 시스템의 desired state 가 선언적으로 표현됨
> 2. **Versioned & Immutable** — 그 선언은 git 같은 immutable 저장소에 보관
> 3. **Pulled automatically** — 에이전트가 자동으로 pull 해서 클러스터에 적용
> 4. **Continuously reconciled** — drift 가 발생하면 자동으로 desired state 로 수렴

핵심: **"git 이 production 의 single source of truth"**.

## 2. 기존 CD 와의 차이

```
[기존 push 모델]
   CI ──build──► registry
       ──kubectl/helm push──► cluster
       (CI 가 클러스터 자격증명 보유, 외부에서 push)

[GitOps pull 모델]
   CI ──build──► registry
       ──commit manifest──► git
                              │ watch
                              ▼
                        [agent in cluster] ──pull──► cluster
                        (자격증명이 클러스터 안, 외부 노출 X)
```

장점:
- **자격증명 위치 역전** — CI 에 클러스터 자격증명 줄 필요 없음 (보안 ↑)
- **drift 자동 수정** — 누군가 `kubectl edit` 해도 git 으로 복귀
- **PR 기반 변경 추적** — 누가 언제 무엇을 바꿨는지 git history
- **rollback = git revert** — 롤백이 코드 변경의 일관성

단점:
- **non-K8s 자원** (DNS, 외부 API key) 와의 동기화는 별개 도구 필요
- **secret 관리** — git 에 평문 secret 못 둠 → SOPS / Sealed Secrets / External Secrets 필요

## 3. Argo CD

### 핵심 개념

| 개념 | 의미 |
|---|---|
| `Application` | "git 의 어떤 path 가 클러스터의 어떤 namespace 에 동기화되어야 하나" |
| `AppProject` | Application 묶음 + RBAC 경계 |
| `ApplicationSet` | 동적 Application 생성 (예: 모든 git repo 를 자동 등록) |
| Sync | git 의 desired ↔ 클러스터 actual 의 동기화 |
| Health | 리소스의 상태 (Healthy / Progressing / Degraded / Suspended / Missing) |

### 가장 단순한 Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: commerce-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/commerce/msa
    path: k8s/overlays/prod-k8s
    targetRevision: main         # 브랜치/태그/SHA
  destination:
    server: https://kubernetes.default.svc
    namespace: commerce
  syncPolicy:
    automated:
      prune: true                # git 에서 사라진 리소스 자동 삭제
      selfHeal: true             # drift 자동 복구
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
      - ApplyOutOfSyncOnly=true
    retry:
      limit: 3
      backoff: { duration: 5s, factor: 2, maxDuration: 1m }
```

### Sync Wave

```yaml
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "-1"   # 작은 값이 먼저
```

순서:
1. CRD 먼저 (-1)
2. Namespace, Secret (0)
3. 일반 리소스 (1)
4. post-sync 훅 (10+)

### Sync Hook

```yaml
metadata:
  annotations:
    argocd.argoproj.io/hook: PreSync       # PreSync | Sync | PostSync | SyncFail
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
```

DB 마이그레이션 Job 을 PreSync 로 두면 새 버전 배포 전에 실행.

### App-of-Apps 패턴

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: root, namespace: argocd }
spec:
  source:
    repoURL: https://github.com/commerce/msa
    path: argocd/apps                       # 이 폴더 안에 다른 Application 매니페스트들
  syncPolicy: { automated: { prune: true, selfHeal: true } }
```

→ root Application 이 하위 Application 들을 만들고, 그것들이 또 진짜 워크로드를 동기화. **Argo CD 자체도 git 으로 관리** 가능.

### ApplicationSet — 동적 생성

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata: { name: per-cluster }
spec:
  generators:
    - clusters: {}                          # 모든 클러스터에 자동 생성
  template:
    metadata: { name: '{{name}}-commerce' }
    spec:
      source:
        repoURL: https://github.com/commerce/msa
        path: 'k8s/overlays/{{metadata.labels.env}}'
      destination: { server: '{{server}}', namespace: commerce }
```

### 환경 분리 패턴

흔한 두 모델:

A) **branch 분리**: `main` (prod), `staging`, `dev`. 단점: cherry-pick 이 잦음.

B) **folder 분리** (msa 가 적합): 한 브랜치, `k8s/overlays/{prod-k8s,k3s-lite,...}` 폴더로. **권장**.

## 4. Flux v2

Argo CD 와 비슷한 위치, 다른 철학:

| 항목 | Argo CD | Flux v2 |
|---|---|---|
| UI | 풍부 (web) | 미니멀 (CLI 위주) |
| 모델 | Application 1개 객체 | GitRepository + Kustomization (또는 HelmRelease) 분리 |
| Helm 통합 | helm controller 내장 | 자체 controller (HelmRelease) |
| Notification | 별도 | 자체 controller 내장 |
| Multi-tenancy | AppProject 로 | tenant flux instance |

기능적으로는 비슷하나, **Argo CD UI** 가 운영팀 친화도 높아 한국 대기업 도입은 Argo CD 우세.

## 5. Drift Detection & Self-heal

```
Git: Deployment replicas=2
Cluster: 누가 kubectl scale --replicas=5

Argo CD 가 watch:
   git.replicas (2) ≠ cluster.replicas (5)
   ↓
   selfHeal: true 면 자동으로 cluster 를 2로 되돌림
   ↓
   selfHeal: false 면 OutOfSync 표시만 (사람이 결정)
```

운영 패턴:
- **Tier 1** — selfHeal: true (절대 drift 금지)
- **Dev / Stage** — selfHeal: false (디버깅 위해 임시 변경 허용)

## 6. Secret 관리 — GitOps 의 가장 큰 숙제

> "git 에 secret 평문은 못 둔다. 그렇다고 git 밖에 두면 GitOps 깨진다."

해결책 4가지.

### A. Sealed Secrets (Bitnami)

```bash
# 1. controller 가 클러스터 안에 RSA 키쌍 보관
# 2. 사용자는 평문 Secret 을 kubeseal 로 암호화 → SealedSecret CR
echo -n "supersecret" | kubectl create secret generic mysql --dry-run=client \
  --from-file=password=/dev/stdin -o yaml \
  | kubeseal --format yaml > sealed-mysql.yaml

# 3. sealed-mysql.yaml 을 git commit (암호문이라 안전)

# 4. 클러스터의 sealed-secrets controller 가 SealedSecret → 평문 Secret 으로 풀어줌
```

```yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata: { name: mysql, namespace: commerce }
spec:
  encryptedData:
    password: AgC...   # base64 암호문
```

장점:
- 암호화는 클러스터의 키로만 풀림 (다른 클러스터로 가면 못 풂 → tenant 분리)
- 아주 단순

단점:
- 키 회전 시 수동 재암호화 필요
- 많은 secret 을 다루기엔 운영 부담

msa 가 채택 (`k8s/infra/prod/sealed-secrets/`).

### B. SOPS (Mozilla)

```bash
# AWS KMS 또는 GCP KMS 또는 age key 로 암호화
sops -e -i secrets.yaml

# 결과 — 값이 암호화된 yaml. metadata 는 그대로
apiVersion: v1
kind: Secret
data:
  password: ENC[AES256_GCM,data:...]
sops:
  kms:
    - arn: arn:aws:kms:us-east-1:...:key/...
```

장점:
- yaml diff 가 부분만 (값만 암호문, 키는 평문)
- KMS 통합 → 키 관리 위임

단점:
- 클러스터에서 자동 복호화하려면 별도 controller 필요 (Helm Secrets, kustomize secret-generator-plugin, Argo CD 의 SOPS 플러그인)
- 운영 도입 곡선

### C. External Secrets Operator (ESO)

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata: { name: aws-secretsmanager }
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt: { serviceAccountRef: { name: external-secrets } }
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata: { name: gateway-jwt-key, namespace: commerce }
spec:
  refreshInterval: 1h
  secretStoreRef: { name: aws-secretsmanager, kind: ClusterSecretStore }
  target: { name: gateway-secret }
  data:
    - secretKey: jwt-key
      remoteRef: { key: prod/gateway/jwt-key }
```

→ ESO 가 1시간마다 AWS Secrets Manager 에서 가져와서 K8s Secret 갱신.

장점:
- secret 의 single source = 클라우드 KMS/Secrets Manager
- 키 회전이 클라우드 콘솔에서 + 자동 반영
- multi-cloud (AWS / GCP / Azure / Vault) 지원

단점:
- 클라우드 의존 (멀티 클라우드 전환 시 Vault 에 배치)
- ESO 자체의 권한 관리 (IRSA / Workload Identity)

장기적으로 가장 좋은 모델. ADR-0027 (OCI Vault KEK envelope encryption) 와 같은 모델.

### D. Vault Agent / Vault Operator

HashiCorp Vault 기반. ESO 보다 풍부 (dynamic secret = 짧은 수명 자격증명) 하지만 운영 비용 큼.

### 비교 매트릭스

| 항목 | Sealed Secrets | SOPS | ESO | Vault |
|---|---|---|---|---|
| git 에 secret 저장 | 암호문 | 암호문 | 참조만 | 참조만 |
| 키 회전 | 수동 재암호화 | KMS 로 위임 | 자동 | 자동 |
| 멀티 클러스터 | 키마다 따로 | KMS 공유 | 클라우드 단일 | Vault 단일 |
| 학습 곡선 | 낮음 | 중간 | 중간 | 높음 |
| 운영 비용 | 낮음 | 중간 | 중간 | 높음 |

msa 의 방향:
- 현재: Sealed Secrets (`infra/prod/sealed-secrets/`)
- 권장: ESO 로 점진 전환 — JWT key, DB password, OCI Vault token 등 "외부 SoT 가 있는 secret" 부터

## 7. Argo CD 의 운영 팁

### Notification 설정

```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: argocd-notifications-cm, namespace: argocd }
data:
  service.slack: |
    token: $slack-token
  template.app-deployed: |
    message: |
      App {{.app.metadata.name}} synced to revision {{.app.status.sync.revision}}
  trigger.on-sync-succeeded: |
    - description: ...
      send: [app-deployed]
      when: app.status.operationState.phase in ['Succeeded']
```

→ Slack 으로 sync 성공/실패 알림.

### RBAC

```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: argocd-rbac-cm, namespace: argocd }
data:
  policy.csv: |
    p, role:admin, applications, *, */*, allow
    p, role:dev,   applications, get, commerce/*, allow
    p, role:dev,   applications, sync, commerce/*, allow
    g, alice@example.com, role:admin
    g, bob@example.com, role:dev
```

### App-of-Apps 의 secret 우선순위

ApplicationSet / App-of-Apps 패턴 도입 시 sync wave 로:
1. Wave -1: cert-manager / sealed-secrets (CRD + controller)
2. Wave 0: SealedSecret / ExternalSecret (실제 secret 객체)
3. Wave 1: 일반 워크로드 (Secret 을 참조)

순서가 깨지면 Pod 가 Secret 못 찾아 CrashLoopBackoff.

### Disaster Recovery

- Argo CD 의 모든 상태 = git + cluster (자체 etcd 쓰지 않음)
- 클러스터 날려도 새 클러스터에 Argo CD 설치 → root Application 적용 → 30분 안에 전체 복구

## 8. msa 매핑 + 도입 권장 순서

### 현재
- Argo CD 미도입
- 변경 적용은 `kubectl apply -k k8s/overlays/{prod-k8s,k3s-lite}` (사람이 직접)
- Sealed Secrets 폴더 존재 (`k8s/infra/prod/sealed-secrets/`) 이지만 실제 사용은 placeholder secret 들에 한정 (Percona/Strimzi)

### Phase 도입 권장

1. **Argo CD 설치** — `helm install argocd` + 자체 root Application 으로 self-manage
2. **App-of-Apps 패턴** — `argocd/apps/` 디렉토리 추가 + commerce-prod, commerce-infra Application 분리
3. **Sealed Secrets 의 placeholder 를 진짜로 채우기** — Percona/Strimzi/MySQL root secret
4. **External Secrets Operator 도입** (장기) — JWT key, OCI Vault token 부터
5. **selfHeal: true** 로 Tier 1 차츰 활성화

### ADR 후보 ([16-improvements.md](16-improvements.md))

- ADR: GitOps 도입 (Argo CD)
- ADR: ESO + AWS Secrets Manager / OCI Vault 통합

## 9. 면접 빈출 7

1. **"GitOps 가 기존 CD 와 무엇이 다른가?"** → push vs pull, drift 자동 수정, git 이 SoT, 자격증명 위치 역전.
2. **"Argo CD vs Flux?"** → UI / 모델 / 다중 controller 차이. 한국 대기업 운영팀은 Argo CD 의 UI 친화성 선호.
3. **"GitOps 에서 secret 어떻게?"** → Sealed Secrets / SOPS / ESO 중 선택. ESO 가 장기적으로 가장 클린.
4. **"누가 git 에 안 통하고 cluster 를 바꾸면?"** → Argo CD 가 OutOfSync 감지 → selfHeal:true 면 자동 복구, false 면 알림만.
5. **"App-of-Apps 패턴이 뭐?"** → root Application 이 자식 Application 들을 동기화. Argo CD 자체도 git 화 가능.
6. **"Sync wave 가 왜 필요?"** → CRD → Namespace/Secret → 워크로드 의 순서 강제. 깨지면 Pod 가 의존 자원 못 찾음.
7. **"Argo CD 설치 자체는 어떻게?"** → 부트스트랩 시 `helm install` 1회, 그 후 자기 자신을 Application 으로 등록 (self-managing).

## 10. 정리

```
GitOps = "git 이 SoT + 에이전트가 pull + drift 자동 수정"

도구:
   배포 → Argo CD / Flux
   secret → Sealed Secrets / SOPS / External Secrets / Vault
   templating → Helm + Kustomize (둘 다 OK)
```

다음: [13-service-mesh.md](13-service-mesh.md) — Istio / Linkerd 의 sidecar 모델과 mTLS.
