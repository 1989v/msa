# 네트워크 — 커버리지 체크리스트

원천:
- study/docs/18-grpc/ — 99-concept-catalog.md 와 본문 노트 01~19 (Protobuf · HTTP/2 · 호출 패턴 · 오류 모델 · LB · 상호운용)
- 볼트 system-resources-cheatsheet.md §06·§07 (TCP 상태 · backlog · 타임아웃 · keep-alive · Nagle · HTTP/TLS · DNS ndots · 소켓 버퍼)
- study/docs/1-aws-network/ 중 프로토콜 수준 개념 (CIDR · 라우팅 · NAT · DHCP · DNS 레코드 · TTL)
- 기존 network.yaml 운영 행 (id 유지)
- 분야 표준 — Kurose · Ross 「Computer Networking」 목차, RFC 9110(HTTP 의미) · 9113(HTTP/2) · 9114(HTTP/3) · 9000(QUIC) · 8446(TLS 1.3) · 9457(Problem Details), grpc.io · protobuf.dev 문서
- 레포 코드 — gateway · portal-fe/nginx.conf · k8s/overlays/oci-arm (ingress · origin-lockdown · sysctl)

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| network | 네트워크 | 기존 운영 행 | placed |
| net-addressing | 주소 지정 · 패킷 전달 | 분야 표준 | placed |
| net-ipv4-addressing | IPv4 주소 지정 | 분야 표준 | placed |
| net-cidr | CIDR · 서브넷팅 | study/1 §01·20 CIDR · IPv6 | placed |
| net-ipv6 | IPv6 | study/1 §01·20 CIDR · IPv6 | placed |
| net-ip-routing | IP 라우팅 · Longest Prefix Match | study/1 §04 라우팅 | placed |
| net-nat | NAT · NAPT | study/1 §03·07 NAT | placed |
| net-arp | ARP | 분야 표준 | placed |
| net-dhcp | DHCP | study/1 §21 DHCP | placed |
| net-icmp | ICMP · ping · traceroute | 분야 표준 | placed |
| net-mtu-fragmentation | MTU · 단편화 · PMTUD | 분야 표준 | placed |
| net-anycast | 애니캐스트 | 분야 표준 | placed |
| net-ipv4-exhaustion | IPv4 주소 고갈 | 분야 표준 | placed |
| net-pmtu-blackhole | PMTU 블랙홀 | 분야 표준 | placed |
| net-name-resolution | 이름 해석 | 기존 운영 행 | placed |
| dns | DNS | 기존 운영 행 | placed |
| net-dns-recursive-resolution | 재귀 · 반복 조회 | 분야 표준 | placed |
| net-dns-ttl-caching | DNS TTL · 캐싱 | study/1 §15 Route 53 | placed |
| net-dnssec | DNSSEC | 분야 표준 | placed |
| net-encrypted-dns | 암호화 DNS (DoH · DoT) | 분야 표준 | placed |
| net-cluster-dns-search | 클러스터 DNS 검색 경로 (ndots) | 볼트 시스템 자원 §07 | placed |
| net-dns-stale-record | DNS 반영 지연 | study/1 §15 Route 53 | placed |
| net-ndots-amplification | ndots 질의 증폭 | 볼트 시스템 자원 §07 | placed |
| net-transport | 전송 | 기존 운영 행 | placed |
| tcp | TCP | 기존 운영 행 · 볼트 시스템 자원 §07 | placed |
| net-tcp-connection-lifecycle | TCP 연결 수립 · 종료 | 볼트 시스템 자원 §07 | placed |
| net-tcp-flow-control | TCP 흐름 제어 | 분야 표준 | placed |
| net-tcp-congestion-control | TCP 혼잡 제어 | 분야 표준 | placed |
| net-slow-start | 슬로 스타트 · AIMD | 분야 표준 | placed |
| net-cubic | CUBIC | 분야 표준 | placed |
| net-bbr | BBR | 분야 표준 | placed |
| net-tcp-retransmission | TCP 재전송 | 분야 표준 | placed |
| net-nagle-algorithm | Nagle 알고리즘 · TCP_NODELAY | 볼트 시스템 자원 §07 | placed |
| net-tcp-keepalive | TCP keepalive | 분야 표준 | placed |
| net-listen-backlog | listen backlog · accept 큐 | 볼트 시스템 자원 §07 | placed |
| net-socket-buffer-tuning | 소켓 버퍼 튜닝 | 볼트 시스템 자원 §07 | placed |
| net-tcp-fast-open | TCP Fast Open | 분야 표준 | placed |
| udp | UDP | 기존 운영 행 | placed |
| quic | QUIC | study/18 §06 HTTP/2 | placed |
| net-quic-connection-migration | 연결 이전 (connection migration) | 분야 표준 | placed |
| net-rtt | RTT | 기존 운영 행 | placed |
| net-bandwidth | 대역폭 · 처리량 | 분야 표준 | placed |
| net-packet-loss | 패킷 손실률 | 분야 표준 | placed |
| net-head-of-line-blocking | Head-of-line blocking | study/18 §06 HTTP/2 | placed |
| net-time-wait-accumulation | TIME_WAIT 누적 · 포트 고갈 | 볼트 시스템 자원 §07 | placed |
| net-close-wait-leak | CLOSE_WAIT 누수 | 볼트 시스템 자원 §07 | placed |
| net-accept-queue-overflow | accept 큐 넘침 | 볼트 시스템 자원 §07 | placed |
| net-nagle-delay | Nagle · 지연 ACK 교착 지연 | 볼트 시스템 자원 §07 | placed |
| net-secure-channel | 보안 채널 수립 | 기존 운영 행 | placed |
| ssl-tls | SSL/TLS | 기존 운영 행 | placed |
| net-tls12-handshake | TLS 1.2 핸드셰이크 | 분야 표준 | placed |
| net-tls13-handshake | TLS 1.3 핸드셰이크 | 분야 표준 | placed |
| net-tls-session-resumption | TLS 세션 재개 · 0-RTT | 분야 표준 | placed |
| net-sni | SNI | 분야 표준 | placed |
| net-alpn | ALPN | 분야 표준 | placed |
| net-mtls | mTLS (상호 TLS) | study/18 §12 인증 | placed |
| net-hsts | HTTPS 강제 · HSTS | 레포 코드 | placed |
| net-pki | PKI · 인증서 체인 검증 | 분야 표준 | placed |
| net-cert-revocation | 인증서 폐기 확인 (OCSP · CRL) | 분야 표준 | placed |
| net-certificate-transparency | Certificate Transparency | 분야 표준 | placed |
| net-tls-termination | TLS 종단 위치 | 볼트 시스템 자원 §07 | placed |
| net-mitm-attack | 중간자 공격 | 분야 표준 | placed |
| net-zero-rtt-replay | 0-RTT 재전송 공격 | 분야 표준 | placed |
| net-http-connection | HTTP 연결 · 버전 선택 | 분야 표준 | placed |
| net-http1-1 | HTTP/1.1 | study/18 §06 HTTP/2 | placed |
| net-http-keep-alive | 지속 연결 (keep-alive) | study/18 §06 HTTP/2 · 볼트 시스템 자원 §07 | placed |
| net-http-pipelining | HTTP 파이프라이닝 | 분야 표준 | placed |
| net-chunked-transfer | 청크 전송 인코딩 | 분야 표준 | placed |
| http2 | HTTP/2 | study/18 §06 HTTP/2 · 볼트 시스템 자원 §07 | placed |
| net-http2-multiplexing | 스트림 다중화 | study/18 §06 HTTP/2 | placed |
| net-hpack | HPACK 헤더 압축 | study/18 §06 HTTP/2 | placed |
| net-http2-flow-control | HTTP/2 흐름 제어 | study/18 §06 HTTP/2 | placed |
| net-http2-goaway | GOAWAY · 우아한 연결 종료 | study/18 §06 HTTP/2 | placed |
| http3 | HTTP/3 | study/18 §06 HTTP/2 | placed |
| net-http2-connection-imbalance | 장기 연결 부하 쏠림 | study/18 §06 HTTP/2 | placed |
| net-ttfb | TTFB | 분야 표준 | placed |
| net-edge-routing | 엣지 · 게이트웨이 라우팅 | 기존 운영 행 | placed |
| net-forward-proxy | 포워드 프록시 | 분야 표준 | placed |
| net-l7-routing | 호스트 · 경로 기반 라우팅 | 레포 코드 | placed |
| net-client-ip-forwarding | 원 클라이언트 IP 전달 | 레포 코드 | placed |
| net-bff | BFF (Backend for Frontend) | study/18 §13 상호운용 | placed |
| net-edge-bypass-host | 우회 호스트 | 기존 운영 행 | placed |
| cloudflare | Cloudflare | 기존 운영 행 | placed |
| spring-cloud-gateway | Spring Cloud Gateway | 기존 운영 행 | placed |
| net-proxy-idle-timeout | 프록시 유휴 타임아웃 | 기존 운영 행 | placed |
| net-request-response | 요청-응답 API 설계 | 기존 운영 행 | placed |
| http | HTTP | 기존 운영 행 | placed |
| net-http-caching | HTTP 캐싱 | 레포 코드 | placed |
| net-conditional-request | 조건부 요청 | 분야 표준 | placed |
| net-content-negotiation | 콘텐츠 협상 | 분야 표준 | placed |
| net-http-compression | HTTP 압축 | 레포 코드 | placed |
| rest | REST | 기존 운영 행 | placed |
| graphql | GraphQL | 기존 운영 행 | placed |
| net-graphql-dataloader | DataLoader 배치 | 분야 표준 | placed |
| grpc | gRPC | 기존 운영 행 | placed |
| net-grpc-unary | Unary RPC | study/18 §04 호출 패턴 | placed |
| net-grpc-server-streaming | 서버 스트리밍 RPC | study/18 §04 호출 패턴 | placed |
| net-grpc-client-streaming | 클라이언트 스트리밍 RPC | study/18 §04 호출 패턴 | placed |
| net-grpc-bidi-streaming | 양방향 스트리밍 RPC | study/18 §04 호출 패턴 | placed |
| net-grpc-codegen-stub | 코드 생성 · 스텁 | study/18 §05 코드 생성 | placed |
| net-grpc-interceptor | 인터셉터 | study/18 §09 고급 기능 | placed |
| net-grpc-cancellation | 취소 전파 | study/18 §04 호출 패턴 | placed |
| net-grpc-error-model | gRPC 오류 모델 | study/18 §11 오류 모델 | placed |
| net-grpc-retry-hedging | 재시도 · 헤징 정책 | study/18 §09 고급 기능 | placed |
| net-grpc-keepalive | gRPC keepalive | study/18 카탈로그 §F·G | placed |
| net-grpc-compression | 메시지 압축 | study/18 §09 고급 기능 | placed |
| net-grpc-client-lb | 클라이언트 측 로드 밸런싱 | study/18 §10 로드 밸런싱 | placed |
| net-xds | xDS | study/18 §10 로드 밸런싱 | placed |
| net-grpc-health-protocol | gRPC 헬스 체크 프로토콜 | study/18 §09 고급 기능 | placed |
| net-grpc-reflection | 서버 리플렉션 | study/18 §09 고급 기능 | placed |
| net-grpc-channelz | Channelz | study/18 카탈로그 §F·G | placed |
| net-grpc-web | gRPC-Web | study/18 §13 상호운용 | placed |
| net-grpc-transcoding | gRPC ↔ REST 트랜스코딩 | study/18 §13 상호운용 | placed |
| net-connect-rpc | Connect 프로토콜 | study/18 §13 상호운용 | placed |
| net-pagination | 페이지네이션 | 분야 표준 | placed |
| net-offset-pagination | 오프셋 페이지네이션 | 레포 코드 | placed |
| net-cursor-pagination | 커서 페이지네이션 | 분야 표준 | placed |
| net-api-versioning | API 버전 관리 | 분야 표준 | placed |
| net-api-error-model | API 오류 응답 설계 | 분야 표준 | placed |
| net-api-spec | API 명세 (OpenAPI) | 레포 코드 | placed |
| net-webhook | 웹훅 | 분야 표준 | placed |
| net-over-fetching | 오버페칭 · 언더페칭 | 기존 운영 행 | placed |
| net-grpc-message-size-limit | 메시지 크기 한도 초과 | study/18 카탈로그 §F·G | placed |
| net-rpc-contract | 스키마 · 직렬화 계약 | study/18 §02·03·07 Protobuf | placed |
| protobuf | Protocol Buffers | study/18 §02·03·07 Protobuf | placed |
| net-protobuf-wire-format | Protobuf 와이어 포맷 | study/18 §02·03·07 Protobuf | placed |
| net-schema-evolution | 스키마 진화 규칙 | study/18 §08·17 스키마 진화 | placed |
| net-schema-breaking-check | 호환성 파괴 검사 | study/18 §08·17 스키마 진화 | placed |
| net-schema-repository | 스키마 저장소 전략 | study/18 §08·17 스키마 진화 | placed |
| net-schema-breaking-change | 스키마 호환성 파괴 | study/18 §08·17 스키마 진화 | placed |
| net-realtime-push | 실시간 푸시 | 기존 운영 행 | placed |
| net-short-polling | 폴링 | 분야 표준 | placed |
| net-long-polling | 롱 폴링 | 분야 표준 | placed |
| sse | SSE | 기존 운영 행 | placed |
| websocket | WebSocket | 기존 운영 행 | placed |
| net-heartbeat | 하트비트 · 앱 수준 핑 | 분야 표준 | placed |
| network-glossary | 네트워크 용어 사전 | 기존 운영 행 | placed |
| net-term-handshake | 핸드셰이크 | 기존 운영 행 | placed |
| net-term-status-code | HTTP 상태 코드 | 기존 운영 행 | placed |
| net-term-idempotent-method | 안전 · 멱등 메서드 | 기존 운영 행 | placed |
| net-term-upgrade | Upgrade 헤더 | 기존 운영 행 | placed |
| net-term-origin-certificate | 오리진 인증서 | 기존 운영 행 | placed |
| net-glossary-layers | 계층 · 주소 용어 | 분야 표준 | placed |
| net-term-osi-model | OSI 7계층 | 분야 표준 | placed |
| net-term-tcp-ip-model | TCP/IP 4계층 | 분야 표준 | placed |
| net-term-pdu | 캡슐화 · PDU | 분야 표준 | placed |
| net-term-port-socket | 포트 · 소켓 | 볼트 시스템 자원 §07 | placed |
| net-term-five-tuple | 5-튜플 | 분야 표준 | placed |
| net-term-private-address | 사설 주소 대역 | study/1 §01·20 CIDR · IPv6 | placed |
| net-glossary-transport | 전송 계층 용어 | 분야 표준 | placed |
| net-term-tcp-state | TCP 연결 상태 | 볼트 시스템 자원 §07 | placed |
| net-term-window | 윈도 (rwnd · cwnd) | 분야 표준 | placed |
| net-term-bdp | BDP (대역폭 지연 곱) | study/18 §06 HTTP/2 · 볼트 시스템 자원 §07 | placed |
| net-term-ephemeral-port | 임시 포트 | study/1 §03·07 NAT | placed |
| net-term-mss | MSS | 분야 표준 | placed |
| net-glossary-http | HTTP 용어 | 분야 표준 | placed |
| net-term-http-header | HTTP 헤더 | 분야 표준 | placed |
| net-term-cache-directive | Cache-Control 지시어 | 분야 표준 | placed |
| net-term-etag | ETag · Last-Modified | 분야 표준 | placed |
| net-term-h2c | h2 · h2c | study/18 §06 HTTP/2 | placed |
| net-term-http2-stream-frame | 스트림 · 프레임 | study/18 §06 HTTP/2 | placed |
| net-term-rest-maturity | REST 성숙도 모델 | study/18 §01 RPC vs REST | placed |
| net-term-last-event-id | Last-Event-ID | 분야 표준 | placed |
| net-glossary-tls | TLS · 인증서 용어 | 분야 표준 | placed |
| net-term-x509-certificate | X.509 인증서 | 분야 표준 | placed |
| net-term-ca-chain | 루트 · 중간 CA | 분야 표준 | placed |
| net-term-cipher-suite | 암호 스위트 | 분야 표준 | placed |
| net-glossary-dns | DNS 용어 | 분야 표준 | placed |
| net-term-dns-record | DNS 레코드 타입 | study/1 §15 Route 53 | placed |
| net-term-authoritative-recursive | 권한 서버 · 리졸버 | 분야 표준 | placed |
| net-glossary-rpc | RPC · Protobuf 용어 | 분야 표준 | placed |
| net-term-field-number | 필드 번호 | study/18 §02·03·07 Protobuf | placed |
| net-term-proto-oneof | oneof · repeated · map | study/18 §02·03·07 Protobuf | placed |
| net-term-field-presence | 필드 존재 여부 (optional) | study/18 §02·03·07 Protobuf | placed |
| net-term-well-known-types | Well-known types | study/18 §02·03·07 Protobuf | placed |
| net-term-reserved-field | reserved | study/18 §08·17 스키마 진화 | placed |
| net-term-proto-editions | proto2 · proto3 · Editions | study/18 §02·03·07 Protobuf | placed |
| net-term-varint-zigzag | varint · ZigZag | study/18 §02·03·07 Protobuf | placed |
| net-term-grpc-metadata | gRPC 메타데이터 | study/18 §09 고급 기능 | placed |
| net-term-grpc-channel | 채널 · 서브채널 | study/18 §10 로드 밸런싱 | placed |
| net-term-grpc-status-code | gRPC 상태 코드 | study/18 §11 오류 모델 | placed |
| net-term-call-credentials | 채널 · 호출 자격 증명 | study/18 §12 인증 | placed |
| reverse-proxy | 리버스 프록시 | 기존 운영 행 | excluded — owned by infrastructure — net-edge-routing 이 CONTAINS 로 품는다 |
| api-gateway | API 게이트웨이 | 기존 운영 행 | excluded — owned by infrastructure — net-edge-routing 이 CONTAINS 로 품는다 |
| dist-timeout | 타임아웃 (connect · read · 전체) | 볼트 시스템 자원 §07 · study/18 §14 | excluded — owned by distributed — grpc 가 USES 로 잇는다 |
| dist-deadline-propagation | 데드라인 전파 | study/18 §09 | excluded — owned by distributed — grpc · net-grpc-cancellation 이 USES 로 잇는다 |
| dist-idempotency-key | 멱등 키 (Idempotency-Key) | 분야 표준 · 레포 코드 | excluded — owned by distributed — net-webhook 이 USES 로 잇는다 |
| connection-pool | 커넥션 풀 | 볼트 시스템 자원 §07 | excluded — owned by data |
| infra-kube-proxy | kube-proxy · Service | 볼트 시스템 자원 §07 · study/1 §13 | excluded — owned by infrastructure |
| infra-network-policy | NetworkPolicy | 볼트 시스템 자원 §07 | excluded — owned by infrastructure — cloud-microsegmentation 이 USES 로 잇는다 |
| infra-cluster-dns | 클러스터 DNS (CoreDNS) | 볼트 시스템 자원 §07 | excluded — owned by infrastructure — 검색 경로(ndots) 동작만 net-cluster-dns-search 로 둔다 |
| epoll | epoll · 논블로킹 소켓 I/O | 볼트 시스템 자원 §06 | excluded — owned by concurrency |
| net-ua-bot-filter | UA · 봇 필터 계측 | 볼트 시스템 자원 §07 | excluded — 계측 사고 사례이지 네트워크 개념이 아니다 |
| cors | CORS | 기존 운영 행 | excluded — owned by security — spring-cloud-gateway 가 IMPLEMENTS 로 잇는다 |
| rate-limiting | 레이트 리미팅 | 기존 운영 행 | excluded — owned by security |
| jwt | JWT 메타데이터 인증 | study/18 §12 | excluded — owned by security |
| net-grpc-authorization | 메서드 단위 인가 | study/18 카탈로그 §E | excluded — owned by security |
| net-workload-identity | 워크로드 아이덴티티 자격 증명 | study/18 카탈로그 §E | excluded — owned by security |
| net-grpc-otel | OpenTelemetry gRPC 계측 | study/18 카탈로그 §G | excluded — owned by observability |
| net-protobuf-schema-registry | Protobuf 스키마 레지스트리 (Kafka) | study/18 카탈로그 §I | excluded — owned by messaging |
| net-grpc-vs-kafka | 동기 RPC vs 비동기 메시징 선택 | study/18 §16 | excluded — owned by architecture — 통신 방식 선택은 아키텍처 판단이다 |
| service-mesh | 서비스 메시 (Istio + xDS) | study/18 카탈로그 §I | excluded — owned by distributed — net-xds 가 USES 로 잇는다 |
| retry-pattern | 재시도 | study/18 §09 | excluded — owned by distributed — net-grpc-retry-hedging 이 USES 로 잇는다 |
| serialization | 직렬화 | study/18 §07 | excluded — owned by language — protobuf 가 USES 로 잇는다 |
| caching | 캐싱 | 분야 표준 | excluded — owned by data — net-http-caching 이 USES 로 잇는다 |
| grpcurl | grpcurl · grpcui | study/18 카탈로그 §G | excluded — 도구 이름이라 개념이 아니다 — net-grpc-reflection 동의어로 둔다 |
| buf | Buf CLI · buf.yaml · buf.gen.yaml | study/18 카탈로그 §A · §17 | excluded — 벤더 한정 도구 설정 — 개념은 net-schema-breaking-check · net-schema-repository |
| net-protoc-custom-options | Custom options · protoc 플러그인 | study/18 카탈로그 §A | excluded — 벤더 한정 도구 설정값이라 개념이 아니다 |
| grpc-spring-boot-starter | Spring Boot gRPC starter | study/18 카탈로그 §I | excluded — 레포에 없는 벤더 라이브러리 |
| envoy | Envoy front-proxy | study/18 카탈로그 §I | excluded — 레포에 없는 제품 — 개념은 reverse-proxy · net-grpc-web |
| net-grpc-over-http3 | gRPC over HTTP/3 | study/18 카탈로그 §B | excluded — 실험 조합이라 http3 · grpc 두 노드로 설명된다 |
| sec-trusted-client-ip | 신뢰 프록시 경계 | 레포 코드 | excluded — owned by security — net-client-ip-forwarding 이 전달 헤더 동작만 맡는다 |
| sec-client-ip-spoofing | 전달 헤더 위조 | 레포 코드 | excluded — owned by security — net-client-ip-forwarding · net-edge-bypass-host 가 CAUSES 로 잇는다 |
| sec-term-forward-secrecy | 전방 비밀성 | 분야 표준 | excluded — owned by security — net-tls13-handshake 가 USES 로 잇는다 |
| data-deep-offset-pagination | 깊은 페이지 비용 | 분야 표준 | excluded — owned by data — net-offset-pagination 이 CAUSES 로 잇는다 |
| data-keyset-pagination | 키셋 조회 | 분야 표준 | excluded — owned by data — API 수준 불투명 커서는 net-cursor-pagination 으로 두고 USES 로 잇는다 |
| dist-hedged-request | 헤지 요청 (Tail at Scale) | study/18 카탈로그 §F | excluded — owned by distributed — net-grpc-retry-hedging 이 USES 로 잇는다 |
| sec-webhook-verification | 웹훅 서명 검증 | 분야 표준 | excluded — owned by security — net-webhook 이 USES 로 잇는다 |
| net-grpc-perf-tuning | gRPC 성능 튜닝 | study/18 카탈로그 §1-A | excluded — 묶음 이름이라 개념이 아니다 — 압축 · 메시지 한도 · 채널 재사용으로 흩어 두었다 |
