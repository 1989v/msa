---
parent: 19-search-engine
seq: 34
title: 검색 평가 메트릭 — Precision / Recall / F1 / MRR / MAP / DCG / nDCG
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 01-search-overview.md
  - 09-hybrid-search-rrf.md
  - 10-reranking-cross-encoder-ltr.md
  - 18-hybrid-search-poc.md
  - 19-improvements.md
sources:
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/ranking-evaluation
  - https://www.elastic.co/blog/ranking-evaluation-elasticsearch
catalog-row: "§F.evaluation"
---

# 34. 검색 평가 메트릭 — Precision / Recall / F1 / MRR / MAP / DCG / nDCG

> 카탈로그 매핑: §99 §F (Scoring/Evaluation) — `★ 신규` → `✅ 커버` 로 갱신.
> 학습 시간 예상: ~2h · 자가평가 입구 레벨: B

> §01 4-4 에서 한 줄 정의로 끝낸 영역 + §10 LTR (Learning to Rank, 랭킹 학습) 9 절에서 사용한 메트릭의 **수식·관계·언제 무엇을 쓰는지** 의 풀 deep file.

---

## 1. 한 줄 핵심

> **검색 품질은 "느낌" 이 아니라 숫자로 증명한다 — judgment list 위에서 메트릭으로.**
> 메트릭은 두 축으로 나뉜다: **순서 무관 (Precision/Recall/F1) ↔ 순서 가중 (MRR/MAP/DCG/nDCG)**. 검색 UX 는 "위에 있는 게 더 중요" 이므로 **순서 가중 메트릭이 표준**, 그 중 nDCG@k 가 다중 정답 환경의 사실상 default.

---

## 2. 왜 평가 메트릭이 필요한가

### 2-1. "직관" 의 한계

- 개발자/PM 이 "이 결과가 1등이어야지" 라고 손으로 보면 — **bias 폭증** + 재현성 ❌ + scale ❌.
- 사용자 1만 명의 검색을 사람이 다 못 본다 → 통계적 측정이 필요.
- A/B 테스트에서 "어느 알고리즘이 좋은가" 를 결정하려면 **단일 숫자** 가 필요.

### 2-2. 메트릭의 두 축

본 deep file 에서 다루는 약어 — F1 (Precision-Recall 조화 평균), MRR (Mean Reciprocal Rank, 평균 상호 순위), MAP (Mean Average Precision, 평균 평균 정밀도), DCG (Discounted Cumulative Gain, 할인 누적 이득), IDCG (Ideal DCG, 이상적 DCG), nDCG (Normalized DCG, 정규화된 DCG):

| 축 | 메트릭 | 핵심 질문 |
|---|---|---|
| **순서 무관** (set 기반) | Precision, Recall, F1 | "정답이 결과 집합에 있느냐" |
| **순서 가중** (ranking 기반) | MRR, MAP, DCG, nDCG | "정답이 얼마나 위에 있느냐" |

검색은 **사용자가 위에서부터 본다** → 1위 정답과 10위 정답은 다르게 평가해야 함 → 순서 가중 메트릭이 표준.

### 2-3. 사전 요건 — judgment list

모든 메트릭은 **정답 라벨 (ground truth)** 이 있어야 계산 가능:

```
query: "갤럭시 폴드"
판정 (judgment):
  doc_001 (Galaxy Z Fold 5)        → relevance = 3 (perfect)
  doc_042 (Galaxy Z Fold 4)        → relevance = 2 (very relevant)
  doc_198 (Galaxy S24)             → relevance = 1 (somewhat relevant)
  doc_500 (iPhone 15)              → relevance = 0 (irrelevant)
  ...
```

- **graded relevance**: 0/1/2/3 같은 등급 (DCG 계열에 필수)
- **binary relevance**: 정답 / 비정답 (Precision/Recall/MRR 계열에 충분)
- 출처: 도메인 전문가 라벨링 + 클릭 로그 + 구매 로그 + 명시적 좋아요

---

## 3. 메트릭 정의 — 수식과 의미

### 3-1. Precision@k — 상위 k 중 정답 비율

```
Precision@k = (상위 k 결과 중 relevant 수) / k
```

예: 상위 10개 중 7개가 정답 → Precision@10 = 7/10 = 0.7

- **순서 무관** — 7개가 1~7위에 있든 4~10위에 있든 같은 점수.
- 의미: "결과를 얼마나 신뢰할 수 있나" — 사용자가 1페이지를 보면 몇 개가 진짜인지.
- 한계: 정답이 몇 개 존재하는지 무시. "사실 정답이 100개 있는데 상위 10개에 7개 잡았다" vs "정답이 7개뿐인데 모두 잡았다" — 같은 점수.

### 3-2. Recall@k — 정답 중 잡은 비율

```
Recall@k = (상위 k 결과 중 relevant 수) / (전체 relevant 수)
```

예: 정답이 총 20개인데 상위 10개에 7개 잡음 → Recall@10 = 7/20 = 0.35

- **순서 무관** — 위치 무시.
- 의미: "정답을 빠뜨리지 않고 가져왔나" — 검색 시스템의 후보 생성 단계 (Stage 1) 평가에 핵심.
- 한계: k 가 커지면 무조건 ↑ — Recall@1000000 = 100% (의미 없음).

### 3-3. F1 — Precision 과 Recall 의 조화 평균

```
F1@k = 2 × Precision@k × Recall@k / (Precision@k + Recall@k)
```

- 두 축의 균형을 단일 숫자로 — **둘 다 높아야** F1 ↑.
- 검색 품질 평가에서 F1 자체는 자주 안 쓰임 (순서 무시는 검색 본질에 안 맞음). 분류 (classification) 컨텍스트가 더 흔함.

### 3-4. MRR — Mean Reciprocal Rank, 첫 정답 위치

```
RR(query) = 1 / rank_of_first_relevant
MRR = mean(RR(query)) over all queries
```

예:
```
query 1: 정답이 1위에 있음 → RR = 1/1 = 1.0
query 2: 정답이 3위에 있음 → RR = 1/3 = 0.333
query 3: 정답이 안 나옴   → RR = 0
MRR = (1.0 + 0.333 + 0) / 3 = 0.444
```

- **첫 정답 위치만** 본다 — 그 다음은 무시.
- 의미: Q&A / "내가 찾는 그 한 개" 가 명확한 검색 (예: 위키 검색, FAQ) 에 적합.
- 한계: 다중 정답 환경에서 부적합 (이커머스 카테고리 검색 등).

### 3-5. MAP — Mean Average Precision

```
AP(query) = mean(Precision@k_i) for k_i where i-th relevant doc appears
MAP = mean(AP) over all queries
```

예 (정답 3개):
```
순위:  1  2  3  4  5  6  7  8  9 10
관련:  R  -  R  -  -  R  -  -  -  -

Precision@1 = 1/1 = 1.0   (1위 정답)
Precision@3 = 2/3 = 0.667 (3위 정답)
Precision@6 = 3/6 = 0.500 (6위 정답)

AP = (1.0 + 0.667 + 0.500) / 3 = 0.722
```

- 정답 위치마다 Precision 을 측정해 평균 → 위쪽에 정답이 몰리면 ↑.
- **순서 가중** + Precision 기반.
- 의미: "정답들이 위쪽에 잘 모여 있나".
- 한계: binary relevance 만 — graded (등급) 처리 ❌.

### 3-6. DCG — Discounted Cumulative Gain

graded relevance 를 처리하는 첫 메트릭.

```
DCG@k = sum_{i=1}^{k} (rel_i / log2(i + 1))

또는 (alternative formula, ES/sklearn default):
DCG@k = sum_{i=1}^{k} ((2^rel_i - 1) / log2(i + 1))
```

- `rel_i` = i 위치 결과의 relevance 등급 (예: 0/1/2/3)
- `log2(i+1)` = position discount — 아래쪽 위치는 점수 적게 받음
- 두 번째 식 (`2^rel - 1`) 이 graded 효과를 강조 — 등급이 높을수록 기하급수적으로 보상

예 (relevance 등급 0~3):
```
순위:  1  2  3
등급:  3  2  1

DCG@3 = 3/log2(2) + 2/log2(3) + 1/log2(4)
      = 3/1.0   + 2/1.585 + 1/2.0
      = 3.0    + 1.262   + 0.5
      = 4.762
```

- **그러나 절대값** — corpus / query 에 따라 범위가 천차만별. 비교 불가.

### 3-7. IDCG — Ideal DCG

> "만약 정답을 완벽한 순서로 정렬했다면 DCG 가 얼마였겠는가."

```
IDCG@k = DCG@k of 최적 정렬 (relevance 내림차순)
```

위 예에서 — 이미 최적 순서면 IDCG = DCG = 4.762.
순서가 [1, 3, 2] 였다면 DCG 는 더 작고, IDCG 는 여전히 4.762.

### 3-8. nDCG — Normalized DCG, 정규화된 DCG

```
nDCG@k = DCG@k / IDCG@k
```

- **0 ~ 1 범위** — 1.0 = 완벽한 정렬, 0 = 정답 없음.
- query 간 / corpus 간 **비교 가능** (절대값 비교의 가장 큰 한계 해결).
- graded relevance + 위치 가중 + 정규화 — **검색/추천 평가의 사실상 default**.

전체 평가:
```
nDCG (over all queries) = mean(nDCG@k(query)) for query in test_set
```

---

## 4. 메트릭 간 관계도

```
                    judgment list (정답 라벨)
                            │
        ┌───────────────────┼───────────────────┐
        │ binary relevance  │   graded relevance│
        ▼                   ▼                   ▼
   ┌─────────┐        ┌────────┐         ┌──────────┐
   │ 순서무관 │        │ 순서가중│         │ 순서가중  │
   │ Precision│        │  MRR   │         │   DCG    │
   │ Recall  │        │  MAP   │         │  ↓ 정규화 │
   │ F1      │        │        │         │   nDCG   │
   └─────────┘        └────────┘         └──────────┘
       │                  │                    │
       ▼                  ▼                    ▼
   "있냐 없냐"      "첫 정답 어디"      "전체 정답 분포"
   Stage 1 후보 생성  Q&A / FAQ          이커머스 / 추천
```

축으로 보면:

| 축1 \ 축2 | 순서 무관 | 순서 가중 |
|---|---|---|
| **Binary** | Precision, Recall, F1 | MRR, MAP |
| **Graded** | (드물게 사용) | DCG, **nDCG** |

---

## 5. 언제 무엇을 쓰는가 — 의사결정 가이드

### 5-1. 검색 단계별

| 단계 | 1차 메트릭 | 2차 메트릭 |
|---|---|---|
| **Stage 1 후보 생성** (recall 단계) | Recall@k (k = 100~1000) | Precision@k 보조 |
| **Stage 2 ranking** (정밀 정렬) | nDCG@10 | MRR, MAP |
| **사용자 UX 영향** | CTR (Click-Through Rate, 클릭률) | CVR (Conversion Rate, 전환율) |
| **Q&A / FAQ / 위키 검색** | MRR | nDCG@5 |
| **이커머스 다중 정답** | nDCG@10 | Recall@50 보조 |

### 5-2. 도메인별 default

| 도메인 | 추천 메트릭 |
|---|---|
| 이커머스 상품 검색 | nDCG@10 (graded: 클릭/구매/조회 등급) |
| 위키 / 검색 엔진 | nDCG@10 + MRR |
| FAQ 챗봇 / Q&A | MRR (single answer) |
| 추천 시스템 (피드) | nDCG@k + Recall@k |
| 코드 검색 / 매뉴얼 | MRR (정답 1개 가정) |
| 학술 논문 검색 | MAP + nDCG@10 |
| 의료 / 법률 — recall 중요 | Recall@k → Precision@k 후처리 |

### 5-3. 메트릭 선택 흐름도

```
정답이 graded (등급) 인가?
├── 예 → DCG / nDCG (보통 nDCG)
└── 아니오 (binary) →
    └── 한 개 정답인가?
        ├── 예 → MRR
        └── 아니오 (다중 정답) →
            └── 순서가 중요한가?
                ├── 예 → MAP
                └── 아니오 → Precision@k / Recall@k
```

---

## 6. 함정과 안티패턴

### 6-1. nDCG 절대값으로 비교 ❌

> "우리 검색 nDCG 가 0.85 야!" — corpus / query 분포가 다르면 비교 의미 ❌.
> nDCG 는 **같은 judgment list + 같은 query set** 에서의 알고리즘 A/B 비교에만 쓴다.

### 6-2. judgment 부족 (under 1000 queries)

- 100~1000 query 로는 통계적 유의성 부족.
- 최소 1만+ judged query / 정답 등급 변동성 검증 필요.

### 6-3. position bias 로 오염된 클릭 로그

- "위에 있어서 클릭됨" ≠ "관련도 있어서 클릭됨".
- 클릭 로그를 그대로 judgment 로 쓰면 **현 ranking 을 강화** (no-op).
- 해법: IPW (Inverse Propensity Weighting, 역경향 가중) (§10) 으로 debias.

### 6-4. k 를 너무 작게 잡음

- nDCG@1 = 1위 하나만 보는 셈. 검색 UX 에선 1페이지 (10개) 가 보통이라 nDCG@10 이 표준.
- k=1 은 사실상 MRR 과 비슷 (graded 효과만 추가).

### 6-5. binary relevance 로 graded 손실

- 클릭 / 좋아요 / 구매를 모두 "relevant=1" 로 통일 → 신호 손실.
- 등급화: 노출=0, 클릭=1, 카트=2, 구매=3 → graded relevance.

### 6-6. test set 과 train set 분리 안 함 (LTR)

- test query 가 train 에 섞이면 nDCG 가 비정상적으로 ↑ — overfitting.
- query-level split 필수 (같은 query 의 doc 들이 한쪽으로만).

### 6-7. 메트릭만 보고 UX 무시

- nDCG ↑ 인데 CTR ↓ — judgment list 가 실제 사용자 의도를 반영 못 함.
- 오프라인 메트릭 (nDCG) + 온라인 메트릭 (CTR/CVR) **둘 다** 봐야 함.

---

## 7. ES 의 Ranking Evaluation API — 실전 사용

ES 8.x 는 [Ranking Evaluation API](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/ranking-evaluation) 를 제공해 nDCG / Precision / MRR / Recall 을 클러스터에서 직접 계산.

### 7-1. 기본 구조

```json
POST /products/_rank_eval
{
  "requests": [
    {
      "id": "query_galaxy_fold",
      "request": {
        "query": { "match": { "name": "갤럭시 폴드" } }
      },
      "ratings": [
        { "_index": "products", "_id": "doc_001", "rating": 3 },
        { "_index": "products", "_id": "doc_042", "rating": 2 },
        { "_index": "products", "_id": "doc_198", "rating": 1 }
      ]
    }
  ],
  "metric": {
    "dcg": {
      "k": 10,
      "normalize": true
    }
  }
}
```

응답:
```json
{
  "metric_score": 0.847,
  "details": {
    "query_galaxy_fold": {
      "metric_score": 0.847,
      "unrated_docs": [...],
      "hits": [...]
    }
  },
  "failures": {}
}
```

### 7-2. 지원 메트릭

| 메트릭 | 옵션 |
|---|---|
| `precision` | `k`, `relevant_rating_threshold`, `ignore_unlabeled` |
| `recall` | `k`, `relevant_rating_threshold` |
| `mean_reciprocal_rank` | `k`, `relevant_rating_threshold` |
| `dcg` | `k`, `normalize` (true 면 nDCG) |
| `expected_reciprocal_rank` | `k`, `maximum_relevance` (graded MRR) |

### 7-3. 실전 워크플로우

```
1. judgment list 작성/수집
   - 도메인 전문가 라벨 (수백 query)
   - 클릭/구매 로그 → 등급화 (수만 query)
   
2. test set 분리 (query-level)

3. 베이스라인 알고리즘 (BM25 only) 으로 _rank_eval 호출
   → baseline nDCG@10 = 0.62

4. 새 알고리즘 (BM25 + function_score) 으로 호출
   → new nDCG@10 = 0.71 (+0.09)

5. 통계적 유의성 검증 (paired t-test on per-query nDCG)

6. 의미 있으면 → 온라인 A/B 테스트
   → CTR/CVR 검증
```

---

## 8. msa 적용 가이드

### 8-1. 현재 상태 (§15 grounding)

- `analytics` 서비스 (Kafka Streams + ClickHouse) 가 클릭/구매 로그 수집 중 (CLAUDE.md).
- 검색 품질 메트릭은 **현재 미구현** (§19 ADR 후보).
- judgment list 인프라 ❌, A/B 테스트 플랫폼 ❌ (`experiment` 서비스 미생성).

### 8-2. 도입 단계 (제안)

```
Phase 1: judgment 수집 (analytics → judgment table)
  - 검색 결과 노출/클릭/구매 이벤트 → 등급화
  - 등급: 노출=0, 클릭=1, 카트=2, 구매=3

Phase 2: ES _rank_eval 정기 잡 (search:batch)
  - 매일 어제 query 1만 건 sample 로 nDCG@10 계산
  - Grafana 대시보드 (CHART)

Phase 3: 도메인 전문가 judgment (보조)
  - PM/MD 가 100~1000 query 손 라벨 (top query)
  - 클릭 기반 자동 judgment 와 cross-check

Phase 4: A/B 테스트 통합 (experiment 서비스 도입 후)
  - 알고리즘 변경 시 nDCG (offline) + CTR/CVR (online) 측정
```

### 8-3. msa 측정 체계

```
[search:app — 검색 API]
    │ 매 검색 응답에 search_id 발급
    ▼
[Kafka — search.event.viewed/clicked/purchased]
    │
    ▼
[analytics — Kafka Streams 집계 → ClickHouse]
    │
    ▼
[judgment table (ClickHouse 또는 ES)]
    │
    ├── 일배치: search:batch 가 _rank_eval 호출 → nDCG 일별 집계
    │
    └── 실시간: experiment 서비스 (A/B 변형별 CTR/CVR)
```

### 8-4. ADR 후보 (§19)

> **ADR-XXXX-3: 검색 품질 측정 — judgment + nDCG@10 + A/B 통합**
>
> 결정: Phase 1~4 단계적 도입. 메트릭 = nDCG@10 (offline) + CTR/CVR (online).

---

## 9. 면접 한 줄 답변 모음

### Q. Precision 과 Recall 의 차이는?

> "Precision 은 결과 중 정답 비율 (얼마나 깨끗한가), Recall 은 정답 중 잡은 비율 (얼마나 빠뜨렸나) 입니다. 검색의 1페이지 UX 는 Precision@10 이 중요하고, 후보 생성 단계 (Stage 1) 는 Recall@k 가 핵심입니다."

### Q. MRR 과 nDCG 중 무엇을 쓰나요?

> "정답이 한 개고 첫 위치만 중요하면 MRR, 다중 정답이고 등급이 있으면 nDCG@k 입니다. 이커머스 / 추천처럼 graded relevance (클릭/구매 등급) 가 있는 환경은 nDCG@10 이 사실상 default 입니다."

### Q. nDCG 가 0.85 면 좋은 건가요?

> "절대값으로는 판단 불가입니다. nDCG 는 같은 judgment list + 같은 query set 에서 알고리즘 A vs B 를 비교할 때만 의미가 있습니다. 0.85 가 의미 있으려면 baseline 이 0.62 였다 같은 비교가 필요합니다."

### Q. judgment list 어떻게 만드나요?

> "두 갈래입니다. (1) 도메인 전문가가 손으로 등급 라벨 — 정확하지만 양 ↓, (2) 클릭/구매 로그 → 등급화 — 양 ↑ 이지만 position bias 오염. 둘을 cross-check 하고, 클릭 기반은 IPW 같은 debiasing 을 거칩니다."

### Q. nDCG 계산 시 IDCG 가 뭔가요?

> "Ideal DCG — 만약 정답을 완벽하게 정렬했다면 나왔을 DCG 입니다. 이걸 분모로 두어 0~1 범위로 정규화하면 nDCG 가 됩니다. 정규화 덕분에 query 간 / corpus 간 비교가 가능해집니다."

### Q. 클릭 로그를 그대로 judgment 로 쓰면 왜 위험한가요?

> "Position bias 입니다. 위에 있는 결과가 클릭이 많을 뿐이지 진짜 관련도가 높은 게 아닐 수 있는데, 그걸 ground truth 로 학습하면 현재 ranking 을 그냥 강화하는 no-op 이 됩니다. IPW (Inverse Propensity Weighting) 같은 debiasing 으로 위치 효과를 빼야 합니다."

---

## 10. 연결 학습

- §01 4-4 — 메트릭 짧은 정의 (이 파일이 풀어 씀)
- §09 — Hybrid Search 평가 시 nDCG 사용 사례
- §10 — LTR (Learning to Rank) 의 listwise (LambdaMART) 가 nDCG 직접 최적화
- §18 — Hybrid Search PoC 의 nDCG@10 비교
- §19 — 검색 품질 측정 부재 ADR 후보
- §35 — function_score modifier (이 메트릭으로 modifier 효과 측정)

---

## 11. 흔한 오해 정정

> **"nDCG 가 1.0 이면 완벽하다"**

- ⚠ 1.0 은 "judgment list 기준 완벽한 정렬" 일 뿐. judgment 가 사용자 의도를 반영 못 하면 1.0 도 의미 없음.

> **"Precision 과 Recall 은 trade-off 다"**

- ⚠ k 가 고정일 때만. k 를 키우면 Recall ↑ Precision ↓ 가 일반적이지만, 더 좋은 알고리즘은 동일 k 에서 둘 다 ↑.

> **"DCG 와 nDCG 는 같다"**

- ❌ DCG 는 절대값 (corpus 의존), nDCG 는 IDCG 로 정규화한 0~1 값. 비교 가능성이 다름.

> **"MAP 와 MRR 은 비슷하다"**

- ⚠ 둘 다 순서 가중이지만, MRR 은 첫 정답만, MAP 는 모든 정답 위치를 본다. 다중 정답 환경에선 MAP 가 더 정보 풍부.

> **"메트릭만 좋으면 검색 잘하는 거다"**

- ❌ 오프라인 메트릭 (nDCG) ↑ 인데 온라인 CTR ↓ 는 흔하다. judgment 와 사용자 의도 사이 gap 점검 필요.

---

## 12. 회독 체크리스트

> §34 회독 체크리스트:
> - [ ] Precision@k / Recall@k / F1 의 수식과 한계
> - [ ] MRR 가 적합한 도메인 vs nDCG 가 적합한 도메인
> - [ ] DCG 수식의 두 가지 변형 (`rel` vs `2^rel - 1`) 의 차이
> - [ ] IDCG 의 의미와 nDCG 정규화 효과
> - [ ] judgment list 만드는 두 갈래 (전문가 vs 클릭) 와 각자의 한계
> - [ ] position bias / IPW 의 개념
> - [ ] ES `_rank_eval` API 의 metric 옵션과 normalize=true 의 의미
> - [ ] msa 의 search 품질 측정 미구현 → 도입 4 단계 답변
