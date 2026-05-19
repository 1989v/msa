# Search ES Migration — 2026-05-19 (ADR-0050 Phase 2)

## 신규 매핑 필드

ADR-0050 Phase 2 신호 확장으로 `products` 인덱스에 신규 필드 추가.

| 필드 | 타입 | 출처 | 용도 |
|---|---|---|---|
| `ctrRaw` | `double` | analytics `score.updated` | unsmoothed CTR (디버그) |
| `cvrRaw` | `double` | analytics `score.updated` | unsmoothed CVR (디버그) |
| `gmv7d` | `double` | analytics `score.updated` | 7일 GMV |
| `gmv30d` | `double` | analytics `score.updated` | 30일 GMV |

## 마이그레이션 절차 (alias swap, ADR-0009)

기존 `products` alias 가 `products_{ts}` 를 가리키는 상태 가정.

```bash
# 1. search:batch 잡 실행 (DB direct 또는 API 기반 전체 reindex)
kubectl create job --from=cronjob/search-batch-product-reindex products-reindex-2026-05-19 -n msa

# 2. 새 인덱스 생성 + alias 교체 + 옛 인덱스 cleanup 은 IndexAliasManager 가 처리
#    (createIndex + updateAliasAndCleanup)

# 3. 검증
curl -s "http://es:9200/products/_mapping" | jq '.products.mappings.properties.gmv7d'
# 기대: { "type": "double" }
```

## 롤백

- 직전 timestamped 인덱스가 retention 정책으로 보존 (default 2개) — alias 만 이전 인덱스로 다시 가리키면 즉시 롤백
- 신규 필드는 `default 0` 으로 추가되므로 기존 `products` 인덱스에서도 함수 조회 시 missing(0) 처리됨 → 무중단 호환

## consumer 호환성

`analytics.score.updated` 페이로드의 `ctrRaw/cvrRaw/gmv7d/gmv30d` 는 analytics 측이 발행하지 않을 동안 default 0. search:consumer 는 모든 필드를 ES 에 부분 업데이트 (PARTIAL_DOCUMENT update) — 0 값으로 덮어쓰기.

> 주의: 만약 analytics 가 일부 메시지에서만 이 필드를 발행하기 시작하면, 미발행 메시지가 0 으로 덮어쓸 위험. 이 경우 analytics → search 전환 시점은 동시 cut-over 권장 (analytics 측 PR 머지와 search ramp 를 같은 윈도우에 진행).
