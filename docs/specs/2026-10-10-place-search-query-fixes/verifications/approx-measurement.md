# 근사 측정이 지금 경로와 같은가 (심판 I-1, 2026-10-11)

**결론: 원인 분석 근사 표의 B 행은 지금 경로가 아니다. 재측정이 필요하다(TG6.0).**

| 항목 | 지금 코드 | 근사 스크립트 |
|---|---|---|
| kNN filter | `vectorLeg(embedding, matched)`. `matched` 는 `matchedQuery` 의 `must multi_match`(OR) + 필터 | `lang`·`embeddingModel` 만. 키워드 일치 없음 |
| 융합 | OpenSearch 하이브리드 + 검색 파이프라인(`fusion: rrf`), `paginationDepth ≥ k` | 스크립트 안 RRF 1/(61+순위), 레그별 top-10 |
| 키워드 레그 점수 | `withCategoryWeights`(분류 가중치·완결성) | 순수 `multi_match` |
| 근거 게이트 행 | (SR-5 는 msm `2<75%`) | AND `_count` 0 이면 빈 결과 |

- 코드 근거는 `search/app/.../opensearch/AttractionSearchAdapter.kt` 의 `buildRequest`(`val matched = matchedQuery(query, query.keyword, attributeFilters)`), `vectorLeg`(`b.filter(filters)`), `matchedQuery`(`b.must { m -> m.multiMatch { … } }`)다.
- 근사 스크립트는 세션 스크래치패드의 `exp.py`(2026-10-11 09:51)다. 표의 수치와 이 스크립트 출력을 잇는 저장 결과(`/tmp/exp-rows.json` 은 파드 안)가 없다. 그래서 「이 스크립트로 잰 값」이라는 것은 정황이고 확정이 아니다.
