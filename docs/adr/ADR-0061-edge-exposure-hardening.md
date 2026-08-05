# ADR-0061 — 엣지 노출면 축소 (Origin 우회 차단 · GitOps 콘솔 비공개 · actuator 비노출)

- Status: Accepted (2026-08-06, origin lockdown 은 활성화 게이트 상태)
- Date: 2026-08-06
- Relates: ADR-0019(K8s 전환), ADR-0055(OpenSearch), ADR-0059(game 서브도메인), ADR-0031(NetworkPolicy)

## Context

Cloudflare Security Insights 리포트(2026-07-31 스캔)가 `1989v.com` 에 5건을 올렸다:
security.txt 부재(Low), Bot Fight 모드 미사용(Moderate), **끊어진 A 레코드**(Moderate),
AI 봇 미차단(Moderate), AI Labyrinth 미사용(Low).

리포트를 실측으로 검증한 결과, 등급이 매겨진 5건보다 **리포트가 잡지 못한 3건**이 심각했다.
"끊어진 A 레코드"는 서브도메인 탈취(우리는 IP 를 계속 보유 중)라는 판정 자체는 오탐이지만,
그것이 가리킨 DNS-only 레코드가 실제 문제의 입구였다.

### 실측 근거 (2026-08-06)

**1. Cloudflare 완전 우회.** `rt` / `argocd` 레코드가 DNS-only(gray cloud)라 OCI public IP
가 DNS 에 공개돼 있고, 그 IP 에 Host 헤더만 바꿔 보내면 엣지를 건너뛴다:

```
curl -H "Host: 1989v.com" https://<OCI_IP>/   → 200, 1511 bytes
curl              https://1989v.com/          → 200, 1511 bytes   (동일)
```

WAF · Rate Limiting · Bot Fight · DDoS 보호가 전부 무력화된다. 즉 리포트가 권한
"Bot Fight 모드 켜기"를 수행해도 우회로가 남아 효과가 반감된다.

**2. Argo CD UI 전면 공개.** `https://argocd.1989v.com/` 이 200 으로 로그인 화면을 서빙하고,
`/api/version` 이 무인증으로 `v3.4.2` 를 노출했다. `/api/v1/applications` 는 401 이라 익명
접근 자체는 막혀 있었으나, GitOps 컨트롤 플레인의 로그인 화면과 정확한 버전이 인터넷에
공개된 상태였다. 침해 시 클러스터 전체 장악으로 직결되고, DNS-only 라 Cloudflare 의
rate limit 조차 걸리지 않았다.

**3. actuator 공개.** proxied host 6종 전부가 `/actuator` prefix 를 gateway 로 라우팅했다.
`/actuator`, `/actuator/health`, `/actuator/prometheus` 가 200 (`env` / `heapdump` 는 404).
전체 메트릭과 내부 클래스명(`com.kgd.gateway.GatewayApplicationKt`)이 익명에게 샜다.

**덤.** `game.1989v.com` 이 526(Invalid SSL certificate)이었다 — 매니페스트의 host 가
`games.` 인데 DNS 는 `game.` 이라 SNI 불일치로 ingress fake cert 가 나갔고 CF Full(strict)이
거부했다. ADR-0059 게임 서브도메인이 배포 후 접근 불가 상태였다.

## Decision

### 1) Origin 우회 차단 — IP 화이트리스트가 아니라 mTLS

Cloudflare **Authenticated Origin Pull**(AOP)을 `commerce-proxied` Ingress 에 건다.
origin 이 Cloudflare 클라이언트 인증서를 검증하므로, 인증서 없는 직접 연결은 400 으로 끊긴다.

`whitelist-source-range` 로 Cloudflare 대역만 허용하는 방식을 **기각**한 이유:
k3s 를 `--disable=traefik` 만 주고 설치해 ServiceLB(klipper-lb)가 살아 있고, LoadBalancer
트래픽을 MASQUERADE 한다. ingress-nginx 가 보는 `$remote_addr` 이 klipper Pod IP 가 되면
화이트리스트가 정상 트래픽까지 전부 막는다. 화이트리스트를 쓰려면 먼저
`externalTrafficPolicy=Local` 로 client IP 보존을 확보하고 실측해야 하는데, 전제 조건이
하나 더 늘어난다. mTLS 는 source IP 보존 여부와 무관하게 동작한다.

**활성화는 2단계 게이트로 둔다.** CA Secret 은 즉시 배포하되(무해), Ingress 패치는
`kustomization.yaml` 에서 주석 상태로 커밋한다. Cloudflare 대시보드에서 AOP 를 먼저 켜지
않은 채 패치가 Argo sync 되면 proxied host 6종이 전부 400 이 되기 때문이다.
절차·검증·롤백 → `k8s/overlays/oci-arm/origin-lockdown/README.md`.

한계는 문서에 명시한다: Global AOP 의 CA(`origin-pull.cloudflare.net`)는 전 Cloudflare
고객이 공유하므로, 다른 고객이 자기 zone 을 이 origin 으로 향하게 하면 검증을 통과할 수
있다. 익명 인터넷을 막는 효과는 확실하되 완전한 origin 인증은 per-hostname AOP + 자체
클라이언트 인증서가 필요하다. `rt` host 는 CF proxy 를 의도적으로 우회하는 WS/SSE 경로라
mTLS 대상에서 제외하며, 노출 범위는 gateway 하나로 제한된다.

### 2) Argo CD — public Ingress 제거, Zero Trust 뒤로

`k8s/argocd/ingress.yaml.template` 을 삭제하고 `install.sh` 의 Ingress 적용 단계를 없앤다.
접근 경로는 둘만 남긴다:

- **port-forward** — `kubectl -n argocd port-forward svc/argocd-server 8080:80` (기본)
- **Cloudflare Zero Trust Tunnel** — 이미 배포된 cloudflared 에 `argocd` Public Hostname 을
  추가하고 Access policy(본인 이메일 1개)를 건다. mysql/es 등 기존 7종과 동일 패턴.

cloudflared 는 `commerce` ns 라 argocd ns 로 나가는 egress 허용이 필요하다.
`cloudflared/network-policy.yaml` 에 argocd namespaceSelector 규칙을 추가하되, egress 정책이
DNAT 전후 어느 포트를 보는지가 CNI 마다 달라 80(Service)/8080(Pod)을 모두 연다.

origin IP 를 가리키는 `argocd` A 레코드는 삭제한다 — 남겨두면 Zero Trust 를 건너뛰고
origin 으로 직행한다. 반면 터널 Public Hostname 등록 시 Cloudflare 가 자동 생성하는
`<tunnel-id>.cfargotunnel.com` CNAME(proxied)은 정상이며 필수다.

### 3) `/actuator` 는 어느 host 에도 두지 않는다

proxied host 5종에서 `/actuator` path 룰을 제거하고, `api` host 는 root catch-all(`/`) 대신
명시 prefix(`/api`, `/ws`, `/sse`, `/svc`)로 좁힌다 — `/` 로 열어두면 `/actuator` 가 그대로
다시 노출되기 때문이다.

Prometheus 는 `k8s/infra/prod/monitoring` 의 ServiceMonitor 가 cluster-internal 로 scrape 하고,
probe 는 Pod IP 로 직접 치므로 공개 라우팅에 의존하지 않는다(레포 전수 확인 완료).

**`/svc/<service>/actuator/health` 는 유지한다.** gateway 의 의도된 헬스 프록시 라우트로
portal-fe 서비스 카탈로그가 사용하며, `health` 한 endpoint 만 노출한다.

### 4) Cloudflare 리포트 5건 처리

| 항목 | 판정 | 조치 |
|---|---|---|
| 끊어진 A 레코드 | 탈취 위험은 오탐(IP 보유 중), 다만 origin IP 공개가 실제 문제 | 1)·2)로 해소 |
| Bot Fight 모드 | 유효 — 단 1) 이후에야 실효 | 1) 활성화 후 대시보드에서 ON |
| security.txt | 유효, 저비용 | `portal-fe/public/.well-known/security.txt` 추가 (RFC 9116) |
| AI 봇 차단 / AI Labyrinth | 보안 이슈 아님 — 노출 정책 판단 | **미적용.** 코드 사전/포트폴리오는 AI 크롤러 노출이 오히려 이득 |

### 5) `game` 서브도메인 SNI 불일치 수정

Ingress 의 host 와 TLS host 를 DNS 실제값(`game.`)에 맞춘다. `cf-origin-ca-tls` 는
`*.1989v.com` 와일드카드(2041-05 만료)라 별도 발급 없이 커버된다.

## 적용 결과 및 후속 발견 (2026-08-06)

### 매니페스트에서 지워도 클러스터 잔재는 남는다

`ingress.yaml.template` 을 레포에서 삭제해도, 과거 `install.sh` 가 **직접 apply** 한
`argocd-server` Ingress 는 클러스터에 그대로 남아 있었다. Argo CD 의 `Application/commerce`
는 `k8s/overlays/oci-arm` 만 추적하므로 argocd ns 의 이 리소스는 **추적 대상이 아니고,
따라서 prune 되지 않는다.** 80일 된 이 잔재가 origin IP 직행 + `Host: argocd.<DOMAIN>`
으로 Access 를 우회해 Argo UI 를 200 으로 열어두고 있던 실제 구멍이었다. SSH 로 수동
삭제 후 origin 직행 404 / CF 경유 Access 302 를 확인했다.

교훈: **GitOps 미추적 네임스페이스에 스크립트로 apply 한 리소스는 레포에서 지운다고
사라지지 않는다.** 노출면을 줄이는 변경은 매니페스트 삭제와 클러스터 실물 확인을
반드시 짝으로 수행한다.

### 배포 검증 (Argo sync 후 실측)

| 대상 | 결과 |
|---|---|
| `argocd.<DOMAIN>` | CF 경유 302(Access) / origin 직행 404 |
| `api.<DOMAIN>/actuator/prometheus` | 404 |
| `<DOMAIN>/actuator/prometheus` | 200 이지만 portal-fe SPA 셸(text/html) — 메트릭 아님 |
| `<DOMAIN>/svc/product/actuator/health` | 200 (의도적 유지) |
| `<DOMAIN>/.well-known/security.txt` | 200 text/plain |
| origin 직행 `Host: <DOMAIN>` | 200 — **AOP 미활성 상태, 예정대로** |

### 도메인 실값 커밋으로의 전환

본 ADR 과 별개로, `commerce-platform.yaml` 의 `__DOMAIN__` 치환 방식은 폐기되고 실값
커밋으로 전환됐다(2026-08-05). `Application/commerce` 의 인라인 인덱스 패치가 host 추가
시 인덱스 드리프트를 일으켜 sync 침묵 정지를 2회 유발했기 때문이다. 결과적으로 host
추가 절차가 "ingress 파일 append → push" 로 단순해졌고, 본 ADR 의 노출면 축소 변경도
같은 파일에서 함께 관리된다.

## Consequences

**긍정**

- Cloudflare 대시보드에서 켜는 보호(WAF/rate limit/Bot Fight)가 비로소 실효를 갖는다.
- GitOps 콘솔이 인터넷 스캐너의 사정권에서 빠진다. Argo CD CVE 공개 시 노출 창이 없다.
- 익명에게 새던 내부 메트릭·클래스명·버전 정보가 차단된다.
- ADR-0059 게임 서브도메인이 실제로 접근 가능해진다.

**부정 / 비용**

- Argo CD UI 접근에 port-forward 또는 Zero Trust 로그인이 한 단계 더 붙는다.
  `argocd` CLI 는 Access Service Token 헤더가 필요하다.
- AOP CA 는 2029-11-01 만료 — 갱신 캘린더 항목이 하나 생긴다.
- origin lockdown 이 **주석 상태로 커밋**되므로, 대시보드 토글 후 별도 커밋으로
  활성화하지 않으면 우회로가 그대로 남는다. 미완 상태임을 인지해야 한다.
- `api` host 가 명시 prefix 로 좁혀져, 향후 gateway 에 새 최상위 path 를 추가하면
  Ingress 룰도 같이 추가해야 한다.

**미결**

- `rt` host 는 여전히 origin IP 를 공개하며 mTLS 대상이 아니다. WS/SSE 를 Cloudflare
  proxy 뒤로 되돌릴 수 있는지(SSE heartbeat 로 100s timeout 회피)는 별도 검토 대상.
- per-hostname AOP + 자체 클라이언트 인증서로의 격상은 Global AOP 공유 CA 한계가
  실제 문제로 드러날 때 재검토한다.
