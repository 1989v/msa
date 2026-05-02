---
parent: 11-k8s-deep-dive
seq: 13
title: Service Mesh — Istio / Linkerd 개요
type: deep
created: 2026-05-01
---

# 13. Service Mesh — Istio / Linkerd

## 1. 한 문장 요약

> "각 Pod 에 사이드카(또는 노드 에이전트) 를 붙여서 **트래픽을 가로채고**, **mTLS / observability / traffic policy** 를 앱 코드 변경 없이 제공하는 인프라 층."

## 2. 왜 필요한가 — Mesh 가 푸는 5가지 문제

1. **mTLS** — 서비스 간 트래픽 암호화 + 상호 인증. 앱 코드에 안 붙임.
2. **관측성** — 트래픽 메트릭(RPS/p99/error rate) + 분산 추적이 자동.
3. **트래픽 정책** — Canary / Mirror / Retry / Timeout / CircuitBreaker 를 declarative 로.
4. **인가 (authz)** — "auth-service 만 user-service 호출 가능" 같은 정책.
5. **L7 라우팅** — header / path / method 기반 라우팅, gRPC LB.

전제: 위 5개를 모두 **코드 한 줄 안 바꾸고** 얻고 싶을 때 mesh 가 의미. 한두 개만 필요하면 mesh 없이도 가능 (cert-manager + Prometheus + spring-retry 등).

## 3. 아키텍처 — Sidecar 모델

```
   Pod                                       Pod
   ┌───────────────┐                       ┌───────────────┐
   │  app          │                       │  app          │
   │     │         │                       │     │         │
   │     ▼         │                       │     ▲         │
   │  sidecar(envoy)─── mTLS encrypted ────► sidecar(envoy)│
   └───────────────┘                       └───────────────┘
            │                                       │
            │  metrics / config                     │
            ▼                                       ▼
        ┌───────────────────────────────────────────────┐
        │  Control Plane (istiod / linkerd-controller)  │
        │   xDS API → 사이드카에 정책/엔드포인트 push       │
        └───────────────────────────────────────────────┘
```

- **Data Plane** — 사이드카 (Envoy / linkerd2-proxy). Pod 의 트래픽을 가로챔 (iptables redirect 또는 eBPF)
- **Control Plane** — 사이드카에 정책 동기화 (Istio: istiod, Linkerd: linkerd-controller)

## 4. Istio 의 핵심 CRD

| Kind | 역할 |
|---|---|
| `VirtualService` | 라우팅 규칙 (host / path / weight / mirror) |
| `DestinationRule` | 대상 서비스의 subset 정의 + LB / outlier detection |
| `Gateway` | mesh 진입점 (ingress) |
| `ServiceEntry` | 외부 서비스를 mesh 가 인식 |
| `AuthorizationPolicy` | 누가 누구를 호출할 수 있는가 |
| `PeerAuthentication` | mTLS 모드 (STRICT / PERMISSIVE) |
| `RequestAuthentication` | JWT 검증 |

### 예시 1 — Canary 가중치

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata: { name: gateway }
spec:
  hosts: [gateway]
  http:
    - route:
        - destination: { host: gateway, subset: stable }
          weight: 90
        - destination: { host: gateway, subset: canary }
          weight: 10
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata: { name: gateway }
spec:
  host: gateway
  subsets:
    - name: stable
      labels: { version: v1 }
    - name: canary
      labels: { version: v2 }
```

### 예시 2 — mTLS STRICT

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata: { name: default, namespace: commerce }
spec:
  mtls: { mode: STRICT }    # 사이드카 없는 호출 거부
```

### 예시 3 — 인가

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata: { name: product-authz, namespace: commerce }
spec:
  selector: { matchLabels: { app: product } }
  action: ALLOW
  rules:
    - from:
        - source: { principals: ["cluster.local/ns/commerce/sa/gateway", "cluster.local/ns/commerce/sa/order"] }
      to:
        - operation: { methods: ["GET"], paths: ["/api/v1/products*"] }
```

→ `gateway` 와 `order` ServiceAccount 만 product 호출 가능 (SPIFFE ID 기반).

## 5. Linkerd 의 차별점

- **언어**: Rust (linkerd2-proxy). 메모리 풋프린트 작음
- **단순함**: Istio 의 절반 정도 CRD
- **자동 mTLS**: 기본 활성, 별도 설정 불필요
- **Service Profiles** — VirtualService 와 비슷하지만 더 단순
- **TrafficSplit (SMI)** — Canary 표준 인터페이스

비교:

| 항목 | Istio | Linkerd |
|---|---|---|
| 사이드카 | Envoy (C++, ~50MB) | linkerd2-proxy (Rust, ~10MB) |
| CRD 수 | 많음 (20+) | 적음 (~5) |
| 학습 곡선 | 가파름 | 완만 |
| mTLS | PeerAuth 명시 | 기본 활성 |
| 외부 연동 | Envoy 의 풀생태계 | 단순 |
| Ambient mode | 1.20+ (sidecar 없는 모드 추가) | 없음 |

## 6. Istio Ambient Mesh — sidecar 없이?

2024 년 GA. 기존 모델의 단점(메모리/CPU/cold start) 를 해결:

- **L4 (zero-trust)** — `ztunnel` DaemonSet 으로 노드 단위 mTLS
- **L7 (정책/관측)** — `waypoint proxy` 라는 별도 Pod 가 namespace/SA 별 처리

장점: 사이드카 주입 없음 → Pod 메모리 ↓ + 시작 빠름. 단점: 새 모델이라 운영 이력 적음.

## 7. eBPF 와 mesh 의 충돌/협력

Cilium 진영은 "**사이드카 없이 eBPF + Cilium Service Mesh**" 를 밀고 있음:
- 노드 레벨에서 트래픽 가로채기 → mTLS / 정책 / 관측
- Pod 마다 사이드카 없음 → 자원 효율

장단:
- 장점: 메모리/CPU 절감, 가시성 좋음 (Hubble)
- 단점: L7 풍부함은 사이드카만큼은 아님 (점진 보완 중)

## 8. 비용 / 복잡도

mesh 도입의 비용:
- 메모리 — Pod 당 사이드카 50-100MB (Envoy) → 100 Pod 클러스터에 5-10GB 추가
- CPU — request 당 +1ms (사이드카 hop)
- 운영 — CRD 학습, debug 도구, 버전 업그레이드, sidecar 호환성

이 비용을 정당화하려면 **mTLS, 관측성, 정책** 중 최소 2개가 진짜 필요해야 함.

대안 (mesh 없이):
- mTLS → cert-manager + SPIFFE/SPIRE
- 관측성 → kube-prometheus-stack + OpenTelemetry
- 정책 → NetworkPolicy + Pod identity (Cilium L7)

## 9. msa 적합도

현재 (`prod-k8s` overlay):
- 외부 진입: ingress-nginx + cert-manager TLS
- 내부 통신: HTTP/REST + Kafka. gRPC 없음.
- 관측성: ServiceMonitor + Prometheus. Tracing 미적용.
- 인가: gateway 가 JWT 검증 후 헤더로 신뢰 → 모든 내부 호출 trust each other (현재 모델)

mesh 도입의 가치:
- **mTLS** — 보통. 같은 클러스터 내 평문 트래픽이지만, NetworkPolicy 로 어느 정도 격리 가능.
- **관측성** — 보통. ServiceMonitor + 분산 추적 도입으로 충분 가능.
- **정책** — 낮음 (현재 namespace 단일). 멀티 테넌시 시작하면 가치 ↑
- **traffic split** — Argo Rollouts + ingress-nginx 가중치로 충분.

→ **현시점 도입 가치 작음**. NetworkPolicy + 분산 추적 + Argo Rollouts 가 우선. mesh 는 다음 라운드.

도입 시점 시그널:
- 멀티 클러스터 / 멀티 테넌트
- B2B mTLS 의무 (PCI / 금융)
- 서비스 50+ 로 점차 복잡

## 10. mTLS 자체는 mesh 없이도 가능

cert-manager + SPIFFE/SPIRE 또는 cert-manager + 앱 자체 TLS:

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata: { name: gateway-internal-tls, namespace: commerce }
spec:
  secretName: gateway-internal-tls
  issuerRef: { name: internal-ca, kind: ClusterIssuer }
  commonName: gateway.commerce.svc
  dnsNames: [gateway, gateway.commerce, gateway.commerce.svc]
  duration: 720h
  renewBefore: 168h
```

각 서비스가 인증서를 마운트 → Spring Boot `server.ssl.*` 설정 → mTLS 통신. 코드는 바뀌지만 mesh 없이 가능.

자세한 mTLS / SPIFFE 는 [#13 17-mtls.md](../13-crypto-jwt-sso/17-mtls.md) 참조.

## 11. 분산 추적 (Tracing) — mesh 없이

mesh 의 자동 tracing 대신 **OpenTelemetry SDK** 를 앱에 도입:

```kotlin
// build.gradle
implementation("io.opentelemetry.instrumentation:opentelemetry-spring-boot-starter")
```

```yaml
# Helm chart 또는 Deployment env
env:
  - { name: OTEL_EXPORTER_OTLP_ENDPOINT, value: http://otel-collector.monitoring:4317 }
  - { name: OTEL_RESOURCE_ATTRIBUTES, value: "service.name=gateway,deployment.environment=prod" }
```

장점: mesh 없이 tracing. 단점: 코드/agent 도입 비용, propagation header 일관성.

## 12. 면접 빈출 6

1. **"Mesh 가 정말 필요한가?"** → mTLS + 관측성 + 정책 의 3개 중 2개 이상이 진짜 필요할 때. NetworkPolicy + cert-manager + Prometheus 로 우선 시도.
2. **"Istio 와 Linkerd 차이?"** → 풍부함 vs 단순함. Istio 는 풀 기능 + 가파른 곡선, Linkerd 는 mTLS 자동 + 단순.
3. **"사이드카가 메모리를 얼마나 먹어?"** → Envoy 50-100MB, linkerd2-proxy 10-20MB. Pod 100개면 5-10GB.
4. **"Ambient mesh 는 뭔가?"** → 사이드카 없는 Istio 의 새 모델. ztunnel(L4) + waypoint(L7) 분리. 자원 절감.
5. **"mesh 의 mTLS 와 cert-manager 의 차이?"** → mesh 는 자동 (Pod 시작 시 인증서 부여 + 회전). cert-manager 만이면 운영자가 정책 설계.
6. **"Cilium 의 mesh 모델?"** → eBPF 기반, 사이드카 없음. L4 는 강력, L7 은 점진 보완.

## 13. 정리

```
Mesh 의 가치 = mTLS + 관측성 + 정책 + 트래픽 제어
   └─ "코드 변경 없이" 라는 부가어가 있을 때만 강력
   
대안:
   mTLS         ─► cert-manager + SPIFFE
   관측성       ─► OpenTelemetry + Prometheus
   정책         ─► NetworkPolicy + Cilium L7
   트래픽       ─► Argo Rollouts + ingress-nginx 가중치

msa 의 현재 단계: 대안으로 충분. mesh 는 다음 라운드.
```

다음: [14-k8s-security.md](14-k8s-security.md) — RBAC / Pod Security Standards / OPA / Kyverno / etcd 암호화.
