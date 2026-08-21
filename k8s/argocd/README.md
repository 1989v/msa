# Argo CD — Minimal GitOps for OCI Single-Node

OCI Ampere A1 24GB 환경에서 메모리 최소화 (704Mi 한도 합) 로 GitOps 운영.

## 구성

- `values.yaml` — Helm chart values (server/repo/controller/redis 리소스 한도)
- `application.yaml` — commerce 플랫폼 sync 정의 (`__GITHUB_REPO_URL__`,
  `__DOMAIN__`, `__OCI_LE_EMAIL__` 치환)
- `install.sh` — 일괄 설치 스크립트

> **UI 는 public Ingress 로 노출하지 않는다** (ADR-0061). GitOps 콘솔이 인터넷에
> 직접 보이면 로그인 화면과 정확한 버전이 익명에게 공개돼 크레덴셜 공격과 신규
> CVE 의 1순위 표적이 되고, 뚫리면 클러스터 전체 장악으로 직결된다. 접근은
> port-forward 또는 Cloudflare Zero Trust Tunnel + Access policy 로만 한다.

## 사전 조건

1. `scripts/oci-bootstrap.sh` 완료 (k3s + ingress-nginx + cert-manager)
2. **OCIR Auth Token 발급**: OCI Console → User Settings → Auth Tokens
3. Tenancy **Object Storage namespace** 확인 (Profile → Tenancy 페이지)
4. **DNS 레코드 등록** (OCI public IP):
   - proxied (orange cloud): `@` (root), `admin`, `quant`, `gft`, `game`, `api`
   - DNS-only (gray cloud): `rt` — WS/SSE 가 CF 100s timeout 을 피해야 해서 의도적 우회
   - `argocd` 는 **origin IP 를 가리키는 A 레코드**를 두지 않는다 (위 참조).
     이미 있으면 삭제할 것 — 남아 있으면 Zero Trust 를 건너뛰고 origin 으로 직행한다.
     단, 터널 Public Hostname 을 등록하면 Cloudflare 가 `<tunnel-id>.cfargotunnel.com`
     으로 향하는 CNAME(proxied)을 자동 생성한다. **이건 정상이며 필수 레코드다.**

## 설치

```bash
OCIR_REGION=ap-seoul-1 \
OCIR_NAMESPACE=<tenancy-namespace> \
OCIR_USERNAME="<tenancy-namespace>/<oci-username>" \
OCIR_TOKEN='<auth-token>' \
./k8s/argocd/install.sh <PUBLIC_IP> <LE_EMAIL> <GIT_REPO_URL> <DOMAIN>

# 예시
OCIR_REGION=ap-seoul-1 \
OCIR_NAMESPACE=kgdcommerce \
OCIR_USERNAME='kgdcommerce/me@example.com' \
OCIR_TOKEN='xxxxxxx' \
./k8s/argocd/install.sh 132.226.10.55 me@example.com \
  https://github.com/kgd/msa.git 1989v.com
```

> federated user (OCI IAM Identity Domain) 면 username 형식이
> `<namespace>/oracleidentitycloudservice/<oci-username>` 입니다.

스크립트 진행 단계:
1. `commerce` ns 생성 + `ocir-pull-secret` 등록 (docker-registry 형식)
2. 기존 ServiceAccount 에 `imagePullSecrets` 부착
3. Helm 차트 설치 (`argo/argo-cd`, namespace `argocd`)
4. `Application/commerce` CRD apply — main 브랜치의 `k8s/overlays/oci-arm` 감시
   (`spec.source.kustomize.patches` 로 도메인 host / Let's Encrypt email 주입)
5. UI ingress (`argocd.<DOMAIN>`) apply + Let's Encrypt TLS 발급 대기
6. 초기 admin 비밀번호 출력

`oci-arm` overlay 는 모든 앱 Deployment/CronJob Pod spec 에
`imagePullSecrets: [{ name: ocir-pull-secret }]` 를 직접 주입한다. 따라서 별도
SA patch CronJob 은 만들지 않는다.

## 운영

### UI 접속

**a) port-forward (기본 — 추가 설정 없음)**

```bash
kubectl -n argocd port-forward svc/argocd-server 8080:80
# → http://localhost:8080   ID: admin / PW: (install.sh 출력값)
```

**b) Cloudflare Zero Trust (상시 접근이 필요할 때)**

`k8s/overlays/oci-arm/cloudflared/README.md` 의 Public Hostname 표에 `argocd`
행을 등록하고 Access policy(본인 이메일 1개)를 건다. cloudflared 가 argocd ns
로 나가는 egress 는 `cloudflared/network-policy.yaml` 에 이미 열려 있다.

### CLI 로그인

port-forward 를 띄운 상태에서:

```bash
argocd login localhost:8080 --username admin --password <PASSWORD> --insecure
argocd app list
argocd app sync commerce
```

Zero Trust hostname 으로 붙일 때는 브라우저 SSO 를 못 타므로 Access
**Service Token** 을 발급해 헤더로 넘긴다:

```bash
argocd login argocd.<DOMAIN> --username admin --password <PASSWORD> \
  --header "CF-Access-Client-Id: <id>,CF-Access-Client-Secret: <secret>"
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

### Ingress host 에 `__DOMAIN__` 가 남음

Argo CD 는 `k8s/overlays/oci-arm/scripts/render.sh` 를 실행하지 않고
`kustomization.yaml` 을 직접 렌더링한다. `__DOMAIN__` (literal placeholder) 가
Ingress host 에 그대로 남으면 `Application/commerce` 의 inline Kustomize
patch 가 설치 시점에 누락된 상태다.

```bash
./k8s/argocd/install.sh <PUBLIC_IP> <LE_EMAIL> <GIT_REPO_URL> <DOMAIN>
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
싶을 때만 다시 활성. Let's Encrypt prod 의 rate limit (등록 도메인당 50 cert/주)
은 베이스 도메인(예: `1989v.com`) 단위로 적용되며, Let's Encrypt 를 쓰는 host 는
`rt` 하나뿐(나머지 proxied host 는 Cloudflare Origin CA)이므로 실질 영향 없음.

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

## 멈춘 동기화 워치독 (ADR-0073)

`stuck-sync-watchdog.yaml` — 5분 주기로 Application 을 보고, 동기화 작업이 20분 넘게 `Running`
이면 `/operation` 을 제거해 끊는다. 다음 자동 동기화가 최신 리비전으로 다시 건다.

```bash
# 상태
kubectl -n argocd get cronjob argocd-stuck-sync-watchdog
# 최근 판정 로그 (유일한 알림 수단이다)
kubectl -n argocd logs -l app.kubernetes.io/name=argocd-stuck-sync-watchdog --tail=20
# 수동 1회 실행
kubectl -n argocd create job --from=cronjob/argocd-stuck-sync-watchdog wd-once
```

**이 파일은 Argo 가 아니라 `install.sh` 가 apply 한다.** Argo 가 막혔을 때 그것을 푸는 물건을
Argo 가 배포하면 같이 막히기 때문이다. 워치독을 고쳤으면 `install.sh` 를 다시 돌리거나
`kubectl apply -f k8s/argocd/stuck-sync-watchdog.yaml` 을 직접 실행한다.

Application 이 늘면 CronJob 의 `APPS` 환경변수에 공백으로 구분해 더한다 — 목록을 API 응답에서
긁지 않는 이유는 status 안의 수백 개 `"name"` 과 뒤섞여 조용히 틀리기 때문이다.
