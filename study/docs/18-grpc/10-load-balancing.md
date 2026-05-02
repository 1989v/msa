---
parent: 18-grpc
seq: 10
title: 로드밸런싱 — Envoy / client-side / Headless service / xDS
type: deep
created: 2026-05-01
---

# 10. gRPC 로드밸런싱

> "K8s 에서 gRPC 가 한 pod 만 받는다" 는 가장 흔한 운영 트러블. 원인을 알면 해법이 명확.

## 1. 문제의 본질 (다시)

[#06](06-http2-deep-dive.md) 에서 본 것:
- HTTP/2 = 한 TCP connection 위 다수 stream 동시
- gRPC client 는 connection 을 재사용 (subchannel pool)
- K8s ClusterIP service = **L4 (TCP) load balancer**

⇒ 클라가 connection 을 한 번 만들면 그 뒤 모든 RPC 가 *한 pod 로 직행*.

```
┌──────────┐       ┌──────────────────┐    ┌──────┐
│ Client   │──TCP──│ ClusterIP (kube-proxy/iptables)│
└──────────┘       │  L4 LB             │   │
                   │  pick once per TCP │   ├─ pod-1  ← 모든 RPC 여기로
                   └──────────────────┘    ├─ pod-2  ← 놀고 있음
                                            └─ pod-3  ← 놀고 있음
```

## 2. 해결 방법 4가지

| 방법 | 어디서 LB | 장점 | 단점 |
|---|---|---|---|
| 1. Envoy / sidecar (mesh) | proxy (L7) | 가장 표준 | 인프라 복잡 |
| 2. K8s Headless service + 클라이언트 LB | client (L7) | 인프라 단순 | 클라마다 정책 구현 |
| 3. Standalone L7 LB (NLB+Envoy / GLB) | proxy | managed | 외부 의존 |
| 4. gRPC xDS resolver | client | 동적 정책, mesh 표준 | 학습 곡선 |

## 3. 방법 1: Envoy (sidecar 또는 standalone)

Service Mesh (Istio / Linkerd) 의 default — 각 pod 옆에 Envoy sidecar 가 붙어 모든 outbound 트래픽 가로채기.

```
Client pod                      Server pods
 ┌──────────┐                   ┌──────────┐
 │ App      │                   │ App      │
 │   ↓      │                   │   ↑      │
 │ Envoy ───┼────HTTP/2 LB─────→│ Envoy    │  pod-1
 └──────────┘                   └──────────┘
                                ┌──────────┐
                          ┌────→│ App / Envoy│ pod-2
                          │     └──────────┘
                          │     ┌──────────┐
                          └────→│ App / Envoy│ pod-3
                                └──────────┘
```

특징:
- 클라이언트는 자신의 sidecar 만 알면 됨 (`localhost:8080` 같은)
- Envoy 가 service discovery + L7 LB + retry + circuit breaker 처리
- mTLS / 정책 / 메트릭 모두 mesh 수준에서

### 단순 standalone Envoy 설정

```yaml
static_resources:
  listeners:
  - name: grpc_listener
    address:
      socket_address: { address: 0.0.0.0, port_value: 9090 }
    filter_chains:
    - filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          codec_type: HTTP2
          stat_prefix: grpc
          route_config:
            virtual_hosts:
            - name: backend
              domains: ["*"]
              routes:
              - match: { prefix: "/" }
                route:
                  cluster: product_service
                  retry_policy:
                    retry_on: "unavailable"
                    num_retries: 3
          http_filters:
          - name: envoy.filters.http.router
  clusters:
  - name: product_service
    type: STRICT_DNS
    http2_protocol_options: {}            # HTTP/2 (gRPC) 강제
    lb_policy: ROUND_ROBIN
    load_assignment:
      cluster_name: product_service
      endpoints:
      - lb_endpoints:
        - endpoint: { address: { socket_address: { address: product, port_value: 9090 }}}
```

핵심: `http2_protocol_options: {}` 가 **stream 단위 LB** 를 가능하게.

## 4. 방법 2: Headless service + 클라이언트 LB

K8s 에서 service 의 `clusterIP: None` 으로 만들면 **headless service** — kube-proxy 가 LB 안 함, DNS 가 모든 pod 의 IP 를 반환.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: product
spec:
  clusterIP: None             # headless
  ports:
    - port: 9090
      targetPort: 9090
  selector:
    app: product
```

클라이언트가 DNS 조회 시:
```
$ dig product.default.svc.cluster.local
;; ANSWER SECTION:
product.default.svc.cluster.local. 30 IN A 10.0.1.5
product.default.svc.cluster.local. 30 IN A 10.0.1.6
product.default.svc.cluster.local. 30 IN A 10.0.1.7
```

→ 클라가 모든 pod IP 를 알게 되고 **각 pod 에 별도 connection** 을 만들어 round-robin.

### gRPC 클라 측 설정

```kotlin
val channel = ManagedChannelBuilder
    .forTarget("dns:///product.default.svc.cluster.local:9090")
    .defaultLoadBalancingPolicy("round_robin")
    .build()
```

핵심:
- `dns:///` 스킴 = gRPC 의 dns name resolver
- `round_robin` policy = subchannel (pod) 마다 RPC 분배
- DNS 변경 (pod scale up/down) = 주기적 refresh (default 30초)

### 함정

- DNS TTL — 너무 길면 새 pod 인지 못 함, 짧으면 DNS 부하
- pod scale up: 새 IP 인지까지 지연
- pod 종료: 클라가 stale connection 으로 호출 → `UNAVAILABLE` retry 필요

⇒ **Resilience4j retry 또는 gRPC retry policy** 가 자연스러운 보완.

## 5. 방법 3: Standalone L7 LB

AWS NLB + Envoy / Google Cloud GLB / nginx-ingress 의 gRPC 모드 등.

### nginx-ingress 설정

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: product-grpc
  annotations:
    nginx.ingress.kubernetes.io/backend-protocol: "GRPC"
    nginx.ingress.kubernetes.io/grpc-backend: "true"
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /commerce.product.v1.ProductService/
        pathType: Prefix
        backend:
          service:
            name: product
            port:
              number: 9090
```

ingress-nginx 의 nginx 가 HTTP/2 로 backend 와 통신 + L7 LB. 외부 노출에 적합.

### 함정

- ingress 가 HTTP/2 ALPN 활성화 필요
- TLS 종단 위치 (passthrough vs reencrypt) 에 따라 mTLS 처리 다름
- 일부 cloud LB 는 HTTP/2 streaming 에 idle timeout 60s 같은 제한

## 6. 방법 4: gRPC xDS resolver (mesh)

xDS = Envoy 가 정의한 동적 설정 프로토콜 (CDS, EDS, LDS, RDS). gRPC-java/go 에 직접 내장된 xDS client 가 mesh control plane (Istio, gRPC xDS, Consul) 에서 endpoint / 정책을 받아옴.

```kotlin
val channel = ManagedChannelBuilder
    .forTarget("xds:///product.default.svc.cluster.local")
    .build()
```

장점:
- Envoy sidecar 없이 (proxyless mesh) 동등 기능
- mTLS / retry / hedging / circuit breaker 정책을 control plane 에서 일괄 관리
- Google Cloud Traffic Director, Istio Ambient 등이 활용

단점:
- 운영 복잡 (control plane)
- 디버깅 도구 부족
- 빌드 시 xds artifact 추가

## 7. 클라이언트 LB 정책

gRPC core 가 제공하는 LB policy:

| Policy | 동작 |
|---|---|
| `pick_first` (default) | 첫 endpoint 만 사용 (LB 효과 없음) |
| `round_robin` | 모든 endpoint 균등 분배 |
| `weighted_round_robin` | EDS 의 weight 활용 |
| `priority` | 그룹 우선순위 + failover |
| `weighted_target` | 트래픽 비율 기반 (canary) |
| `least_request` | 요청 수 적은 endpoint 선호 (xDS 전용) |
| `ring_hash` (consistent hash) | 키 기반 sticky (cache locality) |

⇒ **headless service + round_robin** 이 K8s 의 단순 default 권장.

## 8. msa 가 도입 시 권장 시나리오

### 8-1. Phase 0 (실험)

- 서비스 1 쌍만 (예: order ↔ product) gRPC 로
- **headless service + round_robin** 으로 시작
- TLS 미사용 (h2c, internal NetworkPolicy 로 격리)

### 8-2. Phase 1 (확산)

- 핫패스 3-5 쌍 gRPC 도입
- 여전히 headless + round_robin
- gRPC retry policy 도입 (UNAVAILABLE 만)
- Resilience4j CircuitBreaker 유지

### 8-3. Phase 2 (mesh)

- Istio (또는 Linkerd) 도입 시
- 자동 mTLS + L7 LB + 정책 관리
- 클라 측 LB 정책 코드 제거 가능 (Envoy 가 처리)

→ 이 단계 도달 전까지는 **mesh 도입 미루는 게** 운영 부담 균형.

## 9. 디버깅 도구

| 증상 | 도구 |
|---|---|
| 한 pod 만 받음 | `nslookup product` 로 IP 개수 확인 + 클라 LB policy 확인 |
| 간헐적 UNAVAILABLE | Envoy access log, gRPC `--logtostderr` |
| stream stalled | `nghttp` / WINDOW_UPDATE 추적 |
| RPC 실패 | `grpcurl -plaintext product:9090 list` (reflection) |

## 10. 면접 핵심

> Q: K8s 에서 gRPC 가 한 pod 에만 가는 이유와 해법?

A:
- 원인: HTTP/2 multiplexing (1 connection = 다수 stream) + ClusterIP service 의 L4 LB 가 connection 단위 분배
- 해법: (1) Envoy / mesh 로 L7 LB, (2) headless service + 클라이언트 round_robin, (3) ingress 의 gRPC 모드, (4) gRPC xDS resolver

> Q: gRPC client-side LB 와 proxy-based LB 의 트레이드오프?

A:
- Client-side: 인프라 단순 + latency 1 hop 적음, 그러나 클라마다 정책 구현 / 언어별 구현 차이
- Proxy (Envoy): 정책 일관성 + 언어 무관, 그러나 sidecar 운영 부담 + latency hop 1 추가

> Q: headless service 가 LB 측면에서 의미하는 바?

A: ClusterIP 가 None 이라 kube-proxy 가 개입 안 함. DNS A record 로 모든 pod IP 노출. 클라가 직접 모든 endpoint 를 알고 자체 LB 정책 (round_robin) 으로 분배. gRPC + HTTP/2 multiplexing 환경에서 표준 패턴.

## 다음 학습

- [11-error-handling.md](11-error-handling.md) — UNAVAILABLE / DEADLINE_EXCEEDED 등 LB 관련 status
- [12-auth-mtls-jwt.md](12-auth-mtls-jwt.md) — mesh 의 mTLS 위임
