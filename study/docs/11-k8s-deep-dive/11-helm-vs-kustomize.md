---
parent: 11-k8s-deep-dive
seq: 11
title: Helm vs Kustomize — 패키징 전략 비교
type: deep
created: 2026-05-01
---

# 11. Helm vs Kustomize

## 1. 두 도구가 푸는 같은 문제

> "같은 K8s (Kubernetes) 매니페스트를 환경(dev/stage/prod) 에 따라 조금씩 다르게 적용하기."

해결 방향:
- **Helm** — Go template 으로 변수 치환 + 함수 + 조건부 (Sprig). 패키지(차트) 단위 배포.
- **Kustomize** — 순수 YAML + overlay patch (strategic merge / json6902). 템플릿 없음.

ADR-0019 §3 에서 msa 는 **Kustomize 를 채택**했다. 이유는 그곳에 정리되어 있다 — 본 문서는 두 도구의 mechanics 를 면접 + 실무 양쪽에서 깊게.

## 2. Helm 의 구조

### Chart 디렉토리

```
mychart/
├── Chart.yaml             # 메타: name, version, appVersion, dependencies
├── values.yaml            # 기본 변수
├── values-prod.yaml       # 환경별 override (관행)
├── templates/
│   ├── _helpers.tpl       # 공통 함수 정의
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── hpa.yaml
│   └── NOTES.txt          # install 후 사용자에게 보여줄 메시지
├── charts/                # 의존 차트 (helm dependency update)
└── crds/                  # CRD YAML (template 처리 안 됨)
```

### Chart.yaml

```yaml
apiVersion: v2
name: gateway
description: Commerce gateway service
type: application
version: 0.3.0           # 차트 버전
appVersion: "1.5.0"      # 앱 버전 (image tag 등)
dependencies:
  - name: redis
    version: "18.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

### values.yaml + template

```yaml
# values.yaml
replicaCount: 2
image:
  repository: commerce/gateway
  tag: latest
  pullPolicy: IfNotPresent
service:
  type: ClusterIP
  port: 8080
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: api.commerce.example.com
      paths: [{ path: /, pathType: Prefix }]
  tls:
    - hosts: [api.commerce.example.com]
      secretName: gateway-tls
resources:
  requests: { cpu: 100m, memory: 512Mi }
  limits: { memory: 1Gi }
```

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "gateway.fullname" . }}
  labels: {{- include "gateway.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels: {{- include "gateway.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels: {{- include "gateway.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: app
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - { name: http, containerPort: {{ .Values.service.port }} }
          {{- with .Values.resources }}
          resources: {{- toYaml . | nindent 12 }}
          {{- end }}
          {{- if .Values.metrics.enabled }}
          env:
            - { name: METRICS_ENABLED, value: "true" }
          {{- end }}
```

### _helpers.tpl

```
{{/* fullname: 길이 제한 53 + release prefix */}}
{{- define "gateway.fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "gateway.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}
```

### 설치 / 업그레이드

```bash
helm install gateway ./mychart -n commerce -f values-prod.yaml
helm upgrade --install gateway ./mychart -n commerce -f values-prod.yaml \
    --set image.tag=1.5.1
helm rollback gateway 1
helm uninstall gateway
```

Helm 은 **Release** 단위로 상태 관리 (Secret 으로 클러스터에 저장):
```bash
kubectl get secret -n commerce -l owner=helm
helm history gateway -n commerce
```

### Hooks

```yaml
# templates/db-migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
spec: ...
```

훅 종류: `pre-install / post-install / pre-upgrade / post-upgrade / pre-delete / post-delete / pre-rollback / post-rollback / test`. DB 마이그레이션, 초기 데이터 로딩 등에 자주 사용.

## 3. Helm 의 장점

1. **변수 + 함수 + 조건부** — 복잡한 분기 표현 강력
2. **의존성 (subchart)** — Bitnami / 인프라 차트를 dependency 로 끌어올 수 있음
3. **Release 추적** — install/upgrade/rollback history
4. **CRD 와 인프라 차트 생태계** — Strimzi, Percona, kube-prometheus-stack 등 거의 모든 운영 도구가 Helm 차트 제공
5. **Hooks** — 배포 단계에 코드 끼워넣기

## 4. Helm 의 단점

1. **템플릿이 YAML 이 아님** — `{{ }}` 가 들어간 텍스트. linter / IDE 지원 떨어짐
2. **Whitespace 지옥** — `{{-` / `-}}` 의 공백 제어가 직관적이지 않음
3. **diff 가 어려움** — `helm template` 으로 렌더링 후 비교해야 함 (`helm diff` plugin 으로 보완)
4. **CRD 의 lifecycle** — `crds/` 폴더의 CRD 는 template 처리 X, 또 helm 이 업그레이드 안 함 (의도적)
5. **values 파편화** — values-prod, values-stage, values-eu, ... 가 늘어나면 fat tail
6. **복잡한 차트 작성 곡선** — 재사용 차트(Library Chart) 까지 가면 학습 비용 큼

## 5. Kustomize 의 구조

### 디렉토리

```
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
└── overlays/
    ├── dev/
    │   ├── kustomization.yaml
    │   └── patches/
    └── prod/
        ├── kustomization.yaml
        └── patches/
            ├── replicas.yaml
            ├── resources.yaml
            └── ingress-tls.yaml
```

### base/kustomization.yaml

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: commerce
resources:
  - deployment.yaml
  - service.yaml
  - ingress.yaml
commonLabels:
  app.kubernetes.io/name: gateway
  app.kubernetes.io/part-of: commerce-platform
configMapGenerator:
  - name: gateway-config
    files: [application.yml]
secretGenerator:
  - name: gateway-secret
    envs: [.env.secret]
images:
  - name: commerce/gateway
    newTag: 1.5.0
```

### overlays/prod/kustomization.yaml

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
  - hpa.yaml
  - pdb.yaml
patches:
  - path: patches/replicas.yaml
    target: { kind: Deployment, labelSelector: "app.kubernetes.io/part-of=commerce-platform" }
  - path: patches/resources.yaml
    target: { kind: Deployment, labelSelector: "app.kubernetes.io/part-of=commerce-platform" }
  - path: patches/ingress-tls.yaml
    target: { kind: Ingress, name: gateway }
images:
  - name: commerce/gateway
    newTag: 1.5.1
```

### Patch 종류 2가지

#### A. Strategic Merge Patch (기본)

```yaml
# patches/replicas.yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: placeholder }   # target selector 가 매칭
spec:
  replicas: 4
```

→ Deployment 의 `replicas` 만 4로 덮어씀. 다른 필드는 base 그대로.

#### B. JSON Patch (RFC 6902)

```yaml
- op: replace
  path: /spec/template/spec/containers/0/image
  value: commerce/gateway:1.5.1
- op: add
  path: /spec/template/spec/containers/0/env/-
  value: { name: NEW_FLAG, value: "true" }
```

배열 요소 정확 제어 필요 시 (e.g. 컨테이너 환경변수 N번째에 추가).

### configMapGenerator / secretGenerator

```yaml
configMapGenerator:
  - name: gateway-config
    files: [application.yml]
```

→ ConfigMap 이름이 `gateway-config-<hash>` 로 자동 suffix → ConfigMap 변경 시 hash 변경 → Deployment template 안의 `valueFrom.configMapKeyRef.name` 도 자동으로 새 이름 → **Deployment template 변경 → 새 ReplicaSet → Pod 재시작** (자동 reload).

이 동작이 Helm 에는 없는 큰 장점.

## 6. Kustomize 의 장점

1. **순수 YAML** — IDE 지원 완벽, kubeval 같은 lint 곧장
2. **`kubectl` 빌트인** (`kubectl apply -k`) — 별도 도구 X
3. **Diff 쉬움** — `kubectl diff -k overlays/prod`
4. **base + overlays 의 명확한 모델** — diff review 가 직관
5. **ConfigMap 자동 hash** — Pod 재시작 트리거 자동
6. **patches/labelSelector 로 일괄 적용** — msa 의 `app.kubernetes.io/part-of=commerce-platform` 패턴 같은 게 강력

## 7. Kustomize 의 단점

1. **변수/함수 없음** — DRY 가 어려움 (반복 manifest 가 늘어남). `replacements` 로 보완 가능하나 Helm 만큼 강력하지 않음
2. **조건부 약함** — "prod 일 때만 추가" 가 overlay 분리로만 가능. 한 파일 안 if/else 불가
3. **의존성 차트 모델 없음** — 외부 인프라(Strimzi 등) 는 결국 Helm 또는 직접 manifest. msa 는 `helm install ingress-nginx` + `kubectl apply -k` 의 혼합
4. **Hook 없음** — 배포 단계에 코드 끼우기 X (Job 매니페스트 직접 관리)
5. **버전/Release 관리 없음** — 그냥 `kubectl apply`. 롤백은 git revert + apply

## 8. 직접 비교 매트릭스

| 항목 | Helm | Kustomize |
|---|---|---|
| 학습 곡선 | 중간-높음 | 낮음 |
| YAML 그대로 보임 | X (template) | O |
| 변수/함수 | 강력 (Sprig) | 약함 (replacements) |
| 조건부 | 강력 | overlay 분리만 |
| 의존성 | 강력 (subchart) | 없음 |
| Release / rollback | helm 내장 | git 의존 |
| Hooks | 강력 | 없음 (Job 직접) |
| ConfigMap reload | values 변경만 | hash suffix 자동 |
| Diff/review | 어려움 (`helm template`) | 쉬움 |
| 인프라 차트 생태계 | 큼 | 작음 |
| GitOps 친화 | 가능 (Argo CD 가 지원) | 가능 (Argo CD 기본 지원) |

## 9. 둘을 같이 쓰는 패턴 (가장 흔함)

> "인프라 = Helm, 앱 = Kustomize"

이유:
- 인프라 (Strimzi, Percona, ingress-nginx, kube-prometheus-stack) 는 자체 차트를 제공 → Helm 그대로
- 앱은 손 안에 있고 review/diff 가 자주 발생 → Kustomize 가 편함

msa 의 정확한 모델:
```
Helm install:
  - ingress-nginx
  - cert-manager
  - sealed-secrets controller
  - kube-prometheus-stack
  - bitnami redis (Phase 4)

Kustomize apply -k:
  - k8s/infra/local/   (개발)
  - k8s/infra/prod/    (Operator CR + 부속)
  - k8s/overlays/k3s-lite/
  - k8s/overlays/prod-k8s/
```

ADR-0019 의 "Operator 설치는 Helm, 앱 매니페스트는 Kustomize" (§Alternatives A-4) 가 정확히 이 모델.

## 10. Argo CD 에서의 Helm/Kustomize

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: gateway }
spec:
  destination: { server: https://kubernetes.default.svc, namespace: commerce }
  source:
    repoURL: https://github.com/commerce/msa
    path: k8s/overlays/prod-k8s
    targetRevision: main
    # Argo CD 가 path 의 kustomization.yaml 자동 인식
```

Helm 차트면:
```yaml
  source:
    repoURL: https://charts.bitnami.com/bitnami
    chart: redis
    targetRevision: 18.0.0
    helm:
      values: |
        replica: { replicaCount: 3 }
```

Argo CD 가 둘 다 지원 → 인프라/앱 혼합 운영이 자연스러움.

## 11. Helm 의 함정 5

1. **`helm template` 의 결과와 실제 install 후 다를 수 있다** — Hooks, lookup, Tiller (3.x 에서 제거됐지만 의식 잔재) 등으로
2. **CRD 가 업데이트되지 않음** — `crds/` 폴더는 install 시 한번만. 변경은 수동 또는 별도 차트
3. **values precedence 헷갈림** — `--set` > `-f` > `values.yaml` 의 순서 (뒤가 우선)
4. **subchart values override** — `parent.values` 에 `child:` 로 명시
5. **너무 generic 한 차트** — values 가 100+ 필드가 되면 유지가 지옥. 도메인 한정 차트 권장

## 12. Kustomize 의 함정 5

1. **patches 의 `target` 누락** — 모든 매칭 리소스에 패치 적용되어 사고
2. **`commonLabels` 가 selector 도 변경** — Deployment.spec.selector 가 immutable 이라 갱신 시 충돌 → 신규 배포 필요
3. **순서 의존성** — overlay 가 base 의 변경에 영향 (label 변경 등)
4. **multi-base** — 한 overlay 가 여러 base 를 모두 가져오는 패턴은 강력하지만 복잡
5. **hash suffix + ImagePullPolicy=Always** — hash 자동이라 Pod 재시작은 보장되지만 image pull 은 별개

## 13. msa 매핑 + 실전 팁

### 현재 활용
- `commonLabels` 미사용 (Deployment selector 충돌 우려) — 대신 label 을 base manifest 에 명시
- `images:` 갱신 미사용 — Jib 가 직접 tag 결정 (`./gradlew jib -PjibTag=...`). image tag 갱신을 Kustomize 가 아닌 빌드에서 결정.
- `configMapGenerator` 미사용 — 현재 ConfigMap 거의 없음 (env 변수 위주)
- `patches` + `labelSelector` 패턴이 핵심 (`app.kubernetes.io/part-of=commerce-platform`)

### 가치 있을 패턴

```yaml
# overlays/prod-k8s/kustomization.yaml 추가 후보
configMapGenerator:
  - name: jvm-flags
    literals:
      - JAVA_OPTS=-XX:+UseContainerSupport -XX:MaxRAMPercentage=75
patches:
  - patch: |-
      - op: add
        path: /spec/template/spec/containers/0/envFrom/-
        value:
          configMapRef: { name: jvm-flags }
    target: { kind: Deployment, labelSelector: "app.kubernetes.io/part-of=commerce-platform" }
```

→ JVM flag 를 한곳에서 관리, hash 자동으로 Pod 재시작.

### 면접 답변

**"왜 Kustomize 를 골랐어요?"**:

> "변경의 단위가 base + 환경별 overlay 였고, review 가 git diff 만으로 충분해야 했어요. Helm template 의 `{{ }}` 는 diff 리뷰 비용이 컸고, 인프라(Strimzi/cert-manager) 는 어차피 Helm 으로 따로 깔리니 둘이 자연스럽게 분리됐어요. ConfigMap hash suffix 가 자동으로 Pod 재시작을 트리거하는 것도 유리했고요."

## 14. 정리

```
Helm        — 인프라 / 외부 차트 / 패키지 배포
Kustomize   — 자기 앱 매니페스트 + 환경 overlay
GitOps      — 어느 쪽이든 Argo CD/Flux 가 적용
```

다음: [12-gitops.md](12-gitops.md) — Argo CD / Flux / Sealed Secrets / SOPS / External Secrets.
