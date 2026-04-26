# ADR-0025 MarketDataHub: SharedFlow primary + Kafka fan-out

## Status
Proposed

> 루트 `docs/adr/`에 두는 이유: Quant Phase 2 페이퍼 트레이딩의 시세 분배 패턴이 향후 다른 실시간 도메인(주식·환율·알림 등)에서도 재사용될 수 있는 플랫폼 레벨 결정.

## Context

Quant Phase 2(페이퍼 트레이딩)는 빗썸/업비트 WebSocket 시세를 실시간으로 구독하여 **여러 내부 컴포넌트**(전략 엔진, 페이퍼 체결기, ClickHouse 시세 적재기, FE 라이브 차트 stream, 텔레그램 알림 트리거)에 동일 틱을 공급해야 한다.

- 거래소 WS 연결은 **유저당 / API Key당 rate limit**이 있어 컴포넌트별 중복 연결은 비현실적
- hot path(전략 엔진 → 주문 시뮬레이션)는 sub-millisecond latency가 바람직
- 향후 Phase 3+ 에서는 외부 분석/알림 서비스가 동일 틱 스트림을 비동기 소비할 수 있음 (analytics, 별도 알림 워커 등)
- 입력 스펙: `docs/specs/2026-04-24-quant-crypto-trading/planning/phase-2/spec.md` §4 (MarketDataHub 설계)
- 기반 ADR: ADR-0024 §11 (시세 WS 재연결 + REST 폴백), ADR-0024 §12 (ClickHouse 시세 적재)

## Decision

### 1. Primary path: in-process `SharedFlow<Tick>`
- 거래소 WS 연결 컴포넌트는 단일 진입점 `MarketDataHub` (Spring `@Component`)
- 수신된 모든 틱은 **Kotlin Coroutine `MutableSharedFlow<Tick>`** 으로 broadcast
- Subscriber는 `hub.ticks(symbol).collect { ... }` 형태로 lock-free 구독
- in-process 전달이므로 hot path latency = SharedFlow emit 비용(수 µs)

### 2. SharedFlow buffer 정책
- `replay = 0` (지각 구독자에게 과거 틱 미공급, 최신성 우선)
- `extraBufferCapacity = 256` (초당 수십 틱 × 멀티 심볼 여유)
- `onBufferOverflow = BufferOverflow.DROP_OLDEST` — hot path가 느린 subscriber에 의해 backpressure 받지 않도록 보호
- drop 발생 시 메트릭으로 감지 (정상 운영 시 0이어야 함)

### 3. Kafka fan-out (별도 collector)
- Hub 내부에서 **별도 collector coroutine**이 SharedFlow를 구독하여 Kafka 발행
- 토픽: `quant.market.tick.bithumb.v1`, `quant.market.tick.upbit.v1` (거래소별 분리, ADR-0010 토픽 컨벤션)
- 발행 실패는 hot path와 격리 — 전략 엔진은 Kafka 장애에 영향받지 않음
- 실패 시 DLQ + 메트릭, 재시도는 Kafka producer retry 정책 따름

### 4. Kafka publisher = optional bean
- `@ConditionalOnProperty(prefix = "quant.market.kafka-fanout", name = "enabled", havingValue = "true")`
- **Phase 2 default = false** (외부 소비자 없음 → Kafka 토픽 운영 비용 회피)
- Phase 3+ 에서 analytics/알림 서비스 추가 시 활성화 (코드 변경 0)

### 5. Port 정합성
- 기존 `MarketDataSubscriber` Port(ADR-0024 §5, TG-04 정의)는 그대로 유지 — 백테스트 모드는 hub를 거치지 않고 자체 fixture에서 공급
- `MarketDataHub`는 **페이퍼/실매매 모드에서만 활성화**되는 Hub 어댑터 (ExecutionMode = paper/live)
- 백테스트는 fixture 기반 `BacktestMarketDataAdapter`가 직접 `MarketDataSubscriber` 구현

### 6. 메트릭
- `quant_market_tick_received_total{exchange,symbol}` — counter, WS 수신 누적
- `quant_market_hub_buffer_dropped_total{exchange,symbol}` — counter, DROP_OLDEST 발생
- `quant_market_hub_fanout_lag_seconds{exchange}` — histogram, WS 수신 → Kafka ack 지연
- `quant_market_hub_subscribers{exchange}` — gauge, 활성 구독자 수

## Alternatives Considered

- **Kafka 단독 (in-process도 Kafka 통과)**: 1~10ms latency 추가, broker 장애 시 전략 엔진 정지, 단일 pod 운영에서는 over-engineering
- **Redis Pub/Sub**: Redis SPOF 추가, in-process보다 느림, k3s-lite 환경에서 cluster 모드 부담
- **순수 in-process (Kafka 없음)**: 미래 외부 fan-out 활성화 시 hub 재설계 필요 → optional bean으로 미리 분기 확보가 저비용
- **컴포넌트별 독립 WS 연결**: 거래소 rate limit 위반 + 중복 트래픽, 채택 불가

## Consequences

**긍정적:**
- hot path latency 최소(in-process emit)
- Phase 2 외부 의존성 0 — Kafka 토픽 운영/모니터링 비용 회피
- Phase 3+ fan-out 활성화는 property 토글 1줄

**부정적/주의:**
- replicas > 1 시 각 pod가 독립 SharedFlow → WS 연결 중복. **Phase 2 = replicas=1 가정** (StatefulSet, single instance)
- Kafka publish 실패 시 fan-out 데이터 유실 가능 → DLQ 적용, 재해 복구는 ClickHouse 적재본을 source of truth로 사용
- DROP_OLDEST 정책이 의도치 않은 틱 손실을 숨길 수 있음 → 메트릭 알람 필수

**후속 ADR 후보:**
- replicas > 1 환경에서 leader pod 선출 / WS 연결 단일화 패턴 (Phase 3+, HA 요구 시)
- analytics 서비스가 시세 토픽을 소비하는 경우의 backfill / replay 정책
