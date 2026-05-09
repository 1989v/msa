# Quant SSE Load Tests — TG-16

ADR-0038 P3 SSE prototype 부하 검증.

## SLO (P3)

- 동시 SSE 1,000 connection 가능 (단일 instance, in-memory registry)
- first-byte p95 < 1.5s
- error rate < 1%
- heartbeat 15s 정상 (60s 부하 중 4 회/connection)

## k6 (권장)

```bash
brew install k6
k6 run -e URL=http://localhost:8094/api/v1/charts/stream/BTC/YAHOO \
       -e VUS=1000 \
       -e DURATION=60s \
       scripts/perf/sse-load.k6.js
```

threshold:
- `sse_ttfb_ms p(95) < 1500`
- `sse_connect_errors < 1%`

## bash + curl (k6 미설치)

```bash
N=500 DURATION=30 URL=http://localhost:8094/api/v1/charts/stream/BTC/YAHOO \
  ./scripts/perf/sse-load.sh
```

가벼운 검증용. 정밀한 latency 측정은 k6 권장.

## 후속

- Redis pubsub multi-instance fan-out 시 별도 부하 (인스턴스 간 latency)
- WebSocket 도입 (호가 ADR-0039 PA 후) 시 별도 시나리오
