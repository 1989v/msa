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

## 도쿄 수족관·서울 궁궐 msm (2026-10-11 20:08 KST, TG6.0)

운영 `opensearch-0` 안에서 읽기 전용 `_count`·`_analyze` 만 했다. 색인 `attractions_20261011044641`(별칭 `attractions`, 품사 필터 `search_pos_stop` 반영). 필드는 앱 `KEYWORD_FIELDS` 와 같고 필터는 `lang=ko` 하나다. 앱의 근거 요청은 쿼리 언더스탠딩 필터·근거 잔여까지 쓰므로 이 값은 **필터가 없는 질의에서의 상한**이다.

```
ssh msa-oci "sudo kubectl -n commerce exec -i -c opensearch opensearch-0 -- curl -s -H 'Content-Type: application/json' \
  -X GET 'localhost:9200/attractions_20261011044641/_count' --data-binary @-" <<< \
  '{"query":{"bool":{"must":[{"multi_match":{"query":"<q>","fields":["title^3","title.en^3","titleLocal^3","overview","overview.en","address","address.en"],"minimum_should_match":"2<75%"}}],"filter":[{"term":{"lang":"ko"}}]}}}'
```

| 질의 | 검색 분석(`nori_search`) | msm `2<75%` `_count` | msm 없음(OR) `_count` | msm 상위 10 제목 |
|---|---|---|---|---|
| 도쿄 수족관 | `도쿄 · 수족 · 관` (3토큰 → 2개 요구) | **98** | 5,738 | 전남광주통합특별시 해양수산과학관 · 미술관과 아쿠아리움으로 떠나는 힐링 여행 · 울산 팀아쿠아 · 정남진물과학관 · 에스파스 루이비통 서울 · 여수수산물특화시장 · 장생포 고래생태체험관 · 방파제회센터 · 임진강쉼터어부식당 · 고성생태학습관 |
| 서울 궁궐 | `서울` + 동의어 그래프(`궁궐·고궁·왕궁·경복궁…`, 「경복궁」 류는 `경복`+`궁` 두 위치) | **139** | 9,022 | 궁중문화축전 · 조선의 왕들이 지극히 아끼던 공간 · 서울원조아구찜 · 서린낙지 · 서울 왕궁수문장 교대의식 · 경희궁 흥화문 · 고궁의 아침 · 도시의 고풍스러운 정취를 즐기다 · 나비호스텔 · 연우하우스 |

- 「도쿄 수족관」 msm 은 0 이 아니다. `수족`+`관` 두 토큰으로 국내 수족관·과학관이 맞고, 상위 10 에 도쿄 언급은 없다. SR-7.1 에 따라 단계 2·3 기대는 0 이 아니라 「에펠탑」 줄처럼 남은 문서를 사람이 확인하는 것이다. 이 결과는 SR-5.3 의 「msm 이 해외 지명 질의를 0 으로 만든다」는 전제가 3토큰 이상 한국어 질의에서는 성립하지 않는 사례다. 참고로 「도쿄」만 OR 로 세면 10건이다.
- 「서울 궁궐」 msm 은 139 다. 상위 10 에 제목에 궁궐류가 없는 식당·숙소(서울원조아구찜·서린낙지·나비호스텔·연우하우스)가 섞인다. 어느 토큰으로 맞았는지는 `explain` 으로 보지 않았다. CONFINE(SR-6)이 이 질의에 걸리면 결과가 이 집합으로 한정된다.
