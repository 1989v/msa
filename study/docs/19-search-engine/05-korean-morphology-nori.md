---
parent: 19-search-engine
seq: 05
title: 한국어 형태소 — nori vs mecab-ko vs seunjeon, decompound 3-mode, 사용자 사전
type: deep
created: 2026-05-03
---

# 05. 한국어 형태소 분석

## 1. 한 줄 핵심

> **한국어 검색에서 BM25 (Best Match 25) 보다 먼저 잡아야 할 것이 nori 의 decompound mode + 사용자 사전이다.**
> 토큰이 잘못 나오면 어떤 스코어링도 의미 없다.

## 2. 왜 한국어는 형태소 분석이 필요한가

### 2-1. 한국어의 특성

- **교착어** — 어간 + 조사/어미 결합 ("갤럭시를", "갤럭시의", "갤럭시에서")
- **복합어** — 단어 합성으로 새 단어 ("스마트폰" = 스마트 + 폰)
- **한자어 / 외래어 / 신조어** 혼용
- 띄어쓰기가 모호 ("한번 vs 한 번", "되다 vs 돼다")

### 2-2. standard analyzer 의 한계

```
"갤럭시를 검색했더니 폴드가 나왔다"
  → standard: [갤럭시를, 검색했더니, 폴드가, 나왔다]
```

문제:
- "갤럭시" 검색 → 매칭 ❌ (인덱스에 "갤럭시를" 만 있음)
- "검색" 검색 → 매칭 ❌
- 어떤 BM25 도 못 살림

### 2-3. 형태소 분석기 적용

```
"갤럭시를 검색했더니 폴드가 나왔다"
  → nori: [갤럭시, 검색, 하다, 폴드, 나오다]
```

→ "갤럭시", "검색", "폴드" 모두 매칭 가능.

## 3. 한국어 분석기 비교 (시니어 의사결정)

| 분석기 | 사전 | Lucene 통합 | 유지보수 | 라이선스 | ES/OS 번들 |
|---|---|---|---|---|---|
| **nori** | mecab-ko-dic | ✅ (Lucene 공식, 8.x+) | Apache 공식 | Apache 2.0 | ✅ |
| **mecab-ko** | mecab-ko-dic | ❌ (외부 plugin) | 한국 커뮤니티 | LGPL | 직접 설치 |
| **seunjeon** | mecab-ko-dic | ❌ (외부 plugin) | 거의 정지 (2018년 이후) | Apache 2.0 | 직접 설치 |
| **arirang** | 자체 사전 | ❌ | 한국 커뮤니티 | Apache 2.0 | 직접 설치 |
| **OpenKoreanText (Twitter Korean)** | 자체 | ❌ | 거의 정지 | Apache 2.0 | 직접 설치 |

### 3-1. 결정 기준

- **신규 도입**: 무조건 **nori**. Lucene 공식 + ES/OS 둘 다 번들 + 유지보수 활발.
- **기존 seunjeon 운영**: 마이그레이션 검토 (seunjeon 은 사실상 중단)
- **mecab-ko 운영**: 점진 전환 검토 (nori 가 mecab-ko-dic 같은 사전 사용)
- **arirang**: 특수 도메인 (사전 강점) 외에는 비권장

→ 본 문서는 **nori 중심**.

> **[OS 차이]** OpenSearch 도 nori 번들 동일. 사용법 100% 호환. 한국어 분석기는 ES/OS 분기와 무관한 영역.

## 4. nori 의 구조

```
입력 텍스트
    │
    ▼
┌─────────────────────────────────────────┐
│  nori_tokenizer                          │
│  - mecab-ko-dic 기반 형태소 분리         │
│  - decompound_mode 설정                  │
│  - user_dictionary 적용                  │
└─────────────┬───────────────────────────┘
              │ 토큰 + 품사 정보
              ▼
┌─────────────────────────────────────────┐
│  nori_part_of_speech (token filter)     │
│  - 조사/어미/특정 품사 제거              │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│  nori_readingform (선택)                 │
│  - 한자 → 한글 음 변환 (漢字 → 한자)     │
└─────────────┬───────────────────────────┘
              │
              ▼
        최종 토큰
```

## 5. Decompound Mode — 가장 중요한 결정

복합어를 어떻게 처리할지의 3가지 모드.

### 5-1. 세 가지 mode

`"한국어형태소분석기"` 를:

| mode | 결과 | 인덱스 크기 | 검색 hit |
|---|---|---|---|
| `none` | `[한국어형태소분석기]` (1) | 작음 | 정확 매칭만 |
| `discard` | `[한국어, 형태소, 분석기]` (3) | 중간 | 부분 검색 가능, 원형 ❌ |
| `mixed` (default) | `[한국어형태소분석기, 한국어, 형태소, 분석기]` (4) | 큼 | 둘 다 매칭 |

### 5-2. 각 모드의 사용 시나리오

**`none`** — 합성어를 통째로
- 사용 시점: 브랜드명/고유명사가 중요 (예: "삼성전자" 가 "삼성" + "전자" 로 분해되면 곤란)
- 단점: "삼성" 만 검색하면 hit ❌
- 보완: 사용자 사전에 등록 + 다른 필드에 standard 분석

**`discard`** — 분해만
- 사용 시점: 부분 검색이 더 중요, 원형은 다른 필드에 keyword 로 보존
- 단점: 정확 매칭 (원형) 불가
- 흔히 multi-field 와 결합: `name` (discard) + `name.full` (none)

**`mixed`** (default 권장) — 둘 다
- 사용 시점: 일반 이커머스, 게시판 검색의 표준
- 단점: 인덱스 크기 ↑ (보통 +30~50%)
- 가장 무난, 검색 품질 ↑

### 5-3. 시니어 의사결정

> 신규 도입은 **mixed** 부터 시작. 인덱스 크기 / 성능 측정 후 필요시 discard 로 다운그레이드. **none 단독은 거의 없음**.

설정 예:
```json
"tokenizer": {
  "korean_tokenizer": {
    "type": "nori_tokenizer",
    "decompound_mode": "mixed",
    "discard_punctuation": true,
    "user_dictionary": "user_dict.txt"
  }
}
```

## 6. 사용자 사전 (User Dictionary)

### 6-1. 왜 필요한가

mecab-ko-dic 은 일반 사전이라 도메인 신조어/브랜드명 부족:
- "갤럭시폴드" → `[갤럭시, 폴드]` (분리됨, 의도 ❌)
- "당근마켓" → `[당근, 마켓]` (분리)
- "포케그라" → 사전에 없으면 음절 단위 분해 (최악)

### 6-2. 사용자 사전 형식

`user_dict.txt`:
```
갤럭시폴드
당근마켓 당근 마켓
포케그라 포케 그라
삼성전자
NMS
```

각 줄:
- 단일 단어 → 그 자체로 토큰화
- `<원형> <분해1> <분해2>` → mixed 모드에서 사용 (원형 + 분해)

### 6-3. 적용 위치

ES/OpenSearch 노드의 `config/` 디렉토리:
```
config/
├── elasticsearch.yml
├── analysis/
│   └── user_dict.txt   ← 여기
```

매핑에서 참조:
```json
"tokenizer": {
  "korean_tokenizer": {
    "type": "nori_tokenizer",
    "user_dictionary": "analysis/user_dict.txt",
    "user_dictionary_rules": ["갤럭시폴드", "당근마켓"]   // 인라인도 가능
  }
}
```

### 6-4. 운영 — 사용자 사전 변경

- 파일 변경 시 **인덱스 close → open** 필요 (실시간 반영 ❌)
- 또는 새 분석기 정의 + reindex
- 운영 팁: 사용자 사전을 ConfigMap (K8s) 으로 관리, 변경 시 alias swap reindex

### 6-5. msa 운영 시나리오

신상품 출시 시 (예: "갤럭시Z폴드6"):
1. 마케팅에서 신조어 받음
2. user_dict.txt 에 추가 ("갤럭시Z폴드6")
3. ConfigMap 업데이트 + ES pod 재시작 (또는 reindex)
4. 사용자 검색에 즉시 반영

→ 이 절차의 자동화가 검색 운영의 핵심 과제 중 하나.

## 7. nori_part_of_speech — 품사 필터

### 7-1. 품사 코드

mecab-ko-dic 의 품사 태그:
- `J` (조사) — "을/를/이/가/에서"
- `E` (어미) — "다/하다/했/되"
- `IC` (감탄사) — "아/어/우와"
- `MAJ` (접속부사)
- `XSV` (동사 파생 접미사)
- `SF` (마침표)
- `SP` (공백)
- `NNG` (일반 명사) — 보통 살림
- `NNP` (고유 명사) — 보통 살림
- `VV` (동사) — 살리거나 stop
- 등등

### 7-2. 기본 stop tags

```json
"filter": {
  "korean_pos_filter": {
    "type": "nori_part_of_speech",
    "stoptags": ["E", "IC", "J", "MAG", "MAJ", "MM", "SP", "SSC", "SSO", "SC", "SE", "XPN", "XSA", "XSN", "XSV", "UNA", "NA", "VSV"]
  }
}
```

→ 조사/어미/감탄사/공백 등 검색에 무의미한 토큰 제거.

### 7-3. 효과

```
"갤럭시를 검색했다"
  nori_tokenizer: [갤럭시(NNG), 를(JKO), 검색(NNG), 하(XSV), 았(EP), 다(EF)]
  + nori_part_of_speech: [갤럭시, 검색]
```

→ 조사/어미 제거로 토큰 간결 + 검색 정확도 ↑.

## 8. nori_readingform — 한자 처리

```
"漢字 검색"
  nori_tokenizer: [漢字, 검색]
  + nori_readingform: [한자, 검색]
```

→ 한자를 한글 음으로 변환. 한자 입력으로 검색해도 한글 색인과 매칭.
→ 일본어 ES 의 `kuromoji_readingform` 과 동일 패턴.

## 9. 동의어 (Synonym)

### 9-1. 한국어 동의어 사전

```
synonyms.txt:
폰, 스마트폰, 핸드폰, 휴대폰
TV, 텔레비전, 티비
노트북, 랩탑, laptop
```

### 9-2. 적용

```json
"filter": {
  "korean_synonym": {
    "type": "synonym",
    "synonyms_path": "analysis/synonyms.txt",
    "updateable": true
  }
}
```

→ search_analyzer 에만 두면 동의어 변경 시 reindex 불필요 (`updateable: true` 필수).

### 9-3. 운영

- 동의어는 사용자 사전보다 더 자주 변경됨
- ConfigMap + `_reload_search_analyzers` API 로 reload 가능 (8.x+)

## 10. 검색 품질 디버깅 워크플로우

한국어 검색이 안 될 때 순서:

### Step 1: `_analyze` 로 토큰화 확인

```http
POST /products/_analyze
{
  "field": "name",
  "text": "갤럭시폴드 신상"
}
```

→ 토큰이 의도와 같은가? 다르면:
- decompound mode 잘못
- 사용자 사전 누락
- 잘못된 analyzer 매핑

### Step 2: 검색어도 같은 분석기로

```http
POST /products/_analyze
{
  "field": "name",
  "text": "갤럭시폴드"
}
```

(field 가 search_analyzer 가 정의돼 있으면 그것 적용)

→ 인덱스 토큰과 검색 토큰이 매칭 가능한가?

### Step 3: explain 으로 매칭 분석

```http
GET /products/_search
{
  "explain": true,
  "query": { "match": { "name": "갤럭시폴드" } }
}
```

→ 어느 term 이 매칭됐는지, BM25 score 계산 breakdown.

### Step 4: profile 로 성능 분석

```http
GET /products/_search
{
  "profile": true,
  "query": { ... }
}
```

→ 쿼리 단계별 시간 측정.

## 11. 흔한 실수 패턴

### 11-1. nori 만 깔고 customize 안 함

```
default nori_tokenizer (decompound: discard) + lowercase
```

문제: 조사/어미가 토큰으로 남음 → 검색 정확도 ↓.
해법: nori_part_of_speech 추가 + 사용자 사전 + 도메인에 맞는 decompound mode.

### 11-2. 사용자 사전을 텍스트만 넣음

```
user_dict.txt:
갤럭시폴드
```

→ 단어만 등록. mixed 모드에서 분해 정보 없음.

```
user_dict.txt:
갤럭시폴드 갤럭시 폴드   ← 분해 명시
```

### 11-3. 동의어를 인덱싱 시점에

→ 동의어 변경 시 reindex 필요. search_analyzer 에 두는 게 표준.

### 11-4. 한자/영문 처리 무시

도메인에 한자/영문 섞이면 (예: "iPhone 15") nori 가 별도 처리:
- 영문은 standard tokenizer 처럼 분리
- 한자는 nori_readingform 으로 한글화 검토
- 숫자는 nori 가 보통 잘 처리

### 11-5. mixed mode 의 인덱스 크기 무시

mixed 가 인덱스 ~30-50% 증가. 검색 빈도가 매우 낮은 필드에는 discard 또는 none 검토.

## 12. msa 시사점

`search` 서비스의 product 인덱스 매핑 점검:

```json
PUT /products
{
  "settings": {
    "analysis": {
      "tokenizer": {
        "product_tokenizer": {
          "type": "nori_tokenizer",
          "decompound_mode": "mixed",
          "user_dictionary": "analysis/product_dict.txt"
        }
      },
      "filter": {
        "product_pos_filter": {
          "type": "nori_part_of_speech",
          "stoptags": ["E", "J", "SC", "SE", "SF", "SP"]
        },
        "product_synonym": {
          "type": "synonym",
          "synonyms_path": "analysis/product_synonyms.txt",
          "updateable": true
        }
      },
      "analyzer": {
        "product_index_analyzer": {
          "tokenizer": "product_tokenizer",
          "filter": ["lowercase", "product_pos_filter"]
        },
        "product_search_analyzer": {
          "tokenizer": "product_tokenizer",
          "filter": ["lowercase", "product_pos_filter", "product_synonym"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "name": {
        "type": "text",
        "analyzer": "product_index_analyzer",
        "search_analyzer": "product_search_analyzer",
        "fields": {
          "raw": { "type": "keyword" }
        }
      },
      "category": { "type": "keyword" },
      "price": { "type": "long" },
      "stock": { "type": "long" },           // 변동성 큼 — §15 에서 재검토
      "created_at": { "type": "date" }
    }
  }
}
```

→ §15 에서 실제 매핑과 비교 + 변동성 큰 필드 (price, stock) 가 ES 에 있는지 점검.

## 13. 자주 듣는 오해 정정

> **"nori 와 mecab-ko 는 다른 사전 쓴다"**

- ❌ 둘 다 mecab-ko-dic 기반. nori 는 Lucene 안에 통합 (외부 binary 불필요).

> **"decompound mixed 가 항상 좋다"**

- ⚠ 인덱스 크기 ↑. 검색 빈도 낮은 필드는 discard 검토.

> **"사용자 사전에 단어만 넣으면 mixed 도 동작한다"**

- ❌ 분해 정보 없으면 통째로만 색인. `<원형> <분해>` 형식 명시 필요.

> **"동의어는 무조건 인덱싱 시점에"**

- ❌ search_analyzer 에 두는 게 권장 (변경 시 reindex 불필요).

> **"nori_part_of_speech 는 default 로 충분하다"**

- ⚠ default stoptags 가 있지만 도메인에 맞게 조정 필요. 예: 의류 검색에서 형용사 살리고 싶을 수 있음.

> **"_analyze 결과가 검색 토큰과 항상 같다"**

- ⚠ search_analyzer 가 다르면 다름. `field` 옵션 + `_analyze + explain` 으로 정확히 확인.

## 14. 다음 학습

- [06-tf-idf-bm25-scoring.md](06-tf-idf-bm25-scoring.md) — nori 가 만든 토큰의 tf/df 가 어떻게 score 가 되는가
- [07-query-dsl-patterns.md](07-query-dsl-patterns.md) — match query 에서 nori 가 어떻게 적용되는가
- [13-indexing-pipeline-ilm.md](13-indexing-pipeline-ilm.md) — 사용자 사전 변경 시 reindex 절차
- [15-msa-search-grounding.md](15-msa-search-grounding.md) — msa 의 실제 nori 설정 분석

> **§05 회독 체크리스트**:
> - [ ] decompound mode 3가지 (none / discard / mixed) 의 토큰화 결과를 예시로 답할 수 있다
> - [ ] 사용자 사전이 필요한 시나리오 3가지 (브랜드명, 신조어, 도메인 용어)
> - [ ] nori_part_of_speech 의 stoptag 가 무엇이고 왜 필요한지
> - [ ] 동의어를 search_analyzer 에 두는 이유
> - [ ] 검색 품질 디버깅 4-step (analyze → analyze 검색어 → explain → profile)
> - [ ] nori vs mecab-ko vs seunjeon 의 결정 기준
