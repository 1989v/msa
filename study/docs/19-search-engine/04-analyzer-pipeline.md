---
parent: 19-search-engine
seq: 04
title: Analyzer 파이프라인 — Char Filter / Tokenizer / Token Filter, search_analyzer 분리
type: deep
created: 2026-05-03
---

# 04. Analyzer 파이프라인

## 1. 한 줄 핵심

> **검색 품질의 1차 결정 요소는 BM25 (Best Match 25) 가 아니라 analyzer 다.**
> 인덱싱 analyzer 와 검색 analyzer 가 어긋나면 어떤 BM25 튜닝도 의미 없다.

## 2. Analyzer = 텍스트 → 토큰 변환 파이프라인

```
원본 텍스트
    │
    ▼
┌──────────────────────────────────────┐
│  Step 1: Character Filter (0개 이상)  │  HTML 제거, 문자 매핑
└──────────────┬───────────────────────┘
               ▼
┌──────────────────────────────────────┐
│  Step 2: Tokenizer (정확히 1개)       │  텍스트 → 토큰 분할
└──────────────┬───────────────────────┘
               ▼
┌──────────────────────────────────────┐
│  Step 3: Token Filter (0개 이상)      │  소문자/stopword/형태소 등
└──────────────┬───────────────────────┘
               ▼
        최종 토큰 리스트
```

이 토큰들이 inverted index 의 term 이 된다 (§03).

## 3. Char Filter — 텍스트 전처리

토크나이징 **전에** 문자 단위 변환.

### 3-1. 표준 char filter

| 종류 | 용도 | 예시 |
|---|---|---|
| `html_strip` | HTML 태그 제거 | `"<p>hello</p>"` → `"hello"` |
| `mapping` | 문자 치환 | `&` → `and`, 이모지 제거 |
| `pattern_replace` | 정규식 치환 | URL 패턴 정규화 |

### 3-2. 사용 시점

- 사용자 입력에 HTML 섞임 (CMS, 게시판) → `html_strip`
- 특정 기호 통일 (예: 전각/반각 한자, 따옴표) → `mapping`
- URL / 전화번호 / 주민번호 같은 의미 단위 보존 → `pattern_replace`

### 3-3. 주의

- char filter 는 **Tokenizer 가 보는 입력을 바꿈** → 매핑 잘못하면 토큰 자체가 달라짐
- char filter 의 잘못은 매핑 변경 후 reindex 필요

## 4. Tokenizer — 분할 규칙

정확히 1개 사용. 토큰의 **경계**와 **속성** (시작 위치, 길이, type) 결정.

### 4-1. 표준 tokenizer

| Tokenizer | 분할 기준 | 결과 (`"갤럭시 폴드 스마트폰"`) |
|---|---|---|
| `standard` | Unicode word boundary | `[갤럭시, 폴드, 스마트폰]` |
| `whitespace` | 공백만 | `[갤럭시, 폴드, 스마트폰]` |
| `keyword` | 분할 없음 | `[갤럭시 폴드 스마트폰]` (1개) |
| `pattern` | 정규식 | 사용자 정의 |
| `ngram` | 모든 N-gram | `[갤, 갤럭, 갤럭시, 럭, 럭시, ...]` |
| `edge_ngram` | prefix N-gram | `[갤, 갤럭, 갤럭시, 폴, 폴드, ...]` (자동완성용) |
| `nori_tokenizer` | 한국어 형태소 | `[갤럭시, 폴드, 스마트, 폰]` (decompound) |

### 4-2. 한국어 의미 단위 분할은 standard 가 부족

`"한국어형태소분석기"` 를:
- `standard` → `[한국어형태소분석기]` (분할 없음! 한 단어로 인식)
- `nori_tokenizer` → `[한국어, 형태소, 분석기]` (mecab-ko-dic 사전 기반)

→ 한국어는 `nori_tokenizer` 가 사실상 표준 (자세한 nori 는 §05).

### 4-3. ngram vs edge_ngram

| 종류 | 용도 | 인덱스 크기 |
|---|---|---|
| `ngram` | 부분 문자열 검색 (substring) | 폭증 |
| `edge_ngram` | 자동완성 (prefix) | 적당히 큼 |

`edge_ngram` 으로 자동완성 인덱싱:
```
"갤럭시" → [갤, 갤럭, 갤럭시]
검색 "갤럭" → "갤럭" term 매칭 → 즉시 결과
```

→ ES 8+ 에서는 `search_as_you_type` 필드 타입이 더 권장 (자동 처리).

## 5. Token Filter — 토큰 변환

여러 개 chain 가능. 순서 중요.

### 5-1. 핵심 token filter

| Filter | 용도 | 예시 |
|---|---|---|
| `lowercase` | 소문자 변환 | `Galaxy` → `galaxy` |
| `uppercase` | 대문자 | `Galaxy` → `GALAXY` |
| `stop` | 불용어 제거 | "the", "a", "은", "는" 제거 |
| `stemmer` | 어간 추출 | `running` → `run` |
| `kstem` | Krovetz stemmer (덜 공격적) | `running` → `run` (단, `goes` 유지) |
| `synonym` | 동의어 확장 | `[handphone, mobile]` 동시 색인 |
| `asciifolding` | 악센트 제거 | `naïve` → `naive` |
| `ngram` (filter) | 토큰 → N-gram | `갤럭시` → `[갤럭, 럭시]` |
| `nori_part_of_speech` | 형태소 품사 필터 | 조사/어미 제거 |
| `nori_readingform` | 한자 → 한글 음 | `漢字` → `한자` |

### 5-2. 순서가 중요한 예

```
[lowercase, stop]   ← OK
[stop, lowercase]   ← stop list 가 소문자 기준이면 작동 X
```

→ stop word 가 소문자로 정의돼 있으면 lowercase 가 먼저.

### 5-3. Synonym filter — 검색 vs 색인 시점 결정

```
synonyms: [
  "handphone, mobile, 휴대폰",
  "TV => television"          // 단방향
]
```

배치 시점:
- **인덱싱 시점**: doc 인덱싱 시 모든 동의어를 함께 색인 → 인덱스 크기 ↑
- **검색 시점** (권장): 검색어 들어올 때 동의어 확장 → 동의어 변경 시 reindex 불필요

ES 권장: `search_analyzer` 에 synonym 두기.

## 6. Built-in Analyzer 와 Custom Analyzer

### 6-1. Built-in (자주 쓰는 것)

| Analyzer | Char Filter | Tokenizer | Token Filter |
|---|---|---|---|
| `standard` (default) | - | standard | lowercase |
| `simple` | - | lowercase | - |
| `whitespace` | - | whitespace | - |
| `keyword` | - | keyword | - |
| `english` | - | standard | lowercase, stop, stemmer |
| `korean` (ES 7+) | - | nori_tokenizer | nori_pos, lowercase |

### 6-2. Custom Analyzer 정의

```json
PUT /products
{
  "settings": {
    "analysis": {
      "char_filter": {
        "html_strip_filter": { "type": "html_strip" }
      },
      "tokenizer": {
        "korean_tokenizer": {
          "type": "nori_tokenizer",
          "decompound_mode": "mixed",
          "user_dictionary": "user_dict.txt"
        }
      },
      "filter": {
        "korean_synonym": {
          "type": "synonym",
          "synonyms_path": "synonyms.txt",
          "updateable": true
        }
      },
      "analyzer": {
        "korean_index_analyzer": {
          "type": "custom",
          "char_filter": ["html_strip_filter"],
          "tokenizer": "korean_tokenizer",
          "filter": ["lowercase", "nori_part_of_speech"]
        },
        "korean_search_analyzer": {
          "type": "custom",
          "tokenizer": "korean_tokenizer",
          "filter": ["lowercase", "nori_part_of_speech", "korean_synonym"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "korean_index_analyzer",
        "search_analyzer": "korean_search_analyzer",
        "fields": {
          "raw": { "type": "keyword" }
        }
      }
    }
  }
}
```

이 예시의 핵심:
- `analyzer` ≠ `search_analyzer` (인덱싱과 검색에 다른 analyzer 적용)
- synonym 은 search_analyzer 에만 → updateable 가능
- multi-field (`name.raw`) 로 keyword 동시 색인

## 7. search_analyzer 분리 — 시니어가 자주 놓치는 패턴

### 7-1. 왜 분리하는가

| 시나리오 | 인덱싱 analyzer | 검색 analyzer |
|---|---|---|
| 동의어 (synonym) | 미적용 (확장 X) | 적용 (확장 O) |
| ngram / edge_ngram | 적용 (모든 prefix 색인) | **미적용** (검색어 그대로) |
| stopword | 적용 | 적용 (일관성) |
| stemmer | 적용 | 적용 (일관성) |

### 7-2. edge_ngram 자동완성의 함정

```
edge_ngram(min=1, max=10):
  "갤럭시" → [갤, 갤럭, 갤럭시]

검색어 "갤럭시" 들어옴:
  - 검색에도 edge_ngram 적용 → [갤, 갤럭, 갤럭시] → 너무 많은 매칭
  - 검색에는 standard 만 → [갤럭시] → 정확 prefix 매칭
```

→ `search_analyzer` 를 standard 로 분리해서 검색어 자체는 그대로 → 인덱스의 `[갤, 갤럭, 갤럭시]` 중 `갤럭시` 와 정확 매칭.

### 7-3. ES 8+ 의 search_as_you_type

ES 가 위 패턴을 자동화한 필드 타입:
```json
"name": { "type": "search_as_you_type" }
```
→ 내부적으로 ngram 변형 + 적절한 search analyzer 자동 설정.

## 8. _analyze API — 분석기 디버깅

검색 품질 디버깅의 90% 가 `_analyze` 로 해결.

### 8-1. 기본 사용

```http
POST /_analyze
{
  "analyzer": "korean_search_analyzer",
  "text": "갤럭시 폴드 신상"
}
```

응답:
```json
{
  "tokens": [
    { "token": "갤럭시", "start_offset": 0, "end_offset": 3, "type": "word", "position": 0 },
    { "token": "폴드",   "start_offset": 4, "end_offset": 6, "type": "word", "position": 1 },
    { "token": "신상",   "start_offset": 7, "end_offset": 9, "type": "word", "position": 2 }
  ]
}
```

### 8-2. 인덱스의 매핑된 analyzer 사용

```http
POST /products/_analyze
{
  "field": "name",
  "text": "갤럭시 폴드 신상"
}
```

→ 해당 필드의 `analyzer` (인덱싱 시점) 적용.

### 8-3. explain 옵션

```http
POST /_analyze
{
  "analyzer": "korean_search_analyzer",
  "text": "<p>갤럭시</p>",
  "explain": true
}
```

→ char filter / tokenizer / 각 token filter 단계별 결과를 보여줌. **검색 품질 디버깅의 표준 도구**.

## 9. 흔한 실수 패턴

### 9-1. text vs keyword 혼동

```json
"category": { "type": "text" }   // ❌ — 정확 매칭 / agg 안 됨
"category": { "type": "keyword" } // ✅
```

→ category, status, tag 등 enum 같은 필드는 무조건 keyword.

### 9-2. analyzer / search_analyzer 어긋남

```
인덱싱: nori (decompound mixed) → "한국어형태소" → [한국어, 형태소, 한국어형태소]
검색:   standard → "한국어형태소" → [한국어형태소]
```

→ 검색 토큰은 인덱스에 매칭되지만 **decompound 된 부분 매칭은 누락**. search_analyzer 도 nori 로.

### 9-3. mapping 변경 시 reindex 안 함

```
PUT /products/_mapping
{ "properties": { "name": { "type": "text", "analyzer": "korean" } } }
```

→ **기존 doc 은 옛 analyzer 로 색인됨** (불변). 새 doc 만 새 analyzer 적용. 일관성 깨짐.
→ 해법: 새 인덱스 생성 + reindex + alias swap (§13).

### 9-4. token filter 순서 실수

```
[stop (소문자 기준), lowercase]   ❌
[lowercase, stop]                 ✅
```

→ `_analyze + explain` 으로 단계별 확인 필수.

### 9-5. char filter 의 영향 무시

```
char_filter: html_strip
text: "<a href='https://...'>구매</a>"
```

→ URL 도 같이 사라짐. 의도면 OK, 아니면 mapping char filter 로 보존.

## 10. 운영 시 분석기 변경 절차

분석기 변경은 **사실상 reindex**. 절차:

1. 새 인덱스 생성 (변경된 analyzer 적용)
2. `_reindex` API 또는 외부 reindexer (Kafka 재처리)
3. 인덱싱 완료 후 alias swap (`POST /_aliases` atomic)
4. 옛 인덱스 삭제 (또는 읽기 전용 보관)

→ msa 는 `search:batch` 가 이 패턴. §13 참고.

## 11. msa 시사점

`search` 서비스의 매핑 설계 시 점검 포인트:

| 항목 | 확인 |
|---|---|
| 한국어 필드에 `nori` 또는 한국어 analyzer 적용? | text 만 쓰면 standard → 한국어 부분 매칭 깨짐 |
| `analyzer` ≠ `search_analyzer` 분리? | synonym 있으면 분리, 없으면 동일해도 OK |
| keyword 가 필요한 필드 (category, status) 가 text 로 돼있지 않은가 | 정확 매칭 / sort / agg 가능한지 |
| multi-field (`name`, `name.raw`) 패턴 | text + keyword 동시 색인의 표준 |
| sort / agg 용 필드의 `doc_values: true` | default true, 명시적으로 false 면 의도 확인 |

→ §15 에서 search 코드 직접 검증.

## 12. 자주 듣는 오해 정정

> **"text 와 keyword 의 차이는 길이다"**

- ❌ analyzer 적용 여부. text = analyzed (토큰화), keyword = not analyzed (그대로).

> **"analyzer 는 인덱싱 시점에만 적용된다"**

- ❌ 검색 시점에도 적용 (search_analyzer 가 따로 없으면 같은 analyzer). 따라서 검색어도 토큰화되어 매칭.

> **"한국어는 standard analyzer 로도 된다"**

- ⚠ 띄어쓴 부분만 토큰. "한국어형태소분석기" 같은 복합어는 1 토큰 → 부분 검색 불가. nori 필요.

> **"synonym 은 인덱싱 시점에 적용해야 한다"**

- ⚠ 두 방식 다 있음. 권장은 search_analyzer 에 → 동의어 변경 시 reindex 불필요.

> **"mapping 만 바꾸면 기존 doc 도 새 analyzer 적용된다"**

- ❌ 기존 doc 는 인덱싱 당시의 토큰 그대로. reindex 필수.

> **"_analyze 결과가 검색 결과와 항상 같다"**

- ⚠ search_analyzer 가 다르면 토큰이 다를 수 있음. `field` 옵션으로 정확한 analyzer 확인.

## 13. 다음 학습

- [05-korean-morphology-nori.md](05-korean-morphology-nori.md) — 한국어 analyzer 의 결정판 nori
- [06-tf-idf-bm25-scoring.md](06-tf-idf-bm25-scoring.md) — analyzer 가 만든 토큰이 BM25 의 입력
- [07-query-dsl-patterns.md](07-query-dsl-patterns.md) — match query 의 내부 동작 (analyzer + postings 매칭)
- [13-indexing-pipeline-ilm.md](13-indexing-pipeline-ilm.md) — analyzer 변경 시 reindex 절차

> **§04 회독 체크리스트**:
> - [ ] analyzer 3단계 (char filter / tokenizer / token filter) 와 각 단계 역할
> - [ ] `analyzer` 와 `search_analyzer` 를 분리하는 시나리오 2가지 (synonym, edge_ngram)
> - [ ] `_analyze` API 의 사용 패턴 (analyzer 지정 / field 지정 / explain)
> - [ ] text vs keyword 의 차이를 analyzer 관점에서 답한다
> - [ ] mapping 변경 시 reindex 가 필요한 이유
> - [ ] token filter 순서가 결과에 영향 미치는 이유
