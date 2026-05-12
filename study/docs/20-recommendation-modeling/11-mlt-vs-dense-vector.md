---
parent: 20-recommendation-modeling
seq: 11
title: ES MoreLikeThis vs Dense Vector — TF-IDF 한계, morelike-com/offer 운영 패턴
type: deep
created: 2026-05-12
---

# 11. ES MoreLikeThis vs Dense Vector

> **Phase 5 마지막**. §09 의 임베딩 + §10 의 ANN 인프라가 ES 의 전통적 MoreLikeThis (MLT) 를 어떻게 대체하는지. 산업 morelike-com / morelike-offer 의 운영 패턴.

---

## 1. MoreLikeThis (MLT) 의 정체

### 1-1. ES MLT Query

```json
{
  "query": {
    "more_like_this": {
      "fields": ["title", "description", "tags"],
      "like": [
        { "_index": "products", "_id": "12345" }
      ],
      "min_term_freq": 1,
      "max_query_terms": 25,
      "min_doc_freq": 5
    }
  }
}
```

**알고리즘**:
1. 입력 문서의 텍스트 분석 → 토큰 추출
2. 각 토큰의 TF-IDF (Term Frequency - Inverse Document Frequency) 계산
3. 가장 중요한 N 개 토큰 선정 (max_query_terms)
4. 이 토큰들로 BM25 query 생성
5. 다른 문서들과 매칭 → ranking

### 1-2. MLT 의 본질

= **BM25 의 자동화된 query 생성**. 사람이 query 를 안 적어도 "이 문서 같은 것 찾아줘" 라고 묻는 도구.

장점:
- ✅ ES 만으로 가능 (별도 임베딩 모델 불필요)
- ✅ 즉시 사용 (사전 학습 불필요)
- ✅ 인덱스 변경 없음

---

## 2. MLT 의 한계

### 2-1. Lexical Matching 의 함정

```
문서 A: "프랑스 파리에서 와인 시음 투어"
문서 B: "Bordeaux winery tasting experience"

문서 C: "프랑스 파리 박물관 관람"
```

MLT (TF-IDF 기반):
- A vs B: 공통 토큰 없음 → 낮은 score (그러나 의미는 같음 — 와인 시음)
- A vs C: "프랑스", "파리" 토큰 매칭 → 높은 score (그러나 의미 다름 — 박물관 vs 와인)

**문제**: TF-IDF 는 표면적 단어 매칭. **의미적 유사성** 안 잡음.

### 2-2. 다국어 / 동의어 / 다의어

| 함정 | 예시 |
|---|---|
| **다국어 매칭 불가** | "와인 시음" vs "wine tasting" → 같은 의미인데 매칭 안 됨 |
| **동의어 인식 못함** | "맛집" vs "맛있는 식당" → 다른 토큰 |
| **다의어 구별 못함** | "사과" — 과일? 사죄? |

ES 의 synonym filter 로 일부 보완 가능하지만 **수동 사전 관리** 부담.

### 2-3. 짧은 텍스트의 함정

```
상품명: "에어팟 프로" (8 character)
   TF-IDF query: ["에어팟", "프로"] (2 tokens, 모두 매우 흔함)
   
결과: 너무 broad — "프로" 들어간 다른 상품 모두 매칭
```

짧은 상품명 / 카테고리명 추천에는 TF-IDF 가 약함.

---

## 3. Dense Vector 의 우월점

### 3-1. Semantic Similarity

```
"프랑스 파리에서 와인 시음 투어"  → vec_A
"Bordeaux winery tasting experience" → vec_B

cosine(vec_A, vec_B) = 0.85   (높음 — 의미적으로 유사)
```

Sentence-BERT 같은 임베딩 모델은:
- ✅ **언어 무관** — multilingual 모델은 한↔영 직접 매칭
- ✅ **동의어 자동 인식** — 학습 데이터에서 emergent
- ✅ **문맥 이해** — "사과" 가 어느 의미인지 주변 단어로 판단
- ✅ **짧은 텍스트 강함** — 임베딩이 정보 압축

### 3-2. MLT vs Dense Vector 비교 표

| 축 | MLT (TF-IDF/BM25) | Dense Vector |
|---|---|---|
| **알고리즘** | 토큰 매칭 + 빈도 통계 | 신경망 임베딩 + cosine |
| **의미 유사도** | ❌ 표면 매칭만 | ✅ semantic |
| **다국어** | ❌ 토큰 다름 | ✅ multilingual 모델 |
| **동의어** | 부분 (수동 사전) | ✅ 자동 |
| **짧은 텍스트** | ❌ 약함 | ✅ 강함 |
| **인프라 비용** | 작음 (ES native) | 큼 (임베딩 모델 학습/추론, ANN 인덱스) |
| **즉시 사용** | ✅ 인덱스만 있으면 OK | ❌ 모델 학습 / 임베딩 사전 계산 필요 |
| **신상품 cold-start** | ✅ 텍스트만 있으면 OK | ✅ 텍스트만 있으면 OK |
| **모델 업데이트** | 인덱스 재생성 | 모델 재학습 + 모든 임베딩 재계산 |

### 3-3. 언제 무엇을 쓰나

**MLT 가 적합한 시나리오**:
- ✅ 빠른 prototype — 즉시 동작
- ✅ 정확한 키워드 매칭이 중요 (제품 모델명, 시리얼 번호)
- ✅ 인프라 비용 제약 (임베딩 모델 학습 부담)
- ✅ 검색 결과 설명 가능성 ("이 단어가 매칭되어서")

**Dense Vector 가 적합한 시나리오**:
- ✅ 의미 유사도 중요 (콘텐츠 추천, 여행지 추천)
- ✅ 다국어 (글로벌 OTA)
- ✅ 다양한 텍스트 표현 (사용자 검색어 vs 상품 설명)
- ✅ 신상품 cold-start 안전망

**산업 표준 — Hybrid (Phase 10 §24 cross-ref)**:
```
score = α × bm25_score + β × dense_cosine_score
```
두 시그널 결합 + RRF (Reciprocal Rank Fusion, #19 §07) 또는 weighted sum.

---

## 4. 산업 morelike-com / morelike-offer 의 운영 패턴

산업 카탈로그의 morelike-com (커뮤니티) 과 morelike-offer (상품) 의 운영 패턴 분석.

### 4-1. 공통 코드 + 분리 DAG

```
morelike-com/src/morelike/main.py
morelike-offer/src/morelike/main.py
   → 두 파일 동일

DAG 만 분리:
   morelike-com DAG: 새벽 2시 실행, 커뮤니티 콘텐츠 임베딩
   morelike-offer DAG: 새벽 4시 실행, 상품 임베딩
```

### 4-2. 왜 이렇게 운영하나

**장점**:
- ✅ **도메인별 SLA 분리** — 커뮤니티 학습이 실패해도 상품 영향 없음
- ✅ **도메인별 모니터링** — 각 DAG 의 학습 시간 / 임베딩 품질 독립 추적
- ✅ **도메인별 스케줄** — 데이터 가용 시간이 다름 (커뮤니티 vs 거래)
- ✅ **도메인별 자원** — GPU 인스턴스 도메인 단위 할당

**단점**:
- ❌ **코드 동기화 부담** — 알고리즘 변경 시 두 곳 수정
- ❌ **버전 drift 위험** — 한쪽만 업데이트되면 결과 불일치
- ❌ **의존성 업그레이드** — PyTorch / transformers 등 두 곳 동기화

### 4-3. 산업 표준 대안 — 공통 라이브러리 + 분리 DAG

```
shared-library/morelike-core/
   ├── train.py        ← 학습 로직
   ├── inference.py    ← 추론 로직
   └── config.py       ← 도메인 무관 설정

morelike-com/
   ├── dag.py          ← Airflow DAG (com 도메인)
   ├── config-com.yaml ← 도메인별 설정
   └── requirements.txt → shared-library 의존

morelike-offer/
   ├── dag.py          ← Airflow DAG (offer 도메인)
   ├── config-offer.yaml
   └── requirements.txt → shared-library 의존
```

**구성 요소**:
- **공통 코드** — 라이브러리로 분리
- **도메인별 config** — yaml / json 으로 설정만 분리
- **도메인별 DAG** — 운영만 분리

### 4-4. Phase 10 §21 의 msa recommendation 모듈 설계 시 교훈

msa 의 recommendation 서비스 구현 시:
- ✅ 알고리즘 로직 — `recommendation/domain/` 의 공통 service
- ✅ 도메인별 분기 — `recommendation/application/` 의 strategy pattern
- ✅ 운영 분리 — Kafka topic 별 (recommendation.events.hotel, recommendation.events.activity)

→ 산업 운영의 trade-off 가 msa 의 Clean Architecture 와 자연스럽게 맞물림.

---

## 5. Hybrid Search 의 자연스러운 확장

### 5-1. 추천에서 Hybrid 의 의미

```
score(query_item, candidate_item)
  = α × bm25(query.text, candidate.text)        ← lexical
  + β × cosine(query.embedding, candidate.embedding)  ← semantic
```

또는 RRF (#19 §07 cross-ref):

```
score = 1 / (60 + rank_bm25) + 1 / (60 + rank_dense)
```

### 5-2. ES 의 hybrid 구현

```json
{
  "query": {
    "bool": {
      "should": [
        {
          "more_like_this": {
            "fields": ["title", "description"],
            "like": [{ "_index": "products", "_id": "12345" }],
            "boost": 0.5
          }
        }
      ]
    }
  },
  "knn": {
    "field": "embedding",
    "query_vector": [...],   // 입력 문서의 dense embedding
    "k": 10,
    "num_candidates": 100,
    "boost": 0.5
  }
}
```

ES 8.x 의 native 결합.

### 5-3. 두 시그널의 보완 관계

```
사례 1: 정확한 모델명 ("에어팟 프로 2세대")
   BM25 강함 (토큰 정확 매칭)
   Dense 약함 (짧은 텍스트, 의미 명확)
   → hybrid 가 BM25 결과 살림

사례 2: 의미적 검색 ("여름에 가족과 갈 만한 곳")
   BM25 약함 (다양한 토큰)
   Dense 강함 (의미 임베딩)
   → hybrid 가 Dense 결과 살림

사례 3: 평범한 검색 ("호텔 강남")
   BM25 + Dense 둘 다 잘 함
   → 결과 동의 → 신뢰도 ↑
```

**핵심**: 두 시그널 결합이 단일 시그널 보다 거의 항상 우월. 단점은 인프라 복잡성 + 계산 비용.

---

## 6. 흔한 함정 7가지

| # | 함정 | 실제 |
|---|---|---|
| 1 | "MLT 가 단순 추천에 충분" | 의미 유사도 못 잡음. 모델명 / 정확 키워드 가 아니면 dense 가 우월. |
| 2 | "Dense vector 가 항상 MLT 보다 좋다" | 정확 매칭 (제품 모델명 등) 에는 BM25 강함. Hybrid 가 최고. |
| 3 | "MLT 결과를 dense 로 대체하면 cold-start 동일" | 둘 다 cold-start 안전 (텍스트만 있으면 OK). 차이는 의미 매칭 품질. |
| 4 | "다국어 추천에 multilingual BERT 한 모델 충분" | 언어별 fine-tuning 권장. 한국어는 KLUE-RoBERTa, 영어는 별도. |
| 5 | "Hybrid score 의 α, β 가 0.5 default 충분" | A/B 테스트로 튜닝 필수. 도메인마다 sweet spot 다름. |
| 6 | "공통 코드 + 분리 DAG 이 over-engineering" | 도메인별 SLA / 모니터링 필요하면 표준 패턴. 산업 검증. |
| 7 | "morelike-com/offer 코드 동일 = 버그" | 의도된 운영 분리. 단 동기화 안티패턴은 별도 — 공통 라이브러리로 해결. |

---

## 7. 꼬리 질문 (§26 면접 카드 후보)

1. **MLT 의 TF-IDF 한계가 의미 유사도에서 어떻게 드러나나?**
   - 답: "프랑스 파리 와인 시음" vs "Bordeaux winery tasting" — 공통 토큰 없음 → MLT score 낮음 (그러나 의미는 같음). 다국어 / 동의어 / 짧은 텍스트에서 약함. Dense vector 가 의미 임베딩으로 해결.

2. **Hybrid Search (BM25 + Dense) 가 단일 시그널보다 우월한 이유는?**
   - 답: 두 시그널이 보완 관계. BM25 — 정확 매칭 (제품 모델명) 강함. Dense — 의미 매칭 (자연어 검색) 강함. 결합 시 두 시나리오 모두 좋은 결과. ES 8.x 의 knn + bm25 native 지원.

3. **morelike-com / morelike-offer 가 코드 동일 + DAG 분리인 이유는?**
   - 답: 운영 분리 — 도메인별 SLA / 모니터링 / 스케줄 / 자원 독립. 단점은 코드 동기화 부담. 산업 표준 개선 — 공통 라이브러리 + 분리 DAG + 도메인별 config.

4. **언제 MLT 가 Dense Vector 보다 적합한가?**
   - 답: (1) 정확 매칭 우선 (제품 모델명, 시리얼 번호), (2) 인프라 비용 제약 (임베딩 모델 학습 부담), (3) 설명 가능성 필요 ("이 단어가 매칭"), (4) 빠른 prototype. 일반 콘텐츠 추천은 Dense 또는 Hybrid 가 우월.

5. **추천 임베딩 모델의 정기 재학습 주기는?**
   - 답: 도메인 drift 속도에 따라. 콘텐츠 추천 (트렌드 빠름) — 주 1회. 일반 상품 — 월 1회. 안정 도메인 — 분기 1회. 신상품 추가 비율 + A/B 메트릭 monitor 로 결정. 재학습 시 모든 기존 임베딩 재계산 필요.

---

## 8. cross-ref

| 주제 | 연결된 study |
|---|---|
| BM25 / TF-IDF / MLT | #19 §06, §07 |
| Hybrid Search (BM25 + Dense) | #19 §07 |
| Sentence-BERT 임베딩 | §09 |
| ANN 인덱스 | §10 |
| 공통 라이브러리 + 분리 DAG | Phase 10 §21 (msa 모듈 설계) |
| GitOps 코드 sync | #11 K8s GitOps |
| Two-Tower retrieval | Phase 6 §13 |
