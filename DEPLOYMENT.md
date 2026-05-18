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

생성 후 **Public IPv4 메모** (예: `168.107.22.114`).

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

## 1.7 Reserved Public IP 로 변환 (권장, 1분 작업, 무료)

기본값인 **임시 (Ephemeral) Public IP** 는 인스턴스 lifecycle 에 종속 — VM
terminate / 재생성 시 IP 가 바뀐다. DNS A 레코드를 IP 에 묶는 운영에선
재생성마다 DNS 7개를 다 갱신해야 하는 부담이 생긴다.

**Reserved Public IP** 는 인스턴스와 독립된 영구 IP 리소스 (Always Free 한도
region 당 2개 포함). VM terminate 해도 IP 가 살아남아 새 VM 에 재attach 가능.

### 변환 절차 — Console (UI 변형 두 가지 케이스)

**1차: Networking 메뉴에서 신규 Reserved IP 생성**

```
OCI Console → Networking → IP 관리 → 예약된 퍼블릭 IP
→ 우상단 "예약된 퍼블릭 IP 예약"
→ 이름: "msa-public-ip" (또는 원하는 이름) → 컴파트먼트 선택 → Reserve
```

생성된 새 reserved IP 메모 (예: `168.107.22.114`) — 이게 새 외부 노출 IP.

**2차: VNIC 에 attach (2-step 분리/재연결)**

```
Compute → Instances → [본인 VM] → 연결된 VNIC → VNIC 이름 클릭
→ 페이지 하단의 "프라이빗 IPv4 주소" 표
→ 프라이빗 IP 행 (10.0.0.x) 의 ⋮ → "퍼블릭 IP 편집"
```

다이얼로그에서 `예약된 퍼블릭 IP` 옵션이 안 보이면 (UI 캐싱 이슈, 흔함):
1. `퍼블릭 IP 없음` 선택 → 업데이트 (임시 IP 분리, 인스턴스 외부 접근 잠시 끊김)
2. 같은 행 ⋮ → 편집 다시 → 이제 `예약된 퍼블릭 IP` 활성화
3. `기존 reserved IP 사용` → `msa-public-ip` 선택 → 업데이트

→ 새 reserved IP attach 완료. CLI 검증:

```bash
oci network public-ip get --public-ip-address <NEW_IP> \
  --query 'data.{lifetime:lifetime,assigned:"assigned-entity-type"}'
# 기대: {"lifetime":"RESERVED","assigned":"PRIVATE_IP"}
```

### 변환 후 영향

- 외부 노출 IP 가 `<OLD_IP>` → `<NEW_IP>` 로 바뀜
- 이미 DNS A 레코드를 설정한 상태면 7개 다 갱신 필요 (Phase 5.1 참조)
- 이미 SSH alias 설정돼 있으면 `~/.ssh/config` 의 HostName 도 갱신 (Phase 4.1)
- cert-manager / k8s / Argo CD 자체엔 무관 — cert 는 도메인 기반이라 IP 변경 영향 0

> 처음 셋업이면 1.7 을 먼저 끝내고 (또는 instance 생성 직후 즉시) Phase 4 부터
> 새 IP 로 진행. 기존 임시 IP 로 셋업 완료한 상태라면 Reserved 로 변환 후
> DNS / SSH config / `~/.commerce-env` 갱신만 하면 끝 (cluster 재배포 불필요).

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
    HostName 168.107.22.114
    User ubuntu
    IdentityFile ~/.ssh/oracle
EOF
chmod 600 ~/.ssh/config
```

IP / key 파일명은 본인 환경 맞춰 수정. 이후 `ssh msa-oci` 한 줄로 접속.

> **IP 가 바뀐 경우** (Ephemeral → Reserved 변환 직후 등): HostName 만 수정
> 하고 옛 IP 의 host key cache 도 같이 제거해야 SSH host key warning 안 뜸.
> 
> ```bash
> sed -i '' 's/<OLD_IP>/<NEW_IP>/' ~/.ssh/config
> ssh-keygen -R <OLD_IP>
> ssh msa-oci   # 첫 접속 시 fingerprint 확인 → yes
> ```

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
export PUBLIC_IP='168.107.22.114'
export DOMAIN='1989v.com'
EOF
chmod 600 ~/.commerce-env
```

> ⚠ `~/.commerce-env` 는 절대 git 에 commit 하지 말 것. chmod 600 으로 본인만 읽기.

이후 install.sh 재실행 등 OCIR 자격 필요할 때:

```bash
source ~/.commerce-env
./k8s/argocd/install.sh "$PUBLIC_IP" "$LE_EMAIL" https://github.com/1989v/msa.git "$DOMAIN"
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

> **사전 조건**: Cloudflare (또는 다른 DNS provider) 에 다음 A 레코드가 등록돼
> 있어야 한다. cert-manager 의 HTTP01 challenge 가 도메인을 IP 로 해소할 수
> 있어야 cert 발급된다.
>
> | Type | Name      | Value          | Proxy        | 가는 곳 |
> |------|-----------|----------------|--------------|---------|
> | A    | `@` (root)| `$PUBLIC_IP`   | DNS only     | portal-fe |
> | A    | admin     | `$PUBLIC_IP`   | DNS only     | admin-fe |
> | A    | quant     | `$PUBLIC_IP`   | DNS only     | quant-fe |
> | A    | gft       | `$PUBLIC_IP`   | DNS only     | gifticon-fe |
> | A    | agent     | `$PUBLIC_IP`   | DNS only     | agent-viewer-fe |
> | A    | api       | `$PUBLIC_IP`   | DNS only     | gateway (REST) |
> | A    | rt        | `$PUBLIC_IP`   | DNS only ★ | gateway (WS/SSE bypass) |
> | A    | argocd    | `$PUBLIC_IP`   | DNS only ★ | Argo CD UI |
>
> 검증: `dig +short $DOMAIN admin.$DOMAIN quant.$DOMAIN gft.$DOMAIN agent.$DOMAIN api.$DOMAIN rt.$DOMAIN argocd.$DOMAIN` → 8줄 모두 `$PUBLIC_IP` 반환.
>
> Cloudflare 팁: root A 레코드는 Name 칸에 `@` 또는 도메인 자체 입력. 첫 셋업
> 시엔 모두 **회색 구름 (DNS only)** 로 — HTTP01 challenge 가 정상 동작하려면
> direct 도달 가능해야 함. Phase 6 (선택, 아래) 에서 6개 records (root + admin
> + quant + gft + agent + api) 를 orange cloud 로 토글. rt 와 argocd 는 영구
> gray (★) — rt 는 WebSocket/SSE bypass 용, argocd 는 운영 도구 격리.

```bash
source ~/.commerce-env   # OCIR 시크릿 + DOMAIN 환경변수 로드
./k8s/argocd/install.sh "$PUBLIC_IP" "$LE_EMAIL" https://github.com/1989v/msa.git "$DOMAIN"
```

자동 처리 (~5-10분):
1. `commerce` namespace + `ocir-pull-secret` (docker-registry 형식) 생성
2. 기존 ServiceAccount 모두에 imagePullSecrets 부착
3. legacy sa-pullsecret-patcher 잔여 리소스 정리
4. Helm 으로 Argo CD 설치 (controller 768Mi, server/repo 192Mi)
5. `Application/commerce` CRD apply — `spec.source.kustomize.patches` 로
   DOMAIN/email 주입 (placeholder override)
6. UI ingress (argocd.$DOMAIN) + Let's Encrypt TLS 인증서 발급 대기

종료 시:

```
╭─────────────────────────────────────────────────────────────────╮
│  ✅ Argo CD 설치 완료                                            │
├─────────────────────────────────────────────────────────────────┤
│  UI URL    : https://argocd.1989v.com
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
https://argocd.<DOMAIN>/
ID  : admin
PW  : (5.1 의 출력값)
```

좌측 commerce app 클릭 → 모든 resource 상태 시각화.

## 6.2 commerce 플랫폼 (host 별 분리)

| URL | 화면 |
|---|---|
| `https://<DOMAIN>/` | portal-fe (메인 진입, 코드딕셔너리/포트폴리오) |
| `https://admin.<DOMAIN>/` | admin-fe |
| `https://quant.<DOMAIN>/` | quant-fe |
| `https://gft.<DOMAIN>/` | gifticon-fe |
| `https://agent.<DOMAIN>/` | agent-viewer-fe |
| `https://api.<DOMAIN>/api/v1/products?page=0&size=10` | gateway REST 직접 |
| `https://<DOMAIN>/api/v1/products?page=0&size=10` | 동일, FE same-origin 호출 경로 |
| `https://rt.<DOMAIN>/...` | gateway (WS/SSE 직접, CF bypass 용) |

각 FE subdomain Ingress 는 `/api`, `/ws`, `/sse`, `/actuator`, `/svc` 를 같은
host 에서 gateway 로 proxy 한다 → FE 코드는 CORS 없이 `/api/*` 동일 origin
호출 유지. 직접 API 클라이언트 (postman/mobile) 는 `api.<DOMAIN>` 사용.

첫 접속 시 cert 발급 대기로 5분간 503 가능. 또는 인증서가 staging 으로 떨어진
경우 브라우저 경고 — 아래 "Known Issues" 참조.

---

# Phase 7 — Cloudflare Proxy 활성화 (선택, 권장)

기본 셋업 끝나고 6/`@`/admin/quant/gft/agent/api 가 동작 확인된 후 진행. CF
proxy 켜면 DDoS / WAF / CDN 캐싱 / IP 은닉 효과. rt 와 argocd 는 영구 gray
(WS bypass / 운영 도구).

## 7.1 Cloudflare Origin CA cert 발급 (Plan B)

CF Origin CA cert 는 **15년 유효** wildcard cert. proxy 모드 전제. LE cert
90일 갱신 부담 0.

CF dashboard → 1989v.com → SSL/TLS → Origin Server → **Create Certificate**:

| 항목 | 값 |
|------|-----|
| Private key type | ECC (또는 RSA 2048) |
| Hostnames | `*.<DOMAIN>, <DOMAIN>` |
| Validity | 15 years |

→ Create → **Origin Certificate** + **Private Key** 두 박스 즉시 복사. private
key 는 한 번만 표시되므로 즉시 백업 (Apple Keychain 등).

## 7.2 k8s secret 등록 (VM)

VM 에서 heredoc 으로 직접 붙여넣기:

```bash
cat > ~/cf-origin.crt <<'EOF'
[Origin Certificate 내용 붙여넣기]
EOF

cat > ~/cf-origin.key <<'EOF'
[Private Key 내용 붙여넣기]
EOF

kubectl -n commerce create secret tls cf-origin-ca-tls \
  --cert="$HOME/cf-origin.crt" --key="$HOME/cf-origin.key" \
  && rm -P ~/cf-origin.crt ~/cf-origin.key
```

검증: `kubectl -n commerce get secret cf-origin-ca-tls`.

## 7.3 iCloud 백업 (선택, multi-device)

laptop 에서:
```bash
ssh msa-oci "kubectl -n commerce get secret cf-origin-ca-tls -o yaml" \
  > /tmp/cf-secret.yaml

read -rs "P?Passphrase: "; echo
BACKUP_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/백업/keychain"
mkdir -p "$BACKUP_DIR"
openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt \
  -in /tmp/cf-secret.yaml \
  -out "$BACKUP_DIR/cf-origin-ca-tls_$(date +%Y%m%d).yaml.enc" \
  -pass pass:"$P"
chmod 600 "$BACKUP_DIR/cf-origin-ca-tls_$(date +%Y%m%d).yaml.enc"
rm -P /tmp/cf-secret.yaml
unset P
```

복원: `openssl enc -d ... | ssh msa-oci 'kubectl apply -f -'`.

## 7.4 Cloudflare SSL/TLS mode

CF dashboard → 1989v.com → SSL/TLS → Overview → **Full (strict)** 로 변경.

→ 브라우저 ↔ CF 와 CF ↔ origin 둘 다 HTTPS + 유효 cert 검증. Origin CA cert
가 strict 통과.

## 7.5 DNS 6 records proxy ON (gray → orange)

CF dashboard → 1989v.com → DNS → Records. 각 행의 Proxy status 토글:

| Record | 전환 후 |
|--------|--------|
| `@` (root) | **Proxied** (orange) |
| `admin` | **Proxied** |
| `quant` | **Proxied** |
| `gft` | **Proxied** |
| `agent` | **Proxied** |
| `api` | **Proxied** |
| `rt` | DNS only ★ (그대로) |
| `argocd` | DNS only ★ (그대로) |

## 7.6 검증

laptop 에서 (1-2분 전파 대기 후):

```bash
# 6개 proxied host
for h in '' admin. quant. gft. agent. api.; do
  echo -n "${h}<DOMAIN> → "
  curl -sI "https://${h}<DOMAIN>/" -o /dev/null -w '%{http_code}\n'
done

# CF 헤더 확인
curl -sI https://<DOMAIN>/ | grep -iE 'server:|cf-ray:'
```

기대값:
- 200/308/401 응답 (cert handshake 성공)
- `server: cloudflare` + `cf-ray:` 헤더 보임 (proxy 통과)
- 브라우저로 https://<DOMAIN>/ → 자물쇠 → 발급자 = `WE1` 또는 `Let's Encrypt
  E7` (CF Universal SSL, free plan 기본값)

rt 검증:
```bash
curl -sI https://rt.<DOMAIN>/ | grep -iE 'server:|cf-ray:'
# server: nginx (or absent), cf-ray 없음 → bypass 정상
```

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
2. **NetworkPolicy 가 ACME solver Pod 차단** (가장 흔함, 아래 참조)
3. letsencrypt-staging 으로 발급됨 (untrusted CA)
4. Let's Encrypt rate limit
5. 브라우저 캐시 / HSTS (서버는 정상인데 브라우저만 옛 cert 캐싱)

진단 (한 번에):
```bash
kubectl -n commerce get certificate,order,challenge
```

- `READY=True` cert + `valid` order → 서버 정상, 브라우저 캐시 의심 (시크릿 창 검증)
- `state=pending` challenge 가 5분 이상 → ACME solver 도달 실패 (아래 NetworkPolicy 케이스)
- order 도 없음 → cert-manager / ClusterIssuer 자체 문제

실제 서빙되는 cert 발급자 확인 (브라우저 캐시 vs 서버 문제 판별):
```bash
echo | openssl s_client -connect <DOMAIN>:443 \
  -servername <DOMAIN> 2>/dev/null \
  | openssl x509 -noout -issuer
```
- `O = Let's Encrypt` → 정상, 브라우저 캐시 / HSTS 문제 (Chrome:
  `chrome://net-internals/#hsts` → Delete domain security policies)
- `O = Kubernetes Ingress Controller Fake Certificate` → ingress-nginx 가
  실제 cert 못 붙임 (TLS secret 누락 / Ingress.spec.tls 매핑 오류)
- `O = (STAGING) Let's Encrypt` → staging issuer 사용 중, prod 로 교체

### HTTPS challenge 영구 pending (NetworkPolicy 차단)

증상:
- `kubectl -n commerce get challenge` → `state=pending` 이 10분+ 유지
- `kubectl -n commerce describe challenge` → `Reason: Waiting for HTTP-01
  challenge propagation: wrong status code '502'`
- ingress-nginx 로그: `connect() failed (111: Connection refused) while
  connecting to upstream` (upstream = solver Pod IP:8089)

원인: commerce ns 의 `default-deny-all` NetworkPolicy 가 cert-manager 가
동적 생성하는 ACME solver Pod (라벨 `acme.cert-manager.io/http01-solver=true`)
의 인바운드도 차단. ingress-nginx → solver:8089 패킷이 CNI 에서 drop/RST
처리되어 nginx 입장에선 connection refused.

해결: `k8s/base/network-policy/17-allow-ingress-to-acme-solver.yaml` 이
ingress-nginx ns → solver Pod :8089 만 명시 허용. main 반영 후 Argo CD sync
또는 즉시 적용:
```bash
kubectl apply -f k8s/base/network-policy/17-allow-ingress-to-acme-solver.yaml
```

자동 재시도까지 1-2분. cert-manager 가 challenge self-check 통과하면 Order →
valid, Cert → Ready, solver Ingress/Pod 자동 정리. 그 후엔 `curl http://...
/.well-known/acme-challenge/test` 가 308 (HTTPS 리다이렉트) 응답이 정상 — cert
발급 완료 후 challenge path 가 사라지고 일반 ingress 가 받기 때문.

### stuck 시 강제 재시도

NetworkPolicy 까지 정상인데도 풀리지 않으면 cert/order 삭제하면 cert-manager
가 신규 challenge 생성하며 재시도:
```bash
kubectl -n commerce delete certificate gateway-nipio-tls frontend-nipio-tls
```

## sa-pullsecret-patcher 잔여 리소스 (legacy)

ADR-0019 phase 6 이후 `oci-arm` overlay 는 모든 Deployment/CronJob/Job Pod
spec 에 `imagePullSecrets: [{name: ocir-pull-secret}]` 를 JSON 6902 patch 로
직접 주입한다 (`k8s/overlays/oci-arm/patches/image-pull-secret-*.yaml`).
따라서 별도 SA patcher CronJob 은 불필요하며 install.sh 에서도 제거됨
(commit 2f5b2df).

구버전 install.sh 로 부트스트랩한 클러스터에는 legacy 리소스가 남아 있어
`bitnami/kubectl:1.31` Docker Hub rate limit 으로 ImagePullBackOff 가 계속
보일 수 있다. 본 서비스 트래픽엔 영향 없으나 Argo CD/K8s 상태가 지저분하므로
정리 권장:
```bash
kubectl -n commerce delete cronjob sa-pullsecret-patcher --ignore-not-found
kubectl -n commerce delete job \
  -l batch.kubernetes.io/cronjob-name=sa-pullsecret-patcher --ignore-not-found
kubectl -n commerce get pods --no-headers \
  | awk '/^sa-pullsecret-patcher/{print $1}' \
  | xargs -r kubectl -n commerce delete pod
kubectl -n argocd annotate app commerce \
  argocd.argoproj.io/refresh=hard --overwrite
```

검증 (실패 Pod 없어야 함):
```bash
kubectl -n commerce get pods --no-headers \
  | awk '$3 != "Running" && $3 != "Completed"'
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
| `k8s/overlays/oci-arm/` | commerce 매니페스트 (k3s-lite 베이스 + 도메인 TLS + tier 별 리소스) |
| `.github/workflows/ci.yml` | PR 게이트: compile / yaml duplicate / kustomize |
| `.github/workflows/images.yml` | 변경 서비스만 빌드 → OCIR → manifest 갱신 commit-back |
| `.github/workflows/submodule-bump.yml` | (수동) auth/gifticon submodule pointer 갱신 |

---

# 향후 전환 옵션

| 시점 | 작업 |
|---|---|
| Cloudflare proxy 모드 | DNS 를 proxied (orange cloud) 로 전환 + WebSocket/SSE timeout 튜닝 → DDoS 차단 + 캐싱 |
| 멀티 클러스터 / 팀 확장 | public app repo + private env repo 분리 (App-of-Apps 패턴) |
| 메모리 압박 심해질 때 | Argo CD → Flux (~150Mi 절감) 또는 비핵심 서비스 replicas: 0 |
| arm64 + amd64 동시 지원 | `commerce.jib-convention.gradle.kts` 의 jibPlatforms 다중화 |
