---
parent: 18-grpc
seq: 14
title: gRPC 트레이드오프 종합 — 언제 도입, 언제 보류
type: deep
created: 2026-05-01
---

# 14. 트레이드오프 종합

## 1. 장점 — 무엇이 진짜 이득인가

| 이득 | 본질 | 측정 단위 |
|---|---|---|
| **schema 강제** | proto 를 single source of truth, 컴파일 타임 검증 | 버그 ↓, drift 0 |
| **deadline propagation** | client timeout 이 모든 hop 자동 전파 | tail latency 곱셈 효과 ↓ |
| **효율적 wire** | varint + 사전 합의 schema | 페이로드 30%, 직렬화 5-15% |
| **streaming 네이티브** | HTTP/2 multiplexing | server / client / bidi 단일 추상화 |
| **자동 코드 생성** | DTO 수동 매핑 제거 | 보일러플레이트 ↓ |
| **언어 중립** | 같은 proto 로 Java / Go / Python | polyglot MSA 의 1급 |
| **HTTP/2 multiplexing** | 단일 connection 위 다수 RPC | connection 비용 ↓ |
| **표준 인증 패턴** | mTLS, JWT metadata, mesh 통합 | 보안 일관성 ↑ |

## 2. 단점 — 무엇이 진짜 비용인가

| 비용 | 본질 | 영향 |
|---|---|---|
| **디버깅 도구 부족** | curl 직접 X, 로그 평문 X | 트러블슈팅 시간 ↑ |
| **브라우저 직결 X** | gRPC-Web 필요 (proxy) | FE 단순성 ↓ |
| **K8s LB 함정** | ClusterIP L4 vs HTTP/2 multiplexing | LB 복잡도 ↑ |
| **schema 거버넌스 비용** | Buf / breaking detection / 버전 관리 | 운영 프로세스 추가 |
| **운영 복잡** | 별도 포트 (9090), TLS 종단, mesh | infra 투자 |
| **학습 곡선** | proto, stub, interceptor, status | 1-2주 팀 비용 |
| **HTTP 캐시 / CDN 부적합** | 메시지 binary, idempotency 표시 약함 | 외부 API 부적합 |
| **proto 빌드 통합** | gradle 설정, 코드 생성 단계 | 빌드 시간 ↑ |
| **streaming 의 운영 부담** | long-lived stream, cancel 처리 | 신중한 설계 필요 |
| **에러 추적 비용** | 평문 로그 부재 → trace 의존 | OpenTelemetry 등 의존 ↑ |

## 3. 의사결정 매트릭스

> 점수: 1=낮음, 5=높음

| 차원 | REST + JSON | gRPC | Kafka |
|---|---|---|---|
| 페이로드 효율 | 2 | 5 | 3 |
| 디버깅 편의 | 5 | 2 | 3 |
| 브라우저 친화 | 5 | 1 | 1 |
| 외부 API 적합 | 5 | 2 | 1 |
| 내부 동기 RPC | 4 | 5 | 1 |
| 비동기 / 영속 | 1 | 1 | 5 |
| streaming | 2 (SSE) | 5 | 5 (다른 의미) |
| 운영 단순 | 5 | 3 | 3 |
| schema 강제 | 2 (OpenAPI) | 5 | 4 (Schema Registry) |
| 학습 곡선 | 1 | 3 | 4 |

→ **요약**: 외부/브라우저 = REST, 내부 동기 = gRPC, 비동기 영속 = Kafka. 이를 **하나로 통일하려는 시도가 실패의 원인**.

## 4. "도입할까" 의사결정 트리

```
질문 1: 호출 경로가 내부 (서비스 간) 인가?
   ├─ No  ─ REST 유지 (외부 API)
   └─ Yes ─ 질문 2로

질문 2: 현재 REST 의 latency / 페이로드 / schema drift 가 실제 문제인가?
   ├─ No  ─ REST 유지 (gRPC 학습 비용 > 이득)
   └─ Yes ─ 질문 3으로

질문 3: 팀이 proto / 빌드 / 디버깅 학습 가능한가?
   ├─ No  ─ 학습 투자 먼저, 도입 보류
   └─ Yes ─ 질문 4로

질문 4: K8s LB / mesh / 인증 인프라가 준비됐는가?
   ├─ No  ─ headless service + 단순 시작 가능 (mesh 는 미루기)
   └─ Yes ─ 질문 5로

질문 5: streaming 이 필요하거나 deadline propagation 가치가 명확한가?
   ├─ Yes ─ 부분 도입 (핫패스 1-3 쌍)
   └─ No  ─ 부분 도입 가능하나 ROI 불확실 → 일부 endpoint 만
```

## 5. 점진적 도입 전략 (msa 기준)

### Phase 0: 학습 / POC (1-2주)

- 한 endpoint (예: product getById) gRPC 로 추가 (REST 유지)
- 빌드 / 코드 생성 / 디버깅 도구 셋업
- 평가: latency, 메모리, 운영 부담

### Phase 1: 핫패스 1-2 쌍 (1개월)

- order ↔ product, gateway ↔ auth 같은 latency 민감 페어
- 현 REST 와 병렬 운영 (canary 또는 toggle)
- 메트릭 (P50/P99, 에러율) 비교

### Phase 2: 확산 (3개월)

- 핫패스 5-7 쌍
- proto monorepo 정착
- Buf lint / breaking CI 통합

### Phase 3: mesh / mTLS (선택)

- Istio / Linkerd 도입
- 인증 / LB / 정책 일원화
- 운영 비용 ↑ → 4 서비스 이상 gRPC 가 안정화된 후만

### 절대 금지 시나리오

- "전 서비스 gRPC 일괄 전환"
- 외부 API 까지 한 번에 gRPC-Web 으로 변경
- mesh 와 gRPC 를 동시 도입 (한 번에 한 변수만)

## 6. 비용 / 이득 회계 (가상 추정)

### Latency 절감 가능치

| 구간 | 현재 (WebClient REST) | gRPC | 절감 |
|---|---|---|---|
| 직렬화 (작은 메시지) | 0.05ms | 0.01ms | 0.04ms |
| 페이로드 전송 (1KB) | 1ms | 0.7ms | 0.3ms |
| TCP / TLS handshake | 매 connection (재사용으로 무시) | 동일 | 0 |
| Multiplexing (병렬 호출) | 별도 connection | 단일 | connection 비용만 |
| **단일 RPC 총** | ~2-5ms (LAN) | ~1-3ms | 1-2ms |

→ ms 자릿수 단축. 사용자 SLA (100ms+) 에서 gRPC 단독 효과는 작음. **fan-out / chain 길이가 길수록 deadline propagation 의 가치가 큼**.

### 운영 비용 증가

- 학습 곡선: 1-2주 / 개발자
- 빌드 시간: +5-10s / 서비스 (proto 생성)
- 인프라: 별도 port (9090), grpc-spring-boot-starter
- CI: Buf lint / breaking 추가
- 모니터링: gRPC 별 메트릭 panel (Grafana)

### Schema 거버넌스 이득

- DTO drift 0 (코드 생성 보장)
- 양 서비스 동시 deploy 의 위험 ↓
- partial update 의미 명확 (FieldMask)

## 7. 다른 회사들의 사례

| 회사 | 도입 정도 |
|---|---|
| Google | 거의 모든 내부 (Stubby → gRPC) |
| Netflix | 일부 핫패스 (REST 와 병렬) |
| Uber | 광범위 (자체 RPC 였다 gRPC 로 마이그레이션) |
| Square | 광범위 (Connect 의 모회사) |
| Spotify | 핫패스 점진적 |
| 카카오 | 일부 (게임, 결제 일부) |
| 토스 | 광범위 (Java/Kotlin 백엔드) |

→ **점진적 도입이 표준 패턴**. 일괄 전환은 거의 없음.

## 8. 함정 모음

### 함정 1: streaming 을 메시지 큐로

- gRPC streaming 으로 영속 메시지 전달 시도
- 결과: replay 불가, 클라 종료 = 메시지 손실
- 해결: Kafka 사용

### 함정 2: 외부 API 까지 gRPC

- 3rd party 가 gRPC 안 받음
- 결과: REST gateway 결국 만들어야 함
- 해결: 처음부터 외부는 REST, 내부만 gRPC

### 함정 3: 모든 호출에 streaming

- Unary 로 충분한데 server-streaming 으로 시작
- 결과: LB / retry / 디버깅 어려움
- 해결: 의심스러우면 Unary

### 함정 4: K8s ClusterIP 그대로 사용

- gRPC 호출이 한 pod 에만 가는 줄 모름
- 해결: headless + round_robin 또는 mesh

### 함정 5: schema 거버넌스 미설정

- proto 변경이 다른 팀에 통보 없음
- 결과: silent corruption, 운영 장애
- 해결: Buf breaking + PR review

### 함정 6: 모든 실패에 INTERNAL

- 클라가 retry / 알림 / 분류 불가
- 해결: status code 신중히 선택, details 활용

### 함정 7: deadline 미설정

- gRPC default = 무한 대기
- 결과: 한 hop 이 hang 되면 fan-out 전체 hang
- 해결: 모든 RPC 에 deadline 명시

## 9. msa 컨텍스트의 결론

ADR (Architecture Decision Record, 아키텍처 결정 기록) -0003 의 현 결정 ("gRPC: 학습 비용 / proto 관리 부담 → 미채택") 은 **2024-2025 시점 상황**에서 합리적이었다. 2026 의 변경 요인:

1. K8s (Kubernetes) 정착 (ADR-0019) → mesh 도입 가능성
2. ADR-0025 latency budget → P99 / fan-out 가시성 ↑
3. 서비스 수 증가 (10+) → 강한 schema 의 가치 ↑
4. 일부 핫패스 (auth, inventory, search 인덱싱) 의 latency / payload 압박

⇒ 보류 결정의 재검토는 **부분 도입 (Phase 0-1)** 을 후보로 ADR 갱신 가치 있음. [19 참조](19-improvements.md).

## 10. 면접 핵심

> Q: gRPC 의 단점은?

A: (1) 디버깅 도구 부족 (curl 불가), (2) 브라우저 직결 불가 (gRPC-Web 필요), (3) K8s ClusterIP 의 L4 LB 와 HTTP/2 multiplexing 충돌, (4) schema 거버넌스 비용 (Buf, 버전 관리), (5) 운영 인프라 학습 (mesh, 별도 포트), (6) HTTP 캐시 / CDN 부적합. 외부 / 브라우저 시나리오는 REST 가 여전히 우세.

> Q: REST 와 gRPC 를 같이 운영하면 안 되나?

A: 가능하고 표준 패턴. 외부 (브라우저, 3rd party) = REST, 내부 (서비스 간) = gRPC. 변환 계층 (gateway, BFF (Backend For Frontend), Envoy transcoder) 으로 연결. "어느 하나로 통일" 시도가 함정.

> Q: msa 처럼 REST + Kafka 가 잘 도는데 굳이 gRPC?

A: 측정 가능한 이득 — (1) 핫패스 latency / payload, (2) deadline propagation 의 fan-out tail 보호, (3) schema drift 제거. 측정 안 되면 도입 X. 점진 도입 (Phase 0 POC → 핫패스 1-2 쌍) 으로 ROI 확인 후 확산.

## 다음 학습

- [15-msa-hot-paths.md](15-msa-hot-paths.md) — msa 의 측정 후보 핫패스
- [19-improvements.md](19-improvements.md) — ADR 초안
