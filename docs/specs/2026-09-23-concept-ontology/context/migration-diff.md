# 이관 diff — 운영 V22~V24 → search.yaml revision 1

운영 `concept_edge` 145건(2026-09-23 내보냄)과 `resources/ontology/search.yaml` 의 간선을 **간선 단위**로 비교한다.
로더 적용 뒤 운영에서 같은 비교를 다시 돌려 이 목록과 정확히 같아야 한다(스펙 검증 12). 총합 비교는 잘못된 교체를 통과시킨다.

| 구분 | 건수 |
|---|---|
| 운영 간선 | 145 |
| 파일 간선 | 163 |
| 전환 CONTAINS → USES | 12 |
| 그 밖의 제거 | 27 |
| 그 밖의 추가 | 45 |

## 전환 — 두 번째 부모(CONTAINS)가 쓰임(USES)으로

| from | to |
|---|---|
| ann-search | cosine-similarity |
| bandit-exploration | beta-bernoulli-conjugate |
| bandit-exploration | exploration-exploitation |
| lattice-viterbi | connection-cost |
| lattice-viterbi | context-id |
| lattice-viterbi | lattice |
| lattice-viterbi | word-cost |
| learning-to-rank | ltr-loss-families |
| learning-to-rank | ranking-features |
| morphological-analysis | morpheme |
| morphological-analysis | pos-tag |
| user-dictionary | surface-form |

## 그 밖의 제거

| from | kind | to |
|---|---|---|
| click-weak-labels | CONTAINS | position-bias |
| connection-cost | FLOWS_TO | viterbi-algorithm |
| glossary-learning | CONTAINS | inverse-propensity-scoring |
| glossary-learning | CONTAINS | query-level-cross-validation |
| glossary-learning | CONTAINS | team-draft-interleaving |
| glossary-morphology | CONTAINS | crf |
| glossary-morphology | CONTAINS | mecab-ko-dic |
| glossary-morphology | CONTAINS | sejong-corpus |
| glossary-morphology | CONTAINS | viterbi-algorithm |
| glossary-vector | CONTAINS | hnsw-parameters |
| glossary-vector | CONTAINS | matryoshka-embedding |
| judgment-set | CONTAINS | click-weak-labels |
| judgment-set | CONTAINS | graded-relevance |
| judgment-set | CONTAINS | judgment-coverage |
| judgment-set | FLOWS_TO | offline-metrics |
| judgment-set | CONTAINS | pooling |
| offline-metrics | CONTAINS | ndcg |
| offline-metrics | FLOWS_TO | online-evaluation |
| offline-metrics | CONTAINS | recall-precision |
| search-evaluation | CONTAINS | judgment-set |
| search-evaluation | CONTAINS | offline-metrics |
| search-evaluation | CONTAINS | search-ops-metrics |
| search-ops-metrics | CONTAINS | cache-hit-rate |
| search-ops-metrics | CONTAINS | fallback-rate |
| search-ops-metrics | CONTAINS | impression-click-ledger |
| search-ops-metrics | CONTAINS | latency-percentile |
| search-ops-metrics | CONTAINS | search-node-memory |

## 그 밖의 추가 (이동 · 신설 · 신규 관계)

| from | kind | to |
|---|---|---|
| analyzer-tokenizer | CONTAINS | nori |
| ann-search | MEASURED_BY | fallback-rate |
| bm25 | ALTERNATIVE_TO | ann-search |
| bulk-indexing | CONTAINS | partial-index-live |
| bulk-indexing | CONTAINS | reindex-count-gate |
| candidate-generation | MEASURED_BY | latency-percentile |
| candidate-generation | CONTAINS | opensearch |
| candidate-generation | MEASURED_BY | recall-precision |
| glossary-learning | CONTAINS | graded-relevance |
| glossary-learning | CONTAINS | judgment-set |
| glossary-learning | CONTAINS | ranking-features |
| hnsw-parameters | AFFECTS | recall-precision |
| index-rebuild | CAUSES | partial-index-live |
| interleaving | ALTERNATIVE_TO | ab-test |
| inverse-propensity-scoring | MITIGATES | position-bias |
| judgment-set-building | CONTAINS | click-weak-labels |
| judgment-set-building | USES | graded-relevance |
| judgment-set-building | CONTAINS | judgment-coverage |
| judgment-set-building | FLOWS_TO | offline-evaluation |
| judgment-set-building | CONTAINS | pooling |
| judgment-set-building | CONTAINS | position-bias |
| nori | IMPLEMENTS | lattice-viterbi |
| nori | IMPLEMENTS | user-dictionary |
| offline-evaluation | USES | judgment-set |
| offline-evaluation | CONTAINS | ndcg |
| offline-evaluation | FLOWS_TO | online-evaluation |
| offline-evaluation | CONTAINS | recall-precision |
| opensearch | IMPLEMENTS | ann-search |
| opensearch | IMPLEMENTS | bm25 |
| propensity-logging | MITIGATES | position-bias |
| query-vector-ledger | MEASURED_BY | cache-hit-rate |
| rank-fusion | MEASURED_BY | ndcg |
| reindex-count-gate | MITIGATES | partial-index-live |
| search-evaluation | CONTAINS | judgment-set-building |
| search-evaluation | CONTAINS | offline-evaluation |
| search-evaluation | CONTAINS | search-ops-monitoring |
| search-ops-monitoring | CONTAINS | cache-hit-rate |
| search-ops-monitoring | CONTAINS | fallback-rate |
| search-ops-monitoring | CONTAINS | impression-click-ledger |
| search-ops-monitoring | CONTAINS | latency-percentile |
| search-ops-monitoring | CONTAINS | page-cache-eviction |
| search-ops-monitoring | CONTAINS | search-node-memory |
| vector-quantization | MITIGATES | page-cache-eviction |
| vector-quantization | AFFECTS | recall-precision |
| vector-quantization | AFFECTS | search-node-memory |

## 개념

- 새 개념 8: `judgment-set-building`, `nori`, `offline-evaluation`, `opensearch`, `page-cache-eviction`, `partial-index-live`, `reindex-count-gate`, `search-ops-monitoring`
- 관리 밖으로 빠지는 개념 2: `offline-metrics`, `search-ops-metrics` — 행은 남고 kind·managed_by 가 NULL. 참조 0건(2026-09-24 실측)이라 어드민으로 삭제한다
- 관리 대상 108 (운영 간선에 걸린 개념 102)

## 운영에서 대조하는 법

```sql
SELECT from_concept_id, kind, to_concept_id FROM concept_edge ORDER BY 1,2,3;
```

적용 전 내보낸 `edges.json` 과 이 결과의 차집합 두 개가 위 「제거」·「추가」 표(전환 포함)와 같아야 한다.
