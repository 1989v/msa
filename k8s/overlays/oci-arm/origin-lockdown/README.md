# Origin Lockdown — Cloudflare 우회 차단

## 무엇을 막는가

`rt.<DOMAIN>` / (구) `argocd.<DOMAIN>` 이 DNS-only(gray cloud)로 등록돼 있어
OCI public IP 가 DNS 에 그대로 공개된다. 그 IP 를 알면 Host 헤더만 바꿔서
Cloudflare 를 통째로 건너뛸 수 있었다:

```bash
curl -H "Host: <DOMAIN>" https://<OCI_PUBLIC_IP>/     # → 200, CF 경유와 동일 응답
```

이 경로가 열려 있으면 WAF · Rate Limiting · Bot Fight 모드 · DDoS 보호가 전부
무의미해진다. Cloudflare 대시보드에서 무엇을 켜든 우회로가 남는다.

## 왜 IP 화이트리스트가 아니라 mTLS 인가

`nginx.ingress.kubernetes.io/whitelist-source-range` 로 Cloudflare 대역만
허용하는 방법이 더 단순해 보이지만, 이 클러스터에서는 **위험하다**.

k3s 를 `--disable=traefik` 만 주고 설치하므로 ServiceLB(klipper-lb)가 살아 있고,
LoadBalancer 트래픽을 MASQUERADE 한다. 그러면 ingress-nginx 가 보는
`$remote_addr` 이 klipper Pod IP(10.42.x.x)가 되어 **Cloudflare 대역 화이트리스트가
정상 트래픽까지 전부 차단**한다. 화이트리스트를 쓰려면 먼저
`controller.service.externalTrafficPolicy=Local` 로 client IP 보존을 확보하고
실측 검증까지 해야 한다.

Authenticated Origin Pull(mTLS)은 source IP 보존 여부와 무관하게 동작하므로
이 토폴로지에서 전제 조건이 더 적다.

## 활성화 절차 (순서 중요)

### 1. CA Secret 배포 (무해 — 동작 변화 없음)

`kustomization.yaml` 의 `resources` 에 이미 포함돼 있다. Argo sync 로 자동 적용:

```bash
kubectl -n commerce get secret cf-origin-pull-ca
```

### 2. Cloudflare 대시보드에서 AOP 켜기 — **반드시 3번보다 먼저**

SSL/TLS → **Origin Server** → **Authenticated Origin Pulls** 토글 ON (zone 레벨).

켜면 Cloudflare 엣지가 origin 으로 갈 때 클라이언트 인증서를 제시하기 시작한다.
origin 은 아직 검증하지 않으므로 이 시점에는 아무것도 깨지지 않는다.

### 3. Ingress 패치 활성화

`k8s/overlays/oci-arm/kustomization.yaml` 의 주석 처리된 항목을 해제:

```yaml
patches:
  - path: origin-lockdown/aop-patch.yaml
    target: {kind: Ingress, name: commerce-proxied}
```

커밋 → Argo sync.

### 4. 검증

```bash
# 정상 경로 — 200 이어야 한다
curl -sI https://<DOMAIN>/ | head -1

# 우회 경로 — 400 (No required SSL certificate was sent) 이어야 한다
curl -skI -H "Host: <DOMAIN>" https://<OCI_PUBLIC_IP>/ | head -1
```

두 번째가 여전히 200 이면 2번 토글이 반영 안 된 것이다.

### 롤백

3번의 patches 항목을 다시 주석 처리하고 커밋하면 즉시 원복된다.
Argo sync 를 기다릴 수 없는 장애 상황이면 직접:

```bash
kubectl -n commerce annotate ingress commerce-proxied \
  nginx.ingress.kubernetes.io/auth-tls-verify-client-
```

## 한계

- **Global AOP 의 공유 인증서 문제**: 여기서 쓰는 CA
  (`origin-pull.cloudflare.net`)는 전 Cloudflare 고객이 공유한다. 따라서 다른
  Cloudflare 고객이 자기 zone 을 이 origin IP 로 향하게 만들면 검증을 통과할 수
  있다. 익명 인터넷 전체를 막는 효과는 확실하지만, 완전한 origin 인증을 원하면
  **per-hostname AOP + 자체 발급 클라이언트 인증서**로 올려야 한다.
- **`rt.<DOMAIN>` 은 그대로 열려 있다**. CF proxy 를 의도적으로 우회하는
  WS/SSE host 라 mTLS 를 걸 수 없다. 노출 범위는 gateway 하나로 제한되며,
  gateway 자체 인증 필터와 Rate Limiting 에 의존한다.
- CA 인증서는 **2029-11-01 만료**. 그 전에
  `https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem`
  에서 갱신본을 받아 `cloudflare-origin-pull-ca.yaml` 을 교체해야 한다.
