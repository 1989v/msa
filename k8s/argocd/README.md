# Argo CD — Minimal GitOps for OCI Single-Node

OCI Ampere A1 24GB 환경에서 메모리 최소화 (704Mi 한도 합) 로 GitOps 운영.

## 구성

- `values.yaml` — Helm chart values (server/repo/controller/redis 리소스 한도)
- `application.yaml` — commerce 플랫폼 sync 정의 (`__GITHUB_REPO_URL__`,
  `__OCI_IP_DASHED__`, `__OCI_LE_EMAIL__` 치환)
- `ingress.yaml.template` — UI ingress (cert-manager TLS, `__OCI_IP_DASHED__` 치환)
- `install.sh` — 일괄 설치 스크립트

## 사전 조건

1. `scripts/oci-bootstrap.sh` 완료 (k3s + ingress-nginx + cert-manager)
2. **OCIR Auth Token 발급**: OCI Console → User Settings → Auth Tokens
3. Tenancy **Object Storage namespace** 확인 (Profile → Tenancy 페이지)

## 설치

```bash
OCIR_REGION=ap-seoul-1 \
OCIR_NAMESPACE=<tenancy-namespace> \
OCIR_USERNAME="<tenancy-namespace>/<oci-username>" \
OCIR_TOKEN='<auth-token>' \
./k8s/argocd/install.sh <PUBLIC_IP> <LE_EMAIL> <GIT_REPO_URL>

# 예시
OCIR_REGION=ap-seoul-1 \
OCIR_NAMESPACE=kgdcommerce \
OCIR_USERNAME='kgdcommerce/me@example.com' \
OCIR_TOKEN='xxxxxxx' \
./k8s/argocd/install.sh 132.226.10.55 me@example.com \
  https://github.com/kgd/msa.git
```

> federated user (OCI IAM Identity Domain) 면 username 형식이
> `<namespace>/oracleidentitycloudservice/<oci-username>` 입니다.

스크립트 진행 단계:
1. `commerce` ns 생성 + `ocir-pull-secret` 등록 (docker-registry 형식)
2. 기존 ServiceAccount 에 `imagePullSecrets` 부착
3. Helm 차트 설치 (`argo/argo-cd`, namespace `argocd`)
4. `Application/commerce` CRD apply — main 브랜치의 `k8s/overlays/oci-arm` 감시
   (`spec.source.kustomize.patches` 로 nip.io host / Let's Encrypt email 주입)
5. UI ingress apply + Let's Encrypt TLS 발급 대기
6. 초기 admin 비밀번호 출력

`oci-arm` overlay 는 모든 앱 Deployment/CronJob Pod spec 에
`imagePullSecrets: [{ name: ocir-pull-secret }]` 를 직접 주입한다. 따라서 별도
SA patch CronJob 은 만들지 않는다.

## 운영

### UI 접속

```
https://argocd.<IP-DASHED>.nip.io/
  ID  : admin
  PW  : (install.sh 출력값)
```

### CLI 로그인

```bash
argocd login argocd.<IP-DASHED>.nip.io --username admin --password <PASSWORD>
argocd app list
argocd app sync commerce
```

### 동기화 확인

```bash
kubectl -n argocd get applications
# NAME       SYNC STATUS   HEALTH STATUS
# commerce   Synced        Healthy

# 클러스터 실제 상태
watch -n 5 'kubectl -n commerce get pods | head -30'
```

### 리소스 점유 확인

```bash
kubectl -n argocd top pods
# argocd-application-controller-0          50m   140Mi
# argocd-repo-server-<hash>                30m   130Mi
# argocd-server-<hash>                     20m   95Mi
# argocd-redis-<hash>                      10m   40Mi
# Total: ~110m CPU / ~405Mi RAM (실측, limits 합 704Mi)
```

## 트러블슈팅

### OOM 발생 (특히 server / repo-server)

`values.yaml` 의 해당 컴포넌트 `limits.memory` 한 단계 승격:

```yaml
server:
  resources:
    limits:
      memory: 256Mi   # 192Mi → 256Mi
```

```bash
helm upgrade argocd argo/argo-cd \
  -n argocd --values k8s/argocd/values.yaml
```

여러 컴포넌트가 동시에 OOM 이면 Argo CD 자체가 단일 노드에 너무 큼 → **Flux 마이그레이션** 검토. 매니페스트(`k8s/overlays/oci-arm`) 그대로 둔 채로 컨트롤러만 교체 가능 (메모리 ~150Mi 로 감소).

### Sync 가 멈춤 / 매우 느림

```bash
# 컨트롤러 로그
kubectl -n argocd logs deploy/argocd-application-controller --tail=50

# repo-server (kustomize build) 로그
kubectl -n argocd logs deploy/argocd-repo-server --tail=50

# 강제 refresh
argocd app get commerce --refresh
```

### Ingress host 에 `__OCI_IP_DASHED__` 가 남음

Argo CD 는 `k8s/overlays/oci-arm/scripts/render.sh` 를 실행하지 않고
`kustomization.yaml` 을 직접 렌더링한다. `commerce.__OCI_IP_DASHED__.nip.io`
에러가 나면 `Application/commerce` 에 설치 시점의 inline Kustomize patch 가
없는 상태다.

```bash
./k8s/argocd/install.sh <PUBLIC_IP> <LE_EMAIL> <GIT_REPO_URL>
```

또는 `Application/commerce` 의 `spec.source.kustomize.patches` 에 gateway /
frontend Ingress host 와 ClusterIssuer email patch 를 직접 넣은 뒤 refresh 한다.

### Staging ClusterIssuer 비활성 (선택)

운영상 `letsencrypt-staging` 은 거의 안 쓰고 prod 만 사용. 매니페스트에서
빼고 싶으면 `k8s/overlays/oci-arm/kustomization.yaml` 의 resources 에서 staging
한 줄 주석/제거:

```yaml
resources:
  - ../k3s-lite
  # - cert-manager/cluster-issuer-staging.yaml   # 디버깅 안 할 때 비활성
  - cert-manager/cluster-issuer-prod.yaml
```

그리고 `k8s/argocd/application.yaml` 의 `kustomize.patches` 에서 staging email
patch entry 도 같이 제거. 첫 cert 발급 디버깅 시 staging 으로 먼저 검증하고
싶을 때만 다시 활성. Let's Encrypt prod 의 rate limit (호스트당 50 cert/주)
은 nip.io 서브도메인이 각각 독립 도메인 취급되어 실질 무제한.

### Drift / SelfHeal 비활성화 임시

```bash
kubectl -n argocd patch application commerce \
  -p '{"spec":{"syncPolicy":{"automated":{"selfHeal":false}}}}' --type merge
```

## Flux 로 마이그레이션 시 (메모리 더 절감)

```bash
# 1) Flux 설치 (~150Mi)
flux install --components=source-controller,kustomize-controller

# 2) Flux GitRepository + Kustomization 등록 (msa 매니페스트는 그대로)
cat <<EOF | kubectl apply -f -
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: msa
  namespace: flux-system
spec:
  url: <GIT_REPO_URL>
  ref: { branch: main }
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: commerce
  namespace: flux-system
spec:
  path: ./k8s/overlays/oci-arm
  sourceRef: { kind: GitRepository, name: msa }
  prune: true
  interval: 5m
EOF

# 3) Flux 정상 reconcile 확인 후 Argo CD 제거
kubectl delete application commerce -n argocd
helm uninstall argocd -n argocd
```
