---
parent: 18-grpc
type: preview
created: 2026-05-01
---

# gRPC 심화 — Preview

> 학습자 수준: 중급(intermediate, gRPC 이론 +α / 실 운영 미경험) · 전체 예상 시간: 14h · 목표: 면접 대비 + msa 도입 ADR (Architecture Decision Record, 아키텍처 결정 기록) 초안 작성
> 계획서: [00-plan.md](00-plan.md) · 깊이 패키지: P3 풀팩 · 학습 순서: X (Top-down)

---

## 멘탈 모델: "4층 스택"

gRPC 는 단일 기술이 아니라 **4개의 층이 결합된 패키지**다. 면접/실무에서 어디서 트러블이 나는지는 거의 항상 한 층에 매핑된다.

```
  ┌──────────────────────────────────────────┐
  │  Layer 4: 운영 (LB / 인증 / 관측)
  │  - K8s headless service + client-side LB
  │  - mTLS (서비스 메시) + JWT metadata
  │  - Interceptor / Metadata / Deadline
  └──────────────────┬───────────────────────┘
                     │ "RPC 호출 패턴"
  ┌──────────────────┴───────────────────────┐
  │  Layer 3: gRPC 호출 모델
  │  - 4 패턴: Unary / Server / Client / Bidi
  │  - Status code 16개 + error details
  │  - Retry / Hedging / Cancellation 전파
  └──────────────────┬───────────────────────┘
                     │ "전송 채널"
  ┌──────────────────┴───────────────────────┐
  │  Layer 2: HTTP/2
  │  - Binary framing
  │  - Multiplexing / Flow control / HPACK
  │  - h2 (TLS) vs h2c (cleartext)
  └──────────────────┬───────────────────────┘
                     │ "메시지 직렬화 + 스키마"
  ┌──────────────────┴───────────────────────┐
  │  Layer 1: Protocol Buffers
  │  - IDL (message / field number / scalar)
  │  - Wire format (varint / tag-wire-type)
  │  - Schema evolution (reserved / oneof)
  └──────────────────────────────────────────┘
```

**핵심 5문장만 외운다**:
1. **Protobuf 가 빠른 이유** = 스키마 사전 합의 → 길이/타입 토큰 생략, varint 가변 길이 인코딩.
2. **gRPC 가 streaming 가능한 이유** = HTTP/2 의 multiplexing + 양방향 frame.
3. **K8s (Kubernetes) 에서 gRPC LB 가 안 되는 이유** = ClusterIP 는 L4 → 단일 TCP 위 다중 stream 을 한 pod 가 독식.
4. **Schema evolution** = field number 절대 재사용 금지 + 삭제 시 `reserved`.
5. **Deadline propagation** = client timeout 이 모든 downstream 으로 자동 전파, REST 에는 없음.

---

## 소주제 지도

> 21개 파일로 분할 (00-preview + 01~20). 각 파일 평균 ~40-60분.

### Phase 1: 기본 개념 (5개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 01 | RPC vs REST 추상화 차이 | [01-rpc-vs-rest.md](01-rpc-vs-rest.md) | 함수 호출 가상화 vs 리소스 표현, 결합도 트레이드오프 |
| 02 | Protobuf IDL (message / field number / scalar) | [02-protobuf-idl.md](02-protobuf-idl.md) | proto3 문법, scalar 매핑, nested / package |
| 03 | proto3 default value & optional 변천 | [03-proto3-defaults-optional.md](03-proto3-defaults-optional.md) | proto2→3 의 default 제거, optional 부활(3.15) |
| 04 | gRPC 4가지 호출 패턴 | [04-grpc-call-patterns.md](04-grpc-call-patterns.md) | Unary / Server / Client / Bidi + sequence diagram |
| 05 | 코드 생성 + stub (blocking/async/reactive) | [05-codegen-stubs.md](05-codegen-stubs.md) | protoc, protobuf-gradle-plugin, grpc-kotlin |

### Phase 2: 심화 (9개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 06 | HTTP/2 deep dive | [06-http2-deep-dive.md](06-http2-deep-dive.md) | binary framing, multiplexing, flow control, HPACK, h2/h2c |
| 07 | Protobuf wire format | [07-protobuf-wire-format.md](07-protobuf-wire-format.md) | tag-wire-type, varint LEB128, packed repeated, JSON 비교 |
| 08 | Schema evolution + Buf | [08-schema-evolution.md](08-schema-evolution.md) | field number 불변, reserved, oneof, well-known, BSR |
| 09 | 고급 기능 (Deadline / Interceptor / Retry) | [09-advanced-features.md](09-advanced-features.md) | Deadline propagation, Metadata, Retry / Hedging |
| 10 | 로드밸런싱 모델 | [10-load-balancing.md](10-load-balancing.md) | Envoy, client-side LB, headless service, xDS |
| 11 | 에러 처리 (Status code 16) | [11-error-handling.md](11-error-handling.md) | gRPC ↔ HTTP 매핑, google.rpc.Status, error details |
| 12 | 인증 (mTLS, JWT metadata) | [12-auth-mtls-jwt.md](12-auth-mtls-jwt.md) | #13 SSO 와 결합, 서비스 메시 위임 |
| 13 | 상호운용 (gateway / Web / transcoder) | [13-interop-gateway-web.md](13-interop-gateway-web.md) | grpc-gateway, gRPC-Web, Envoy json transcoder |
| 14 | 트레이드오프 종합 | [14-tradeoffs.md](14-tradeoffs.md) | 언제 도입, 언제 보류 — 의사결정 트리 |

### Phase 3: 실전 적용 (msa) (4개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 15 | msa 핫패스 식별 (latency / 처리량) | [15-msa-hot-paths.md](15-msa-hot-paths.md) | gateway↔auth, order↔inventory, search↔product |
| 16 | gRPC vs Kafka 역할 분담 | [16-grpc-vs-kafka.md](16-grpc-vs-kafka.md) | 동기 RPC vs 비동기 이벤트, ADR-0003 와 정합 |
| 17 | proto 파일 monorepo 전략 | [17-proto-monorepo-strategy.md](17-proto-monorepo-strategy.md) | monorepo `proto/`, BSR, 빌드 통합 |
| 18 | 가상 마이그레이션 (product getById) | [18-virtual-migration-product.md](18-virtual-migration-product.md) | REST 와 병렬 운영 시뮬레이션 |

### 산출물 (2개)

| # | 소주제 | 심화 파일 | 핵심 |
|---|---|---|---|
| 19 | gRPC 도입 검토 ADR 초안 | [19-improvements.md](19-improvements.md) | 보류 / 부분 / 전면 옵션 비교 + 결론 |
| 20 | 면접 Q&A 카드 | [20-interview-qa.md](20-interview-qa.md) | Phase 별 핵심 질문 + 모범 답변 |

---

## 개념 관계도

```
                 ┌─────────────────────────────┐
                 │  Protocol Buffers (IDL)     │
                 │  message / field# / scalar  │
                 └──────────────┬──────────────┘
                                │ protoc 코드 생성
                                ▼
                 ┌─────────────────────────────┐
                 │  gRPC stub (Kotlin / Java)  │
                 │  blocking / async / coroutine│
                 └──────────────┬──────────────┘
                                │ 4 가지 호출 패턴
                                ▼
                 ┌─────────────────────────────┐
                 │  HTTP/2 transport           │
                 │  multiplexing / flow control│
                 │  HPACK / binary framing     │
                 └──────────────┬──────────────┘
                                │ 운영 계층
                                ▼
              ┌────────┬────────┴────────┬─────────┐
              ▼        ▼                 ▼         ▼
         로드밸런싱  인증/mTLS      Interceptor   에러처리
         (Envoy)  (서비스 메시)   (관측/Auth)   (Status)
```

---

## Phase 1 치트시트 (학습 시작 전 한 장)

### 자주 헷갈리는 용어

| 용어 | 의미 | 한 줄 |
|---|---|---|
| RPC | Remote Procedure Call | 원격 함수 호출 추상화 |
| IDL | Interface Definition Language | 언어 중립 스키마 |
| Stub | 클라이언트/서버 generated code | proto → 코드 |
| Channel | gRPC 의 추상 연결 | 내부적으로 HTTP/2 connection pool |
| Stream | HTTP/2 의 단방향/양방향 메시지 흐름 | 한 RPC = 한 stream |
| Metadata | gRPC 의 헤더 (key-value) | ASCII / `-bin` 키 |
| Deadline | 절대 시각 timeout | downstream 자동 전파 |

### 호출 패턴 4가지 한 줄

| 패턴 | 클라 → 서버 | 서버 → 클라 | 예시 |
|---|---|---|---|
| Unary | 1 | 1 | getProduct(id) |
| Server-streaming | 1 | N | 시세 push, 검색 결과 페이징 |
| Client-streaming | N | 1 | 파일 업로드, 메트릭 배치 |
| Bidi | N | M | 채팅, 협업, 트레이딩 책 |

### Status code 16개 (자주 나오는 8개만)

| 코드 | 의미 | HTTP 매핑 |
|---|---|---|
| OK | 정상 | 200 |
| CANCELLED | 클라이언트 취소 | 499 (nginx) |
| INVALID_ARGUMENT | 입력 검증 실패 | 400 |
| DEADLINE_EXCEEDED | 시간 초과 | 504 |
| NOT_FOUND | 리소스 없음 | 404 |
| PERMISSION_DENIED | 인가 실패 | 403 |
| UNAUTHENTICATED | 인증 실패 | 401 |
| UNAVAILABLE | 서버 다운/과부하 | 503 |

### 절대 하지 말 것

- field number 재사용 (구버전과 wire 충돌)
- proto3 에서 0/false/"" 와 "필드 없음" 을 의미적으로 구분 (3.15+ optional 사용)
- ClusterIP service 로 gRPC 호출 (한 pod 만 받음)
- JSON-over-HTTP 와 Protobuf 직렬화 비용을 동일선상 비교 (스키마 가정 차이)
- Kafka 가 가능한 구간을 gRPC streaming 으로 대체 (영속성 / 재처리 손실)

---

## 학습 진행 가이드

- 권장 순서: **01 → 02 → ... → 20** (Top-down 직진)
- Phase 1 (01-05) 은 의존성 있음 → 순서대로
- Phase 2 의 06 (HTTP/2) 는 기존 HTTP/1.1 에 익숙하면 1.5배 빠름
- Phase 2 의 10 (LB) 는 K8s headless / xDS 배경 지식 도움
- **15-18 (Phase 3)** 은 msa 코드베이스 (`order/`, `auth/`, `search/`, `product/`) grep 병행 권장
- **19-improvements.md** 는 ADR 초안 — 그대로 `docs/adr/` 후보
- **20-interview-qa.md** 는 회독용 — 학습 종료 후 1주일 간격 2-3회 회독

각 파일 호출:
```
/study:start 18           # 다음 deep file 자동 선택
/study:start 18 06        # 06-http2-deep-dive.md 직접 지정
```
