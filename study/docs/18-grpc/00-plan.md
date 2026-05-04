---
id: 18
title: gRPC 심화 — Protobuf · HTTP/2 · Streaming
status: completed
created: 2026-05-01
updated: 2026-05-02
tags: [grpc, protobuf, http2, rpc, streaming, microservices, schema-evolution]
difficulty: intermediate
estimated-hours: 14
codebase-relevant: false
---

# gRPC 심화

## 1. 개요

gRPC (gRPC Remote Procedure Call, Google 발 RPC 프레임워크) 는 Google 의 RPC (Remote Procedure Call, 원격 프로시저 호출) 프레임워크로 Protocol Buffers 직렬화 + HTTP/2 전송 + IDL 기반 코드 생성을 결합한다. MSA (Microservices Architecture, 마이크로서비스 아키텍처) 내부 통신에서 REST (Representational State Transfer) /JSON 대비 처리량·지연·schema 보장 면에서 우위가 있어 Netflix·Uber·Square·Spotify 등이 채택. msa 프로젝트는 현재 REST 기반이므로 도입 트레이드오프 평가까지 포함한다.

## 2. 학습 목표

- HTTP/2 의 multiplexing/streaming 이 gRPC 에 어떻게 활용되는가 설명
- Protobuf 직렬화 포맷 (varint, tag-wire-type, packed) 과 JSON 대비 크기/속도
- 4가지 gRPC 호출 패턴: Unary / Server-streaming / Client-streaming / Bidirectional streaming
- proto 파일 작성, schema evolution 규칙 (backward / forward compatibility)
- Interceptor / Metadata / Deadline / Cancellation
- 인증 (mTLS, JWT via metadata)
- 로드밸런싱 모델 (client-side LB, lookaside, headless service)
- 에러 처리 (Status code, error details)
- gRPC ↔ REST gateway (grpc-gateway, Envoy)
- gRPC vs REST/GraphQL 의 선택 기준 (10년차 면접 단골)

## 3. 선수 지식

- HTTP/1.1 vs HTTP/2 차이
- TLS (Transport Layer Security, 전송 계층 보안) 기본
- IDL 의 개념

## 4. 학습 로드맵

### Phase 1: 기본 개념
- RPC vs REST 의 추상화 차이
- Protocol Buffers IDL: message, field number, scalar types
- Proto3 의 default value, optional 필드 변천
- gRPC stub (blocking / async / reactive)
- 4가지 호출 패턴
- 코드 생성 (`protoc`, `protobuf-gradle-plugin`)
- Java/Kotlin gRPC 의존성 (`grpc-java`, `grpc-kotlin`)

### Phase 2: 심화
- **HTTP/2 의 핵심 기능 (gRPC 가 의존)**
  - Binary framing
  - Multiplexing (single TCP connection, 다중 stream)
  - Stream prioritization, flow control (per-stream + connection-level WINDOW_UPDATE)
  - Header compression (HPACK)
  - HTTP/2 + TLS (h2) vs cleartext (h2c)
- **Protobuf wire format**
  - tag = (field_number << 3) | wire_type
  - varint encoding (LEB128)
  - length-delimited / fixed32 / fixed64 / group(deprecated)
  - packed encoded repeated
  - JSON 대비 크기/속도 벤치 (보통 3-10x 작음, 5-100x 빠름)
- **Schema evolution**
  - field number 절대 재사용 금지
  - field 추가는 안전 (unknown field preserved)
  - 삭제 시 `reserved`
  - oneof, map, well-known types (Timestamp, Duration, Any)
  - Buf / Buf Schema Registry, lint, breaking detection
- **호출 패턴 활용**
  - Server-streaming: 실시간 시세, 알림 push
  - Client-streaming: 파일 업로드, 메트릭 배치
  - Bidi: 채팅, 실시간 협업
- **고급 기능**
  - **Deadline propagation**: client 가 timeout 설정 → 모든 downstream 자동 전파
  - Cancellation propagation
  - Interceptor (client-side / server-side)
  - Metadata (gRPC 의 헤더, ASCII / binary `-bin` 키)
  - Retry / Hedging (gRPC 자체 정책)
- **로드밸런싱**
  - Proxy-based (Envoy) — 외부 LB
  - Client-side: gRPC name resolver (`dns:///`, `xds:///`), Round Robin / pick_first
  - K8s (Kubernetes) 환경: ClusterIP service 는 L4 LB → multiplexing 때문에 한 pod 만 받음 → **Headless service + client-side LB** 또는 Envoy
- **에러 처리**
  - `Status` code 16개 (OK / CANCELLED / INVALID_ARGUMENT / DEADLINE_EXCEEDED / NOT_FOUND / ALREADY_EXISTS / PERMISSION_DENIED / UNAUTHENTICATED / RESOURCE_EXHAUSTED / FAILED_PRECONDITION / ABORTED / OUT_OF_RANGE / UNIMPLEMENTED / INTERNAL / UNAVAILABLE / DATA_LOSS)
  - `google.rpc.Status` + `details` 로 풍부한 에러 정보
- **인증**
  - mTLS (mutual TLS, 양방향 TLS) (보통 service mesh 가 처리)
  - JWT (JSON Web Token) via Metadata (#13 SSO (Single Sign-On, 단일 로그인) 와 결합)
- **상호운용**
  - grpc-gateway: gRPC ↔ REST/JSON 자동 매핑
  - gRPC-Web (브라우저 직접 호출)
  - Envoy 의 grpc_json_transcoder
- **트레이드오프**
  - 장점: 성능, schema, code-gen, deadline propagation, streaming
  - 단점: 디버깅 도구 부족 (curl 직접 X), 브라우저 직접 호출 불가, schema 관리 비용, 운영 부담 (proxy 설정), HTTP/2 LB 이슈

### Phase 3: 실전 적용
- msa service-to-service 호출 (현재 REST + Spring Cloud OpenFeign / RestClient) 을 gRPC 로 가정 시 영향 평가
  - 가장 latency 민감한 연결 식별 (예: gateway↔auth, order↔inventory)
  - 처리량 큰 연결 식별 (예: search↔product 인덱싱)
  - Kafka 와의 역할 분담: gRPC = 동기 RPC, Kafka = 비동기 이벤트 (혼동 금지)
- proto 파일 위치 전략: monorepo `proto/` 또는 BSR
- 구현 데모: 한 endpoint (예: product getById) 를 gRPC 로 추가하고 latency 비교
- ADR (Architecture Decision Record, 아키텍처 결정 기록) 후보: "service-to-service 통신에 gRPC 도입 보류 / 부분 도입 / 전면 전환"

### Phase 4: 면접 대비
- "REST 대신 gRPC 를 쓰는 이유는?"
- "gRPC 의 4가지 호출 패턴은?"
- "Protobuf 가 JSON 보다 빠른 이유는?"
- "gRPC 가 HTTP/2 의 어떤 기능을 활용하나요?"
- "K8s 에서 gRPC 로드밸런싱이 잘 안 되는 이유는?"
- "gRPC 와 Kafka 의 역할 차이는?"
- "Schema evolution 은 어떻게 안전하게 하나요?"
- "Deadline propagation 이 뭔가요? REST 에서는 어떻게?"
- "gRPC 도입의 단점은?"

## 5. 코드베이스 연관성

- 현재 msa 는 REST + Kafka — gRPC 미사용
- **잠재 적용**: 내부 핫패스 (auth ↔ gateway, order ↔ inventory)
- **참고 ADR**: ADR-0011 (inventory-fulfillment service), ADR-0015 (resilience strategy) — 도입 시 보완 필요
- ADR 작성 후보: "gRPC 도입 검토 — 현 시점 결론과 부분 도입 기준"

## 6. 참고 자료

- gRPC 공식 docs (grpc.io)
- "gRPC: Up and Running" — Kasun Indrasiri
- HTTP/2 RFC 7540
- Protocol Buffers Encoding 공식 문서
- Buf 공식 (Schema Registry, breaking detection)
- Envoy gRPC docs

## 7. 미결 사항

> **회고 (2026-05-02)**: 본 섹션은 plan 작성 시점의 미결 항목이며, 현재 deep study 완료 상태에서 각 항목별로 마킹됨.

- 실습 깊이 (실제 proto 작성 + Spring Boot 통합 vs 이론)
  - 🔄 부분 결정: `02-protobuf-idl.md` + `05-codegen-stubs.md` (protoc/protobuf-gradle-plugin/grpc-kotlin) + `18-virtual-migration-product.md` 에서 product getById 가상 마이그레이션 + REST 와 병렬 운영 시뮬레이션 / 추가 검토 필요: 실제 Spring Boot 통합 동작 검증은 ADR 승격 후 PoC 단계로 이관.
- gRPC-Web 까지 포함 여부
  - ✅ 결정: `13-interop-gateway-web.md` 에서 grpc-gateway + gRPC-Web + Envoy json transcoder 까지 포함 (브라우저 직접 호출 불가 한계 명시).
- ADR 작성 (msa 에 gRPC 도입 검토)
  - ✅ 결정: `19-improvements.md` 가 ADR-XXXX (Proposed) 초안 형식 준수 — 보류/부분/전면 옵션 비교 + 추천 결론까지 작성 완료. 그대로 `docs/adr/` 승격 가능.

## 8. 원본 메모

```
18. grpc
```
