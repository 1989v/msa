// TG-16 — SSE 부하 테스트.
//
// 실행:
//   k6 run -e URL=http://localhost:8094/api/v1/charts/stream/BTC/YAHOO -e VUS=1000 scripts/perf/sse-load.k6.js
//
// k6 는 SSE 를 1급 지원하지는 않지만 http.get 으로 long-lived 응답 측정 가능.
// 정확한 SSE delta 분석은 별도 도구 (autocannon, custom Node script) 권장.
//
// SLO:
//   - 동시 1,000 VU 에서 connect rate ≥ 95%
//   - p95 first-byte < 1.5s
//   - error rate < 1%
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

const url = __ENV.URL || 'http://localhost:8094/api/v1/charts/stream/BTC/YAHOO'
const vus = parseInt(__ENV.VUS || '500', 10)
const duration = __ENV.DURATION || '60s'

const ttfb = new Trend('sse_ttfb_ms')
const connectErrors = new Rate('sse_connect_errors')

export const options = {
  scenarios: {
    sse: {
      executor: 'constant-vus',
      vus,
      duration,
    },
  },
  thresholds: {
    sse_ttfb_ms: ['p(95)<1500'],
    sse_connect_errors: ['rate<0.01'],
  },
}

export default function () {
  const start = Date.now()
  const res = http.get(url, {
    timeout: '60s',
    headers: { Accept: 'text/event-stream' },
    tags: { type: 'sse' },
  })
  ttfb.add(Date.now() - start)
  const ok = check(res, {
    'status 200': r => r.status === 200,
    'event-stream': r => (r.headers['Content-Type'] || '').includes('text/event-stream'),
  })
  connectErrors.add(!ok)
  sleep(1)
}
