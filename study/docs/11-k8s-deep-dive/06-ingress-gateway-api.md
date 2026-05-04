---
parent: 11-k8s-deep-dive
seq: 06
title: Ingress / Gateway API / NetworkPolicy / CoreDNS
type: deep
created: 2026-05-01
---

# 06. Ingress / Gateway API / NetworkPolicy

## 1. 한 장 요약

- **Ingress** = HTTP/HTTPS L7 진입의 1세대 표준. 단순하지만 좁다.
- **Gateway API** = Ingress 후속. TCP/UDP/gRPC 까지, 멀티 팀/멀티 controller 모델.
- **NetworkPolicy** = Pod 사이 L3/L4 방화벽. CNI (Container Network Interface, 컨테이너 네트워크 인터페이스) 가 구현 (Calico/Cilium 필수).
- **CoreDNS** = 서비스 디스커버리 DNS. ndots:5 함정과 NodeLocal DNSCache 가 핵심.

## 2. Ingress 의 구조 (다시)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gateway
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/use-regex: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
    - hosts: [api.commerce.example.com]
      secretName: gateway-tls
  rules:
    - host: api.commerce.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service: { name: gateway, port: { name: http } }
```

### Ingress Controller 의 동작

```
Ingress 객체 (YAML)
   │ watch
   ▼
ingress-nginx Controller (Deployment)
   │ generate
   ▼
nginx.conf  (server_name, location, SSL, ...)
   │ reload
   ▼
실제 nginx 프로세스
```

ingress-nginx 의 controller Pod 자체가 nginx + control loop. 새 Ingress / 새 Endpoint 가 들어오면 nginx config 를 재생성하고 SIGHUP 으로 reload.

### Ingress 한계 5가지

1. **HTTP/HTTPS 만** — TCP/UDP 안 됨. (NodePort 또는 LB Service 별도 사용)
2. **표준 spec 좁음** — rate limit, header rewrite, weighted routing 등은 controller 별 annotation. nginx 와 traefik annotation 호환 안 됨.
3. **단일 controller 가정** — 한 클러스터에 여러 controller 운영 시 ingressClassName 으로 분리하지만 관리 복잡.
4. **Listener / Route 분리 없음** — TLS 인증서 + 라우팅이 한 객체에 묶임. SRE 와 앱 팀 권한 분리 어려움.
5. **확장성 한계** — annotation 의 미궁. 100+ annotation 쌓이면 검증 불가.

## 3. Gateway API 의 새 모델

K8s 1.27+ 에서 GA. **3-layer 분리**:

```
GatewayClass  (= IngressClass 후속, 클러스터 레벨)
   │
   ▼
Gateway       (= 실제 LB/listener 정의, 인프라/SRE 팀 소유)
   │
   ▼
HTTPRoute / TCPRoute / GRPCRoute / TLSRoute   (= 라우팅 규칙, 앱 팀 소유)
```

### 예시

```yaml
# 인프라 팀
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata: { name: nginx }
spec: { controllerName: k8s.io/ingress-nginx }
---
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata: { name: prod-gateway, namespace: commerce-system }
spec:
  gatewayClassName: nginx
  listeners:
    - name: https
      port: 443
      protocol: HTTPS
      tls:
        mode: Terminate
        certificateRefs:
          - kind: Secret
            name: gateway-tls
      allowedRoutes:
        namespaces: { from: Selector, selector: { matchLabels: { allow-routes: "true" } } }
---
# 앱 팀 (commerce ns)
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: { name: gateway-route, namespace: commerce }
spec:
  parentRefs:
    - name: prod-gateway
      namespace: commerce-system
  hostnames: [api.commerce.example.com]
  rules:
    - matches:
        - path: { type: PathPrefix, value: / }
      backendRefs:
        - name: gateway
          port: 8080
          weight: 100
```

### Ingress 대비 장점

| 항목 | Ingress | Gateway API |
|---|---|---|
| 프로토콜 | HTTP/S | HTTP/S, TCP, UDP, gRPC, TLS |
| 권한 분리 | annotation 수준 | RBAC 로 Gateway/Route 분리 |
| 멀티 팀 | namespace 단위만 | `allowedRoutes` 로 정밀 제어 |
| 가중치 라우팅 | annotation | 표준 `weight` 필드 |
| traffic split | controller 의존 | HTTPRoute backendRefs `weight` |

### 언제 옮길 만한가

- 멀티 팀 클러스터, 정책 분리 필요
- Canary 가중치 라우팅 표준화
- gRPC / TCP routing 필요

msa 의 현재(`gateway` 1개 Ingress) 규모는 마이그레이션 가치가 작음. 단, Argo Rollouts 의 traffic management 가 Gateway API 와 자연 통합 — Canary 도입 시 함께 검토 가치 있음 ([10-deployment-strategies.md](10-deployment-strategies.md)).

## 4. NetworkPolicy — Pod L3/L4 방화벽

### Default deny + allowlist 패턴

```yaml
# 1. namespace 의 모든 ingress/egress 차단
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: deny-all, namespace: commerce }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
---
# 2. ingress-nginx 에서 gateway 로만 ingress 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-ingress-to-gateway, namespace: commerce }
spec:
  podSelector: { matchLabels: { app.kubernetes.io/name: gateway } }
  policyTypes: [Ingress]
  ingress:
    - from:
        - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: ingress-nginx } }
      ports:
        - { port: 8080, protocol: TCP }
---
# 3. gateway → 각 백엔드 호출 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-gateway-to-backends, namespace: commerce }
spec:
  podSelector: { matchExpressions: [{ key: app.kubernetes.io/name, operator: In, values: [product, order, search, member, ...] }] }
  policyTypes: [Ingress]
  ingress:
    - from:
        - podSelector: { matchLabels: { app.kubernetes.io/name: gateway } }
---
# 4. 모든 Pod 의 DNS / Egress 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-egress-dns, namespace: commerce }
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to:
        - namespaceSelector: { matchLabels: { kubernetes.io/metadata.name: kube-system } }
          podSelector: { matchLabels: { k8s-app: kube-dns } }
      ports:
        - { port: 53, protocol: UDP }
        - { port: 53, protocol: TCP }
    - to: []           # 외부 인터넷 허용 (필요 시 좁힘)
      ports: [{ port: 443 }, { port: 80 }]
```

### 함정 5가지

1. **CNI 가 NetworkPolicy 미지원** — flannel 만 깔린 클러스터에서는 정책이 무시되며 false sense of security. Calico/Cilium 필수.
2. **Egress 기본 차단 시 DNS 도 차단** — 위 #4 같은 DNS allow rule 필수.
3. **Ingress controller 같은 namespace 외부에서 들어오는 트래픽** — `namespaceSelector` 로 명시 안 하면 차단됨.
4. **Service Mesh sidecar** — Istio sidecar 는 별도 ports 필요. mesh + NetPol 동시 사용 시 매트릭스 복잡.
5. **NetworkPolicy 는 Pod 끼리만** — Pod → Service IP → Pod 의 경우 잘 동작하지만, hostNetwork=true Pod 에는 적용 안 됨.

### Cilium 의 확장 — L7 정책

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata: { name: allow-only-get-products }
spec:
  endpointSelector: { matchLabels: { app.kubernetes.io/name: product } }
  ingress:
    - fromEndpoints: [{ matchLabels: { app.kubernetes.io/name: gateway } }]
      toPorts:
        - ports: [{ port: "8081", protocol: TCP }]
          rules:
            http:
              - method: GET
                path: /api/v1/products(/.*)?
              - method: GET
                path: /actuator/health/.*
```

표준 NetworkPolicy 가 못 하는 "method + path" 단위 제어가 가능. mesh 없이도.

## 5. CoreDNS 깊이

### Corefile (CoreDNS 의 설정)

```
.:53 {
    errors
    health { lameduck 5s }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
        pods insecure
        fallthrough in-addr.arpa ip6.arpa
        ttl 30
    }
    prometheus :9153
    forward . /etc/resolv.conf {
        max_concurrent 1000
    }
    cache 30
    loop
    reload
    loadbalance
}
```

- `kubernetes` plugin → K8s api-server watch 로 Service/Pod DNS 응답
- `forward` → 그 외 도메인은 노드 resolv.conf 로 위임
- `cache 30` → 30s 캐시

### NodeLocal DNSCache

```yaml
# DaemonSet 으로 노드마다 1개
apiVersion: apps/v1
kind: DaemonSet
metadata: { name: node-local-dns, namespace: kube-system }
spec:
  template:
    spec:
      hostNetwork: true
      containers:
        - name: node-cache
          image: registry.k8s.io/dns/k8s-dns-node-cache:1.23.0
          args: [
            "-localip", "169.254.20.10",
            "-conf", "/etc/Corefile",
            "-upstreamsvc", "kube-dns-upstream"
          ]
```

각 Pod 의 resolv.conf 가 `169.254.20.10` 을 가리키도록 (kubelet `--cluster-dns` 변경) → 같은 노드 안의 캐시에서 즉시 응답. CoreDNS 는 cache miss 만.

효과:
- DNS p99 mode 단위 → ms 단위
- CoreDNS QPS 5-10x 감소
- conntrack 부하 ↓ (UDP → TCP local 통신 감소)

큰 클러스터면 거의 필수.

### ndots 함정 재확인

`/etc/resolv.conf` 의 `options ndots:5` 가 기본:

```
$ curl http://product/api/...
   → DNS 조회 순서:
      1. product.commerce.svc.cluster.local
      2. product.svc.cluster.local
      3. product.cluster.local
      4. product.<host-domain>
      5. (절대 도메인) product
```

내부 호출 (`product`) 은 1번에서 성공이라 4번/5번까지 안 가지만, **외부 호출 (`api.example.com`, dot 1개)** 은 search 리스트 4번 모두 NXDOMAIN 후 5번에서 성공 → 5번 DNS RTT.

해결:
```yaml
spec:
  dnsConfig:
    options:
      - { name: ndots, value: "1" }   # 점 1개 이상이면 absolute 처리
```

또는 호출 코드에서 FQDN 을 명시 (`api.example.com.` 끝에 점). 클라우드 SDK 는 후자 권장.

## 6. ExternalDNS — 자동 Route53/CloudDNS 갱신

K8s Ingress 만들면 Route53 에 A 레코드를 자동 등록해주는 컨트롤러:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata: { name: external-dns, namespace: kube-system }
spec:
  template:
    spec:
      containers:
        - name: external-dns
          image: registry.k8s.io/external-dns/external-dns:v0.14.0
          args:
            - --source=ingress
            - --source=service
            - --provider=aws
            - --domain-filter=commerce.example.com
            - --policy=upsert-only
```

Ingress annotation `external-dns.alpha.kubernetes.io/hostname: api.commerce.example.com` 을 단 Ingress 가 들어오면 → Route53 A 레코드 자동 생성. 삭제하면 자동 제거 (policy=sync 일 때).

cert-manager + ExternalDNS + ingress-nginx 가 표준 트리오 — DNS/TLS/L7 routing 전부 GitOps 가능.

## 7. 면접 빈출 6

1. **"Ingress 와 Gateway API 차이?"** → 위 §3 표. 핵심: 권한 분리 + 다중 프로토콜.
2. **"NetworkPolicy 만 적용하면 보안 끝?"** → CNI 지원 확인 + Pod identity 기반(Cilium L7) 까지 가야 진짜. 또 mesh 와 결합 시 매트릭스 복잡.
3. **"DNS 가 느려요"** → ndots:5, NodeLocal DNSCache, FQDN 사용. 3개 검토 순서.
4. **"왜 ingress-nginx 가 admission webhook 을 쓰나?"** → Ingress 객체 검증 + nginx config 의 syntax 미리 검사. 잘못된 annotation 막기.
5. **"cert-manager 의 TLS 발급 흐름?"** → `Certificate` CR → Issuer 가 ACME challenge → 인증 성공 시 Secret(type=kubernetes.io/tls) 생성 → Ingress 가 참조. 자세한 건 [04-crd-operator.md](04-crd-operator.md) 의 CRD 패턴.
6. **"ExternalDNS 와 CoreDNS 차이?"** → CoreDNS 는 클러스터 내부 DNS 서버. ExternalDNS 는 외부 DNS provider(Route53 등) 에 K8s 변경을 동기화해주는 컨트롤러.

## 8. msa 매핑

- 현재: `k8s/base/gateway/ingress.yaml` 에 ingress-nginx 1개. `frontend-ingress.yaml` 에 FE 추가
- prod overlay (`patches/ingress-tls.yaml`): cert-manager + Let's Encrypt
- **NetworkPolicy 0건** — 가장 큰 보안 gap. [16-improvements.md](16-improvements.md) 의 즉시 항목으로 넣을 것
- DNS: NodeLocal DNSCache 미설치 — 트래픽 작아 우선순위 낮지만, 외부 API 호출 많은 charting / chatbot 은 ndots 검토 가치
- Gateway API 는 미도입. Argo Rollouts 도입 시점에 함께 검토

다음: [07-storage.md](07-storage.md) — PV/PVC/StorageClass/CSI/StatefulSet 의 동작.
