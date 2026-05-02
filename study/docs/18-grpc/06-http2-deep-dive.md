---
parent: 18-grpc
seq: 06
title: HTTP/2 deep dive — binary framing · multiplexing · flow control · HPACK
type: deep
created: 2026-05-01
---

# 06. HTTP/2 deep dive

gRPC 의 streaming / multiplexing / efficient header 가능 여부는 HTTP/2 에 100% 위임된다. HTTP/2 를 모르면 K8s LB 이슈 / head-of-line blocking / flow control 디버깅이 모두 미궁에 빠진다.

## 1. HTTP/1.1 의 한계 (왜 HTTP/2 가 필요했나)

- **Head-of-line blocking**: 한 TCP 연결에 한 번에 1 요청 (response 다 받기 전에 다음 요청 시작 불가)
- **다중 연결로 회피** → 브라우저는 도메인당 6 connection (CPU/memory 비용)
- **헤더 반복**: 매 요청마다 동일한 cookie / user-agent / accept 를 평문으로 재전송 (KB 단위 낭비)
- **요청-응답 1:1 강제**: streaming = chunked 뿐, 양방향은 WebSocket 필요

→ Google 의 SPDY (2009) → HTTP/2 (RFC 7540, 2015) 로 표준화.

## 2. HTTP/2 의 5 핵심

| # | 기능 | 1줄 |
|---|---|---|
| 1 | **Binary framing** | 텍스트가 아닌 binary frame 단위 전송 |
| 2 | **Multiplexing** | 단일 TCP 위에 다수 stream 병렬 |
| 3 | **Flow control** | per-stream + connection-level 백프레셔 |
| 4 | **HPACK** | 헤더 정적/동적 사전 + Huffman 압축 |
| 5 | **Server push** | (사실상 폐기, 거의 안 씀) |

## 3. Binary framing

HTTP/1.1 은 텍스트:
```
GET /products/123 HTTP/1.1
Host: api.example.com
Accept: application/json
```

HTTP/2 는 모든 메시지가 **frame** 으로 분해됨.

```
frame 구조 (9 byte 헤더 + payload):
+-----------------------------------------------+
| Length (24)                                   |
+---------------+---------------+---------------+
| Type (8)      | Flags (8)     |
+-+-------------+---------------+---------------+
| R (1) | Stream Identifier (31)               |
+-+-------------+---------------+---------------+
| Frame Payload (0..2^24-1 byte)               |
+-----------------------------------------------+
```

주요 frame type:

| Type | 의미 |
|---|---|
| HEADERS | 헤더 송수신 (HPACK 인코딩) |
| DATA | 본문 (gRPC 의 protobuf) |
| SETTINGS | 연결 파라미터 (window size, max streams) |
| WINDOW_UPDATE | flow control credit 추가 |
| RST_STREAM | stream cancel |
| GOAWAY | connection 종료 통보 |
| PING | keepalive / RTT 측정 |
| PRIORITY | (거의 미사용) |
| PUSH_PROMISE | server push (폐기) |
| CONTINUATION | HEADERS 의 연속 |

**왜 binary 인가**:
- 파싱 오버헤드 ↓ (state machine 단순)
- 길이 prefix 로 boundary 명확 (chunked encoding 같은 trick 불필요)
- multiplexing 의 전제 (frame 별 stream id 필요)

## 4. Multiplexing — gRPC 의 핵심 기반

HTTP/1.1: 1 TCP = 1 요청 시점.
HTTP/2: 1 TCP = N stream 동시.

```
TCP connection
  ├─ stream 1: HEADERS → DATA → DATA (END_STREAM)
  ├─ stream 3: HEADERS → DATA (END_STREAM)
  ├─ stream 5: HEADERS → DATA → DATA → ... (열려 있음)
  └─ stream 7: HEADERS → ...
```

규칙:
- 클라가 시작한 stream 은 **odd id** (1, 3, 5...), 서버 시작은 even (push, 거의 미사용)
- 한 connection 의 동시 stream 수 = `SETTINGS_MAX_CONCURRENT_STREAMS` (기본 보통 100-1000)
- frame 들은 stream id 로 분리되어 인터리브 가능

⇒ **gRPC 가 한 채널 (= 한 TCP) 위에서 수백 개 RPC 를 병렬 가능한 이유**.

### Head-of-line blocking 의 잔재

HTTP/2 multiplexing 은 **HTTP-level** 의 HOL 만 제거한다. **TCP-level HOL 은 여전히 있음**:
- 한 패킷 손실 → 그 뒤 모든 stream 의 데이터가 TCP 재전송 대기
- 해결 = HTTP/3 (QUIC, UDP 위) — gRPC 도 점진적 지원 중 (2026 현재 베타)

## 5. Flow control

gRPC streaming 에서 **빠른 송신자가 느린 수신자를 죽이지 않게** 보호하는 메커니즘.

### 두 레벨

1. **Stream-level**: 각 stream 마다 receive window (기본 64KB)
2. **Connection-level**: 전체 connection 에 별도 window

수신자는 buffer 가 비면 `WINDOW_UPDATE` frame 으로 credit 을 송신자에 부여:

```
Server (송신)                  Client (수신)
  │                                │
  │                                │ initial window = 64KB
  │ DATA (32KB)  ──────────────→  │ window 32KB 남음
  │ DATA (32KB)  ──────────────→  │ window 0
  │ (stop)                         │ buffer 비움
  │ ←─ WINDOW_UPDATE (+64KB)  ────│
  │ DATA (32KB)  ──────────────→  │ ...
```

특징:
- 송신자가 window 초과 송신 = 프로토콜 위반 (PROTOCOL_ERROR)
- gRPC 의 server-streaming 이 클라가 느릴 때 **자동 백프레셔** = 이것 덕분
- HTTP/1.1 에는 없음 (TCP backpressure 만 있고 stream-level 없음)

### 기본 64KB window 가 작아 BDP 못 채움

- 광대역 (1Gbps × 100ms RTT = 12.5MB) 환경에서 64KB 는 throughput 제한
- 해결: gRPC 의 `withFlowControlWindow(...)` 또는 `SETTINGS_INITIAL_WINDOW_SIZE` 조정 (보통 1MB+)
- gRPC-Java 의 `NettyChannelBuilder.flowControlWindow(1024 * 1024)`

## 6. HPACK — 헤더 압축

HTTP/2 는 헤더를 **HPACK** (RFC 7541) 으로 압축.

### 구성 요소

1. **Static table** — 자주 쓰이는 61개 헤더 사전 정의 (인덱스로 참조)
   - `:method GET`, `:status 200`, `accept-encoding gzip` 등
2. **Dynamic table** — 연결마다 갱신되는 LRU 사전
   - 첫 송신 시 평문, 다음부터 인덱스로 참조
3. **Huffman 인코딩** — 평문 헤더 값을 가변 길이 인코딩

### 효과

- 첫 요청: `Authorization: Bearer xyz` (전체 평문, ~50 byte)
- 두 번째: 인덱스 참조 (~2 byte)
- gRPC 의 작은 RPC 에서 헤더 오버헤드를 무시할 수 있게 만듦 (REST/HTTP/1.1 은 매 요청 KB 단위 헤더 전송)

### 보안 고려

- **CRIME / BREACH 공격**: 압축 + 비밀 + 부분제어 헤더 = 비밀 추정 가능
- HPACK 은 sensitive 헤더를 dynamic table 에서 제외하는 옵션 (`Sensitive` flag)
- gRPC metadata 의 `authorization`, `grpc-trace-bin` 등은 sensitive 처리 권장

## 7. h2 vs h2c

HTTP/2 는 두 가지 모드:

| 모드 | 의미 | 협상 방법 |
|---|---|---|
| **h2** | TLS 위 HTTP/2 | TLS ALPN extension 으로 `h2` 선택 |
| **h2c** | cleartext (no TLS) | HTTP/1.1 Upgrade 헤더 또는 prior knowledge |

### h2 (실세계 표준)

- 브라우저는 **TLS 만 지원** (h2c 직접 사용 불가)
- ALPN: TLS handshake 중 `h2` / `http/1.1` 우선순위 협상
- 인증서 + ALPN = 자연스러운 fallback

### h2c (내부망)

- TLS 부담 ↓ (서비스 메시 / mTLS 가 별도로 처리할 때)
- Spring `grpc-server-spring-boot-starter` 기본 = `negotiation-type: PLAINTEXT` (h2c)
- prior knowledge mode = "이 서버는 무조건 h2c" 가정 (Upgrade 협상 생략)
- K8s 내부 (NetworkPolicy 로 격리) 에서 흔함

### 면접 함정

> "K8s 에서 gRPC 가 안 되는데..."
- ingress 가 HTTP/1.1 만 지원 / ALPN 미설정 → h2 협상 실패
- ingress-nginx 에서 `nginx.ingress.kubernetes.io/backend-protocol: GRPC` 필요
- Envoy / Istio 는 자동 h2 detect

## 8. Keep-alive 와 idle stream

- HTTP/2 connection 은 long-lived (재연결 비용 ↓)
- PING frame 으로 RTT 측정 + connection liveness 확인
- gRPC 의 keep-alive 설정:
  ```
  keepAliveTime: 30s         # 30초마다 PING
  keepAliveTimeout: 10s      # PING 후 10초 응답 없으면 connection close
  permitKeepAliveWithoutCalls: true  # 진행 중 RPC 없어도 PING
  ```
- 너무 공격적이면 LB 가 `ENHANCE_YOUR_CALM` (GOAWAY) 으로 거부

## 9. GOAWAY 와 graceful shutdown

서버가 종료할 때:
1. `GOAWAY (last_stream_id)` 송신 — "이 id 이후 신규 stream 거부, 기존은 마무리"
2. 진행 중 stream 마무리
3. connection close

K8s rolling update 에서 중요:
- pod 가 SIGTERM 받으면 GOAWAY 송신
- 클라이언트는 GOAWAY 받으면 새 connection 으로 retry
- gRPC client 의 default retry policy 가 이를 처리

⇒ **graceful shutdown 시간 (terminationGracePeriodSeconds)** 을 진행 RPC 의 deadline 보다 길게.

## 10. HTTP/2 가 만드는 새로운 운영 이슈

### 9-1. K8s ClusterIP LB 함정

- ClusterIP service 는 **L4 (TCP) LB**
- HTTP/2 는 한 TCP connection 위 다중 stream
- → 클라이언트가 TCP connection 을 한 번 만들면 그 뒤 모든 RPC 가 **한 pod 로 집중**
- 해결 = headless service + client-side LB, 또는 Envoy 경유 ([10 참조](10-load-balancing.md))

### 9-2. Connection pool 의 의미 변화

- HTTP/1.1 클라이언트는 N 개 connection 풀
- HTTP/2 는 1 connection 으로 충분 (multiplexing) → 풀 크기 조정 의미 다름
- gRPC client 는 보통 **subchannel** (서버 인스턴스당 1 connection) 모델

### 9-3. 디버깅 도구

- `nghttp` / `nghttpd` — HTTP/2 raw frame 검사
- `grpcurl` — gRPC 호출
- Wireshark + TLS 키 (SSLKEYLOGFILE) → 평문 분석
- Envoy access log + tcpdump

## 11. HTTP/3 / QUIC 와의 관계

- HTTP/3 = QUIC (UDP 위 자체 reliability) + HTTP semantics
- TCP HOL blocking 제거 (각 stream 이 독립 reliability)
- gRPC over HTTP/3 = 2026 현재 grpc-go 가 알파, grpc-java 는 베타
- 모바일 / 손실 많은 네트워크에서 이득
- 데이터센터 내부에서는 큰 차이 없음

## 12. 면접 핵심

> Q: gRPC 가 HTTP/2 의 어떤 기능을 활용하나?

A:
1. **Binary framing** + stream id → 4 가지 호출 패턴 표현
2. **Multiplexing** → 한 채널 (TCP) 에 다수 RPC 동시
3. **Flow control** → server-streaming 의 자동 백프레셔
4. **HPACK** → 작은 RPC 의 헤더 오버헤드 ↓
5. **Trailers** → 응답 후 status 전달 (`grpc-status`, `grpc-message`)

> Q: K8s 에서 gRPC 가 한 pod 에만 가는 이유는?

A: HTTP/2 의 multiplexing 으로 클라가 단일 TCP connection 을 사용. ClusterIP service 는 L4 LB 라 connection 단위 분배만 가능 → 결과적으로 모든 RPC 가 한 pod 로. 해결: (a) headless service + client-side LB, (b) Envoy / Istio L7 LB, (c) gRPC xDS resolver.

## 다음 학습

- [07-protobuf-wire-format.md](07-protobuf-wire-format.md) — DATA frame 안의 protobuf 인코딩
- [10-load-balancing.md](10-load-balancing.md) — K8s 에서의 LB 전략
- [09-advanced-features.md](09-advanced-features.md) — Deadline / Interceptor / Metadata
