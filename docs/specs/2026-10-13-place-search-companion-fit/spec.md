# Specification: 관광지 검색 — 동행 적합 · 벡터 레그 분류 가중치 · 복제 소개문 감쇠

## Goal
「kids friendly place」처럼 벡터 레그만 타는 질의에서 아동복 매장이 상위를 차지하는 문제를 푼다.
특정 질의·상호를 겨냥한 규칙 없이, 이미 있는 순위 규칙을 두 레그에 똑같이 걸고 근거 있는 파생 값 둘을 더한다.

## 원인 (2026-10-13 운영 실측)
- 영문 색인 15,300건 중 쇼핑 11,071건(72%), 대부분 「[Tax Refund Shop]」 브랜드 지점. 소개문은 브랜드 문구를 지점마다 복사해
  15,300건에 소개문 종류가 6,670개, 같은 소개문을 5회 이상 공유하는 문서 8,292건.
- 분류 가중치(관광 ×3 · 상점·식당 ×0.35, `AttractionRankingProperties`)는 **키워드 레그에만** 걸린다. 동반 표현만 있는 질의는
  잔여 키워드가 없어 벡터 레그 단독이고, 그 경로에는 가중치가 없다.
- 벡터 단독 상위 10 상점·식당: 「family friendly for kids place」 6 · 「photo spots」 6.

## 오프라인 실측 (벡터 단독 top-100 재정렬, `scratchpad/sim-rank.py`)
| 질의 | 지금 | +분류 가중치 | +아이 적합 ×1.5 |
|---|---|---|---|
| family friendly for kids place | 상점 6/10 | 0/10 | 0/10, 아이 적합 6/10 |
| photo spots | 상점 6/10 | 0/10 | 0/10 |
| 어린이와 가족이 함께 갈 만한 곳 | 아이 적합 4/10 | 4/10 | 10/10 |
| kids clothing store | 상점 10/10 | 10/10 | 10/10 |

## Specific Requirements
- **SR-1 벡터 레그 분류 가중치** — 키워드 레그의 분류 함수(관광·상점 가중치)를 벡터 레그에도 같은 값으로 건다(단독·하이브리드 둘 다).
  상업 의도 질의(`commerceIntent`)면 키워드 레그와 같게 걸지 않는다. 완결성(popularity) 함수는 벡터 레그에 걸지 않는다 —
  의미 순위를 완결성이 뒤집는다. 스위치 `search.attraction-ranking.vector-leg` (기본 true).
- **SR-2 복제 소개문 감쇠** — 재색인 1차 훑기가 언어별로 「같은 소개문(앞뒤 공백 제거, 앞 300자)을 쓰는 활성 문서 수」 n 을 센다.
  문서에 `contentUniqueness = 1 / (1 + ln n)` 을 싣는다(소개문이 비면 1.0). 두 레그 모두 이 값을 곱한다(상업 의도여도 — 같은 브랜드
  지점이 목록을 채우지 않게). 없는 옛 문서는 1.0.
- **SR-3 동행 적합 `companions`** — 파생 다중값 keyword. 지금 값은 `KIDS` 하나:
  원천 분류(`lclsSystm3`)가 아이 대상 분류(테마파크·동물원·수족관·어린이공원·과학관·체험마을·체험농장·체험목장·체험어장·
  전통문화체험·기타공예체험·기타체험관광·일반야영장·오토캠핑장)이거나, 원천 체험 가능 연령(`expagerange*`)이 어린이·유아·아동·
  초등·children·kids·child 를 말할 때. 「전연령」·「all ages」만으로는 붙이지 않는다(반려견 공원이 붙었다).
  반려동물은 기존 `petPolicy` 가 맡으므로 여기 넣지 않는다.
- **SR-4 질의 연결** — 질의 이해가 동반 표현을 찾으면 `Understood.companion = KIDS`. 검색은 `companions=KIDS` 문서에
  `search.attraction-ranking.companion-weight`(기본 1.5)를 두 레그에 곱한다. **거르지 않는다** — 근거 없는 곳도 남는다.
- **SR-5 평가** — 배포 뒤 판정 세트 v3(사람 반영)로 두 바퀴 재고 ko·en C 가 기준선(.7486 · .7388) − 0.01 보다 낮으면 스위치를 끈다.
  결과 집합이 바뀐 질의는 판정 없는 문서 수를 먼저 세고 채점한 뒤 비교한다.

## Existing Code to Leverage
- `AttractionSearchAdapter.withCategoryWeights` · `vectorLeg` · `hybridQuery`
- `AttractionApiReindexTasklet.collectRegionPlacements` (1차 훑기) · `AttractionClickSignal`(재색인이 계산해 싣는 계수의 선례)
- `QueryIntent.extractCompanion`

## Out of Scope
- 연인과·부모님과·친구와·혼자 — 원천 근거가 없다. 클릭 원장이 쌓인 뒤 다룬다. 판정 세트에는 질의를 먼저 넣는다.
- LLM 판정 — 테마 다중 판정은 2026-09-27 수동 채점에서 45건 중 약 28건이 틀렸다(`scripts/attraction-setting/README.md`).
