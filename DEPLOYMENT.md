# Deployment Guide — OCI Ampere A1 + Argo CD GitOps

OCI Always Free Ampere A1 (arm64, 4 OCPU / 24GB) 단일 노드에 commerce 플랫폼
전체를 배포하는 절차. 신규 VM 또는 클러스터 재구축 시 이 문서만 따라가면
1시간 내 배포 완료.

**비용**: $0 (OCI Always Free + GitHub public repo + OCIR Always Free).

---

## Architecture 한 줄 요약

```
git push → GitHub Actions (arm64 native, public 무료)
        → OCIR push (Always Free 10GB)
        → kustomization.yaml bot commit
   ↓
Argo CD on OCI VM (k3s)
   → 변경된 deployment 만 rolling update
```

---

## 사전 준비물

| 항목 | 비고 |
|---|---|
| OCI 계정 + Ampere A1 VM 생성 권한 | Always Free 한도: 4 OCPU + 24GB / 100GB 블록 |
| GitHub 계정 + 본 repo (`1989v/msa`) | public 권장. private 시 GHA 분 한도 + GHCR 비용 발생 |
| 로컬 머신 (Mac/Linux) + SSH key | OCI VM 접속용 |
| 본인 이메일 | Let's Encrypt 등록용 (외부 노출됨) |

---

# Phase 1 — OCI Console 설정

## 1.1 Ampere A1 인스턴스 생성

```
OCI Console → Compute → Instances → Create Instance
```

| 필드 | 값 |
|---|---|
| Shape | VM.Standard.A1.Flex |
| OCPU | 4 |
| Memory (GB) | 24 |
| Image | Canonical Ubuntu 24.04 Minimal **aarch64** |
| Boot volume | 47GB (Always Free 한도 안) |
| SSH key | 본인 public key (`~/.ssh/oracle.pub`) 또는 새로 생성 |

생성 후 **Public IPv4 메모** (예: `134.185.107.208`).

## 1.2 VCN Security List — 80/443 허용

```
OCI Console → Networking → Virtual Cloud Networks → (본인 VCN)
→ Security Lists → Default Security List
→ Add Ingress Rules
```

규칙 2개 추가:

| Source CIDR | IP Protocol | Source Port | Destination Port |
|---|---|---|---|
| `0.0.0.0/0` | TCP | (비움) | `80` |
| `0.0.0.0/0` | TCP | (비움) | `443` |

Stateless 체크 안함 (Stateful 유지).

## 1.3 Tenancy Object Storage Namespace 확인

```
OCI Console → 좌상단 ☰ → Storage → Buckets
→ 페이지 상단 "네임스페이스: xxxxxxxxxxxx" 값 메모
```

(예: `axyooxbyk5yv`). 이게 OCIR URL 의 일부.

## 1.4 OCI Region key 확인

콘솔 우상단 region drop-down → 영문 region key 메모 (예: `ap-chuncheon-1`).

## 1.5 Auth Token 발급 (OCIR push 용)

```
OCI Console → 우상단 프로필 → User Settings
→ 좌측 Auth Tokens → Generate Token
→ Description: "OCIR CI/CD"
→ Generate → ★ 토큰 한 번만 표시됨, 즉시 복사
```

OCI Auth Token 은 20자 정도 (짧음). 마지막 글자까지 정확히 복사.

## 1.6 사용자 이름 형식 확인

같은 페이지 상단 "Name" 필드값:

| 표시 형식 | OCIR_USERNAME 값 |
|---|---|
| `1989v@naver.com` | `<namespace>/1989v@naver.com` |
| `oracleidentitycloudservice/1989v@naver.com` | `<namespace>/oracleidentitycloudservice/1989v@naver.com` |
| `Default/1989v@naver.com` | `<namespace>/Default/1989v@naver.com` |

---

# Phase 2 — GitHub 설정

## 2.1 Repo visibility — public 권장

```
GitHub → Settings → General → Danger zone → Change visibility → Public
```

장점:
- ubuntu-24.04-arm runner 무제한 무료
- GHA 분 무제한
- 코드 공개 — auth/gifticon 같은 private submodule 은 별개 repo 라 영향 X

private 유지 시:
- GHA 월 2000분 한도
- arm64 runner 유료 ($0.005/분)
- GHCR 사용 시 storage/transfer 한도 (OCIR 사용하면 무관)

## 2.2 GitHub App 생성 (CI bot)

```
GitHub → Settings → Developer settings → GitHub Apps → New GitHub App
```

| 필드 | 값 |
|---|---|
| GitHub App name | `msa-ci-bot` (또는 본인 선택) |
| Homepage URL | 본인 GitHub 프로필 URL |
| Webhook | **Active 체크 해제** (사용 안함) |

### Repository permissions

| 권한 | 값 | 용도 |
|---|---|---|
| **Contents** | **Read and write** | submodule fetch + commit-back |
| Metadata | Read | (자동) |
| **Packages** | **Read and write** | OCIR push (현재 미사용이지만 미래 대비) |

"Where can this GitHub App be installed?" → Only on this account.

생성 후 **App ID 메모** (페이지 상단 숫자, 예: `987654`).

## 2.3 App Private key 발급

같은 App 페이지 → "Private keys" 섹션 → **Generate a private key**

`.pem` 파일 다운로드. 내용 전체 (BEGIN/END 라인 포함, 마지막 빈 줄까지) 필요.

## 2.4 App 을 필요 repo 에 설치

```
같은 App 페이지 → 좌측 "Install App" → "1989v" 또는 본인 계정 옆 "Install"
```

"Only select repositories" 선택 → 다음 3개 체크:

- `msa` (메인 repo — commit-back 권한)
- `msa-auth` (private submodule)
- `msa-gifticon` (private submodule)

저장.

> 4개 이상 선택해도 동작하지만 최소권한 원칙상 정확히 3개 권장.

## 2.5 Repo Secrets 등록

```
GitHub → msa repo → Settings → Secrets and variables → Actions
→ New repository secret (총 6개)
```

| Secret name | 값 |
|---|---|
| `APP_ID` | 2.2 의 App ID 숫자 |
| `APP_PRIVATE_KEY` | 2.3 의 `.pem` 전체 내용 |
| `OCIR_REGION` | 1.4 의 region key (소문자) |
| `OCIR_NAMESPACE` | 1.3 의 namespace (소문자) |
| `OCIR_USERNAME` | 1.6 의 username 형식 |
| `OCIR_TOKEN` | 1.5 의 Auth Token |

---

# Phase 3 — 첫 빌드 트리거

이미 main 에 commit 이 있으면 workflow_dispatch 로 강제 빌드:

```
GitHub → 1989v/msa → Actions → "images" 워크플로
→ Run workflow → main 브랜치 → "rebuild_all": true → Run
```

또는 빈 commit push:

```bash
# 로컬에서
cd ~/IdeaProjects/msa
git commit --allow-empty -m "ci: trigger initial build"
git push origin main
```

소요 ~10-20분. 진행:
1. GHA 가 28개 이미지 빌드 → OCIR push
2. kustomization.yaml 의 images: 섹션 자동 갱신 → bot commit-back `[skip ci]`

### 검증

OCI Console → Developer Services → Container Registry → 본인 namespace
→ 28개 repo (gateway, product, ... portal-fe, recommendation-ann) 등재 확인.

GitHub Actions 페이지에 images workflow ✓ Success.

---

# Phase 4 — VM 부트스트랩

## 4.1 SSH 접속 alias 등록 (로컬 Mac, 1회)

```bash
cat >> ~/.ssh/config <<EOF

Host msa-oci
    HostName 134.185.107.208
    User ubuntu
    IdentityFile ~/.ssh/oracle
EOF
chmod 600 ~/.ssh/config
```

IP / key 파일명은 본인 환경 맞춰 수정. 이후 `ssh msa-oci` 한 줄로 접속.

## 4.2 VM 안 — 도구 설치 + repo clone

```bash
ssh msa-oci

sudo apt-get update && sudo apt-get install -y git curl
git clone https://github.com/1989v/msa.git
cd msa
```

## 4.3 k3s + ingress-nginx + cert-manager 설치 (3-5분)

```bash
sudo ./scripts/oci-bootstrap.sh
```

자동 처리:
- iptables 80/443/6443 오픈
- k3s 단일 노드 설치 (Traefik 비활성)
- Helm 설치
- ingress-nginx 4.11 + cert-manager v1.16

종료 메시지에 다음 단계 안내 출력.

## 4.4 환경 변수 영구 설정 (★ 매번 export 안 하려면)

KUBECONFIG 는 .bashrc 에:

```bash
echo 'export KUBECONFIG=/etc/rancher/k3s/k3s.yaml' >> ~/.bashrc
```

OCIR 시크릿 4개는 별도 보호 파일 (.bashrc 에 박으면 ps/history 등으로 누출 위험):

```bash
cat > ~/.commerce-env <<'EOF'
export OCIR_REGION=ap-chuncheon-1
export OCIR_NAMESPACE=axyooxbyk5yv
export OCIR_USERNAME='axyooxbyk5yv/1989v@naver.com'
export OCIR_TOKEN='여기에-실제-토큰-paste'
export LE_EMAIL='your.email@example.com'
EOF
chmod 600 ~/.commerce-env
```

> ⚠ `~/.commerce-env` 는 절대 git 에 commit 하지 말 것. chmod 600 으로 본인만 읽기.

이후 install.sh 재실행 등 OCIR 자격 필요할 때:

```bash
source ~/.commerce-env
./k8s/argocd/install.sh "$PUBLIC_IP" "$LE_EMAIL" https://github.com/1989v/msa.git
```

쉘 시작 시 자동 source 하려면 .bashrc 에 한 줄 추가 (선택):

```bash
echo '[[ -f ~/.commerce-env ]] && source ~/.commerce-env' >> ~/.bashrc
```

→ 다음 SSH 부터 자동 export. 다만 자동 export 는 ssh 세션마다 token 이 환경에
박힌 상태가 되니, 보안 신경 쓰이면 필요할 때만 수동 `source` 추천.

## 4.5 부트스트랩 검증

```bash
# 새 셸 열거나 source ~/.bashrc 후
kubectl get nodes                 # Ready 1개
kubectl -n ingress-nginx get svc  # ingress-nginx-controller LoadBalancer
kubectl -n cert-manager get pods  # 3개 Running
```

---

# Phase 5 — Argo CD 설치 + commerce 배포

## 5.1 install.sh 실행

```bash
source ~/.commerce-env   # OCIR 시크릿 환경변수 로드
./k8s/argocd/install.sh "<PUBLIC_IP>" "$LE_EMAIL" https://github.com/1989v/msa.git
```

`<PUBLIC_IP>` 자리에 본인 VM IP (예: `134.185.107.208`).

자동 처리 (~5-10분):
1. `commerce` namespace + `ocir-pull-secret` (docker-registry 형식) 생성
2. 기존 ServiceAccount 모두에 imagePullSecrets 부착
3. 신규 SA 자동 patch CronJob 등록
4. Helm 으로 Argo CD 설치 (controller 768Mi, server/repo 192Mi)
5. `Application/commerce` CRD apply — `spec.source.kustomize.patches` 로 IP/email
   주입 (placeholder override)
6. UI ingress + Let's Encrypt TLS 인증서 발급 대기

종료 시:

```
╭─────────────────────────────────────────────────────────────────╮
│  ✅ Argo CD 설치 완료                                            │
├─────────────────────────────────────────────────────────────────┤
│  UI URL    : https://argocd.<IP-DASHED>.nip.io
│  Username  : admin
│  Password  : (랜덤 비번)
╰─────────────────────────────────────────────────────────────────╯
```

**비밀번호 메모 필수**. 나중에 다시 보려면:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d; echo
```

## 5.2 Sync 진행 모니터링 (5-15분)

```bash
watch -n 5 '
echo "=== Application ==="
kubectl -n argocd get applications
echo
echo "=== Pod count ==="
kubectl -n commerce get pods --no-headers | wc -l
echo
echo "=== 문제 pod ==="
kubectl -n commerce get pods --no-headers | awk "\$3 != \"Running\" && \$3 != \"Completed\""
'
```

기대 흐름:
- 0-3분: ConfigMap/Secret/Service/Ingress/ClusterIssuer 생성
- 3-6분: StatefulSet (mysql/kafka/es/clickhouse/redis/postgres) Ready
- 6-12분: 백엔드 deployment 들 image pull → Running
- 12-15분: 안정화

최종 상태:
```
NAME       SYNC STATUS   HEALTH STATUS
commerce   Synced        Healthy
또는
commerce   OutOfSync     Degraded   ← StatefulSet cosmetic drift (실 동작엔 영향 X)
```

문제 pod 출력에 `sa-pullsecret-patcher` 만 보이면 정상 (Docker Hub rate limit,
보조 CronJob — 운영 무관).

---

# Phase 6 — 검증

## 6.1 Argo CD UI

```
https://argocd.<IP-DASHED>.nip.io/
ID  : admin
PW  : (5.1 의 출력값)
```

좌측 commerce app 클릭 → 모든 resource 상태 시각화.

## 6.2 commerce 플랫폼

| URL | 화면 |
|---|---|
| `https://commerce.<IP-DASHED>.nip.io/` | portal-fe |
| `https://commerce.<IP-DASHED>.nip.io/admin/` | admin-fe |
| `https://commerce.<IP-DASHED>.nip.io/quant/` | quant-fe |
| `https://commerce.<IP-DASHED>.nip.io/api/v1/products?page=0&size=10` | gateway REST |

첫 접속 시 cert 발급 대기로 5분간 503 가능. 또는 인증서가 staging 으로 떨어진
경우 브라우저 경고 — 아래 "Known Issues" 참조.

---

# 일상 운영

## 코드 변경 → 자동 배포

```bash
# 로컬에서 코드 수정
vim product/app/src/main/kotlin/...
git commit -am "feat: add discount calculation"
git push origin main
```

자동 진행:
1. `ci` 워크플로 (1-3분): compile / yaml / kustomize validate
2. `images` 워크플로 (3-5분): **변경된 서비스만** Jib/buildx → OCIR push → kustomization.yaml bot commit
3. Argo CD (3분 polling): main 변경 감지 → 변경된 deployment 만 rolling update

총 5-15분 후 새 버전 반영. **다른 27개 서비스 영향 없음** (incremental).

## Submodule (auth/gifticon) 변경

옵션 A — msa 안에서 작업 (권장):
```bash
cd ~/IdeaProjects/msa/auth
# 수정 + commit + push to msa-auth
cd ..
git add auth && git commit -m "chore: bump auth" && git push
```

옵션 B — 외부에서 msa-auth 만 push 한 경우:
```
GitHub → msa → Actions → submodule-bump → Run workflow
```

수동 트리거. msa 의 submodule pointer 갱신 → images.yml 트리거.

## 강제 전체 rebuild

```
GitHub → msa → Actions → images → Run workflow → rebuild_all = true
```

---

# Known Issues / Troubleshooting

## HTTPS 인증서 경고

원인 후보:
1. cert-manager 가 아직 발급 진행 중 (HTTP01 challenge)
2. letsencrypt-staging 으로 발급됨 (untrusted CA)
3. Let's Encrypt rate limit

진단:
```bash
kubectl -n commerce describe certificate gateway-nipio-tls | tail -20
kubectl -n commerce describe certificate frontend-nipio-tls | tail -20
kubectl -n argocd describe certificate argocd-tls | tail -10
```

`Reason: Issued` 면 정상. `Reason: Failed` 면 message 확인.

stuck 시 강제 재시도:
```bash
kubectl -n commerce delete certificate gateway-nipio-tls frontend-nipio-tls
# 자동 재생성 + 재발급 시도
```

## sa-pullsecret-patcher ImagePullBackOff

`bitnami/kubectl:1.31` Docker Hub rate limit. **무시 OK** — install.sh 가
이미 SA patch 다 함, 신규 SA 안 생기면 patcher 없어도 동작.

영구 해결 (선택):
```bash
# CronJob 자체 제거
kubectl -n commerce delete cronjob sa-pullsecret-patcher
```

## Argo CD: OutOfSync + Degraded (StatefulSet drift)

K8s 가 StatefulSet 적용 시 자동 추가하는 기본 필드 때문에 Argo CD diff 가
"drift" 로 인식. 실제 동작엔 영향 0.

해소 (선택, cosmetic):
```bash
kubectl -n argocd patch app commerce --type merge -p '
{
  "spec": {
    "ignoreDifferences": [
      {"group": "apps", "kind": "StatefulSet",
       "jsonPointers": ["/spec/volumeClaimTemplates"]}
    ]
  }
}'
```

## code-dictionary CrashLoopBackOff (YAML 에러)

증상: `found duplicate key spring` Spring Boot startup 실패.

원인: `application*.yml` 에 `spring:` 블록 두 번 (top-level key 중복).

이제 CI (`yaml-validate` job) 가 사전 차단하므로 main 에 머지 자체가 안 됨.
혹시 발생 시 해당 yml 의 dotted-notation (`spring.elasticsearch:`) 을 기존
`spring:` 블록 내부 `elasticsearch:` 로 이동.

## argocd-application-controller CrashLoopBackOff (OOM)

증상: `Last State: Terminated Reason: OOMKilled`.

원인: first sync 시 70+ resource diff 가 256Mi 한도 초과.

해결: `k8s/argocd/values.yaml` 의 controller.resources.limits.memory 가
이미 768Mi 로 설정됨. 그래도 OOM 발생 시 1Gi 로 상향:

```bash
kubectl -n argocd set resources statefulset argocd-application-controller \
  --containers='application-controller' --limits=memory=1Gi
kubectl -n argocd delete pod argocd-application-controller-0
```

## App token 발급 시 404

증상:
```
Failed to create token for "msa,msa-auth,msa-gifticon" ... Not Found
```

원인: App 이 명시된 repo 에 정확히 설치 안됨.

해결: GitHub → App 설정 → Install App → 1989v Configure → Repository access
→ "Only select repositories" → `msa`, `msa-auth`, `msa-gifticon` 모두 체크.

## OCIR 401 Unauthorized

원인: Auth Token 오타 / 만료 / username prefix 누락.

검증:
```bash
read -rsp 'Token: ' T && echo
curl -s -u "$OCIR_USERNAME:$T" \
  "https://$OCIR_REGION.ocir.io/20180419/docker/token?service=$OCIR_REGION.ocir.io&scope=repository:$OCIR_NAMESPACE/gateway:pull" | head -c 100
unset T
```

`{"token":"...JWT..."}` 응답 = 인증 OK.
401 = username 형식 (federated prefix 누락) 또는 토큰 오류.

K8s secret 갱신:
```bash
kubectl -n commerce delete secret ocir-pull-secret
read -rsp 'Token: ' T && echo
kubectl -n commerce create secret docker-registry ocir-pull-secret \
  --docker-server="$OCIR_REGION.ocir.io" \
  --docker-username="$OCIR_USERNAME" \
  --docker-password="$T" \
  --docker-email="$LE_EMAIL"
unset T
# 실패 pod 재시도
kubectl -n commerce get pods | awk '/ImagePullBackOff|ErrImagePull/{print $1}' \
  | xargs -r kubectl -n commerce delete pod
```

---

# 클러스터 재구축 절차 (재해 복구 / 새 VM)

기존 VM 폐기하고 새로 시작할 때:

1. **OCI Console**: 새 VM 생성 (Phase 1.1~1.2)
2. **secrets 그대로 유지** — GHA secrets 와 OCIR Auth Token 은 그대로 작동
3. **공개 IP 가 바뀌면**: Phase 5.1 의 install.sh 인자가 새 IP 로 바뀜.
   `Application` CRD 의 kustomize.patches 가 새 IP 로 갱신됨
4. **OCIR 의 기존 이미지 그대로 사용** — 재빌드 불필요
5. **Phase 4-5 만 다시**: bootstrap + install.sh → 5-15분 후 완전 복구

git 매니페스트엔 환경값 (IP/email) 안 박혀있어서 매번 install.sh 인자만 새로
주면 됨. **README/docs 변경 없음**.

---

# 예산 (24GB / 4 OCPU 안에서 28개 서비스)

| 그룹 | 메모리 한도 합 |
|---|---|
| Backend 21종 (Tier XL/L/M/S/XS 차등) | ~13.0 GB |
| FE 5종 (nginx) | ~0.5 GB |
| Infra (MySQL/Redis/Kafka/ES/ClickHouse/Postgres) | ~6.75 GB |
| Argo CD (~700Mi) + ingress + cert-manager + k3s | ~3 GB |
| **합계** | **~23.25 GB** (24GB 안에 ~750Mi 여유) |

Tier 별 메모리 배분 상세: `k8s/overlays/oci-arm/README.md` 참조.

---

# 파일 레퍼런스

| 파일 | 역할 |
|---|---|
| `scripts/oci-bootstrap.sh` | VM 의 k3s + ingress + cert-manager 일괄 설치 |
| `k8s/argocd/install.sh` | Argo CD + Application CRD + OCIR pull secret 설치 |
| `k8s/argocd/values.yaml` | Argo CD Helm values (최소 리소스) |
| `k8s/argocd/application.yaml` | Argo CD Application CRD 템플릿 (kustomize.patches 로 env 주입) |
| `k8s/argocd/ingress.yaml.template` | Argo CD UI ingress 템플릿 |
| `k8s/overlays/oci-arm/` | commerce 매니페스트 (k3s-lite 베이스 + nip.io TLS + tier 별 리소스) |
| `.github/workflows/ci.yml` | PR 게이트: compile / yaml duplicate / kustomize |
| `.github/workflows/images.yml` | 변경 서비스만 빌드 → OCIR → manifest 갱신 commit-back |
| `.github/workflows/submodule-bump.yml` | (수동) auth/gifticon submodule pointer 갱신 |

---

# 향후 전환 옵션

| 시점 | 작업 |
|---|---|
| 실제 도메인 확보 | `commerce.example.com` 으로 nip.io 대체 → Application kustomize.patches 제거 가능 |
| 멀티 클러스터 / 팀 확장 | public app repo + private env repo 분리 (App-of-Apps 패턴) |
| 메모리 압박 심해질 때 | Argo CD → Flux (~150Mi 절감) 또는 비핵심 서비스 replicas: 0 |
| arm64 + amd64 동시 지원 | `commerce.jib-convention.gradle.kts` 의 jibPlatforms 다중화 |
