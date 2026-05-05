// Code Dictionary Treemap — k6 endpoint P99 latency test (T5.2)
//
// 목적
//   GET /api/v1/concepts/stats/treemap 의 P99 latency 가 ADR-0025 Tier 1 SLA
//   (P99 < 200ms) 를 만족하는지 baseline 측정.
//
// 실행 (수동, k6 CLI 설치 필요):
//   1) 사전 seed: ConceptFixture.large(500) 데이터 적재 (별도 dev 시드 스크립트 참조)
//   2) k3d 클러스터 + ingress + gateway + code-dictionary 기동 확인
//        - kubectl apply -k k8s/overlays/k3s-lite
//        - scripts/image-import.sh --all
//   3) 본 스크립트 실행:
//        k6 run code-dictionary/app/src/test/k6/treemap-stats.js
//
// 기대 결과
//   - http_req_duration{endpoint:treemap} P99 < 200ms
//   - http_req_failed rate < 1%
//
// 결과는 ADR-0025 §3 P99 alerting 룰의 baseline 으로 활용.
// 참조: spec.md §5.3 latency budget, test-quality.md §Performance — Endpoint P99 (k6)

import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 50,
  duration: '60s',
  thresholds: {
    'http_req_duration{endpoint:treemap}': ['p(99)<200'],
    'http_req_failed': ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('http://localhost:8080/api/v1/concepts/stats/treemap', {
    tags: { endpoint: 'treemap' },
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has data': (r) => r.json('data.categories') !== undefined,
  });
}
