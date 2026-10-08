# 벡터 레그 knn 필터 비교 — 검색어 must 포함(A, 현재) vs 구조 필터만(B)

- 측정: 2026-10-08 KST, 운영 색인 `attractions`, 배포 이미지 `search:23c07d5` (작업 트리 코드와 해당 파일 동일)
- 판정 세트: `judgments-attractions-2026-10-05.json` (150쿼리, ko 90 · en 60)
- 두 변형은 벡터 레그 knn `filter` 만 다르다. 키워드 레그(function_score 분류 가중치 · ln1p 완결성, 클릭 계수 꺼짐) · RRF 파이프라인 `attraction-hybrid-rrf`(rank_constant 60) · k 100 · rescore oversample 3 · pagination_depth 100 · size 10 은 코드대로.
- 질의 이해는 앱과 같게 재현했다: API 응답의 `correctedKeyword` → `QueryIntent.analyze` 파이썬 이식(사전은 운영 content `/api/places/attractions/category-codes`, ko·en 각 711항) → 잔여는 키워드 레그, 교정된 원문(QueryNormalizer)은 인코더.
- 잔여가 없는 질의(의도어만)는 앱이 벡터 단독 경로로 가므로 A·B 가 구조적으로 같다 — 22개.
- 쿼리 벡터: 운영 search 파드 인코더 사이드카 `/encode`. 실패 0건, 제외 0건.

## 재현 일치율

| 대조 | 일치 |
|---|---|
| A top-10 vs 운영 API(클러스터 안 search:8083) top-10, 순서까지 | **150 / 150** |
| A top-10 vs 공개 API `api.1989v.com` 표본 8개 | 8 / 8 |

## nDCG@10

| 구분 | n | A (현재) | B (구조 필터만) | B − A | 95% CI (짝 부트스트랩) | B>A · B<A · 같음 | 판정 없는 문서 A · B |
|---|---|---|---|---|---|---|---|
| ko | 90 | 0.7762 | 0.7784 | +0.0022 | [−0.0040, +0.0081] | 13 · 11 · 66 | 11/890 · 10/890 |
| en | 60 | 0.7162 | 0.7260 | +0.0097 | [−0.0054, +0.0279] | 19 · 10 · 31 | 2/574 · 1/590 |
| 전체 | 150 | 0.7522 | 0.7574 | +0.0052 | [−0.0021, +0.0135] | 32 · 21 · 97 | 13/1464 · 11/1480 |

하이브리드 경로 128개 중 순서가 바뀐 질의 66, top-10 집합이 바뀐 질의 54, B 가 새로 올린 문서 128개.
판정 없는 문서 비율은 두 변형 모두 1% 안팎이라 풀링 편향은 작다.

## 쿼리별 차이 상위

| lang | 질의 | 잔여 / 필터 | A | B | B − A |
|---|---|---|---|---|---|
| en | stargazing | stargazing | 0.523 | 0.907 | **+0.384** |
| en | seongsan ilchulbong | 같음 | 0.958 | 0.802 | −0.156 |
| en | traditional market food | 같음 | 0.567 | 0.712 | +0.145 |
| en | pet friendly | 같음 | 0.914 | 0.778 | −0.136 |
| ko | 불국사 | 같음 | 0.619 | 0.492 | −0.127 |
| en | autumn foliage | 같음 | 0.671 | 0.790 | +0.118 |
| en | winter trip | 같음 | 0.490 | 0.598 | +0.108 |
| en | kids friendly place | 같음 | 0.604 | 0.707 | +0.102 |
| ko | 실내 놀거리 | 놀거리 / setting=indoor | 0.698 | 0.794 | +0.096 |
| ko | 일출 명소 | 일출 / contentTypeId=12 | 0.593 | 0.670 | +0.077 |

- **B 가 이기는 쪽**은 본문 어휘와 질의 어휘가 어긋나는 영문 의미 질의다. 「stargazing」은 A 에서 키워드 일치 문서가 4개뿐이라 목록이 4개에서 끝났고, B 는 벡터가 천문대·별 관측지를 끌어와 10개를 채웠다.
- **B 가 지는 쪽**은 고유명 질의다(불국사·성산일출봉·설악산). A 에서는 벡터 레그도 이름이 맞는 문서 안에서만 고르므로 이름 정밀도가 지켜진다. B 에서는 비슷한 다른 사찰·봉우리가 벡터 레그로 섞여 정답을 밀어낸다.

## 해석

1. A 에서 벡터 레그는 BM25 일치 집합 안의 **재정렬기**일 뿐이고 리콜을 하나도 보태지 않는다. 키워드에 안 걸리는 문서는 하이브리드에서 절대 나올 수 없다. 의도된 설계라면 ADR-0090 D4 의 「벡터 레그는 같은 필터를 진 k-NN」 문구가 검색어 일치까지 포함한다는 뜻인지 명시해야 한다.
2. B 로 바꾼 이득은 평균 +0.005 이고 신뢰구간이 0 을 덮는다. ko 는 사실상 0, en 은 +0.01 이다. 개선이 질의 소수(stargazing 등 의미 질의)에 몰리고 고유명 질의에서 비슷한 크기의 손실이 난다.
3. 지금 판정 세트로는 B 로 바꿀 근거가 부족하다. 다만 0건·소수 결과 질의를 구하는 효과는 실재하므로, 바꾸려면 고유명 손실을 막는 장치를 같이 재야 한다. 예를 들어 잔여가 짧은 고유명 질의에서만 A 를 유지하는 방식이다.

## 곁가지 발견 (이번 실험 범위 밖)

- 「템플스테이」·「temple stay」는 A·B 모두 결과 0건이다. 질의 이해가 전체를 `lclsSystm3=EX040100` 필터로 바꾸고 잔여가 비어 벡터 단독 경로로 가는데, 그 코드로 걸리는 문서가 없다.
- 「gyeongbokgoong」(오타)은 A 0건, B 10건이지만 정답 문서 1개가 B 상위 10위에도 없어 둘 다 0이다.

## 운영 상태를 바꾸지 않았다는 확인

| 확인 | 결과 |
|---|---|
| 스크립트가 부르는 엔드포인트 | OpenSearch `POST /attractions/_search` · 인코더 `POST /encode` · search API `GET` · content `GET` 뿐 |
| `grep -nE "PUT\|DELETE\|_update\|_bulk\|_settings\|_doc" exp.py run.sh` | 일치 없음 |
| API 호출이 사전 미적중이면 `query_vector` 에 행을 쓸 수 있는 경로라 확인: `oci-mysql search_db "SELECT source, COUNT(*), MAX(updated_at) FROM query_vector WHERE updated_at >= NOW() - INTERVAL 2 HOUR GROUP BY source"` | 0행 — 150쿼리 모두 기존 사전 적중 |
| 노드 정리: `pgrep -af "port-forward.*(19221\|18183\|18197)"` | 남은 port-forward 없음, `/tmp/vf-*` 삭제 |

## 파일

- `exp.py` — 질의 조립·QU 이식·nDCG 계산 (노드에서 실행)
- `run.sh` — port-forward(opensearch-0:9200, search 파드 8083·8099, svc/content 8097) 후 실행
- `rows.json` — 쿼리별 A·B·API top-10 id, 잔여·필터, nDCG
