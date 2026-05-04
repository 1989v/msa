---
parent: 18-grpc
seq: 99
title: gRPC 개념 카탈로그 — Protobuf · HTTP/2 · Streaming · 심화 템플릿
type: catalog
created: 2026-05-04
updated: 2026-05-04
status: living-doc
sources:
  - https://grpc.io/docs/
  - https://grpc.io/docs/what-is-grpc/core-concepts/
  - https://protobuf.dev/
  - https://grpc.io/docs/guides/auth/
  - https://github.com/grpc/grpc-java
  - https://buf.build/docs
  - https://connectrpc.com/docs/
---

# 99. gRPC 개념 카탈로그

> **목적** — 18-grpc 의 20+ deep file + grpc.io / protobuf.dev / buf / Connect RPC 공식 기준 빠진 영역 발굴 (Buf workflow + breaking change detection, gRPC-Web, ConnectRPC, gRPC over HTTP/3, xDS-based load balancing, Server reflection, Channelz 등).

---

## 1. 기존 커버 매트릭스

| 카테고리 | 핵심 | 상태 |
|---|---|---|
| Protobuf | message / service / scalar types / wire format | ✅ |
| HTTP/2 | frames, multiplexing, flow control | ✅ |
| 4 RPC 패턴 | unary / server streaming / client streaming / bidi | ✅ |
| Codegen | protoc / java / kotlin / python | ✅ |
| Auth | TLS / mTLS / token-based | ✅ |
| 인터셉터 | client / server interceptor | ✅ |
| 에러 모델 | Status + StatusRuntimeException | ✅ |
| Schema 호환 | wire-compatibility 규칙 | ✅ |
| K8s LB | headless service + ClientSideLB / xDS | ✅ |
| msa 적용 | (현재 미적용 가설, ADR 후보) | 🟡 |

### 1-A. 갭 진단

1. **Buf** (CLI + BSR) — protoc 후속 워크플로우, breaking change detection, dep mgmt
2. **buf.gen.yaml + buf.yaml + buf.work.yaml** — 표준 구성
3. **gRPC-Web** — browser 호환
4. **ConnectRPC** — gRPC + HTTP/JSON + browser 친화 (Buf)
5. **gRPC over HTTP/3 (QUIC)** — 실험
6. **xDS** (Envoy ADS) — service discovery + load balancing
7. **Server reflection** — `grpc.reflection.v1alpha.ServerReflection`
8. **Channelz** — runtime debugging
9. **Health check protocol** — `grpc.health.v1`
10. **Retry policy (gRPC service config)** — JSON 기반
11. **Hedging policy** (#7/#12 cross — Tail at Scale)
12. **Deadlines** (vs timeouts) propagation
13. **Cancellation propagation**
14. **Compression** — gzip / deflate / snappy (default off, opt-in)
15. **Keepalive (KEEPALIVE_TIME / KEEPALIVE_TIMEOUT / PERMIT_WITHOUT_CALLS)**
16. **Flow control (HTTP/2 window) tuning**
17. **MaxInboundMessageSize / MaxOutboundMessageSize**
18. **Message size 함정** (default 4MB)
19. **Proto3 vs Proto2** — optional / required / oneof / map
20. **Well-known types** (Timestamp / Duration / Any / Struct / Value / FieldMask / Empty)
21. **Custom options** + protoc plugin
22. **gRPC-Gateway** — REST/JSON gateway
23. **Server-streaming with backpressure** — flow control
24. **Bidi streaming + frame interleaving**
25. **Interceptor 의 Metadata propagation**
26. **Tracing (OpenTelemetry gRPC instrumentation)** + W3C Trace Context (#10 cross)
27. **Authentication strategies** — mTLS / OAuth2 (Bearer) / JWT / API key
28. **Authorization** — protoreflect + per-method / per-service
29. **Load Balancing 정책** — pick_first / round_robin / weighted_round_robin / xDS / RLS (Route Lookup Service)
30. **Name Resolver — DNS / xDS / k8s headless service / static**
31. **Channel + Subchannel + Stream** lifecycle
32. **Protobuf editions (2023+)** — proto2/3 의 후속
33. **Schema Registry for Protobuf** (Confluent + Apicurio)
34. **gRPC + Kafka** — Schema Registry + EventEnvelope
35. **gRPC service mesh integration** (Istio + xDS)
36. **gRPC + Envoy front-proxy** — TLS termination
37. **gRPC interceptor chain order**
38. **Reflection-based dynamic clients**
39. **grpcurl + grpcui** — 도구
40. **Performance tuning** — request batching, message size, compression, channel sharing

---

## 2. 카테고리별 개념 트리

### A. Protobuf

| 개념 | 정의 | 상태 |
|---|---|---|
| Message / scalar types / enum | wire format | ✅ |
| Field number 규칙 (1-15 = 1 byte tag) | wire 효율 | ✅ |
| Tag types (VARINT / I64 / LEN / I32) | wire | ✅ |
| `optional` / `repeated` / `oneof` / `map` | 4 | ✅ |
| Proto3 vs Proto2 | 차이 | ✅ |
| **Editions (2023+)** — proto2/3 후속 | 새 표준 | ★ 신규 |
| **Well-known types** (Timestamp / Duration / Any / Struct / Value / FieldMask / Empty) | 8 | ★ 신규 |
| Custom options + protoc plugin | 확장 | ★ 신규 |
| **Buf** (CLI + BSR) | protoc 후속 | ★ 신규 |
| Breaking change detection (buf breaking) | schema 진화 | ★ 신규 |

### B. HTTP/2 / Wire

| 개념 | 정의 | 상태 |
|---|---|---|
| Frames (HEADERS / DATA / SETTINGS / WINDOW_UPDATE / PING / GOAWAY / RST_STREAM) | binary | ✅ |
| Multiplexing | stream parallel | ✅ |
| **Flow control (window)** | per-stream + per-connection | 🟡 |
| Header compression (HPACK) | 효율 | 🟡 |
| HTTP/3 (QUIC) | gRPC over QUIC (실험) | ★ 신규 |

### C. RPC 패턴

| 패턴 | 정의 | 상태 |
|---|---|---|
| Unary | 1 req → 1 resp | ✅ |
| Server streaming | 1 req → N resp | ✅ |
| Client streaming | N req → 1 resp | ✅ |
| Bidirectional streaming | N ↔ N | ✅ |

### D. Channel / LB / Discovery

| 개념 | 정의 | 상태 |
|---|---|---|
| Channel + Subchannel + Stream | lifecycle | 🟡 |
| Name resolver (dns / static / xDS / k8s) | discovery | ✅ |
| LB policy — pick_first / round_robin / weighted_round_robin / **xDS** / **RLS** | LB 5종 | ★ 신규 |
| K8s headless service + client-side LB | gRPC 표준 | ✅ |
| **xDS (Envoy ADS)** | service mesh 통합 | ★ 신규 |

### E. Auth / Security

| 개념 | 정의 | 상태 |
|---|---|---|
| TLS / **mTLS** | 표준 | ✅ |
| Token (Bearer / JWT) | metadata 'authorization' | ✅ |
| OAuth2 ChannelCredentials | gRPC auth helper | 🟡 |
| Per-call vs per-channel credentials | 두 모델 | 🟡 |
| Compute Engine credentials / Workload Identity | cloud | ★ 신규 |

### F. 회복성 / 운영

| 개념 | 정의 | 상태 |
|---|---|---|
| **Retry policy** (service config JSON) | code 기반 재시도 | ★ 신규 |
| **Hedging policy** (Tail at Scale) | duplicate 호출 | ★ 신규 |
| Deadlines propagation | 부모 deadline 전파 | ✅ |
| Cancellation propagation | client → server | ✅ |
| Compression (gzip / snappy / deflate) | opt-in | ★ 신규 |
| **Keepalive (TIME / TIMEOUT / PERMIT_WITHOUT_CALLS)** | 연결 유지 | ★ 신규 |
| **MaxInboundMessageSize / Outbound** | 4MB default 함정 | ★ 신규 |

### G. 도구 / 진단

| 도구 | 역할 | 상태 |
|---|---|---|
| **grpcurl** | curl 등가 CLI | ★ 신규 |
| **grpcui** | UI 클라이언트 | ★ 신규 |
| **Server reflection** (`grpc.reflection.v1alpha.ServerReflection`) | 동적 호출 | ★ 신규 |
| **Channelz** | runtime debugging | ★ 신규 |
| **Health check protocol** (`grpc.health.v1`) | k8s liveness | ★ 신규 |
| OpenTelemetry gRPC instrumentation (#10 cross) | trace / metric | ★ 신규 |

### H. Web / 호환

| 개념 | 정의 | 상태 |
|---|---|---|
| **gRPC-Web** | browser 호환 (HTTP/1.1 + Envoy proxy) | ★ 신규 |
| **gRPC-Gateway** | REST/JSON gateway | ★ 신규 |
| **ConnectRPC** (Buf) | gRPC + JSON + browser 친화 | ★ 신규 |

### I. 통합 패턴

| 패턴 | 정의 | 상태 |
|---|---|---|
| Spring Boot gRPC starter (`net.devh:grpc-spring-boot-starter`) | Spring 통합 | ✅ |
| Schema Registry for Protobuf (Confluent / Apicurio) | Kafka EventEnvelope | ★ 신규 |
| Service Mesh + gRPC (Istio + xDS) | sidecar LB | ★ 신규 |
| Envoy front-proxy + gRPC + TLS termination | edge | ★ 신규 |

---

## 3. 우선 심화 후보 Top-10

| 우선 | 주제 | 왜 |
|---|---|---|
| 1 | **Buf 워크플로우 (CLI + buf.yaml + buf.gen.yaml)** | protoc 후속 표준 |
| 2 | **buf breaking change detection** | schema 진화 안전성 |
| 3 | **gRPC service config (Retry + Hedging + Deadline)** | 운영 회복성 표준 |
| 4 | **xDS-based LB** | service mesh 진입 시 |
| 5 | **gRPC-Web / gRPC-Gateway / ConnectRPC** | browser 호환 결정 |
| 6 | **Health check protocol + k8s liveness/readiness** | 표준 health |
| 7 | **OpenTelemetry gRPC instrumentation** (#10 cross) | trace/metric 표준 |
| 8 | **Keepalive + Flow control + MaxMessageSize** 튜닝 | 운영 함정 |
| 9 | **Well-known types (Timestamp/Duration/Any/FieldMask)** | 정확한 사용 |
| 10 | **Schema Registry for Protobuf + Kafka EventEnvelope** | event-driven 표준 |

---

## 4. 표준 심화 스터디 템플릿

`19/99 §4` 사용. gRPC 특화:
- §3 → "Channel / Stream / RPC 패턴 다이어그램"
- §6 → "gRPC vs REST vs ConnectRPC" 비교
- §7 → "Channelz / Health / OTel" 운영 표

---

## 5. 참고 자료

- gRPC docs: https://grpc.io/docs/
- Protobuf: https://protobuf.dev/
- Buf: https://buf.build/docs
- ConnectRPC: https://connectrpc.com/docs/
- gRPC-Java: https://github.com/grpc/grpc-java
- "gRPC: Up and Running" (Kasun Indrasiri, Danesh Kuruppu)
- "Practical gRPC"
- gRPC Service Config: https://github.com/grpc/grpc/blob/master/doc/service_config.md
- xDS: https://www.envoyproxy.io/docs/envoy/latest/api-docs/xds_protocol
