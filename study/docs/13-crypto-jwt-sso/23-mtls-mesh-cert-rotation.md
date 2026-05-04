---
parent: 13-crypto-jwt-sso
seq: 23
title: mTLS in mesh / SPIFFE / Cert rotation / OCSP / CT log — service identity 운영
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 16-tls.md
  - 17-mtls.md
  - 15-hsm.md
  - 22-jwt-pitfalls-zero-trust.md
sources:
  - https://spiffe.io/docs/latest/spiffe-about/spiffe-concepts/
  - https://github.com/spiffe/spiffe/blob/main/standards/SPIFFE.md
  - https://github.com/spiffe/spiffe/blob/main/standards/X509-SVID.md
  - https://datatracker.ietf.org/doc/html/rfc8446
  - https://datatracker.ietf.org/doc/html/rfc6960
  - https://datatracker.ietf.org/doc/html/rfc6962
  - https://istio.io/latest/docs/concepts/security/
  - https://linkerd.io/2/features/automatic-mtls/
catalog-row: "§D mTLS in mesh / cert rotation / SPIFFE-SPIRE / OCSP / CT log / HSM-backed CA"
---

# 23. mTLS in mesh / SPIFFE / Cert rotation / OCSP / CT log — service identity 운영

> 카탈로그 매핑: §99 §D — `mTLS in mesh (Istio/Linkerd auto rotation)` (★ → ✅), `Service identity (SPIFFE ID / X.509 SVID / JWT SVID)` (★ → ✅), `Certificate rotation 자동화 (short-lived)` (★ → ✅), `Cert chain validation pitfalls` (★ → ✅), `OCSP / OCSP Stapling / CRL` (★ → ✅), `Certificate Transparency (CT log)` (★ → ✅), `HSM-backed CA` (★ → ✅).
> 학습 시간 예상: ~3h · 자가평가 입구 레벨: B+

> "TLS 양방향 검증" 으로 정의되는 mTLS 는 도서관 정의일 뿐. 실무 mTLS 는 (1) **service identity** 를 cert 에 어떻게 박을지, (2) cert 를 어떻게 자동 회전할지 (24h 주기), (3) chain / revocation / CT log 를 어떻게 검증할지, (4) root CA 를 HSM 으로 어떻게 보호할지 — 4 면이 모두 풀려야 한다. 본 deep file 은 service mesh (Istio / Linkerd) 의 auto mTLS, SPIFFE/SPIRE, short-lived cert rotation, OCSP / Stapling / CRL, Certificate Transparency, HSM-backed CA 까지 다룬다.

---

## 1. 한 줄 핵심

> **mTLS 운영 = "identity (SPIFFE) → 발급 (SPIRE/Citadel) → 회전 (short-lived) → 검증 (chain + revocation + CT)" 4 파이프라인.**
> 핵심은 cert 수명을 분/시간 단위로 줄여서 revocation 자체가 거의 불필요하게 만드는 것. 그래서 service mesh 가 "auto mTLS" 라는 말로 묶여 팔린다. root CA 는 HSM 안에서만 살고, 외부에 노출되는 모든 cert 는 짧고 자동.

---

## 2. 등장 배경

### 2-1. "TLS 만으로 충분" 의 종말 — zero-trust 의 부상

기존 보안 모델: VPC / 사내망 안은 신뢰, 외부만 검증. 문제:

- 측면 이동 (lateral movement) — 한 서비스 침해 시 같은 네트워크 안 모든 서비스 호출 가능.
- 네트워크 경계가 컨테이너 / 멀티 클라우드 / SaaS 로 흐려짐.
- 내부 서비스 간 호출에도 누가 누구인지 증명 필요.

zero-trust = 모든 서비스 간 호출이 인증 + 인가 + 암호화. 그 인프라 표준이 mTLS.

### 2-2. 손으로 cert 발급하던 시절의 사고

- cert 만료 — 모니터링 누락 → 새벽 2 시 장애 (LinkedIn 2018, Spotify 2020 등 다수).
- 한 서비스의 long-lived cert 유출 → 회수 (revocation) 불가능 / 늦음 → 영구 도용.
- ops 팀이 OpenSSL CLI 로 발급 → 키 PEM 파일이 git 에 commit 되는 사고.

→ 자동 회전 + short-lived cert 가 표준.

### 2-3. service identity 표준의 부재

- "어느 cert 가 어느 서비스인가" — CN/SAN 에 다양한 형식 (DNS, URL, custom).
- 멀티 클라우드 / 멀티 클러스터 에서 동일 ID 표현 어려움.

→ SPIFFE (Secure Production Identity Framework For Everyone) 가 표준 ID 형식 (`spiffe://trust-domain/path`) 정의.

### 2-4. revocation 의 슬픈 역사

| 메커니즘 | 문제 |
|---|---|
| CRL (Certificate Revocation List) | 매 검증마다 CA 가 게시한 거대한 리스트 다운로드 → 거의 사장 |
| OCSP (Online Certificate Status Protocol) | privacy 누출 (CA 가 누가 어디 접속하는지 봄) + latency + soft-fail (응답 못 받으면 통과) |
| OCSP Stapling | 서버가 미리 받은 OCSP 응답을 동봉 — 개선이지만 여전히 limited |
| CRLite | 브라우저 측 압축 CRL — Chrome / Firefox 가 일부 도입 |
| **Short-lived cert (24h)** | 만료가 곧 revocation — 표준이 됨 |

→ 결국 "cert 수명을 짧게 → revocation 거의 불필요" 가 현대 답.

### 2-5. CT (Certificate Transparency) 의 등장

- DigiNotar 사고 (2011): 가짜 CA 가 \*.google.com cert 를 발급 → 이란이 Gmail MITM.
- 그 후 모든 신뢰 CA 가 발급한 cert 를 공개 로그에 등록 강제 (Chrome 정책 2018+).
- misissue 가 발생하면 도메인 소유자가 로그 모니터링으로 즉시 감지.

### 2-6. HSM 의 역할

- root CA 의 private key 가 노출되면 모든 발급 cert 신뢰성 붕괴 → "회사 망함" 수준.
- HSM (Hardware Security Module) 안에서만 root key 사용 + 서명 → 외부에 절대 노출 안 됨.
- FIPS 140-2 Level 3 / 140-3 Level 3 가 표준.

---

## 3. 동작 원리

### 3-1. mTLS 핸드셰이크 (TLS 1.3 기준)

```
Client                                            Server
  |  ClientHello (alpn, sni, signature_algorithms, ...)  →
  |  ←  ServerHello, EncryptedExtensions, Certificate, CertificateVerify, Finished
  |                                              + CertificateRequest (mTLS 시)
  |  Certificate (client cert), CertificateVerify (client priv key 서명), Finished  →
  |  ←  application data
```

핵심 검증:
- 서버 cert 의 chain → root CA (양측 trust store) 에 도달 ?
- SAN (Subject Alternative Name) / SPIFFE URI 가 expected identity 와 일치 ?
- not_before / not_after 윈도우 안 ?
- (option) revocation 검사 (OCSP / Stapling / CRL).
- (option) CT proof 검증 (브라우저는 강제, internal mTLS 는 통상 생략).

### 3-2. SPIFFE ID 와 SVID

#### SPIFFE ID 형식

```
spiffe://<trust-domain>/<path>

예:
  spiffe://msa.local/sa/product
  spiffe://msa.local/sa/order
  spiffe://prod.acme.com/cluster/eu-west/ns/checkout/sa/api
```

- trust-domain = 한 신뢰 경계 (보통 회사 / 클러스터).
- path = 워크로드 식별 (Kubernetes ServiceAccount, AWS IAM role 등에 매핑).

#### SVID (SPIFFE Verifiable Identity Document)

| 종류 | 형식 | 용도 |
|---|---|---|
| **X.509-SVID** | X.509 cert + URI SAN = SPIFFE ID | mTLS 핸드셰이크 |
| **JWT-SVID** | JWT (alg=ES256/RS256, sub=spiffe id) | HTTP request 인증 (mesh 통과 후 application 레벨) |

X.509-SVID 의 SAN 예시:

```
X509v3 Subject Alternative Name: critical
    URI:spiffe://msa.local/sa/product
```

→ CN/DNS 이 아닌 URI SAN 으로 식별. 검증 측은 cert 안의 URI 가 expected SPIFFE ID 와 일치하는지 확인.

### 3-3. SPIRE — SPIFFE 의 reference 구현

```
┌──────────────────────────────────────────────────────────────┐
│                   SPIRE Server                               │
│  - registration entries (어떤 워크로드가 어떤 SPIFFE ID 받나)│
│  - signing CA (intermediate)                                 │
│  - root CA 는 HSM 또는 upstream                              │
└────────────────────────┬─────────────────────────────────────┘
                         │ Workload API (gRPC over UDS)
   ┌─────────────────────┼─────────────────────┐
   ▼                     ▼                     ▼
┌──────────┐       ┌──────────┐         ┌──────────┐
│ SPIRE    │       │ SPIRE    │         │ SPIRE    │
│ Agent    │       │ Agent    │         │ Agent    │
│ (node)   │       │ (node)   │         │ (node)   │
└────┬─────┘       └────┬─────┘         └────┬─────┘
     │ attestation        │                   │
     ▼                    ▼                   ▼
  workload            workload            workload
  (product pod)       (order pod)         (gateway pod)
```

흐름:
1. Agent 가 노드를 attest (k8s SA token / EC2 IID / GCP IAM).
2. workload (pod) 가 Workload API (`/run/spire/sockets/agent.sock`) 에 connect.
3. Agent 가 workload selector (k8s namespace / SA / labels) 로 매칭.
4. Server 가 SVID 발급 → Agent 가 workload 에 전달.
5. SVID 가 1 시간 (default) 만료 → 만료 50% 시점에 자동 갱신.

### 3-4. Istio 의 auto mTLS

```
Application (msa-product:8080)
       │
       ▼
   Envoy sidecar     ← Citadel (이젠 istiod) 가 cert 발급, 24h 주기 회전
       │  TLS
       ▼
   Network → Envoy sidecar (msa-order)
       │
       ▼
   Application (msa-order:8080)
```

- mesh 안 모든 트래픽이 sidecar 를 거치며 mTLS 자동.
- application 코드는 plain HTTP — TLS 신경 안 씀.
- `PeerAuthentication` CRD (Custom Resource Definition) 로 strict / permissive / disable 모드 설정.
- `AuthorizationPolicy` 로 SPIFFE ID 기반 RBAC.

```yaml
# 모든 mesh 가 strict mTLS 강제
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT

---
# product 서비스는 order, gateway 의 SA 만 호출 허용
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: product-allow-order-gateway
  namespace: msa
spec:
  selector:
    matchLabels:
      app: product
  rules:
    - from:
        - source:
            principals:
              - "cluster.local/ns/msa/sa/order"
              - "cluster.local/ns/msa/sa/gateway"
```

### 3-5. Linkerd 의 auto mTLS

- Istio 보다 가벼움 — Linkerd2-proxy (Rust) 가 sidecar.
- identity controller 가 24h cert 자동 회전.
- 워크로드 ID = `<sa>.<namespace>.serviceaccount.identity.linkerd.cluster.local` (SPIFFE 호환 변형).

| | Istio | Linkerd |
|---|---|---|
| sidecar | Envoy (C++) | linkerd2-proxy (Rust) |
| memory | ~50~100 MB | ~10~20 MB |
| identity | SPIFFE | SPIFFE-호환 (별도 형식) |
| 정책 | AuthorizationPolicy | Server / ServerAuthorization |
| 사용 적합 | 큰 조직 / 풍부한 정책 | 단순 / 성능 민감 |

### 3-6. Short-lived cert 회전 자동화

| 수명 | 회전 주기 | revocation 필요성 |
|---|---|---|
| 1 년 | 매년 | 강함 (CRL/OCSP 필요) |
| 90 일 (Let's Encrypt) | 60 일 | 약 (실용적 short) |
| **24 시간** (mesh 표준) | 12 시간 | 거의 0 |
| 1 시간 (SPIRE default) | 30 분 | 0 |

회전 패턴:

```
T=0    : cert v1 발급, valid for 24h
T=12h  : v2 발급 (50% 시점), application 이 listener 에 v2 hot-reload
         → 클라이언트 측 다음 핸드셰이크부터 v2 사용
T=24h  : v1 만료 (이미 v2 가 active 라 무영향)
```

Hot-reload 핵심:
- Envoy / Linkerd2-proxy 의 SDS (Secret Discovery Service) — cert 가 file/socket 으로 푸시되면 listener 재로드.
- application 직접 (Kotlin/Java): `SslContext` 를 atomic reference 로 swap, 새 connection 부터 적용.

### 3-7. Cert chain validation 함정

```
[Root CA] (self-signed)
   ↓ signs
[Intermediate CA] (서명 권한 위임)
   ↓ signs
[Leaf cert] (실제 워크로드)
```

함정:

| 함정 | 설명 |
|---|---|
| **chain 누락** | 서버가 leaf 만 보내고 intermediate 누락 → 클라이언트가 chain build 실패. AIA fetching 으로 우회되긴 하지만 latency / 일부 클라이언트는 실패 |
| **wrong order** | leaf → intermediate → root 순서 (대부분 라이브러리는 양방향 OK 하지만 일부 strict) |
| **expired intermediate** | leaf 는 valid 하지만 intermediate 가 만료 → 전체 chain 무효. 2020년 AddTrust root 만료 사고 |
| **root in chain** | self-signed root 를 chain 에 포함 — 무의미하고 일부 클라이언트가 거부 |
| **trust store 누락** | 컨테이너 image 의 `/etc/ssl/certs/ca-certificates.crt` 가 stale → 새 root CA 검증 실패 |
| **EKU mismatch** | Extended Key Usage 가 serverAuth 인데 clientAuth 시도 (또는 반대) |
| **SAN 누락** | 옛 cert 가 CN 만 있고 SAN 없음 — 현대 클라이언트 (Chrome 58+) 는 SAN 만 사용 |

### 3-8. OCSP / Stapling / CRL

#### OCSP (RFC 6960)

```
Client        OCSP responder (CA 운영)
  | 요청: "이 cert 가 valid 한가?"  →
  | ←  응답: { good / revoked / unknown, signed by CA }
```

문제:
- privacy: CA 가 클라이언트의 모든 접속을 봄.
- latency: 추가 RTT.
- soft-fail: 응답 못 받으면 통과 (공격자가 차단 가능).

#### OCSP Stapling (RFC 6066)

```
Server pre-fetch       Client
  | 미리 OCSP 응답 캐시
  ▼
Client TLS handshake
  ←  Certificate + stapled OCSP response  
```

- 서버가 OCSP 응답을 미리 받아 핸드셰이크에 동봉.
- privacy 해결, latency ↓, but 아직 hard-fail 강제 불가.
- `Must-Staple` extension (RFC 7633) 가 cert 에 박혀있으면 stapled 응답 없을 시 hard-fail.

#### CRL (Certificate Revocation List)

- CA 가 주기적으로 게시하는 revoked serial 리스트.
- 거대 (수 MB) → 클라이언트 부담 → 거의 사장.
- internal mTLS 에서는 short-lived cert 로 대체.

#### 현대 답: short-lived + revocation 거의 불필요

```
internal mesh:  cert 24h → 사고 시 다음 회전까지 12h 대기 또는 강제 회전
public TLS:    OCSP Stapling + Must-Staple + 90 일 cert (Let's Encrypt)
모바일:        CRLSets / CRLite 에 의존
```

### 3-9. Certificate Transparency (RFC 6962)

```
CA 발급
  ↓
SCT (Signed Certificate Timestamp) ← CT log 가 발급
  ↓
cert 의 extension 또는 OCSP response 또는 TLS extension 으로 동봉
  ↓
Client: SCT 검증 — log 가 본 적 있는 cert 인가
```

도메인 소유자는 CT log monitoring (Google `crt.sh`, Facebook `developers.facebook.com/tools/ct/`) 으로 자기 도메인의 모든 발급 cert 추적 → misissue 감지.

internal CA 는 CT 등록 안 함 (privacy). public 대상 cert 만 CT 강제.

### 3-10. HSM-backed CA

```
[HSM (FIPS 140-2 Level 3)]
  - root CA private key (NEVER 외부 노출)
  - sign 요청만 받음 (PKCS#11 / KMIP API)
       │
       ▼
[Online CA / signing service]
  - intermediate CA cert + intermediate private key (HSM 또는 KMS)
       │
       ▼
[Issuance API] (cert-manager / SPIRE / Vault PKI)
  - leaf cert 발급
```

- root CA 는 보통 **offline** + HSM. 1 년에 1 번 정도 새 intermediate 서명 시만 켬.
- intermediate 도 HSM 권장 (cloud KMS / AWS CloudHSM).
- compromise 시 intermediate 만 revoke + 새 intermediate 발급 → root 는 무손상.

#### FIPS 140-2 / 140-3 Level

| Level | 보호 강도 |
|---|---|
| 1 | software 만, 기본 보호 |
| 2 | tamper-evidence (열면 흔적 남음) |
| **3** | tamper-resistant (열면 키 즉시 zero out), role-based auth | ← 표준 |
| 4 | tamper-detection + 환경 변동 (전압, 온도) 감지 |

→ AWS CloudHSM, GCP Cloud HSM, Thales Luna, YubiHSM 2 등이 Level 3.

---

## 4. 사용 예제

### 4-1. SPIRE 배포 + 워크로드 등록

```bash
# 1) SPIRE Server 배포 (Helm)
helm install spire-server spire-server/spire-server \
  --set "trustDomain=msa.local"

# 2) SPIRE Agent (DaemonSet)
helm install spire-agent spire-server/spire-agent \
  --set "server.address=spire-server.spire.svc"

# 3) 워크로드 등록
kubectl exec -it spire-server-0 -- \
  bin/spire-server entry create \
    -spiffeID spiffe://msa.local/sa/product \
    -parentID spiffe://msa.local/spire/agent/k8s_sat/msa/<node> \
    -selector k8s:ns:msa \
    -selector k8s:sa:product \
    -ttl 3600
```

### 4-2. 워크로드 코드 (Java SPIFFE Library)

```kotlin
import io.spiffe.workloadapi.WorkloadApiClient
import io.spiffe.workloadapi.X509Source

val source = X509Source.newSource()         // /run/spire/sockets/agent.sock 자동 connect
val mySvid = source.x509Svid                // 자기 cert (자동 갱신됨)

// Server 측: 자기 cert 로 listen
val sslContext = ServerTlsSocketFactory(source)
val server = HttpServer.create(InetSocketAddress(8443), 0)
// (실무: Netty / Spring SslContext 와 결합)

// Client 측: 동일하게 source 로 cert 사용
val httpClient = HttpClient.newBuilder()
    .sslContext(SpiffeSslContextFactory.getSslContext(source))
    .build()
```

→ 코드는 cert 회전 신경 안 씀. `X509Source` 가 background 에서 새 cert fetch + ssl context 재구성.

### 4-3. Istio strict mTLS + RBAC (위 §3-4 참조 + 적용 명령)

```bash
kubectl apply -f peer-authentication.yaml
kubectl apply -f authorization-policy.yaml

# 검증
istioctl x describe pod product-7d8f-xyz -n msa
# → mTLS 모드 / 적용된 정책 / SPIFFE ID 출력
```

### 4-4. cert-manager + Let's Encrypt (public ingress)

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata: { name: letsencrypt-prod }
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ops@msa.local
    privateKeySecretRef: { name: letsencrypt-prod }
    solvers:
      - dns01:
          route53: { region: ap-northeast-2 }

---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata: { name: msa-tls, namespace: msa }
spec:
  secretName: msa-tls
  duration: 2160h        # 90 days
  renewBefore: 720h      # 30 days before expiry
  dnsNames: ["api.msa.local"]
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
```

### 4-5. Vault PKI 로 internal CA + auto rotation

```bash
# 1) PKI 활성화
vault secrets enable -path=pki pki
vault secrets tune -max-lease-ttl=87600h pki    # 10 년 root

# 2) Root CA 생성 (HSM 통합 권장)
vault write pki/root/generate/internal common_name=msa.local ttl=87600h

# 3) Role
vault write pki/roles/msa-service \
  allowed_domains=msa.local \
  allow_subdomains=true \
  max_ttl=24h            # 24h leaf

# 4) cert 발급 (애플리케이션이 Vault Agent 로 sidecar)
vault write pki/issue/msa-service common_name=product.msa.local
```

Vault Agent 가 cert lease 의 50% 지점에서 자동 renew + file write → application 이 fsnotify 로 reload.

### 4-6. OCSP Stapling 설정 (Nginx)

```nginx
server {
    listen 443 ssl http2;
    ssl_certificate     /etc/letsencrypt/live/msa.local/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/msa.local/privkey.pem;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 1.1.1.1 8.8.8.8 valid=300s;
    ssl_trusted_certificate /etc/letsencrypt/live/msa.local/chain.pem;
}
```

### 4-7. CT log monitoring (crt.sh)

```bash
# 우리 도메인의 모든 발급 cert 조회
curl 'https://crt.sh/?q=msa.local&output=json' | jq '.[] | {issuer_name, not_before, not_after}'

# 정기 모니터링: 이상 발급 (예상 CA 와 다른 issuer) 알림
```

운영: Cron 으로 daily 조회 + diff → Slack alert.

### 4-8. cert chain 검증 디버깅

```bash
# chain 완전성 검증
openssl s_client -connect api.msa.local:443 -showcerts < /dev/null

# leaf 의 SAN 확인
openssl x509 -in leaf.pem -noout -text | grep -A1 "Subject Alternative Name"

# chain 검증
openssl verify -CAfile root.pem -untrusted intermediate.pem leaf.pem

# 만료 일자
openssl x509 -in leaf.pem -noout -enddate
```

---

## 5. 트레이드오프 / 안티패턴

### 5-1. long-lived cert (1 년) + revocation 의존

- OCSP soft-fail 로 사실상 revocation 무력 / CRL 거대.
- mesh 환경: short-lived (24h) 가 표준.

### 5-2. cert 를 git / configmap 에 commit

- private key 가 git history 에 영구 남음.
- 발견 즉시 회전 + history rewrite + audit.

### 5-3. self-signed root 를 trust store 에 직접 import (production)

- 한 노드 침해로 root key 노출 시 전체 mesh 신뢰 붕괴.
- 대안: HSM-backed root + intermediate 로 sign + 노드는 intermediate 까지만 trust.

### 5-4. mesh 의 default permissive 모드 그대로 운영

```yaml
mtls: { mode: PERMISSIVE }   # plain + mTLS 둘 다 허용
```

- migration 용 임시 모드. 영구로 두면 plain 트래픽이 섞여서 의미 없음.
- 마이그레이션 끝나면 STRICT 강제.

### 5-5. 한 cert 로 여러 SPIFFE ID 표현 시도

- 1 cert = 1 SPIFFE ID 가 표준. 멀티 ID 는 multiple cert 또는 SVID list.

### 5-6. application 이 cert 를 메모리에 한 번만 load

- 회전 시 reload 누락 → 만료 후 장애.
- 패턴: file watch (fsnotify) 또는 SDS push + atomic SslContext swap.

### 5-7. SAN 에 wildcard 만 + 검증 측은 strict matching

- `*.msa.local` cert 로 `api.v2.msa.local` 검증 → 일부 라이브러리는 한 단계 wildcard 만 허용 (RFC 6125).
- 차라리 multi-SAN 명시.

### 5-8. trust store update 누락

- 컨테이너 base image 의 `ca-certificates` 가 1 년 전 — 새 root CA 검증 실패.
- 정기 base image 업데이트 + AppArmor 등으로 trust store 무결성 검증.

### 5-9. internal CA 를 browser trust store 에 추가

- 사용자 브라우저에 회사 root CA → 회사가 모든 HTTPS MITM 가능 (privacy 침해).
- internal CA 는 internal 워크로드에만 분배.

### 5-10. CT 로그 모니터링 부재

- 가짜 CA 가 우리 도메인 cert 발급해도 모름.
- 자동 monitoring + Slack alert 가 의무.

### 5-11. mTLS 만 적용 + application-level 인증 생략

- mTLS = 누가 호출했나 (peer identity). 무엇을 할 수 있나 (authorization) 는 별도.
- 패턴: mTLS + JWT (DPoP / JWT-SVID) + RBAC (SPIFFE ID 기반).

### 5-12. cert 만료 모니터링 부재

- 자동 회전 도입 후에도 회전 실패 → 만료 → 장애.
- alert: not_after - now < 7d 면 critical.

---

## 6. msa 적용

### 6-1. 현재 msa 의 mTLS 상태 (추정)

- ADR-0019 (K8s migration) 후 ingress-nginx + Let's Encrypt 로 외부 TLS 만 적용 가정.
- 내부 서비스 간 (gateway → product / order / search 등) 호출은 plain HTTP 추정.
- "VPC 안 = 신뢰" 모델 의존 → zero-trust 부재.

### 6-2. 도입 단계 (Phase plan)

```
Phase 0: 진단 (1주)
  - 모든 서비스 간 호출 inventory (gateway, product, order, search, member, ...)
  - 외부 노출 surface vs 내부 호출 분리

Phase 1: cert-manager + Let's Encrypt (외부) (1주)
  - api.msa.local TLS — 이미 했다면 skip

Phase 2: Linkerd 도입 — auto mTLS 시작 (3주)
  - permissive mode 로 시작 → 호환성 검증
  - 모든 namespace 에 sidecar inject

Phase 3: strict mTLS + RBAC (2주)
  - Linkerd Server / ServerAuthorization 정책
  - 또는 Istio AuthorizationPolicy

Phase 4: SPIRE 통합 (선택, 4주)
  - cross-cluster identity 필요 시
  - Linkerd 만으로 충분하면 skip

Phase 5: monitoring (1주)
  - cert 만료 alert
  - CT log monitoring (crt.sh)
  - mesh metric (Prometheus + Grafana)

Phase 6: short-lived cert 정책 강화 (1주)
  - leaf TTL 24h → 1h 로 단축 검토 (성능 측정 후)
```

### 6-3. Linkerd 도입 권장 이유 (vs Istio)

- msa 의 서비스 수 (~10) 와 트래픽 규모는 Istio overhead 가 과함.
- Linkerd 는 sidecar 메모리 ~20 MB, latency overhead < 1ms.
- auto mTLS 가 default + 간결한 정책 (Server/ServerAuthorization).

### 6-4. SPIFFE ID 매핑 (msa)

```
spiffe://msa.local/ns/msa/sa/gateway
spiffe://msa.local/ns/msa/sa/product
spiffe://msa.local/ns/msa/sa/order
spiffe://msa.local/ns/msa/sa/search
spiffe://msa.local/ns/msa/sa/member
spiffe://msa.local/ns/msa/sa/wishlist
spiffe://msa.local/ns/msa/sa/quant
spiffe://msa.local/ns/msa/sa/charting
spiffe://msa.local/ns/msa/sa/analytics
spiffe://msa.local/ns/msa/sa/experiment
```

→ Linkerd / Istio 가 자동으로 k8s SA 기반 SPIFFE 호환 ID 부여.

### 6-5. RBAC 정책 (예: product 가 누구로부터 호출 받나)

```yaml
# Linkerd
apiVersion: policy.linkerd.io/v1beta1
kind: Server
metadata:
  name: product-api
  namespace: msa
spec:
  podSelector:
    matchLabels: { app: product }
  port: 8080
  proxyProtocol: HTTP/1

---
apiVersion: policy.linkerd.io/v1beta1
kind: ServerAuthorization
metadata:
  name: product-api-allow
  namespace: msa
spec:
  server:
    name: product-api
  client:
    meshTLS:
      serviceAccounts:
        - name: gateway
        - name: order
        - name: search
```

→ gateway / order / search 만 product API 호출 가능. analytics 등이 잘못 호출하면 mesh 가 차단.

### 6-6. JWT-SVID 와 application-level 인증 결합

- mTLS = 서비스 identity (peer).
- JWT-SVID = 사용자 identity (end-user) 를 internal call 에 전파.
- gateway 가 외부 JWT (사용자) 검증 → internal call 에 JWT-SVID + user claim 동봉 → product 가 두 layer 모두 검증.

### 6-7. cert 만료 모니터링

```yaml
# Prometheus alert
- alert: ServiceCertExpiringSoon
  expr: (cert_not_after - time()) / 86400 < 7
  for: 1h
  annotations:
    summary: "{{ $labels.service }} cert 만료 7일 이내"
```

- Linkerd / Istio 가 자체 metric 노출.
- 외부 (Let's Encrypt) cert 도 prometheus-blackbox-exporter 로.

### 6-8. CT log monitoring 자동화

```bash
# k8s CronJob
schedule: "0 9 * * *"
script: |
  curl -s 'https://crt.sh/?q=msa.local&output=json' | \
    jq -r '.[] | select(.not_before > "'"$YESTERDAY"'") | .issuer_name' | \
    grep -v "Let's Encrypt" | head -1 | \
    if read line; then
      slack-notify "CT alert: 예상치 못한 issuer = $line"
    fi
```

---

## 7. ADR 후보

> **ADR-XXXX-13f: 서비스 간 mTLS 도입 — Linkerd auto mTLS + SPIFFE-호환 identity**
>
> **Context**: msa 는 ingress-nginx 로 외부 TLS 만 적용, 내부 서비스 간 호출은 plain HTTP. "VPC 안 = 신뢰" 모델 의존 → 한 서비스 침해 시 lateral movement 자유, 측면 인증 부재. 컴플라이언스 (PCI-DSS / GDPR) 관점에서도 in-transit 암호화 요구 증가.
>
> **Decision**:
> 1. **Linkerd 도입** — Istio 보다 가볍고 auto mTLS 가 default. 24h cert 자동 회전.
> 2. **strict mTLS** — permissive 로 마이그레이션 후 STRICT 강제.
> 3. **RBAC by SPIFFE ID** — Server / ServerAuthorization 으로 호출 매트릭스 정의.
> 4. **JWT-SVID 또는 user JWT 전파** — application-level 사용자 identity 는 별도 layer.
> 5. **cert 만료 alert** — Prometheus + Slack.
> 6. **CT log monitoring** — daily CronJob, 비예상 issuer 감지.
>
> **Consequences**:
> - (+) zero-trust internal, lateral movement 차단.
> - (+) 사고 시 blast radius 축소 (서비스 단위 cert).
> - (+) 컴플라이언스 만족.
> - (-) sidecar 메모리 / CPU 추가 (~20MB / pod).
> - (-) 운영 복잡도 ↑ (mesh 디버깅 학습).
>
> **Alternatives 검토**:
> - Istio — 기능 풍부하지만 overhead 과함 (msa 규모에서). 채택 ❌
> - 직접 mTLS (no mesh) — 회전 자동화 부재. 채택 ❌
> - mTLS 미도입 (현행 유지) — zero-trust 부재. 채택 ❌

> **ADR-XXXX-13g: Internal CA 운영 — HSM-backed + short-lived leaf**
>
> **Decision**:
> 1. Root CA private key 는 AWS CloudHSM (FIPS 140-2 Level 3) 안에서만 사용. 1 년에 1 번 정도 사용.
> 2. Intermediate CA 는 KMS-backed (AWS KMS asymmetric key) 또는 별도 HSM.
> 3. Leaf cert TTL = 24h (mesh default), 1h 로 단축 검토.
> 4. Public-facing cert 는 Let's Encrypt (90 일).
>
> **Consequences**:
> - (+) root key 노출 위험 ~0.
> - (+) revocation 거의 불필요.
> - (-) HSM 비용 ($/hour).

---

## 8. 면접 한 줄 답변

### Q. mTLS 가 일반 TLS 와 다른 점은?

> "TLS 는 서버 인증만 강제하고 클라이언트 인증은 선택입니다. mTLS 는 클라이언트도 cert 를 제시하고 서버가 검증해서 양방향 신뢰를 만듭니다. zero-trust 모델에서 서비스 간 호출의 peer identity 를 증명하는 표준이고, service mesh (Istio / Linkerd) 가 sidecar 로 자동화해서 application 코드는 plain HTTP 그대로 두고도 mTLS 를 적용할 수 있습니다."

### Q. SPIFFE 와 SVID 가 무엇이고 왜 필요한가요?

> "SPIFFE 는 \"어떤 워크로드가 누구인가\" 를 표준화한 프레임워크입니다. ID 형식이 `spiffe://<trust-domain>/<path>` 로 통일되고, 이걸 X.509 cert 의 URI SAN 에 박은 게 X.509-SVID, JWT 의 sub 에 넣은 게 JWT-SVID 입니다. CN/DNS 같은 다양한 형식 대신 멀티 클러스터 / 멀티 클라우드에서 같은 ID 표현이 가능하고, SPIRE 가 attestation 기반으로 자동 발급합니다. Istio / Linkerd 가 내부적으로 이 표준을 따릅니다."

### Q. cert short-lived (24h) 가 long-lived (1년) 보다 안전한 이유는?

> "revocation 자체가 거의 불필요해집니다. long-lived cert 는 노출됐을 때 OCSP / CRL 로 무효화해야 하는데, OCSP 는 privacy 누출 + soft-fail 로 사실상 무력하고 CRL 은 거대해서 사장됐습니다. 24h cert 는 만료가 곧 revocation 이라, 사고 시 최대 24h 만 견디면 자동 정리됩니다. service mesh 가 cert 회전을 sidecar 가 자동으로 처리해주니 운영 부담 없이 적용 가능합니다."

### Q. OCSP, OCSP Stapling, CRL 의 차이는?

> "CRL 은 CA 가 게시하는 거대한 revoked serial 리스트인데, 거의 사장됐습니다. OCSP 는 클라이언트가 매 검증마다 CA 에 \"이 cert 살아있나\" 묻는 방식인데, privacy 누출 + 추가 RTT + 응답 못 받으면 통과 (soft-fail) 라는 단점이 있습니다. OCSP Stapling 은 서버가 미리 받은 OCSP 응답을 핸드셰이크에 동봉해서 privacy 와 latency 문제를 해결합니다. Must-Staple extension 이 cert 에 박혀있으면 stapled 응답 없을 때 hard-fail 까지 강제할 수 있습니다. 현대적 답은 short-lived cert 로 revocation 자체를 거의 불필요하게 만드는 것입니다."

### Q. Certificate Transparency 가 도입된 이유와 동작은?

> "2011 년 DigiNotar 사고가 계기입니다. 가짜 CA 가 google.com cert 를 발급해서 이란이 Gmail MITM 에 사용했는데, 도메인 소유자가 모르고 있었습니다. 그래서 모든 신뢰 CA 가 발급하는 cert 를 공개 append-only 로그에 등록하도록 강제하고, 도메인 소유자가 crt.sh 같은 monitoring 으로 자기 도메인의 모든 발급 cert 를 추적해서 misissue 를 즉시 감지할 수 있게 한 게 CT 입니다. SCT (Signed Certificate Timestamp) 가 cert 에 박혀서 클라이언트가 검증하고, Chrome 은 2018 년부터 모든 public cert 에 강제합니다."

### Q. service mesh (Istio / Linkerd) 의 auto mTLS 는 어떻게 동작하나요?

> "각 pod 옆에 sidecar proxy (Envoy 또는 linkerd2-proxy) 가 inject 되고, mesh control plane (istiod / linkerd-identity) 이 워크로드에 short-lived cert (default 24h) 를 발급합니다. application 트래픽이 sidecar 를 거치면서 자동으로 mTLS 가 입혀져서 application 코드는 plain HTTP 그대로 둡니다. SPIFFE ID 기반 RBAC 정책으로 \"product 는 gateway 와 order 만 호출 가능\" 같은 매트릭스를 yaml 로 정의할 수 있고, cert 회전은 sidecar 가 SDS 로 hot-reload 해서 무중단으로 처리합니다."

### Q. HSM 이 root CA 보호에 왜 필수인가요?

> "root CA private key 가 노출되면 그 CA 가 발급한 모든 cert 의 신뢰성이 한 번에 무너집니다 — 회사 망함 수준. HSM 은 FIPS 140-2 Level 3 이상의 tamper-resistant 하드웨어 안에서만 키를 사용하고 외부에 절대 노출하지 않습니다. signing 요청만 PKCS#11 / KMIP 로 받아서 처리하고, 물리적 침입 시 키를 자동 zero out 합니다. 실무적으론 root CA 는 offline + HSM, intermediate 는 cloud KMS / CloudHSM, leaf 는 mesh 자동 발급 — 3 단 분리로 운영합니다."

---

## 9. 흔한 오해 정정

> **"VPC / 사내망 안은 안전하니 mTLS 불필요"**

- ❌ 한 서비스 침해 시 lateral movement 자유. zero-trust = 모든 호출에 인증.

> **"mTLS 만 켜면 보안 끝"**

- ❌ mTLS = peer identity. authorization (누가 무엇을 할 수 있나) 은 별도 layer (RBAC, JWT scope).

> **"OCSP Stapling 이면 revocation 완벽"**

- ⚠ Must-Staple 까지 결합해야 hard-fail. soft-fail 모드로 운영하면 공격자가 OCSP 차단으로 우회 가능.

> **"cert 발급은 OpenSSL CLI 면 충분"**

- ❌ 수동 발급은 휴먼 에러 + 키 유출 위험. cert-manager / Vault PKI / SPIRE 가 표준.

> **"Let's Encrypt 의 90 일은 너무 짧다"**

- ⚠ ACME 자동화 + cert-manager 면 운영 부담 0. 짧은 만큼 revocation 의존도 ↓.

> **"내부에선 self-signed cert 가 간단해서 좋다"**

- ⚠ trust store 분배 / 회전 / 검증 누락의 함정. internal CA + cert-manager 가 장기적으로 더 간단.

> **"SPIFFE 는 Istio 의 부가 기능이다"**

- ❌ SPIFFE 는 CNCF 표준, Istio / Linkerd / Vault / Kubernetes 모두 지원. Istio 의 종속 아님.

> **"cert 회전 자동화하면 만료 모니터링 불필요"**

- ❌ 회전 자체가 실패할 수 있음 (CA 장애, 정책 충돌). expiry alert 는 backup 으로 필수.

> **"CT 로그는 브라우저용이라 internal mTLS 와 무관"**

- ⚠ public-facing cert (api.msa.local) 는 CT monitoring 의무. internal-only cert 는 무관 (오히려 등록하면 경로 노출).

> **"HSM 은 비싸니까 cloud KMS 면 충분"**

- ⚠ 대부분의 cloud KMS (AWS KMS) 는 내부적으로 HSM-backed (FIPS 140-2 Level 2~3). 추가 HSM 은 아주 민감한 root CA 만.

> **"chain 에 root CA 도 포함시키는 게 완전성을 위해 좋다"**

- ❌ root 는 클라이언트 trust store 에 이미 있음. chain 에 포함하면 일부 클라이언트가 거부 + payload 낭비.

---

## 10. 회독 체크리스트

> §23 회독 체크리스트:
> - [ ] mTLS vs TLS 차이 (양방향 cert 검증)
> - [ ] SPIFFE ID 형식 (`spiffe://<trust-domain>/<path>`) + URI SAN
> - [ ] X.509-SVID vs JWT-SVID 용도 차이
> - [ ] SPIRE 의 attestation → SVID 발급 흐름
> - [ ] Istio (Envoy) vs Linkerd (linkerd2-proxy) 의 sidecar 차이
> - [ ] short-lived cert (24h) 가 revocation 을 사실상 대체하는 원리
> - [ ] cert 회전 hot-reload (SDS / file watch) 패턴
> - [ ] cert chain 검증 함정 7 종 (chain 누락 / wrong order / expired intermediate / root in chain / trust store stale / EKU mismatch / SAN 누락)
> - [ ] CRL → OCSP → OCSP Stapling → Must-Staple 의 발전 흐름
> - [ ] Certificate Transparency 의 SCT + crt.sh monitoring
> - [ ] FIPS 140-2 Level 3 HSM 의 의미
> - [ ] mesh permissive vs strict 모드의 마이그레이션 패턴
> - [ ] Linkerd Server / ServerAuthorization 정책 형식
> - [ ] JWT-SVID 와 user JWT 의 layer 분리 (peer identity vs user identity)
> - [ ] cert 만료 alert (Prometheus + Slack) 의무
> - [ ] msa 도입 6 phase (진단 / cert-manager / Linkerd / strict / SPIRE 검토 / monitoring / TTL 단축)

---

## 11. 연결 학습

- §16 TLS — 1.2 vs 1.3 핸드셰이크 (이 파일은 mTLS / mesh 적용)
- §17 mTLS 기본 — 양방향 cert (이 파일은 운영 / 회전 / SPIFFE 심화)
- §15 HSM — root CA 보호 (이 파일은 HSM-backed CA 운영)
- §22 JWT 함정 — mTLS-bound token (RFC 8705) 이 mTLS 인프라 위에서 동작
- §24 Post-Quantum (다음 파일) — TLS 1.3 hybrid (X25519+Kyber) 가 mTLS 에도 적용
