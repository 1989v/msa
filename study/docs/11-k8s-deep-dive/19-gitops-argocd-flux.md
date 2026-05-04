---
parent: 11-k8s-deep-dive
seq: 19
title: GitOps 심화 — Argo CD ApplicationSet / Sync Wave / Image Updater / Multi-cluster
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 11-helm-vs-kustomize.md
  - 12-gitops.md
  - 18-operator-pattern-crd.md
  - 20-canary-bluegreen-argo-rollouts.md
  - 15-msa-k8s-grep.md
sources:
  - https://argo-cd.readthedocs.io/en/stable/
  - https://argocd-applicationset.readthedocs.io/en/stable/
  - https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/
  - https://fluxcd.io/flux/
  - https://argocd-image-updater.readthedocs.io/en/stable/
  - https://external-secrets.io/latest/
catalog-row: "§G (GitOps) — Argo CD Application / ApplicationSet / Sync waves / hooks / Image Updater / Flux"
---

# 19. GitOps 심화 — Argo CD ApplicationSet / Sync Wave / Image Updater / Multi-cluster

> 카탈로그 매핑: §99 §G — `Argo CD App of Apps / ApplicationSet / Sync waves / hooks` (★ → ✅), `Flux Source / Kustomization / HelmRelease / Image automation` (★ → ✅).
> 학습 시간 예상: ~2.5h · 자가평가 입구 레벨: B
>
> §12 (gitops 기본) 위에 쌓는 운영 심화. ApplicationSet 의 4 generator (List / Cluster / Git / Matrix), Sync wave 의 의존성 그래프 설계, PreSync/Sync/PostSync hook 의 실전 패턴, Image Updater 로 tag 갱신 자동화, multi-cluster GitOps 의 hub-and-spoke vs per-cluster Argo, External Secrets / SealedSecrets / SOPS 3 secret 전략의 현실 비교, msa 의 `k8s/overlays/{k3s-lite, prod-k8s}` 디렉토리 구조에 GitOps 를 얹는 도입 단계 (ADR 후보 포함) 까지 다룬다.

---

## 1. 한 줄 핵심

> **GitOps = "git 이 production 의 single source of truth + 클러스터 안 에이전트가 pull + drift 자동 수정."**
>
> 4 원칙: (1) Declarative (선언적), (2) Versioned & Immutable (git 보관), (3) Pulled automatically (에이전트 pull), (4) Continuously reconciled (drift 자동 수렴). 핵심 효과: **자격증명 위치 역전** (CI 에 클러스터 자격증명 줄 필요 없음, 에이전트가 cluster 안에 있음), **rollback = git revert**, **PR 기반 변경 추적**. 단점: secret 관리가 별개 도구 필요 (Sealed Secrets / SOPS / External Secrets / Vault) + non-K8s 자원 (DNS / 외부 API key) 동기화는 별도 도구.

---

## 2. 등장 배경 — 왜 ApplicationSet / Sync Wave 가 필요한가

### 2-1. 단일 Application 의 한계

§12 의 기본 패턴:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: commerce-prod, namespace: argocd }
spec:
  source: { repoURL: ..., path: k8s/overlays/prod-k8s, targetRevision: main }
  destination: { server: https://kubernetes.default.svc, namespace: commerce }
  syncPolicy: { automated: { prune: true, selfHeal: true } }
```

**한계**:
1. 환경이 늘면 (`prod-k8s`, `k3s-lite`, `staging`, `dev`) Application 매니페스트를 N개 복붙.
2. 클러스터가 늘면 (us-east, eu-west, ap-northeast) Application 을 클러스터별로 또 복붙.
3. 신규 서비스 추가 시 (msa 는 18+ 서비스) 사람이 Application 매니페스트를 손으로 추가.

→ **"Application 자체의 매니페스트도 동적 생성하고 싶다"** = ApplicationSet.

### 2-2. 의존성 무지의 사고 시나리오

```
[순서 무시 sync]
  Argo CD 가 동시에 모두 apply
    ├── cert-manager Deployment
    ├── Issuer (cert-manager CRD 필요)
    ├── Certificate (cert-manager CRD 필요)
    ├── Sealed Secret CR (sealed-secrets controller CRD 필요)
    ├── Secret (Sealed Secret 복호화 결과)
    ├── Deployment (Secret 참조)
    └── Ingress (Certificate 참조)

  → CRD 가 controller 보다 먼저 들어와야 → 일부 CR 이 "no matches for kind" 에러
  → controller 가 Secret 만들기 전에 Deployment 가 시작 → CrashLoopBackoff
```

**해결**: Sync Wave 로 명시적 순서 강제.

### 2-3. Image tag 변경 흐름의 문제

```
[수동 흐름]
  CI: docker build → registry push → tag = v1.2.3
  사람: git 의 manifest.yaml 의 image: tag 를 v1.2.3 으로 직접 수정 → PR → merge
  Argo CD: git pull → apply

  → 사람이 PR 만드는 단계가 병목.
```

**해결**: Argo CD Image Updater (또는 Flux Image Automation) 가 registry watch → 자동 PR.

### 2-4. Multi-cluster 의 표준화 문제

msa 가 (가상으로) 글로벌 확장 시:

```
us-east-1 cluster — 미국 사용자 트래픽
eu-west-1 cluster — 유럽 사용자 트래픽
ap-northeast-1 cluster — 한국 사용자 트래픽

각 클러스터에 같은 manifest 적용 — 클러스터별 차이는 minimal (DNS / TLS cert 호스트만)
```

→ 클러스터별 Argo CD 인스턴스 N개 vs 중앙 hub Argo CD 1개 — 어떤 모델?

---

## 3. ApplicationSet — 동적 Application 생성

### 3-1. 4 generator 비교

| Generator | 입력 | 사용 케이스 |
|---|---|---|
| **List** | 명시적 list | 환경 3-4개 고정 (dev/staging/prod) |
| **Cluster** | Argo CD 에 등록된 모든 cluster | multi-cluster 동일 manifest |
| **Git (directories)** | git repo 의 디렉토리 목록 | 디렉토리 = 환경 / 클러스터 |
| **Git (files)** | git repo 의 파일 목록 (json/yaml) | 파일 = 환경별 변수 |
| **Matrix** | 다른 generator 들의 cartesian product | 환경 × 클러스터 |
| **Merge** | 다른 generator 들의 inner join | 키로 결합 |
| **Pull Request** | GitHub/GitLab PR 목록 | PR per preview 환경 |
| **SCM Provider** | GitHub/GitLab repo 목록 | 멀티 repo 자동 등록 |

### 3-2. List Generator — 가장 단순

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata: { name: commerce-environments }
spec:
  generators:
    - list:
        elements:
          - env: prod
            cluster: https://kubernetes.default.svc
            namespace: commerce
          - env: staging
            cluster: https://kubernetes.default.svc
            namespace: commerce-staging
  template:
    metadata:
      name: 'commerce-{{env}}'
    spec:
      source:
        repoURL: https://github.com/commerce/msa
        path: 'k8s/overlays/{{env}}'
        targetRevision: main
      destination:
        server: '{{cluster}}'
        namespace: '{{namespace}}'
      syncPolicy:
        automated: { prune: true, selfHeal: true }
```

→ 1개 ApplicationSet 이 2개 Application (`commerce-prod`, `commerce-staging`) 생성.

### 3-3. Cluster Generator — 모든 클러스터에 자동 적용

```yaml
spec:
  generators:
    - clusters:
        selector:
          matchLabels:
            env: prod      # cluster 의 label 로 필터링
  template:
    metadata:
      name: 'commerce-{{name}}'
    spec:
      source:
        repoURL: https://github.com/commerce/msa
        path: 'k8s/overlays/prod-k8s'
      destination:
        server: '{{server}}'
        namespace: commerce
```

→ Argo CD 에 `env=prod` 라벨 붙은 cluster 가 N개면 N개 Application 자동 생성. 새 cluster 추가 시 ApplicationSet 매니페스트 변경 ❌ — cluster registration 만으로 자동.

### 3-4. Git Directories Generator — msa 에 가장 적합

```yaml
spec:
  generators:
    - git:
        repoURL: https://github.com/commerce/msa
        revision: main
        directories:
          - path: k8s/overlays/*    # k3s-lite / prod-k8s / (향후 staging)
  template:
    metadata:
      name: 'commerce-{{path.basename}}'   # commerce-k3s-lite, commerce-prod-k8s
    spec:
      source:
        repoURL: https://github.com/commerce/msa
        path: '{{path}}'
        targetRevision: main
      destination:
        server: 'https://kubernetes.default.svc'
        namespace: commerce
      syncPolicy:
        automated: { prune: true, selfHeal: true }
```

**핵심 효과**: 새 overlay (예: `staging-k8s`) 디렉토리 추가만으로 Application 자동 생성. msa 의 `k8s/overlays/` 폴더 분리 패턴과 완벽히 매핑.

### 3-5. Matrix Generator — 환경 × 클러스터

```yaml
spec:
  generators:
    - matrix:
        generators:
          - clusters:
              selector: { matchLabels: { env: prod } }    # cluster 1: us-east, cluster 2: eu-west
          - list:
              elements:
                - app: commerce-platform
                - app: monitoring
                - app: ingress
  template:
    metadata: { name: '{{name}}-{{app}}' }
    ...
```

→ 2 cluster × 3 app = 6 Application 자동 생성. msa 가 multi-cluster 도입 시 패턴.

### 3-6. msa 적용 — `k8s/overlays/*` directories generator

```
[현재]
  k8s/overlays/k3s-lite/    — 로컬 k3d
  k8s/overlays/prod-k8s/    — managed K8s

[ApplicationSet 도입 후]
  argocd/applicationsets/commerce-overlays.yaml   — generator: git directories: k8s/overlays/*
    → 자동 생성: commerce-k3s-lite Application + commerce-prod-k8s Application

[향후 staging 추가 시]
  k8s/overlays/staging-k8s/  — 디렉토리만 추가
    → 자동으로 commerce-staging-k8s Application 생성됨 (사람이 Application 매니페스트 작성 X)
```

---

## 4. Sync Wave / Hooks — 의존성 그래프 표현

### 4-1. Sync Wave — 작은 값이 먼저

```yaml
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "-1"   # 음수도 허용. 작을수록 먼저
```

**표준 wave 설계** (CRD-controller-CR 패턴):

| Wave | 의미 | 예시 |
|---|---|---|
| **-2** | CRD 만 (extension API 등록) | cert-manager CRDs, sealed-secrets CRDs, Strimzi CRDs |
| **-1** | Operator / controller pod | cert-manager controller, sealed-secrets controller, Strimzi operator |
| **0** | Operator 가 watch 하는 CR + Namespace + Secret | ClusterIssuer, SealedSecret, Kafka, Elasticsearch |
| **1** | 일반 워크로드 (CR 결과로 만든 Secret 참조) | Deployment, StatefulSet, Service |
| **2** | Ingress / Route (Certificate 참조) | Ingress |
| **10+** | post-sync 검증 / 알림 hook | smoke test Job, Slack 알림 |

### 4-2. Hooks — Sync 흐름의 stage

```yaml
metadata:
  annotations:
    argocd.argoproj.io/hook: PreSync       # Sync 전
    argocd.argoproj.io/hook: Sync          # Sync 중 (default — 일반 자원)
    argocd.argoproj.io/hook: PostSync      # Sync 성공 후
    argocd.argoproj.io/hook: SyncFail      # Sync 실패 시 (cleanup)
    argocd.argoproj.io/hook-delete-policy: HookSucceeded   # 성공 시 삭제
                                              | HookFailed
                                              | BeforeHookCreation
```

### 4-3. PreSync — DB 마이그레이션 표준 패턴

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: order-flyway-migrate
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded   # 성공 후 자동 삭제
    argocd.argoproj.io/sync-wave: "0"
spec:
  template:
    spec:
      containers:
        - name: flyway
          image: commerce/order:v1.2.3
          command: ["java", "-jar", "/app.jar", "--spring.flyway.migrate=true", "--spring.main.web-application-type=none"]
      restartPolicy: Never
  backoffLimit: 0
```

→ PreSync 가 성공해야 다음 Sync (Deployment) 진행. 마이그레이션 실패 시 Sync 전체 abort.

### 4-4. PostSync — smoke test

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: gateway-smoke-test
  annotations:
    argocd.argoproj.io/hook: PostSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      containers:
        - name: curl
          image: curlimages/curl:8
          command: ["sh", "-c"]
          args:
            - |
              set -e
              curl -fs http://gateway/actuator/health | grep '"status":"UP"'
              curl -fs http://gateway/api/v1/products?size=1 | grep '"code"'
      restartPolicy: Never
  backoffLimit: 0
```

→ PostSync 실패 시 Application status 가 Degraded → Slack 알림 → 사람이 결정 (auto-rollback 은 §20 의 Argo Rollouts 영역).

### 4-5. SyncFail — cleanup hook

```yaml
metadata:
  annotations:
    argocd.argoproj.io/hook: SyncFail
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
```

→ Sync 실패 시 cleanup Job 실행 (예: 부분 적용된 자원 정리).

### 4-6. msa wave 설계안

```
Wave -2:  cert-manager CRDs / sealed-secrets CRDs / Strimzi CRDs (k8s/infra/prod/ Operator CRDs)
Wave -1:  Operator pods (cert-manager controller, sealed-secrets controller, strimzi-cluster-operator,
            percona-operator, eck-operator, opensearch-operator, altinity-operator, prometheus-operator)
Wave 0:   ClusterIssuer / Namespace / SealedSecret / Kafka / KafkaTopic / KafkaUser /
            Elasticsearch / OpenSearchCluster / PerconaServerMySQL / ClickHouseInstallation
Wave 1:   commerce 서비스 18종 Deployment + Service + ConfigMap (k8s/base/)
Wave 2:   Ingress (gateway), HPA, PDB, NetworkPolicy
Wave 10:  smoke test Job (PostSync hook)
```

**효과**:
- 클러스터 0 부터 풀 부트스트랩 시 30분 안에 commerce 전체 가동.
- DR (Disaster Recovery, 재해 복구) 시 새 클러스터에서 동일한 wave 순서로 복구.

---

## 5. Sync Policy 심화 — auto-sync / self-heal / prune / retry

### 5-1. 4 옵션 매트릭스

```yaml
syncPolicy:
  automated:
    prune:    true      # git 에서 사라진 리소스 자동 삭제
    selfHeal: true      # drift 자동 복구
  syncOptions:
    - CreateNamespace=true
    - ServerSideApply=true
    - ApplyOutOfSyncOnly=true
    - PrunePropagationPolicy=foreground
  retry:
    limit: 3
    backoff: { duration: 5s, factor: 2, maxDuration: 1m }
```

| 옵션 | 의미 | Tier 권장 |
|---|---|---|
| `automated.prune: true` | git 에서 제거된 리소스 자동 cluster 에서 삭제 | 모든 환경 |
| `automated.selfHeal: true` | drift 자동 복구 (kubectl edit 무효화) | Tier 1 (prod) |
| `automated.selfHeal: false` | drift 표시만 (사람이 결정) | dev / staging |
| `CreateNamespace=true` | namespace 자동 생성 | 모든 환경 |
| `ServerSideApply=true` | strategic merge → SSA (field manager 분리) | 권장 표준 |
| `ApplyOutOfSyncOnly=true` | 변경된 리소스만 apply (apply 폭주 방지) | 큰 application |

### 5-2. Self-heal 의 동작

```
git: replicas: 2
cluster: 누가 kubectl scale --replicas=5

Argo CD watch:
   git.replicas (2) ≠ cluster.replicas (5)
   ↓
   selfHeal: true 면 자동으로 cluster 를 2로 patch
   ↓
   selfHeal: false 면 OutOfSync 표시만
```

**Tier 정책**:
- Tier 1 (gateway / order / payment) — `selfHeal: true` (drift 절대 금지)
- Tier 2 (search / product) — `selfHeal: true` 권장
- Tier 3 (analytics / search-consumer) — `selfHeal: false` 도 OK (디버깅 시 임시 변경 허용)
- dev / staging — `selfHeal: false` (PoC 친화)

### 5-3. Prune 의 함정

```yaml
prune: true
```

→ git 에서 manifest 파일 삭제 = cluster 에서도 즉시 삭제.

**위험 시나리오**:
1. git 의 PVC manifest 를 실수로 삭제 → cluster 의 PVC 도 삭제 → 데이터 영구 손실.
2. namespace 매니페스트 삭제 → cascading delete.

**완화책**:
1. `Prune=false` annotation 으로 특정 리소스 보호:
   ```yaml
   metadata:
     annotations:
       argocd.argoproj.io/sync-options: Prune=false
   ```
2. Prune 시 finalizer (PVC 의 `kubernetes.io/pvc-protection`) 가 자식 자원 보호.
3. Tier 1 의 PVC / StatefulSet 은 명시적으로 prune 제외.

### 5-4. Retry — 일시 실패 회복

```yaml
retry:
  limit: 3
  backoff: { duration: 5s, factor: 2, maxDuration: 1m }
```

→ 5s → 10s → 20s 백오프. 3회 실패 시 사람 알림.

---

## 6. Drift Detection 의 4 상태

### 6-1. OutOfSync 의 분류

```yaml
status:
  sync:
    status: OutOfSync          # Synced | OutOfSync | Unknown
    revision: abc123def
  health:
    status: Healthy             # Healthy | Progressing | Degraded | Suspended | Missing
```

```
[OutOfSync 의 4 케이스]
1. spec.replicas 변경     — 단순 drift, selfHeal 가능
2. CRD 가 사라짐          — Operator 가 die → 모든 CR 도 사라질 위험
3. 누가 manifest 추가      — git 에 없는 리소스 (prune 로 청소)
4. 누가 label 변경        — annotation drift (보통 무시 가능)
```

### 6-2. ignoreDifferences — 의도적 무시

```yaml
spec:
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas              # HPA 가 관리, Argo CD 는 무시
    - group: ""
      kind: Service
      jsonPointers:
        - /spec/clusterIP             # K8s 가 자동 할당
```

→ HPA 가 `replicas` 를 동적 변경하는데 Argo CD 가 매번 git 의 값으로 되돌리면 HPA 와 다툼. `ignoreDifferences` 로 회피.

### 6-3. Server-Side Apply (SSA) 의 field manager

```yaml
syncOptions:
  - ServerSideApply=true
```

→ Argo CD 가 `argocd-controller` 라는 field manager 로 SSA. HPA 는 `hpa-controller` 라는 다른 field manager. 같은 필드를 두 manager 가 다투면 conflict 명시.

→ SSA 가 strategic merge 보다 안전 — field ownership 명시화.

---

## 7. Image Updater — tag 자동 갱신

### 7-1. 흐름 비교

```
[수동 흐름]
  CI: build → registry push → tag = v1.2.3
  사람: PR (manifest 의 tag 변경) → review → merge
  Argo CD: pull → apply

[Image Updater 흐름]
  CI: build → registry push → tag = v1.2.3
  Argo CD Image Updater (cluster 안):
      registry watch → 새 tag 감지
      → write-back: git PR (또는 in-place commit)
  Argo CD: pull → apply
```

### 7-2. Annotation 기반 설정

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: commerce-prod
  annotations:
    argocd-image-updater.argoproj.io/image-list: |
      gateway=registry.commerce.example.com/gateway,
      product=registry.commerce.example.com/product,
      order=registry.commerce.example.com/order
    argocd-image-updater.argoproj.io/gateway.update-strategy: semver
    argocd-image-updater.argoproj.io/gateway.allow-tags: "regexp:^v[0-9]+\\.[0-9]+\\.[0-9]+$"
    argocd-image-updater.argoproj.io/write-back-method: git
    argocd-image-updater.argoproj.io/write-back-target: kustomization
spec: ...
```

| update-strategy | 의미 |
|---|---|
| `semver` | semantic version, 가장 큰 정렬 |
| `latest` | timestamp 가장 최근 |
| `digest` | mutable tag (latest) 의 SHA 변경 감지 |
| `name` | alphabetical sort |

### 7-3. write-back 모드

| 모드 | 동작 | 장점 | 단점 |
|---|---|---|---|
| `argocd` | in-memory only (Application override) | 가장 빠름 | git 과 cluster drift |
| `git` (commit) | git 에 직접 commit | git 이 SoT (Source of Truth) 유지 | review 우회 |
| `git` (PR via webhook) | PR 생성 → review → merge | review 보장 | latency |

**권장 패턴**: prod = `git` PR + 자동 review bypass (label `auto-merge`); dev = `argocd` (빠른 iteration).

### 7-4. Flux 의 Image Automation 비교

```yaml
# Flux Image Reflector + Image Automation
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata: { name: gateway }
spec:
  image: registry.commerce.example.com/gateway
  interval: 1m
---
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata: { name: gateway }
spec:
  imageRepositoryRef: { name: gateway }
  policy:
    semver: { range: '>=1.2.0 <2.0.0' }
---
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageUpdateAutomation
metadata: { name: commerce-image-update }
spec:
  sourceRef: { kind: GitRepository, name: msa }
  git:
    commit:
      author: { name: flux-bot, email: flux@commerce.example.com }
      messageTemplate: 'chore: update {{.AutomationObject.Namespace}} images'
    push: { branch: main }
  update: { strategy: Setters }
```

→ Flux 가 더 declarative + CR 별 분리. Argo CD Image Updater 가 더 단순 (annotation 기반).

---

## 8. Multi-cluster GitOps — Hub vs Per-cluster

### 8-1. 두 모델 비교

```
[Hub-and-Spoke]
                 ┌──────────────────────┐
                 │  Hub Argo CD         │
                 │  (control cluster)   │
                 └──────┬───────────────┘
                        │ push (kubeconfig)
            ┌───────────┼───────────┐
            ▼           ▼           ▼
       cluster-A   cluster-B   cluster-C
       (workload)  (workload)  (workload)

장점: 운영 통일 / 단일 UI / 하나의 RBAC
단점: hub 장애 = 모든 cluster GitOps 멈춤 / hub 의 자격증명 보안 부담

[Per-cluster Argo CD]
       cluster-A          cluster-B          cluster-C
       ┌──────┐           ┌──────┐           ┌──────┐
       │Argo  │           │Argo  │           │Argo  │
       │+ wkl │           │+ wkl │           │+ wkl │
       └──────┘           └──────┘           └──────┘

장점: cluster 격리 / hub 단일 장애점 X
단점: N개 UI / N개 RBAC / 운영 복잡
```

### 8-2. 권장 — 작을 땐 Hub, 클 땐 Per-cluster

| cluster 수 | 권장 모델 |
|---|---|
| 1-3개 | Hub (단순) |
| 4-10개 | Hub + ApplicationSet cluster generator |
| 10+ 또는 cluster 격리 강제 | Per-cluster Argo CD + 중앙 root repo |

### 8-3. msa 의 현 상황 + 미래

- 현재: 1 cluster (k3s-lite 로컬 + prod-k8s 1개) → Hub 로 충분.
- 미래 (가상 글로벌 확장): 3 region cluster → Hub + ApplicationSet cluster generator.

---

## 9. Secret 관리 — GitOps 의 가장 큰 숙제

> **§12 §6 의 4 옵션 (Sealed Secrets / SOPS / ESO / Vault) 요약 + msa 컨텍스트**.

### 9-1. 4 옵션 트레이드오프

| 옵션 | git 안 secret 형태 | 키 회전 | 멀티 cluster | 학습 곡선 | msa 위치 |
|---|---|---|---|---|---|
| **Sealed Secrets** | 암호문 (cluster 키로만 풀림) | 수동 재암호화 | 클러스터마다 따로 | 낮음 | 현재 채택 (`k8s/infra/prod/sealed-secrets/`) |
| **SOPS** | KMS 암호문 | KMS 위임 | KMS 공유 | 중간 | (도입 안 함) |
| **External Secrets Operator (ESO)** | 참조만 (실제 값은 cloud secret store) | 자동 (cloud 측 회전 자동 반영) | cloud 단일 | 중간 | 권장 다음 단계 |
| **Vault** | 참조만 (Vault 에서 dynamic) | 자동 + dynamic secret | Vault 단일 | 높음 | 미래 후보 |

### 9-2. 키 회전 — 가장 큰 차이점

```
[Sealed Secrets]
  cluster A: 키쌍 K_A
  cluster B: 키쌍 K_B
  → SealedSecret 은 클러스터별 암호화. cluster 이전 시 재암호화 필요.
  → K_A 회전 시 모든 SealedSecret 재암호화 (수동 또는 controller 의 batch resealing).

[ESO]
  AWS Secrets Manager: 평문 secret + 자체 회전 정책
  ESO: 1시간마다 fetch → K8s Secret 갱신
  → 회전 = 클라우드 콘솔에서 → 자동 반영 (ROI 가장 높음).
```

→ **장기 권장**: ESO + cloud secrets manager (AWS / GCP / OCI Vault). msa 의 ADR-0027 (OCI Vault KEK) 와 자연스럽게 통합.

### 9-3. ESO 도입 단계 (msa 컨텍스트)

```yaml
# Phase 1: ClusterSecretStore 등록 — IRSA / Workload Identity 로 IAM 위임
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata: { name: aws-secretsmanager }
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt: { serviceAccountRef: { name: external-secrets, namespace: external-secrets } }
---
# Phase 2: 서비스별 ExternalSecret
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata: { name: gateway-jwt-key, namespace: commerce }
spec:
  refreshInterval: 1h
  secretStoreRef: { name: aws-secretsmanager, kind: ClusterSecretStore }
  target: { name: gateway-secret }     # 결과 K8s Secret 이름
  data:
    - secretKey: jwt-key
      remoteRef: { key: prod/gateway/jwt-key }
    - secretKey: oauth-client-secret
      remoteRef: { key: prod/gateway/oauth-client-secret }
```

→ ESO controller 가 1h 주기 fetch → 클라우드 콘솔에서 회전 → 1h 안에 자동 반영.

---

## 10. Argo CD vs Flux v2 — 한 표 비교

| 항목 | Argo CD | Flux v2 |
|---|---|---|
| UI | 풍부 (web) | 미니멀 (CLI 위주, Weave GitOps Enterprise 별도) |
| 모델 | Application 1개 객체 | GitRepository + Kustomization (분리) |
| 동적 application 생성 | ApplicationSet (1 CRD) | Tenant + GitRepository + Kustomization 조합 |
| Helm 통합 | helm controller 내장 | HelmRelease (별도 controller) |
| Image automation | Image Updater (annotation) | Image Reflector + Image Automation (CRD) |
| Notification | argocd-notifications-cm (별도 controller) | notification controller 내장 |
| Multi-tenancy | AppProject + RBAC | Tenant CRD + Flux 인스턴스 분리 |
| 한국 대기업 도입 | 우세 (UI 친화) | 보조적 |
| K8s SIG 호환성 | 둘 다 CNCF Graduated |
| 학습 곡선 | UI 로 진입 쉬움 | CLI 익숙해야 함 |

**선택 기준**:
- 운영팀이 UI 친화적 → Argo CD.
- 모든 게 declarative CR + GitOps native → Flux.
- msa 권장: **Argo CD** — UI / ApplicationSet / Image Updater / Notifications / Rollouts 통합이 더 일관.

---

## 11. msa 적용 — `k8s/overlays/*` 에 GitOps 도입

### 11-1. 현재 (Argo CD 미도입)

- 변경 적용은 사람이 `kubectl apply -k k8s/overlays/prod-k8s`.
- Sealed Secrets 폴더만 존재 (`k8s/infra/prod/sealed-secrets/`), 실제 sealing 은 placeholder.
- drift detection 없음 — 누가 `kubectl edit` 하면 영구 drift.

### 11-2. 도입 단계 (Phase plan)

```
Phase 1 (1주): Argo CD 설치 + self-managing
  helm install argocd argo/argo-cd --namespace argocd
  argocd/bootstrap/argocd-self.yaml — root Application 이 argocd 자체를 git 에서 sync
  → 이후 argocd 설정 변경도 git PR.

Phase 2 (1주): Application of Apps + ApplicationSet
  argocd/applicationsets/commerce-overlays.yaml
    generator: git directories → k8s/overlays/*
    → commerce-k3s-lite + commerce-prod-k8s 자동 생성
  argocd/applicationsets/commerce-infra.yaml
    generator: list (cert-manager / sealed-secrets / strimzi / eck / percona / opensearch / clickhouse / monitoring)
    → infra Operator 들 자동 등록

Phase 3 (1주): Sync Wave 정비
  k8s/infra/prod/ 의 모든 매니페스트에 sync-wave annotation 추가
  CRD: -2, Operator: -1, CR: 0, Workload: 1, Ingress: 2, smoke test: 10

Phase 4 (1주): Self-heal Tier 1 enable
  selfHeal: true 를 gateway / order / payment 부터 단계 적용
  drift 알림 Slack 연동

Phase 5 (1-2주): Image Updater
  registry watch → semver 정책 → write-back: git PR
  prod 는 PR + 사람 review, dev 는 in-place commit

Phase 6 (2-3주): External Secrets Operator
  k8s/infra/prod/external-secrets/ 추가
  ClusterSecretStore (AWS / GCP / OCI Vault) 등록
  서비스별 ExternalSecret 으로 점진 마이그레이션 (Sealed Secrets → ESO)
  JWT key, DB password, OCI Vault token 부터

Phase 7 (1주): smoke test PostSync hook
  k8s/base/smoke-test/ 추가 — gateway health + 핵심 API 검증 Job
```

### 11-3. ApplicationSet 디렉토리 구조 (제안)

```
msa/
├── argocd/
│   ├── bootstrap/
│   │   └── argocd-self.yaml          # Argo CD self-managing root Application
│   ├── applicationsets/
│   │   ├── commerce-overlays.yaml     # k8s/overlays/* directories generator
│   │   ├── commerce-infra.yaml        # k8s/infra/prod/{cert-manager,sealed-secrets,...}
│   │   └── commerce-image-updater.yaml # 18개 service 의 image annotation 모음
│   ├── projects/
│   │   ├── commerce.yaml              # AppProject — RBAC + 리포 제한
│   │   └── infra.yaml
│   └── notifications/
│       └── slack.yaml
├── k8s/
│   ├── base/                          # (기존)
│   ├── infra/                         # (기존)
│   └── overlays/                      # (기존)
```

### 11-4. AppProject 로 RBAC 분리

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata: { name: commerce, namespace: argocd }
spec:
  description: "Commerce platform applications"
  sourceRepos:
    - https://github.com/commerce/msa
  destinations:
    - server: '*'
      namespace: 'commerce*'             # commerce / commerce-staging / commerce-system
  clusterResourceWhitelist:
    - { group: '', kind: Namespace }
    - { group: 'apiextensions.k8s.io', kind: CustomResourceDefinition }
  namespaceResourceWhitelist:
    - { group: '*', kind: '*' }
  roles:
    - name: dev
      policies:
        - p, proj:commerce:dev, applications, sync, commerce/*, allow
        - p, proj:commerce:dev, applications, get,  commerce/*, allow
      groups:
        - commerce:dev
    - name: ops
      policies:
        - p, proj:commerce:ops, applications, *, commerce/*, allow
      groups:
        - commerce:ops
```

→ dev 는 sync 만, ops 는 모든 권한. SSO (Single Sign-On, 단일 로그인) group claim 으로 매핑.

---

## 12. 트레이드오프 / 함정

### 12-1. Sync Wave 의존성 모름

```yaml
# 잘못된 패턴
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "0"   # CRD 도 0, Operator 도 0
```

→ apply 순서가 불확정 → "no matches for kind" 에러 발생 → retry 로 결국 회복하지만 첫 apply latency ↑.

**원칙**: CRD = -2, Operator = -1, CR = 0 의 표준 wave 항상 유지.

### 12-2. Self-heal 의 amplification

```
- HPA 가 replicas=5 로 변경 (CPU 부하)
- Argo CD selfHeal: true → replicas=2 (git 값) 으로 되돌림
- HPA 가 다시 replicas=5
- Argo CD 또 되돌림
→ 무한 toggle → CPU 부하 → HPA 가 더 많이 scale up → 자원 폭주
```

**해결**: `ignoreDifferences` 로 `/spec/replicas` 무시 + HPA 도입 시 항상 함께 설정.

### 12-3. Prune 의 cascade delete

```
git: deleted PVC manifest by mistake
Argo CD: prune: true → cluster PVC 삭제 → 데이터 영구 손실
```

**완화**:
- Stateful 리소스 (PVC / StatefulSet) 는 `Prune=false` annotation.
- Tier 1 namespace 는 별도 AppProject + `prune: false`.
- 위험한 prune 직전 manual confirm 단계 (Argo CD 의 sync window).

### 12-4. ApplicationSet 의 빈 generator

```yaml
generators:
  - clusters: { selector: { matchLabels: { env: prod } } }   # 매칭 없으면 0개 Application
```

→ 초기에 cluster 등록 안 됐으면 0개 Application → 아무 일도 안 일어남 → **silent failure**.

**해결**: `ApplicationSet` status 모니터링 + 알림.

### 12-5. Image Updater 의 무한 PR

```
Image Updater: digest 기반 watch → 매 1분 같은 tag 의 새 digest → 매번 PR
```

→ 보통 mutable tag (latest) 사용 시 발생. **항상 immutable tag (semver) 권장**.

### 12-6. Sync Hook 의 race

```
PreSync Job (DB 마이그레이션) — Sync wave 0
일반 Deployment — Sync wave 1
같은 Application 안에서 wave 가 다르면 OK.
다른 Application 사이의 의존성은 ApplicationSet 으로 표현 못함.
```

**해결**: 의존성 강한 Application 들은 sync-wave 를 맞추거나 (같은 ApplicationSet), Argo Workflows 등 외부 orchestrator 도입.

### 12-7. 자체 Argo CD vs 매니지드

| 옵션 | 비용 | 복잡도 |
|---|---|---|
| 자체 Argo CD (helm install) | $0 인프라 비용 | 운영 비용 ↑ (HA / DR / 업그레이드) |
| Akuity / Codefresh GitOps Cloud | 매니지드 비용 | 운영 비용 ↓ |

→ msa 같은 단일 cluster 면 자체 Argo CD 면 충분. multi-region + 다수 cluster 면 매니지드 검토.

### 12-8. Drift 의 의도된 케이스 무시

```
- 운영 디버깅 시 임시 replicas 증가 → Argo CD selfHeal 즉시 되돌림
- 사람이 패치한 변경이 사라져 디버깅 불가
```

**해결**: dev / staging 은 selfHeal 끄기 + Tier 1 은 켜기. 또는 Sync Window (특정 시간대만 sync) 도입.

---

## 13. ADR 후보 (msa GitOps 도입)

> **ADR-XXXX-B: GitOps 도입 — Argo CD + ApplicationSet + Sync Wave + ESO 단계 마이그레이션**
>
> **Context**: 현재 msa 는 `kubectl apply -k` 수동 적용 — drift 발생 시 감지 불가, rollback 이 git revert + 사람 apply 의 2단계, secret 관리는 SealedSecrets placeholder. multi-cluster / multi-environment 확장 시 운영 비용이 빠르게 증가.
>
> **Decision**:
> 1. **Argo CD 도입** — Hub 모델 (단일 cluster 시작). self-managing root Application.
> 2. **ApplicationSet** — `k8s/overlays/*` directories generator 로 환경별 Application 자동 생성. `k8s/infra/prod/*` list generator 로 Operator 묶음.
> 3. **Sync Wave 표준** — CRD(-2) → Operator(-1) → CR(0) → Workload(1) → Ingress(2) → smoke test(10).
> 4. **Self-heal Tier 정책** — Tier 1 (gateway/order/payment) selfHeal:true, Tier 3 (analytics) selfHeal:false.
> 5. **Image Updater** — semver 정책 + git PR write-back. prod 는 PR + 사람 review, dev 는 in-place.
> 6. **External Secrets Operator** — Phase 6 에서 도입. SealedSecrets → ESO 점진 마이그레이션. JWT key, OCI Vault token 부터.
> 7. **AppProject** — `commerce` (workload) + `infra` (Operator/CRD) 분리. SSO group → role 매핑.
>
> **Consequences**:
> - (+) drift 자동 감지 + 복구.
> - (+) rollback = git revert.
> - (+) PR 기반 변경 추적 + review.
> - (+) 신규 환경 추가가 디렉토리 생성만으로 자동.
> - (-) Argo CD 운영 비용 (HA / DR / 버전 업그레이드).
> - (-) selfHeal 의 무한 toggle 위험 (HPA 와 다툼) — `ignoreDifferences` 필수.
> - (-) Image Updater 의 mutable tag 무한 PR — semver 강제.
>
> **Alternatives 검토**:
> - Flux v2 — 기능 비슷하나 한국 대기업 운영팀 UI 친화도 ↓. 채택 ❌.
> - 매니지드 GitOps (Akuity / Codefresh) — 비용 vs 운영 부담 trade-off. 단일 cluster 면 자체 Argo CD 가 ROI 높음.
> - 수동 `kubectl apply` 유지 — multi-cluster 시 폭증. 채택 ❌.

---

## 14. 면접 한 줄 답변

### Q. GitOps 의 4 원칙은?

> "CNCF (Cloud Native Computing Foundation) 의 정의입니다. 첫째 Declarative — 시스템 desired state 가 선언적으로 표현됨. 둘째 Versioned & Immutable — 그 선언이 git 같은 immutable 저장소에 보관. 셋째 Pulled automatically — 클러스터 안 에이전트가 자동 pull. 넷째 Continuously reconciled — drift 발생 시 desired state 로 자동 수렴. 핵심은 'git 이 production 의 single source of truth'."

### Q. push CD 와 pull GitOps 의 본질적 차이는?

> "자격증명 위치가 역전됩니다. push 모델은 CI 가 클러스터 자격증명을 보유하고 외부에서 push — CI 가 보안 위협 표면이 됩니다. pull 모델은 클러스터 안 에이전트가 git 을 pull 하고 자격증명은 클러스터 안에만 — 외부 노출 0. 부수 효과로 drift 자동 수정과 rollback = git revert 라는 일관성도 얻습니다."

### Q. ApplicationSet 의 generator 4종은?

> "List (명시적 list), Cluster (등록된 모든 cluster), Git directories/files (git repo 의 디렉토리/파일 목록), Matrix (다른 generator 의 cartesian product) 가 핵심입니다. msa 같은 환경 분리 패턴엔 git directories 가 가장 적합 — `k8s/overlays/*` 디렉토리 추가만으로 Application 자동 생성. multi-cluster 면 cluster generator 로 새 cluster 등록 시 자동 매핑."

### Q. Sync Wave 가 왜 필요한가요?

> "CRD → Operator (controller) → CR (Operator 가 watch) → 일반 워크로드 → Ingress → smoke test 의 의존성 그래프가 있습니다. wave 없이 동시 apply 하면 'no matches for kind' 에러나 Pod 가 Secret 못 찾아 CrashLoop 가 발생합니다. msa 표준은 -2 (CRD) / -1 (Operator) / 0 (CR + Namespace + Secret) / 1 (Deployment) / 2 (Ingress) / 10 (smoke test) 입니다."

### Q. selfHeal: true 의 위험은?

> "HPA 가 replicas 를 동적으로 변경하는데 Argo CD 가 매번 git 값으로 되돌리면 무한 toggle 이 발생해서 자원이 폭주합니다. 해결은 `ignoreDifferences` 로 `/spec/replicas` 같은 동적 필드를 무시하는 것입니다. 또 dev/staging 에선 selfHeal 끄고 Tier 1 (gateway/order/payment) 만 켜는 Tier 정책이 표준입니다."

### Q. Image Updater 의 write-back 모드 3종은?

> "argocd (in-memory only) / git commit / git PR 입니다. argocd 는 가장 빠르지만 git 과 cluster 가 drift 합니다. git commit 은 git SoT 유지하지만 review 가 우회됩니다. git PR 이 가장 안전 — review 보장 + git SoT. msa 권장은 prod = PR + 사람 review, dev = argocd 또는 commit (빠른 iteration)."

### Q. Sealed Secrets / SOPS / ESO 의 차이는?

> "Sealed Secrets 는 cluster 키로 암호화 — 단순하지만 키 회전 시 모든 SealedSecret 재암호화 필요. SOPS 는 KMS (Key Management Service) 위임 — KMS 공유 클러스터들끼리 호환 + 키 관리 위임. ESO (External Secrets Operator) 는 cloud secrets manager (AWS / GCP / OCI Vault) 의 참조만 git 에 두고 ESO 가 주기적 fetch — 키 회전이 자동 반영되어 ROI (Return On Investment, 투자 대비 수익) 가 가장 높습니다. msa 는 현재 Sealed Secrets, 다음 단계는 ESO 입니다."

### Q. Argo CD 와 Flux v2 의 핵심 차이는?

> "Argo CD 는 풍부한 UI + Application 1개 객체 모델 — 운영팀 UI 친화. Flux 는 미니멀 CLI + GitRepository/Kustomization/HelmRelease 분리 — declarative 더 native. 한국 대기업 운영팀이 UI 익숙하면 Argo CD, 모든 게 GitOps native CR 이어야 한다면 Flux. 둘 다 CNCF Graduated 이고 핵심 기능은 비슷합니다. msa 는 Argo CD 권장 — ApplicationSet + Image Updater + Rollouts 통합이 더 일관."

### Q. multi-cluster GitOps 의 hub vs per-cluster 모델은?

> "Hub 모델은 control cluster 1개의 Argo CD 가 N개 workload cluster 를 push 모드로 관리 — 단일 UI, 단일 RBAC, 운영 통일. 단점은 hub 단일 장애점 + hub 의 자격증명 보안 부담. Per-cluster 모델은 각 cluster 가 자체 Argo CD — cluster 격리, hub 단일 장애점 X. 단점은 N개 UI + N개 RBAC. cluster 1-3개면 hub, 4-10개면 Hub + ApplicationSet cluster generator, 10+ 또는 격리 강제면 per-cluster."

### Q. msa 가 GitOps 도입한다면 단계는?

> "Phase 1 Argo CD 설치 + self-managing. Phase 2 ApplicationSet — k8s/overlays/* directories generator + k8s/infra/prod/* list generator. Phase 3 Sync wave 정비 (CRD -2 / Operator -1 / CR 0 / Workload 1 / Ingress 2 / smoke 10). Phase 4 selfHeal Tier 정책 (Tier 1 enable). Phase 5 Image Updater (semver + git PR). Phase 6 ESO 도입 (Sealed Secrets → ESO 점진). Phase 7 PostSync smoke test hook. 총 8-10주 1인 풀타임."

---

## 15. 흔한 오해 정정

> **"GitOps 는 모든 자원을 git 에 두면 된다"**

- ❌ secret 은 평문으로 git 에 못 둠. Sealed Secrets / SOPS / ESO 중 하나 필수. non-K8s 자원 (DNS / 외부 API key) 은 별개 도구.

> **"Argo CD 와 Flux 는 호환된다"**

- ❌ 동일 cluster 에 둘 다 두면 같은 자원 다툼. 하나만 선택.

> **"ApplicationSet 만 있으면 Application 안 만들어도 된다"**

- ❌ ApplicationSet 이 Application 을 자동 생성 — 결과적으로 Application CR 이 클러스터에 존재. 단지 사람이 손으로 안 쓸 뿐.

> **"selfHeal: true 가 무조건 좋다"**

- ❌ HPA / VPA 와 다툼. `ignoreDifferences` 필수. dev 환경에선 디버깅 위해 끄기도.

> **"prune: true 는 안전하다"**

- ❌ git 에서 PVC manifest 를 실수로 삭제 → cluster PVC 삭제 → 데이터 손실. Stateful 자원은 `Prune=false` annotation.

> **"Image Updater 는 매번 git PR 이라 안전하다"**

- ⚠ mutable tag (latest) 사용 시 매 분 새 digest → 무한 PR. immutable tag (semver) 강제 + branch 병합 자동화.

> **"hub 모델 Argo CD 가 죽으면 cluster 도 멈춘다"**

- ❌ workload 는 K8s built-in controller (kube-controller-manager) 가 계속 관리. Argo CD 가 죽어도 이미 배포된 자원은 동작. 단지 새 변경 / drift 복구가 멈출 뿐.

> **"ESO 가 도입되면 Sealed Secrets 즉시 제거"**

- ❌ 점진 마이그레이션 권장. 새 secret 부터 ESO 로, 기존은 회전 시점에 ESO 로 전환. 양쪽 controller 가 독립적이라 공존 가능.

---

## 16. 회독 체크리스트

> §19 회독 체크리스트:
> - [ ] GitOps 4 원칙 (Declarative / Versioned / Pulled / Reconciled)
> - [ ] push 와 pull 의 자격증명 위치 역전
> - [ ] ApplicationSet 4 generator (List / Cluster / Git directories / Matrix)
> - [ ] msa 의 git directories generator 매핑 (`k8s/overlays/*`)
> - [ ] Sync wave 표준 (-2 CRD / -1 Operator / 0 CR / 1 Workload / 2 Ingress / 10 smoke)
> - [ ] PreSync / Sync / PostSync / SyncFail 4 hook 의 사용 패턴
> - [ ] PreSync 의 DB 마이그레이션 패턴 (실패 시 Sync 전체 abort)
> - [ ] PostSync 의 smoke test 패턴
> - [ ] selfHeal Tier 정책 (Tier 1 enable, dev/staging disable)
> - [ ] selfHeal × HPA 의 무한 toggle 위험 + `ignoreDifferences` 해결
> - [ ] Prune 의 cascade delete 위험 + Stateful 보호 (`Prune=false`)
> - [ ] Image Updater 의 update-strategy (semver / latest / digest / name)
> - [ ] write-back 3 모드 (argocd / git commit / git PR) 의 trade-off
> - [ ] Sealed Secrets / SOPS / ESO / Vault 의 4 secret 옵션 비교
> - [ ] ESO 의 회전 자동 반영 + IRSA / Workload Identity
> - [ ] hub-and-spoke vs per-cluster Argo CD 의 cluster 수 기준 (1-3 hub, 4-10 hub+ApplicationSet, 10+ per-cluster)
> - [ ] AppProject 의 RBAC + sourceRepos / destinations 제한
> - [ ] Argo CD vs Flux 의 UI / 모델 / 한국 대기업 채택 차이
> - [ ] msa GitOps 도입 7 Phase (Argo CD → ApplicationSet → Sync wave → selfHeal Tier → Image Updater → ESO → smoke test)

---

## 17. 연결 학습

- §11 Helm vs Kustomize — 패키징 (이 파일은 GitOps 가 두 도구를 어떻게 다루는가)
- §12 GitOps 기본 — Application / Sync / drift / Sealed Secrets / SOPS 기본 (이 파일은 ApplicationSet / Sync wave / Image Updater / multi-cluster 심화)
- §18 Operator 패턴 — CRD + Controller (이 파일은 Operator 들을 GitOps 로 어떻게 배포 — Sync wave -2/-1/0)
- §20 (다음) Argo Rollouts — Canary / Blue-Green 자동화 (Argo CD 와 자연스럽게 통합 + AnalysisTemplate 의 GitOps 화)
- §15 msa K8s grep — `k8s/overlays/{k3s-lite,prod-k8s}` 구조 (이 파일은 그 구조에 GitOps 를 얹는 설계)
- §14 K8s 보안 — RBAC / SealedSecrets (이 파일은 AppProject + RBAC + ESO 의 secret governance)
