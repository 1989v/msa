---
parent: 18-grpc
seq: 20
title: 면접 Q&A 카드 — Phase 별 핵심 + 모범 답변
type: interview-qa
created: 2026-05-01
---

# 20. 면접 Q&A

> 한국 대기업 백엔드 10년차 면접 기준. **답변 1줄 + 깊이 답변** 구조. 회독용 카드.

---

## Phase 1: 기본 (10문항)

### Q1. REST 와 gRPC 의 본질적 차이는?

**한 줄**: REST 는 *리소스 표현*, gRPC 는 *함수 호출 추상화*.

**깊이**:
- REST: URL 이 자원 식별자, HTTP 메서드 (GET/POST) 가 동작. 보통 JSON.
- gRPC: proto 의 RPC 시그니처가 1급. URL 은 단순 라우팅 키. Protobuf binary.
- 결합도: 데이터 결합은 gRPC 강함 (proto field number), 시간/위치 결합은 둘 다 동기 RPC면 같음.
- 진짜 느슨함은 Kafka 같은 메시지 브로커 (시간 + 위치 분리).

### Q2. Protobuf 가 JSON 보다 빠른 이유는?

**한 줄**: 사전 합의된 schema + varint + 컴파일된 직렬화 코드.

**깊이**:
1. 필드명 미전송 (number 만)
2. tag = `(field_number << 3) | wire_type` → 1 byte 가 흔함
3. Varint 가변 길이 (작은 수가 1 byte)
4. Packed repeated (배열 tag 1번)
5. Reflection 없는 컴파일된 코드
6. UTF-8 escape / whitespace 비용 0

페이로드 3-10x 작음, 직렬화 5-100x 빠름. JSON 도 simdjson / 컴파일 schema 로 가속 가능하나 본질적 한계.

### Q3. proto3 의 default 와 optional 의 변천은?

**한 줄**: proto3 가 단순화로 optional 제거 → "0 vs 미설정" 구별 불가 → proto3.15 에서 single-field oneof 로 부활.

**깊이**:
- proto2: required / optional / default 있음
- proto3 초기: 모두 제거, 모든 scalar 가 implicit default
- 문제: PATCH 의미 표현 불가 (`stock=0` 이 "0 으로 변경" 인지 "건드리지 마" 인지 모호)
- 우회: Wrapper types (`Int32Value`), FieldMask, sentinel
- proto3.15: `optional` 부활 (내부적으로 single-field oneof) → has_* 가능
- 신규 코드는 mutable 필드에 `optional` 권장

### Q4. gRPC 의 4가지 호출 패턴은?

**한 줄**: Unary, Server-streaming, Client-streaming, Bidirectional.

**깊이**:

| 패턴 | proto | 시나리오 |
|---|---|---|
| Unary | `rpc Foo(Req) returns (Resp)` | 일반 조회 |
| Server-stream | `returns (stream Resp)` | 시세 push, 실시간 알림 |
| Client-stream | `stream Req` | 파일 업로드, 메트릭 배치 |
| Bidi | `stream Req returns stream Resp` | 채팅, 협업, 트레이딩 호가창 |

HTTP/2 의 multiplexing + 양방향 frame 흐름이 가능하게 만듦. 의심스러우면 Unary.

### Q5. proto 의 field number 가 중요한 이유는?

**한 줄**: wire format 의 식별자라 한 번 발행되면 영원히 불변.

**깊이**:
- 필드명은 wire 에 안 보냄, number 만
- 1-15: 1 byte tag (자주 쓰는 필드 배치)
- 16-2047: 2 byte tag
- 재사용 금지 — 옛 클라가 옛 number 로 보낸 데이터를 새 reader 가 다른 필드로 해석하면 silent corruption
- 삭제 시 `reserved <number>;` 로 재사용 차단

### Q6. proto3 의 enum 에서 0 값을 unspecified 로 두는 이유?

**한 줄**: default 값과 "값 미설정" 을 구별 가능하게.

**깊이**:
- proto3 enum 은 0 값 필수 + default = 0
- 의미 있는 값에 0 을 두면 "안 보냄" 과 구별 불가
- Google API style guide: `XXX_UNSPECIFIED = 0`
- 서버는 UNSPECIFIED 받으면 INVALID_ARGUMENT 거부 또는 default 정책 명시

### Q7. gRPC stub 의 4가지 종류는?

**한 줄**: Blocking, Async (callback), ListenableFuture, Coroutine (Kotlin 권장).

**깊이**:
- Blocking: 호출 thread block. 간단 + 동기.
- Async: `StreamObserver` callback. 4 패턴 모두 지원.
- ListenableFuture: Guava future. Unary 만. 합성 용이.
- Coroutine (Kotlin): `suspend fun` (Unary, Client-stream) + `Flow<T>` (Server-stream, Bidi). 가장 깔끔. msa 의 WebClient + reactor 패턴과 호환.

### Q8. protoc / protobuf-gradle-plugin 의 역할?

**한 줄**: protoc 가 .proto → 언어별 코드, gradle 플러그인이 빌드 자동화.

**깊이**:
- protoc: C++ 바이너리, Google 공식 컴파일러
- 플러그인: `protoc-gen-grpc-java`, `protoc-gen-grpc-kotlin` 등 (각 언어 코드 생성)
- protobuf-gradle-plugin: protoc 호출 + sourceSet 통합 + 의존성 관리
- 산출물: `build/generated/source/proto/main/{java,kotlin,grpc,grpckt}/`
- Buf 가 protoc 대체 + lint + breaking + BSR 통합

### Q9. gRPC 와 IDL 의 관계는?

**한 줄**: proto 파일이 IDL 로서 schema + RPC 시그니처를 single source of truth.

**깊이**:
- IDL = Interface Definition Language
- 언어 중립 (proto 한 파일 → Java / Kotlin / Go / Python / TS 코드)
- 메시지 + 서비스 + 직렬화 규칙 + 진화 가능성 모두 담음
- DTO / 스키마 / 문서가 모두 proto 에서 파생 → drift 0

### Q10. gRPC 의 RPC URL 은 어떻게 생기나?

**한 줄**: `/<package>.<Service>/<Method>` 형식.

**깊이**:
- 예: `/commerce.product.v1.ProductService/GetProduct`
- HTTP/2 의 `:path` pseudo-header 에 인코딩
- 클라가 stub 호출 → 자동 생성
- ingress / Envoy 의 라우팅 키로 사용 (`/commerce.product.v1.*` prefix matching 가능)

---

## Phase 2: HTTP/2 + 심화 (12문항)

### Q11. gRPC 가 HTTP/2 의 어떤 기능을 활용하나?

**한 줄**: Binary framing + multiplexing + flow control + HPACK + trailers.

**깊이**:
1. Binary framing: 모든 메시지가 frame 단위, stream id 로 분리
2. Multiplexing: 1 TCP 위 다수 stream → 4 패턴 표현 가능
3. Flow control: per-stream + connection window → server-streaming 자동 백프레셔
4. HPACK: 헤더 압축 (작은 RPC 의 헤더 오버헤드 ↓)
5. Trailers: `grpc-status`, `grpc-message` 응답 후 전달

### Q12. K8s 에서 gRPC 가 한 pod 만 받는 이유와 해법?

**한 줄**: HTTP/2 multiplexing + ClusterIP 의 L4 LB 충돌. 해법은 headless + client-side LB 또는 Envoy.

**깊이**:
- 원인: HTTP/2 는 1 TCP 위 다수 stream. ClusterIP service 는 L4 (TCP) LB 라 connection 단위 분배만. 한 connection = 한 pod.
- 해법:
  1. **Headless service + 클라이언트 round_robin** — 가장 단순
  2. **Envoy / Istio mesh** — sidecar 가 L7 LB
  3. **ingress-nginx 의 gRPC 모드** — 외부 노출용
  4. **gRPC xDS resolver** — proxyless mesh

### Q13. HTTP/2 의 multiplexing 과 HTTP/1.1 의 pipelining 차이?

**한 줄**: pipelining 은 응답 순서가 요청 순서와 같아야 함 (HOL blocking), multiplexing 은 인터리브 가능.

**깊이**:
- HTTP/1.1 pipelining: 요청 N 개 보낸 후 응답을 *순서대로* 받아야 함. 한 요청이 느리면 다 막힘 (HOL).
- HTTP/2 multiplexing: 각 stream 이 독립. 빠른 응답이 먼저 와도 OK. stream id 로 분리.
- TCP 레벨 HOL 은 여전히 있음 → HTTP/3 (QUIC, UDP) 가 해결.

### Q14. HPACK 이란?

**한 줄**: HTTP/2 의 헤더 압축 — static / dynamic table + Huffman.

**깊이**:
- Static table: 자주 쓰는 61개 헤더 사전 정의 (`:method GET`, `:status 200`)
- Dynamic table: 연결마다 LRU 사전 (첫 송신 후 인덱스 참조)
- Huffman: 평문 헤더 값을 가변 길이 인코딩
- 효과: `Authorization: Bearer xyz` 첫 50 byte → 다음부터 2 byte
- 보안: CRIME / BREACH 대비 sensitive flag 활용

### Q15. Protobuf wire format 의 tag 는?

**한 줄**: `tag = (field_number << 3) | wire_type` 의 varint.

**깊이**:
- field number: 사용자 정의 (1-2^29-1)
- wire_type: VARINT(0), I64(1), LEN(2), I32(5) — 4 종 흔함
- 예: field 1 + VARINT = `(1 << 3) | 0 = 0x08` (1 byte)
- 1-15 number = 1 byte tag, 16+ 부터 2 byte → 자주 쓰는 필드는 1-15
- 모르는 tag 는 wire_type 으로 길이 계산 후 skip (forward compat)

### Q16. int32 와 sint32 의 차이?

**한 줄**: int32 는 음수일 때 10 byte, sint32 는 ZigZag 로 짧음.

**깊이**:
- int32 -1 = 64-bit 부호확장 → varint 10 byte (모든 byte 가 0xFF)
- sint32 = ZigZag 매핑 (`(n << 1) ^ (n >> 31)`)
  - 0 → 0, -1 → 1, 1 → 2, -2 → 3, 2 → 4
- sint32 -1 = 1 byte
- 음수 빈번 필드 (delta, offset) 는 반드시 sint*

### Q17. Schema 를 안전하게 진화시키는 법은?

**한 줄**: field number 재사용 금지, 추가는 안전, 삭제는 reserved, major 변경은 v2 패키지.

**깊이**:
1. 필드 추가 (새 number) = ✅ 안전 (옛 reader 는 unknown 으로 무시 + 보존)
2. 필드 number 재사용 = ❌ 절대 금지 → silent corruption
3. 삭제 시 `reserved <num>; reserved "name";`
4. type 변경은 같은 wire 호환 그룹 내에서만 (int32 ↔ int64 OK, int32 ↔ sint32 X)
5. enum 0 = `_UNSPECIFIED`
6. major 변경 = 패키지 분리 (`v1` → `v2`), deprecated v1 6개월 유지
7. Buf breaking detection 을 CI 에

### Q18. Deadline propagation 이란?

**한 줄**: 클라가 timeout 부여하면 모든 downstream gRPC 호출에 자동 전파.

**깊이**:
- 클라가 `withDeadlineAfter(500, MS)` 설정 → `grpc-timeout: 500m` metadata 송신
- 서버가 다른 gRPC 호출 시 *남은 시간* 으로 deadline 자동 부여
- 어느 hop 에서든 만료 → 즉시 cancel 신호 전파
- REST 에는 표준 없음 (수동 헤더로 흉내)
- ADR-0025 의 fan-out tail 보호의 핵심 도구

### Q19. gRPC retry 와 Resilience4j 의 관계는?

**한 줄**: 다른 레이어 — gRPC 는 transport, Resilience4j 는 비즈 코드 가까이.

**깊이**:
- gRPC service config: JSON 으로 retry / hedging / timeout 선언. transparent.
- 멱등 RPC + UNAVAILABLE 만 retry 의미
- Resilience4j: Circuit Breaker / Bulkhead / RateLimiter 등 retry 외 패턴
- msa 패턴: Resilience4j CB + gRPC retry policy 병행. 충돌 없음.

### Q20. gRPC Status code 16개 중 retry 가능한 것은?

**한 줄**: ABORTED (10), UNAVAILABLE (14), 조건부 RESOURCE_EXHAUSTED / DEADLINE_EXCEEDED.

**깊이**:
- ABORTED = 동시성 충돌 (낙관락) → 멱등 retry 가능
- UNAVAILABLE = transient transport / 서버 다운 → transparent retry
- RESOURCE_EXHAUSTED = quota 초과 → backoff 후
- DEADLINE_EXCEEDED = 시간 충분하면
- INVALID_ARGUMENT / NOT_FOUND / PERMISSION_DENIED 등은 retry 무의미

### Q21. UNAUTHENTICATED 와 PERMISSION_DENIED 차이?

**한 줄**: 누구냐 모름 (401 매핑) vs 그 사람은 안 됨 (403 매핑).

**깊이**:
- UNAUTHENTICATED (16): 자격 증명 부재 / 잘못. JWT 만료 / 누락.
- PERMISSION_DENIED (7): 인증은 OK 지만 권한 없음. RBAC 거부.
- 클라 측 처리 다름: UNAUTHENTICATED → 토큰 갱신 / 재로그인, PERMISSION_DENIED → 에러 표시.

### Q22. ABORTED 와 UNAVAILABLE 의 retry 의미 차이는?

**한 줄**: ABORTED 는 application-level (멱등 보장 책임), UNAVAILABLE 은 transport (transparent OK).

**깊이**:
- ABORTED: 트랜잭션 충돌, 낙관락 위반. 클라이언트가 같은 요청 재시도 = 동일한 결과면 OK (멱등). 비멱등이면 idempotency key 필요.
- UNAVAILABLE: TCP 연결 실패, 서버 재시작 중. transport 레벨 — 실제로 서버에 도달 안 했을 가능성 높음 → safe to retry.
- gRPC 의 transparent retry 는 UNAVAILABLE 위주.

---

## Phase 3: 운영 + msa 적용 (8문항)

### Q23. mTLS 와 JWT metadata 의 역할 분담은?

**한 줄**: mTLS = 서비스 신원, JWT = 사용자 신원.

**깊이**:
- mTLS: 인증서의 CN/SAN = 서비스 ID. 서비스 메시 (Istio) 가 자동 발급/회전. AuthorizationPolicy 로 service-to-service.
- JWT via metadata: 사용자 위임 호출. `authorization: Bearer <token>` ClientInterceptor 로 주입, ServerInterceptor 가 검증.
- Zero-trust 표준 = 둘 다 적용. mTLS 가 *어느 서비스* 보증, JWT 가 *어느 사용자* 전달.

### Q24. gRPC 도입 시 mesh 가 필요한가?

**한 줄**: 아니다. mesh 없이도 부분 도입 가능. mesh 는 4-5 서비스 이상 안정화 후 별도 결정.

**깊이**:
- 부분 도입 단계: headless service + 클라 round_robin + h2c (NetworkPolicy 격리) 로 충분
- mesh 도입 시 이득: 자동 mTLS, AuthorizationPolicy, sidecar L7 LB, 메트릭 통합
- mesh 도입 비용: control plane 운영, 학습, 디버깅 복잡
- "한 번에 한 변수" 원칙 — gRPC + mesh 동시 도입 ❌

### Q25. msa 에 gRPC 를 도입한다면 어디부터?

**한 줄**: 핫패스 하나만 POC. order → product.getProduct 가 자연스러움.

**깊이**:
1. POC: 단일 endpoint, 양립 운영, 1주 측정
2. 평가 4축: latency 민감도 / 호출 빈도 / 페이로드 크기 / schema drift 위험
3. 우선 후보:
   - `gateway → auth` (high RPS, deadline propagation)
   - `order → product` (POC 시작점)
   - `order → inventory` (ADR-0011 핫패스)
   - `search-batch → product` (server-streaming best fit)
4. 제외: 외부 API (PG, OAuth), 비동기 (Kafka 자리), 트래픽 적은 호출

### Q26. gRPC 와 Kafka 둘 다 쓰는 이유?

**한 줄**: 동기 RPC = gRPC, 비동기 영속 이벤트 = Kafka. 본질이 다른 도구.

**깊이**:
- gRPC: 시간/위치 결합 강함, 영속성 없음, 1:1, 동기 응답.
- Kafka: 시간/위치 결합 약함, 영속 + replay, 1:N pub/sub.
- 표준 패턴: Outbox + Saga choreography. 동기 진입 = gRPC, 후속 처리 = Kafka.
- streaming ≠ Kafka. streaming 은 transient real-time, Kafka 는 persistent log.

### Q27. proto 파일은 어디에 두나?

**한 줄**: monorepo 의 전용 모듈 (`:proto-commerce`).

**깊이**:
- 옵션 A (서비스 내) = 복제 / drift 위험
- 옵션 B (전용 모듈) = 추천 — 단일 진실, 빌드 캐시
- 옵션 C (별도 repo) = 다수 monorepo 공유 시
- 옵션 D (BSR) = 외부 공개 / 거버넌스 강화
- 패키지 컨벤션: `commerce.<domain>.v1`, Java: `com.kgd.proto.commerce.<domain>.v1`

### Q28. Buf 의 역할은?

**한 줄**: lint + breaking detection + (선택) BSR 의 schema 거버넌스 도구.

**깊이**:
- `buf lint` — STANDARD 룰 (Google API style + 자체)
- `buf breaking --against '.git#branch=main'` — 호환 깨짐 PR 차단
- `buf format -w` — 표준 포매팅
- `buf generate` — protoc 대체 코드 생성
- BSR — proto 패키지 게시 (npm 처럼). 외부 공개 시 검토.
- CI 통합으로 silent breaking 차단 — gRPC 도입의 안정성 보강

### Q29. gRPC 도입의 단점은?

**한 줄**: 디버깅 도구 부족, 브라우저 X, K8s LB 함정, 학습 곡선.

**깊이**:
1. curl 직접 X — `grpcurl` 별도, 평문 로그 X
2. 브라우저 직결 X — gRPC-Web (Envoy) 필요
3. K8s ClusterIP 와 multiplexing 충돌
4. schema 거버넌스 비용 (Buf, 버전, PR review)
5. 운영 인프라 학습 (mesh, 별도 포트)
6. HTTP 캐시 / CDN 부적합 → 외부 API 부적합
7. 빌드 통합 비용 (proto 생성, +5-10s)

### Q30. 면접 마무리 — gRPC 한 줄 평?

**한 줄**: schema-first MSA 내부 통신의 표준. 점진 도입, 외부는 REST 유지.

**깊이**:
- 외부 / 브라우저 = REST 가 여전히 우세
- 내부 동기 핫패스 = gRPC 가 schema + deadline + 효율 우위
- 비동기 / 영속 = Kafka 가 정답 (gRPC streaming 으로 대체 X)
- "한 번에 통일" 의 함정 — REST + gRPC + Kafka 의 역할 분담이 표준
- 도입 시 "한 번에 한 변수" — mesh 와 gRPC 동시 X

---

## 빠른 회독용 카드 (요약)

| # | 핵심 키워드 |
|---|---|
| Q1 | 리소스 vs 함수 호출 |
| Q2 | varint + 컴파일 schema |
| Q3 | optional → 제거 → 부활 (single-field oneof) |
| Q4 | Unary / Server / Client / Bidi |
| Q5 | field number 영구 불변, reserved |
| Q6 | enum 0 = unspecified |
| Q7 | Coroutine stub 권장 |
| Q8 | protoc + Gradle plugin |
| Q9 | proto = single source of truth |
| Q10 | `/<package>.<Service>/<Method>` |
| Q11 | binary framing + multiplexing + HPACK + trailers |
| Q12 | headless + round_robin |
| Q13 | multiplexing 은 인터리브, pipelining 은 순서 강제 |
| Q14 | static + dynamic + Huffman |
| Q15 | (number << 3) \| wire_type |
| Q16 | sint = ZigZag |
| Q17 | reserved + 추가 안전 + v2 패키지 |
| Q18 | deadline 자동 전파 |
| Q19 | 다른 레이어, 병행 |
| Q20 | ABORTED + UNAVAILABLE |
| Q21 | 401 vs 403 |
| Q22 | application vs transport |
| Q23 | 서비스 신원 + 사용자 신원 |
| Q24 | mesh 없이도 가능 |
| Q25 | order → product POC |
| Q26 | 동기 vs 비동기 영속 |
| Q27 | `:proto-commerce` 모듈 |
| Q28 | lint + breaking + BSR |
| Q29 | 디버깅 X, 브라우저 X, K8s LB |
| Q30 | schema-first 표준, 점진 도입 |

## 학습 종료 후 회독 가이드

- 1주 후: Q1, Q4, Q11, Q12, Q18, Q25 (가장 빈출)
- 2주 후: Q2, Q15, Q16, Q17, Q22, Q23 (기술 깊이)
- 1개월 후: 전체 30문 회독, 답변 1문장 → 깊이 답변 자동 생성 확인
- 면접 직전: Q12, Q18, Q24, Q25, Q29 (현실 운영 + msa 컨텍스트)
