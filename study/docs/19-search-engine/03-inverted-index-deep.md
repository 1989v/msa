---
parent: 19-search-engine
seq: 03
title: Inverted Index 자료구조 — Term Dictionary / Postings / Skip List, B-Tree 와의 차이
type: deep
created: 2026-05-03
---

# 03. Inverted Index 자료구조

## 1. 한 줄 핵심

> **B-Tree 가 "행을 빨리 찾는" 자료구조라면, Inverted Index 는 "단어가 들어있는 행 집합을 빨리 찾는" 자료구조다.**

RDB 의 인덱스는 row → row, 검색엔진의 인덱스는 term → row set. 비교 대상이 비대칭. 이 비대칭성이 LIKE '%foo%' 가 안 되는 근본 이유.

## 2. Inverted Index = "단어 → 문서 ID 리스트"

### 2-1. 개념

```
원본 documents:
  doc1: "갤럭시 폴드 신상"
  doc2: "갤럭시 워치 할인"
  doc3: "아이폰 신상"
```

Inverted index:
```
term         → postings (doc id 리스트)
─────────────────────────────────────────
"갤럭시"      → [1, 2]
"폴드"        → [1]
"신상"        → [1, 3]
"워치"        → [2]
"할인"        → [2]
"아이폰"      → [3]
```

쿼리 `"갤럭시 신상"` (AND):
- "갤럭시" → [1, 2]
- "신상" → [1, 3]
- 교집합 → [1] ✅

→ **검색 = 두 정렬된 리스트의 교/합집합 연산**. 매우 빠름. RDB 의 `LIKE '%foo%'` 는 모든 row 의 모든 byte 를 스캔해야 함 (Full Table Scan).

### 2-2. 왜 "inverted" 인가

RDB 관점에서 정상 (forward) 인덱스 = "문서 → 단어들":
```
doc1: ["갤럭시", "폴드", "신상"]
doc2: ["갤럭시", "워치", "할인"]
```

검색엔진은 이걸 뒤집어서 "단어 → 문서들":
```
"갤럭시" → [doc1, doc2]
```

→ 단어로 시작해서 문서를 찾는 방향이라 "inverted" (뒤집힌).

## 3. Lucene 의 Inverted Index 자료구조

### 3-1. 3-tier 구조

Lucene 의 inverted index 는 단순 dict 가 아니라 **3개 자료구조의 결합**:

```
┌─────────────────────────────────────────────┐
│  1. Term Dictionary (FST)                    │  ← 메모리
│     "갤" 으로 시작하는 term 빠르게 찾기      │
│     ".tip" 파일                              │
└──────────────┬──────────────────────────────┘
               │ term offset → ".tim" 파일 위치
               ▼
┌─────────────────────────────────────────────┐
│  2. Term Index (".tim" 파일)                 │  ← 디스크 (mmap)
│     term → posting 의 메타 (df, ttf, ptr)    │
└──────────────┬──────────────────────────────┘
               │ postings ptr
               ▼
┌─────────────────────────────────────────────┐
│  3. Postings (".doc", ".pos", ".pay" 파일)   │  ← 디스크 (mmap)
│     문서 ID 리스트 + 위치 + payload          │
│     skip list 로 빠른 traversal              │
└─────────────────────────────────────────────┘
```

### 3-2. Term Dictionary — FST (Finite State Transducer)

- Term 들을 **prefix-shared trie** 형태로 압축한 자동기계
- 메모리에 통째로 올림 (term 검색이 가장 빈번)
- "갤*" 같은 prefix 검색이 매우 빠름 (suggest / completion 의 기반)
- 수십~수백 MB 의 term 도 수 MB 의 FST 로 압축

**왜 hash table 이 아닌가**:
- hash 는 정확 매칭 only — prefix / range 검색 ❌
- FST 는 정렬 순서 + prefix 공유로 메모리 효율 + 다양한 쿼리 가능

### 3-3. Postings — Doc ID + Position + Payload

term 별로 다음 정보 저장:
- **doc id 리스트** (".doc") — 정렬된 doc id 들
- **term frequency** (".doc") — 각 doc 에서 term 등장 횟수 (BM25 의 tf)
- **positions** (".pos") — 각 doc 내 term 의 위치 (phrase query 용)
- **payloads** (".pay") — term 별 부가 정보 (LTR feature 등에 활용)

압축:
- doc id 는 **delta encoding** + **bitpacking** — 정렬돼 있으니 차이값만 저장
- 예: `[100, 102, 105, 110]` → `[100, 2, 3, 5]` → bitpack

### 3-4. Skip List — 빠른 traversal

Postings 가 길면 (수백만 doc) 처음부터 순차 스캔이 비효율. 해법:

```
Postings: [1, 5, 9, 12, 18, 25, 33, 41, 50, 67, 80, 99, ...]
             ▲           ▲            ▲             ▲
Skip list:   1           18           33            67   (매 N 개마다 포인터)
```

쿼리 "doc id ≥ 50 인 것 찾기":
- skip list 에서 67 발견 → 50 < 67 < 99 → 67 직전 블록부터 스캔
- O(log n) 비슷한 효율

→ AND/OR 쿼리에서 두 postings 의 교집합 빠르게 계산 가능.

## 4. B-Tree vs Inverted Index — 시니어 면접 단골

| 축 | B-Tree (RDB) | Inverted Index (Lucene) |
|---|---|---|
| 키 | row 의 column 값 (단일 또는 복합) | **term** (토큰) |
| 값 | row pointer (rowid / PK) | **doc id 리스트** (postings) |
| 구조 | balanced tree, 노드 = 페이지 | term dict (FST) + postings 분리 |
| 정렬 | 키 정렬 | term 정렬 + postings 내 doc id 정렬 |
| 갱신 | in-place 가능 (mvcc) | append-only segment (불변) |
| prefix 검색 | 가능 (`WHERE col LIKE 'foo%'`) | 가능 (FST traversal) |
| suffix / contains 검색 | ❌ (`%foo%` full scan) | **분석기로 토큰화 후 매칭** |
| 점수 | ❌ | ✅ (tf, df, position 활용) |
| 메모리 | leaf 만 메모리 가능 | term dict 통째로 메모리 권장 |
| 수정 비용 | 낮음 (한 leaf 페이지) | 높음 (segment 추가 → merge) |
| 읽기 비용 | O(log n) 트리 traversal | O(log n) FST + O(k) postings 스캔 |

### 핵심 차이

> **B-Tree 는 "정렬된 키" 가 1급, Inverted Index 는 "term + 문서들" 이 1급.**

RDB 의 `WHERE col = 'foo'` 는 트리에서 한 leaf 찾는 일. ES 의 `match: foo` 는 term 찾고 → postings 가져와서 → BM25 점수 계산하고 → 정렬.

### LIKE '%foo%' 가 RDB 에서 안 되는 이유 (정확한 답)

- B-Tree 는 **prefix 정렬** — `'%foo%'` 는 prefix 가 와일드카드라 트리 traversal 불가
- 결과: index 무시 → Full Table Scan
- Inverted Index 는 미리 토큰화 → "foo" 라는 term 으로 직접 lookup

## 5. 다른 자료구조와의 비교

### 5-1. Hash Index

| 축 | Hash | Inverted Index |
|---|---|---|
| 정확 매칭 | ✅ (O(1)) | ✅ (FST O(log n)) |
| Range 검색 | ❌ | ✅ |
| Prefix 검색 | ❌ | ✅ |
| Suggest / 자동완성 | ❌ | ✅ (FST traversal) |

→ Hash 는 정확 매칭만 빠름. 검색에는 부적합.

### 5-2. Trie

- FST 는 trie 의 일종 (압축된 trie + finite-state 정보)
- 일반 trie 보다 메모리 효율 ↑

### 5-3. PostgreSQL GIN (Generalized Inverted Index)

- Postgres 가 array / JSON / FTS 용으로 제공하는 inverted index
- 같은 원리지만 분산 / 분석기 / 점수 / kNN 미지원
- → 작은 규모 FTS 는 GIN 으로 충분, 본격 검색은 ES

## 6. Doc id 의 정체

### 6-1. Doc id 는 segment-local

- doc id = segment 내 0부터 시작하는 정수
- segment 별로 독립 (다른 segment 와 doc id 충돌)
- 검색 결과에 포함되는 `_id` 와 다름:
  - `_id` = 사용자 지정 (또는 자동 UUID), shard-level 유일
  - doc id = Lucene 내부, segment 내 위치 식별자

### 6-2. Update 의 비밀

```
update doc(_id=100, name="갤럭시" → "갤럭시 폴드")
```

내부 동작:
1. 기존 segment 에서 _id=100 의 doc id 를 찾음
2. 해당 doc id 에 **tombstone bit 설정** (삭제 플래그)
3. 새 segment 에 새 doc id 로 새 버전 추가
4. 검색 시 tombstone 인 것 제외
5. merge 시점에 tombstone 실제 제거

→ **update 는 사실 delete + insert**. 그래서:
- 잦은 update = segment 비대 + tombstone 누적
- 평균 업데이트 빈도 ↑ → merge 비용 ↑
- partial update 도 내부적으로 같음 (`_source` reconstruct → reindex)

### 6-3. version_type

- `internal` (default) — ES 내부 version 카운터, 재인덱싱 시 충돌 감지
- `external` — 외부 버전 (예: RDB 의 updated_at timestamp 또는 sequence) 사용
- **분산 인덱싱에서 필수** — Kafka 메시지가 out-of-order 도착해도 옛 버전 무시 가능

```json
PUT /products/_doc/100?version=20260503001&version_type=external
{"name": "갤럭시 폴드", "price": 2400000}
```

→ 같은 doc 의 옛 version 이 도착하면 ES 가 거부 (409 Conflict). 멱등성과 직결 (§14).

## 7. 점수 계산을 위한 추가 통계

inverted index 가 점수 계산을 가능하게 하는 추가 정보:

| 통계 | 의미 | 어디 저장 |
|---|---|---|
| **tf** (term frequency) | doc 내 term 등장 횟수 | postings (.doc) |
| **df** (document frequency) | corpus 내 term 포함 doc 개수 | term dict (.tim) |
| **doc length** | 토큰 개수 | norms (.nvd / .nvm) |
| **avgdl** | 평균 doc length | segment 메타 |
| **position** | 토큰 위치 | positions (.pos) |
| **payload** | 임의 정보 | payloads (.pay) |

→ BM25 가 필요로 하는 모든 정보가 이미 인덱싱 시점에 계산되어 있음. 검색 시 추가 계산 거의 없음 → 빠름.

## 8. 실제 쿼리 흐름

`{"match": {"name": "갤럭시 폴드"}}` 의 내부 동작:

```
1. analyzer 적용: "갤럭시 폴드" → ["갤럭시", "폴드"]
2. 각 term 에 대해:
   - "갤럭시": FST → term offset → postings → [doc1, doc2, ...]
   - "폴드": FST → term offset → postings → [doc1, ...]
3. 두 postings 의 OR (default) 또는 AND (operator: and)
4. 결과 doc 별 BM25 score 계산:
   - tf (postings 에서) × idf (df 에서 계산) × length 보정
5. score 기준 정렬 → top K (default 10)
6. _source 가져오기 (.fdt 파일에서 doc 원본)
7. 응답 조립
```

→ 모든 단계가 segment 별로 병렬 수행 후 머지 (collector 패턴).

## 9. msa 시사점

- product 의 검색 매핑 설계 시 (예시 가정):
  - `name` text + `name.raw` keyword (multi-field)
  - text 는 nori analyzer → inverted index
  - keyword 는 그대로 → 정렬/agg 용
- shard 1개 = 1 Lucene index = 여러 segment
- `_id` 는 product PK 로 명시 — 멱등 인덱싱 + version_type=external 결합 필수

→ §15 에서 실제 매핑 분석.

## 10. 자주 듣는 오해 정정

> **"Inverted Index 는 hash table 이다"**

- ❌ FST (sorted, prefix-shared). hash 면 prefix / range 불가.

> **"하나의 term 의 postings 가 메모리에 다 올라간다"**

- ❌ disk-based, mmap 으로 OS page cache 활용. 자주 쓰는 부분만 RAM 에 머무름.

> **"update 가 in-place 다"**

- ❌ delete (tombstone) + insert. merge 가 실제 정리.

> **"doc id 가 _id 와 같다"**

- ❌ doc id = segment-local 정수. _id = 사용자 지정 (shard-level 유일).

> **"검색 시 모든 doc 의 score 를 계산한다"**

- ❌ postings 에 들어있는 doc 들에 대해서만 + skip list 로 가지치기. 매칭 안 되는 doc 은 아예 무시.

> **"prefix query (foo*) 는 빠르고 wildcard (*foo) 는 느리다"**

- ✅ 정확. prefix 는 FST traversal (빠름), suffix wildcard 는 모든 term 스캔 (느림).

## 11. 다음 학습

- [04-analyzer-pipeline.md](04-analyzer-pipeline.md) — 인덱싱 시점에 어떻게 term 이 만들어지는가 (analyzer 가 inverted index 의 입력)
- [05-korean-morphology-nori.md](05-korean-morphology-nori.md) — 한국어에서 term 추출
- [06-tf-idf-bm25-scoring.md](06-tf-idf-bm25-scoring.md) — postings 의 tf / df 가 어떻게 score 가 되는가
- [07-query-dsl-patterns.md](07-query-dsl-patterns.md) — 쿼리가 inverted index 를 어떻게 활용하는가

> **§03 회독 체크리스트**:
> - [ ] inverted index 가 "term → doc id list" 임을 그릴 수 있다
> - [ ] B-Tree 와의 차이를 3가지 이상 설명할 수 있다
> - [ ] LIKE '%foo%' 가 RDB 에서 안 되는 이유를 자료구조 관점에서 답한다
> - [ ] FST 가 hash 보다 검색에 적합한 이유 (prefix / suggest)
> - [ ] update 가 사실 delete + insert 임을 안다 → tombstone, merge 의 의미
> - [ ] version_type=external 의 용도 (분산 인덱싱 멱등성)
