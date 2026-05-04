---
parent: 19-search-engine
seq: 35
title: function_score modifier — NONE / SQRT / LN1P / LN2P / LOG1P / LOG2P / RECIPROCAL / SQUARE
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 06-tf-idf-bm25-scoring.md
  - 07-query-dsl-patterns.md
  - 09-hybrid-search-rrf.md
  - 15-msa-search-grounding.md
  - 32-specialized-queries.md
sources:
  - https://www.elastic.co/docs/reference/query-languages/query-dsl/query-dsl-function-score-query
  - https://www.elastic.co/docs/reference/elasticsearch/rest-apis/scoring
catalog-row: "§F.function_score-modifier"
---

# 35. function_score modifier — NONE / SQRT / LN1P / LN2P / LOG1P / LOG2P / RECIPROCAL / SQUARE

> 카탈로그 매핑: §99 §F (Scoring/Evaluation) — `★ 신규` → `✅ 커버`.
> 학습 시간 예상: ~1.5h · 자가평가 입구 레벨: B

> §06 6-5 절에서 한 줄로 끝낸 `field_value_factor.modifier` 옵션의 **수식·곡선·0 처리·언제 무엇을 쓰는지** 의 풀 deep file. function_score 튜닝 시 안전한 default 와 위험한 안티패턴을 정리.

---

## 1. 한 줄 핵심

> **modifier 는 raw field 값의 비선형 변환** — 큰 값을 누르고 작은 값을 살리는 "saturation 함수". 0 처리와 0~1 정규화 분포에 따라 **LN2P (= ln(2+x)) 가 가장 안전한 default**, NONE/SQRT 는 0 곱 폭사 위험으로 가드 필요.

---

## 2. 등장 배경 — 왜 modifier 가 필요한가

### 2-1. raw 값을 그대로 쓰면 생기는 문제

`field_value_factor` 는 doc 의 필드 값 (예: `popularity`, `click_count`, `rating`) 을 직접 점수 계산에 쓴다.

```json
{ "field_value_factor": {
    "field": "click_count",
    "factor": 1.0,
    "modifier": "none",
    "missing": 1.0
}}
```

여기서 `click_count` 가 **long-tail 분포** (가장 인기 있는 상품은 10만 클릭, 일반은 10 클릭) 면:

```
상품 A: click=100,000 → score = 100,000 × BM25 (Best Match 25, ES 기본 랭킹 함수)
상품 B: click=10      → score = 10 × BM25

→ A 의 BM25 가 B 보다 만 배 작아도 A 가 1위 — 사실상 BM25 무시.
```

**현상**: 인기도가 검색 의도를 압도 → 사용자가 검색한 키워드 무관하게 인기 상품만 노출.

### 2-2. 해법 — 비선형 압축 (saturation)

큰 값을 누르고 작은 값과의 격차를 줄이는 함수:

```
log(100,000) ≈ 11.5    log(10) ≈ 2.3
sqrt(100,000) ≈ 316    sqrt(10) ≈ 3.16
```

→ A : B 비율이 10,000 : 1 → log 후 5 : 1, sqrt 후 100 : 1 로 압축.
→ BM25 와의 균형이 맞아 검색 키워드 의도가 살아남.

### 2-3. modifier = saturation 함수의 카탈로그

ES 의 `field_value_factor.modifier` 는 자주 쓰는 saturation 함수를 enum 으로 제공한다.

---

## 3. modifier 옵션 전체 카탈로그

ES 가 지원하는 modifier 와 수식. 입력 `x` 는 `factor × field_value`:

| modifier | 수식 | x=0 | x=0.5 | x=1 | x=10 | x=100 | 특징 |
|---|---|---|---|---|---|---|---|
| `NONE` | `x` | 0 | 0.5 | 1.0 | 10 | 100 | 변환 없음 (raw) |
| `LOG` | `log₁₀(x)` | -∞ ⚠️ | -0.301 | 0 | 1.0 | 2.0 | x≤0 발산. 거의 안 씀 |
| `LOG1P` | `log₁₀(1+x)` | 0 | 0.176 | 0.301 | 1.04 | 2.00 | 0 → 0 (0 가드 필요) |
| `LOG2P` | `log₁₀(2+x)` | 0.301 | 0.398 | 0.477 | 1.08 | 2.01 | **0 자동 가드** |
| `LN` | `ln(x)` | -∞ ⚠️ | -0.693 | 0 | 2.30 | 4.61 | x≤0 발산. 거의 안 씀 |
| `LN1P` | `ln(1+x)` | 0 | 0.405 | 0.693 | 2.40 | 4.61 | 0 → 0 (0 가드 필요) |
| `LN2P` | `ln(2+x)` | **0.693** | 0.916 | 1.099 | 2.48 | 4.62 | **0 자동 가드** |
| `SQRT` | `√x` | 0 | 0.707 | 1.0 | 3.16 | 10.0 | 부드러운 압축 (0 가드 필요) |
| `SQUARE` | `x²` | 0 | 0.25 | 1.0 | 100 | 10,000 | **확대 (격차 ↑)** — 거의 안 씀 |
| `RECIPROCAL` | `1/x` | ∞ ⚠️ | 2.0 | 1.0 | 0.1 | 0.01 | 역수 (작은 값 ↑). 0 발산 |

### 3-1. 핵심 그룹

#### "P" 접미사 — Plus N

`1P` / `2P` 는 입력에 +1 또는 +2 를 더한 후 log/ln 적용.

- 목적: `log(0) = -∞` / `ln(0) = -∞` 발산 방지.
- `LN1P` / `LOG1P` (= log(1+x)): `x=0` 이면 `log(1) = 0` — 자동 가드되지만 **결과 0 → score × 0 = 0** (곱 boost_mode 에서 폭사).
- `LN2P` / `LOG2P` (= log(2+x)): `x=0` 이면 `log(2) > 0` — **0 입력도 안전**.

#### LOG vs LN

- `LOG` = base-10 (`log₁₀`)
- `LN` = base-e (자연로그)
- 둘 다 단조 증가 + 압축. **LN 이 LOG 보다 약하게 압축** (`ln(x) ≈ 2.303 × log₁₀(x)` → 같은 입력에 LN 결과가 ~2.3 배).
- 실무 영향: 절대값만 다름, 곱연산 (boost_mode=multiply) 에서는 다른 boost factor 들과 동시에 곱해지므로 절대값 차이는 의미 ↓. **상대 분포** 가 중요.

#### SQRT — 부드러운 압축

- `√x` — 곡선이 위로 휨.
- 0~1 입력: 0~1 출력 유지 + 곡선이 위로 (0.25 → 0.5, 0.5 → 0.707).
- "저품질을 살짝 끌어올리는" 효과.
- `x = 0` → 0, 가드 필요.

#### SQUARE — 확대 (반대 방향)

- `x²` — 큰 값을 더 키움. saturation 의 정반대.
- 격차를 강조하고 싶을 때 (드물게).
- 0~1 입력 → 곡선이 아래로 (0.5 → 0.25, 0.7 → 0.49).

#### RECIPROCAL — 역수

- `1/x` — 작은 값을 ↑.
- `created_at` 의 역수로 "오래된 doc 일수록 ↓" 같은 패턴.
- `x=0` 발산 — 가드 필수.

---

## 4. 0 처리 — 핵심 안전 이슈

### 4-1. 왜 0 처리가 critical 인가

`function_score` 의 **`boost_mode` default 는 `multiply`** (function × query):

```
final_score = BM25_score × function_score
```

함수 값이 0 이면:

```
final_score = BM25_score × 0 = 0
```

→ **해당 doc 의 검색 점수가 0** → 검색 결과에서 사실상 사라짐 (또는 최하위).

### 4-2. modifier 별 0 처리

| modifier | x=0 결과 | boost_mode=multiply 시 영향 |
|---|---|---|
| `NONE` | 0 | **score = 0 — 폭사** ⚠️ |
| `SQRT` | 0 | **score = 0 — 폭사** ⚠️ |
| `LN1P` / `LOG1P` | 0 | **score = 0 — 폭사** ⚠️ |
| `LN2P` / `LOG2P` | log(2) > 0 | 안전 ✅ |
| `LOG` / `LN` | -∞ | **계산 오류 / Underflow** ⚠️⚠️ |
| `RECIPROCAL` | ∞ | **계산 오류 / Overflow** ⚠️⚠️ |
| `SQUARE` | 0 | **score = 0 — 폭사** ⚠️ |

### 4-3. 가드 패턴

#### 옵션 A: `range > 0` filter

```json
{
  "function_score": {
    "query": { ... },
    "functions": [
      {
        "filter": { "range": { "click_count": { "gt": 0 } } },
        "field_value_factor": { "field": "click_count", "modifier": "log1p" }
      }
    ]
  }
}
```

→ click_count > 0 인 doc 에만 function 적용. 0 인 doc 은 BM25 만으로 점수.

#### 옵션 B: `missing` 옵션

```json
{ "field_value_factor": {
    "field": "click_count",
    "modifier": "log1p",
    "missing": 1
}}
```

→ 필드가 **없을 때만** missing 값 사용. 필드가 있고 값이 0 이면 여전히 폭사.

#### 옵션 C: LN2P / LOG2P 사용 (자동 가드)

```json
{ "field_value_factor": {
    "field": "click_count",
    "modifier": "ln2p"
}}
```

→ `ln(2 + 0) = ln(2) ≈ 0.693` — 0 입력도 안전. **가드 코드 불필요**.

---

## 5. 0~1 정규화된 featureScore 의 분포 비교

`featureScore` 같은 0~1 정규화된 값을 modifier 에 넣으면:

| modifier | 0 입력 | 0.5 입력 | 1 입력 | 분포 폭 (max/min) | 0 안전 |
|---|---|---|---|---|---|
| `NONE` | 0 | 0.5 | 1.0 | ∞ (0 → 1.0) | ❌ |
| `SQRT` | 0 | 0.707 | 1.0 | ∞ | ❌ |
| `LN1P` | 0 | 0.405 | 0.693 | ∞ | ❌ |
| `LOG1P` | 0 | 0.176 | 0.301 | ∞ | ❌ |
| `LN2P` | 0.693 | 0.916 | 1.099 | **1.59x** | ✅ |
| `LOG2P` | 0.301 | 0.398 | 0.477 | **1.59x** | ✅ |

### 5-1. 분포 폭의 의미

- **1.59x** = 최댓값이 최솟값의 1.59 배 — 미세 조정 (BM25 의 hard pin 거의 보존)
- **∞** = 0 입력 시 score 자체가 0 으로 폭사

### 5-2. LN2P 와 LOG2P 의 절대값 차이

```
LN2P (ln(2+x)):   0.693 ~ 1.099  (range ≈ 0.41)
LOG2P (log(2+x)): 0.301 ~ 0.477  (range ≈ 0.18)

LOG2P / LN2P ≈ 0.434 (= 1/ln(10))
```

→ **boost_mode = multiply 에서는 절대값보다 상대 분포가 중요** → 둘 다 같은 1.59x 비율 → 효과 거의 동일.
→ 차이는 "다른 function 과 어떻게 곱해지는가" 에 따라. 다른 function 이 절대값 큰 boost (예: weight=10) 면 LOG2P 의 작은 절대값이 묻힐 수 있음.

### 5-3. featureScore = 0 인 doc 처리 (구체 시나리오)

```
featureScore: 신상품도 = 1.0, 오래된 상품 = 0.0

NONE: 오래된 상품 score × 0 = 0 → 검색 결과에서 사라짐 ⚠️
SQRT: 동일 ⚠️
LN1P: 동일 ⚠️
LN2P: 0 → ln(2) = 0.693 → 신상품 (1.099) 의 63% — 표시됨 ✅
LOG2P: 0 → log(2) = 0.301 → 신상품 (0.477) 의 63% — 표시됨 ✅
```

→ **0 입력이 정상 도메인 케이스** (예: 신상품 boost 에서 오래된 상품의 score=0) 라면 **LN2P / LOG2P 가 사실상 강제**.

---

## 6. 곡선 시각화 (ASCII)

```
y
↑
│
│ NONE         /
│            /
│           /
│         /  SQRT
│       /  ___
│     /__/
│   //   ___ LN2P
│  /   __/    ___ LOG2P
│ /  __/   __/
│/_/____/
└────────────────────→ x
0  0.5  1   2    5   10
```

- NONE: 직선 (45°)
- SQRT: 위로 휜 부드러운 곡선
- LN2P: 강한 압축 + y축 절편 ln(2) ≈ 0.693
- LOG2P: 가장 강한 압축 + y축 절편 log(2) ≈ 0.301

---

## 7. 의사결정 가이드 — 무엇을 쓸까

### 7-1. 입력 도메인별

| 입력 분포 | 추천 modifier | 이유 |
|---|---|---|
| **0~1 정규화 featureScore** | **LN2P** (default) | 1.59x 압축 + 0 자동 가드 + 직관적 절대값 |
| 클릭/조회 long-tail (0~10만) | LOG1P + range>0 가드 | 강한 압축 필요, 0 doc 은 filter 로 분리 |
| rating (1~5) | LN1P | 미세 압축 (5→1.79, 1→0.69), 1 이상 보장 |
| popularity score (0~100) | LN2P 또는 SQRT | LN2P 면 안전, SQRT 면 분포 약압축 |
| 가격 / 거리 (역수 효과 원함) | RECIPROCAL + range>0 | 작은 값 ↑ |
| price 직접 정렬 | NONE + functions × multiplier 조합 | 비선형 ❌ — sort 가 더 적합 |

### 7-2. boost_mode 별

| boost_mode | 함수값 의미 | modifier 선택 |
|---|---|---|
| `multiply` (default) | 곱셈 — 상대 비율 | LN2P/LOG2P (0 안전) |
| `sum` | 덧셈 — 절대값 | NONE/LN1P (0 도 OK) |
| `replace` | 대체 — 절대값 | 도메인 의존 |
| `min` / `max` | 한쪽만 | 도메인 의존 |

### 7-3. score_mode (여러 function 결합) 별

여러 function 의 결과를 어떻게 합칠지:

| score_mode | 의미 | modifier 영향 |
|---|---|---|
| `multiply` | function 들 곱 | 한 function 이 0 이면 폭사 → LN2P 강력 추천 |
| `sum` | function 들 합 | 0 도 OK |
| `avg` | function 들 평균 | 비교적 안전 |
| `max` / `min` | 한쪽 | 안전 |

---

## 8. 안티패턴

### 8-1. NONE + multiply + 분산 큰 필드

```json
{ "field_value_factor": { "field": "click_count" } }
// boost_mode = multiply (default)
```

- 1억 클릭 doc 와 0 클릭 doc 격차 = 1억 배.
- BM25 의미 사라짐. 검색 키워드 무시되고 인기상품만.
- **반드시 saturation modifier 적용**.

### 8-2. SQRT 로 0 가드 안 함

```json
{ "field_value_factor": { "field": "rating", "modifier": "sqrt" } }
```

- rating 이 0 인 doc 의 score → 0 → 검색 결과 사라짐.
- 신규 상품 (아직 rating 0) 이 노출 안 됨.
- **range>0 가드 또는 LN2P 사용**.

### 8-3. SQUARE 로 격차 확대

```json
{ "field_value_factor": { "field": "popularity", "modifier": "square" } }
```

- 격차 확대 = saturation 정반대.
- 인기상품이 검색 키워드 무시하고 1등.
- 거의 안 씀.

### 8-4. log_method 가 LN/LOG (P 없는 raw)

```json
{ "field_value_factor": { "field": "x", "modifier": "log" } }
```

- `x = 0` 또는 `x < 0` → `-∞` 또는 NaN.
- 8.x 에서 ES 가 명시적 에러 또는 0 반환 (구현 의존).
- **항상 1P/2P 변형 사용**.

### 8-5. weight 와 modifier 혼동

```json
{
  "field_value_factor": { "field": "x", "modifier": "ln2p" },
  "weight": 0.1
}
```

- `weight` 는 함수 결과의 곱 — modifier 후 적용.
- `weight × modifier(x)` = `0.1 × ln(2+x)`.
- 단순 곱이라 분포 폭은 그대로 1.59x — weight 는 다른 function 과의 균형 조정용.

### 8-6. boost_mode=multiply + 0 가능 + LN1P

```json
{
  "function_score": {
    "query": { ... },
    "field_value_factor": { "field": "click_count", "modifier": "ln1p" },
    "boost_mode": "multiply"
  }
}
```

- click_count = 0 → ln(1) = 0 → BM25 × 0 = 0 → 검색 사라짐.
- **LN2P 로 변경 또는 boost_mode=sum**.

### 8-7. modifier 만으로 신상품 boost

- click_count modifier 만으로는 신상품 (click=0) 이 항상 하위.
- 신상품 boost 는 별도 `gauss(created_at)` decay function 으로.

---

## 9. ES 의 modifier 와 OS (OpenSearch) 의 차이

### 9-1. 옵션 가용성

| modifier | ES 8.x | OpenSearch 3.x |
|---|---|---|
| NONE | ✅ | ✅ |
| LOG / LOG1P / LOG2P | ✅ | ✅ |
| LN / LN1P / LN2P | ✅ | ✅ |
| SQRT | ✅ | ✅ |
| SQUARE | ✅ | ✅ |
| RECIPROCAL | ✅ | ✅ |

→ 양쪽 모두 동일. Lucene 기반이라 거의 동일 enum.

### 9-2. Java 클라이언트 enum

ES Java client (`co.elastic.clients`):
```java
FieldValueFactorModifier.Log1p
FieldValueFactorModifier.Ln2p
FieldValueFactorModifier.Sqrt
FieldValueFactorModifier.None
```

OpenSearch Java client:
```java
FieldValueFactorModifier.LOG1P
FieldValueFactorModifier.LN2P
// ...
```

- 케이스/네이밍 차이 — migration 시 확인 필요.

---

## 10. msa 적용 (§15 grounding 보강)

### 10-1. 현재 적용 (`product/ProductSearchAdapter`)

`search/app/src/main/kotlin/com/kgd/search/elasticsearch/ProductSearchAdapter.kt:149`:

```kotlin
.modifier(FieldValueFactorModifier.Log1p)
```

→ `popularityScore`, `ctr` 두 함수에 모두 LOG1P 적용 (§15 4-2).

### 10-2. 점검 — featureScore 분포

만약 `popularityScore` / `ctr` 가 **0~1 정규화된 featureScore** 라면:

- 현재 LOG1P → 0 입력이 0 → boost_mode=multiply 면 폭사.
- `popularityScore = 0` 인 신상품 / 클릭 없는 상품이 검색에서 사라짐.

**개선 권장**: LOG1P → **LN2P** 로 교체.

```kotlin
.modifier(FieldValueFactorModifier.Ln2p)  // 0 자동 가드, 1.59x 압축
```

### 10-3. 점검 — long-tail 분포라면

`popularityScore` 가 0~정수 (예: click_count) 라면:

- LOG1P 도 OK — 단 range>0 filter 로 0 doc 분리.
- 또는 LN2P 로 통일 (0 안전 + 약압축).

### 10-4. ADR 후보 (§19 보강)

> **ADR-XXXX-4: function_score modifier 표준 — featureScore 도메인은 LN2P, raw 카운트는 LOG1P + range>0**

- featureScore (0~1 정규화): LN2P
- raw 카운트 (0~1억): LOG1P + range>0 가드 또는 LOG2P
- rating (1~5): LN1P (1 이상 보장)
- 신상도: gauss decay 별도

---

## 11. 면접 한 줄 답변

### Q. function_score 의 modifier 가 왜 필요한가요?

> "raw 필드 값 (예: click_count) 의 long-tail 분포가 BM25 점수를 압도해서 검색 키워드 의미가 묻히는 걸 방지하기 위해 비선형 압축 (saturation) 을 적용합니다. log/ln 계열이 가장 흔하고, 0 처리 안전성을 위해 LN2P (`ln(2+x)`) 가 default 로 권장됩니다."

### Q. LOG1P 과 LOG2P 의 차이는?

> "둘 다 log(N + x) 형태인데, 1P 는 x=0 이면 결과가 0 (boost_mode=multiply 면 score 폭사), 2P 는 x=0 이면 log(2) > 0 으로 자동 가드됩니다. 즉 0 이 정상 도메인 케이스인 featureScore 같은 입력은 LN2P/LOG2P 가 안전합니다."

### Q. SQRT 와 LN2P 중 무엇을 쓰나요?

> "SQRT 는 곡선이 부드럽게 압축되지만 x=0 이면 0 으로 폭사하므로 range>0 가드가 필요합니다. LN2P 는 0 자동 가드 + 0~1 입력에서 1.59x 압축으로 BM25 의 hard pin 을 거의 보존합니다. 0 이 정상 케이스면 LN2P, 0 doc 을 검색에서 빼도 OK 면 SQRT + 가드 둘 다 가능."

### Q. modifier 의 절대값 차이가 중요한가요?

> "boost_mode=multiply 에서는 상대 분포가 중요하지 절대값은 다른 function/weight 와의 균형 조정 문제입니다. LN2P 와 LOG2P 가 같은 1.59x 압축 비율인 이유로 효과는 거의 동일하고, 다른 boost (gauss, weight) 와의 균형으로 결정합니다."

### Q. boost_mode=multiply 에서 한 function 값이 0 이면 어떻게 되나요?

> "최종 score 가 0 이 되어 검색 결과에서 사실상 사라집니다. 그래서 0 가드가 critical — LN2P/LOG2P 사용, range>0 filter, 또는 boost_mode=sum 으로 전환하는 세 가지 패턴 중 하나가 필요합니다."

### Q. msa 의 search 에는 무엇이 적용돼 있나요?

> "현재 ProductSearchAdapter 가 popularityScore 와 ctr 에 LOG1P modifier 를 쓰는데, featureScore 가 0~1 정규화된 값이면 0 인 doc (신상품 등) 의 score 가 폭사하는 위험이 있습니다. LN2P 로 교체하는 ADR 이 후보로 검토 가능합니다."

---

## 12. 흔한 오해 정정

> **"modifier 는 절대값이 중요하다"**

- ⚠ boost_mode=multiply 에선 상대 분포가 중요. 절대값은 다른 boost 와의 균형 문제.

> **"LOG = log₁₀ 이다"** — 맞음. 단 `ln` 과 헷갈리지 말 것 (ln = base-e).

> **"LN1P 가 0 안전 가드다"**

- ❌ LN1P (= ln(1+x)) 는 x=0 이면 0. 가드 미흡. **LN2P** 가 자동 가드.

> **"SQUARE 로 인기상품 boost"**

- ❌ SQUARE 는 격차를 확대 — saturation 정반대. 검색 키워드 의미 죽음.

> **"missing 옵션이 0 가드를 자동 처리한다"**

- ❌ `missing` 은 **필드가 아예 없을 때만** 발동. 필드가 있고 값이 0 이면 그대로 사용.

> **"LN과 LOG 는 효과가 다르다"**

- ⚠ 절대값만 ~2.3x 차이. 같은 boost_mode=multiply 에서 다른 function 과 함께 곱해질 때 효과는 거의 동일.

---

## 13. 회독 체크리스트

> §35 회독 체크리스트:
> - [ ] modifier 가 왜 필요한가 (long-tail 분포 vs BM25 균형)
> - [ ] NONE / SQRT / LN1P / LN2P / LOG1P / LOG2P / SQUARE / RECIPROCAL 의 수식과 분포 폭
> - [ ] x=0 일 때 각 modifier 의 결과와 boost_mode=multiply 에서의 위험
> - [ ] LN2P 가 0~1 정규화 featureScore 의 default 가 되는 이유 (1.59x + 자동 가드)
> - [ ] LN1P / LOG1P 사용 시 가드 패턴 3가지 (range>0, missing, LN2P 교체)
> - [ ] LN vs LOG 의 절대값 차이 (~2.3x) 가 multiply 에서 의미 ↓ 인 이유
> - [ ] msa 의 ProductSearchAdapter 가 LOG1P 인데 featureScore 분포 점검 필요한 이유

---

## 14. 연결 학습

- §06 6-5 — function_score 함수 종류 (이 파일이 modifier 풀어 씀)
- §07 — query DSL 패턴, function_score 사용 예
- §15 4-2 — msa 의 ProductSearchAdapter modifier 적용 현황
- §32 — rank_feature query (modifier 와 다른 boost 메커니즘)
- §34 — 이 modifier 변경의 효과를 nDCG@10 으로 측정
