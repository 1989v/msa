---
parent: 19-search-engine
seq: 21
title: 보강 Q&A — Two-Phase Lookup 가격 필터 / Refresh-Translog 단계별 / Segment 증가 패턴
type: followup
created: 2026-05-04
updated: 2026-05-04
related: [01-search-overview.md, 02-lucene-internals.md, 15-msa-search-grounding.md]
---

# 21. 보강 Q&A

> 19 ES 스터디 완료 후 던진 추가 질문 모음. 기존 §01 §02 §15 의 내용을 한 단계 더 풀어 쓴다.

---

## Q1. Two-Phase Lookup — 가격 필터를 복합으로 걸 경우는?

### 질문의 전제

§01 §15 ADR 후보 1: "변동성 큰 필드 (가격/재고) 는 ES 색인 ❌, RDB 에서 fetch (Two-Phase Lookup)."

→ 그러면 **사용자 검색에서 `price >= 10000 AND price <= 30000 AND brand = 'X'` 같은 복합 필터** 는 어떻게 푸나?

### 핵심 답변

**원칙은 절대 명령이 아니라 트레이드오프 가이드** 다. "가격 필터가 검색 UX 의 핵심" 이면 ES 색인을 유지하고, 변경 빈도와 색인 lag SLA 를 같이 설계한다. 결정 축은 두 개:

1. **가격 변경 빈도** (Δprice / second)
2. **가격 필터의 비즈니스 임팩트** (검색 결과 정렬/필터에 필수냐)

이 둘의 조합으로 4가지 풀이가 나온다.

### 4 가지 풀이

#### 풀이 A — ES 에 색인 유지 + Eventually Consistent (EC, 최종 일관성) (가장 흔함)

- 가격을 ES 에도 색인. range filter / sort 모두 ES 에서 처리.
- 가격 변경 시 `_update` (partial update) 로 매핑 유지하며 변경 전파.
- 색인 lag SLA (Service Level Agreement, 서비스 수준 협약) 명시 (예: P99 (99th Percentile) < 5s), 사용자에게 stale 가격 노출 가능성 인지.
- **언제**: 가격 변경 < 검색 빈도, 또는 `상품 자체 등록/품절` 이 더 자주 일어나는 도메인.
- **함정**: ES partial update 는 결국 "delete 옛 doc + insert 새 doc" — segment 에 tombstone + 새 doc 가 쌓여 merge 비용 ↑. 1 분에 수만 건 가격 변경 시 IO (Input/Output) 폭증.

#### 풀이 B — Bucketed Price (가격대 구간 색인)

- ES 에는 `price_bucket: "10k-30k"` 같은 구간 keyword 만 색인.
- range filter 는 클라이언트가 bucket 으로 변환 (`10000 ~ 30000` → `["10k-30k"]`).
- 정밀 필터는 RDB 후처리, 또는 bucket 정밀도를 충분히 잘게 (예: 1000원 단위 → 100k bucket).
- **언제**: 가격이 매우 자주 변하지만 사용자 UX (User Experience) 가 "가격대 슬라이더" 정도의 정밀도면 충분할 때.
- **장점**: bucket 이 안 바뀌면 ES update 없음 → 인덱싱 부하 0.
- **단점**: bucket 경계 ($9999 vs $10001) 에서 이상하게 보일 수 있음.

#### 풀이 C — Two-Phase + Over-fetch + RDB 후처리

```
ES: keyword 매칭 + 점수 → top N 개 ID (예: N=1000)
    ↓
RDB: WHERE id IN (...) AND price BETWEEN 10000 AND 30000 AND brand = 'X'
    → 페이지 단위로 page * size 잘라서 응답
```

- ES 는 "관련성 + 일부 stable filter" 만 (brand 같은 변동성 ↓ 필드).
- 가격/재고 정밀 필터 + 정렬 (가격 오름차순) 은 RDB.
- **함정**:
  - 페이지네이션 깨짐 — 1000 개 over-fetch 했는데 가격 필터로 50 개만 살아남으면 다음 페이지가 없음.
  - 정렬 불일치 — ES 점수 순서와 RDB 가격 정렬이 충돌.
- **언제**: 가격 정밀도가 매우 중요하고 (실시간 가격 비교 사이트), 검색 결과가 보통 좁은 도메인 (수백 ~ 수천 건) 일 때.

#### 풀이 D — Runtime Field (ES 7.11+) / Script Field

- ES (Elasticsearch) 의 `runtime_field` — **색인 시점이 아니라 쿼리 시점에 값 계산**.
- 외부 source (Painless script + lookup) 로 가격 계산 가능.
- **장점**: 색인 안 해도 됨, 가격 변경이 실시간 반영.
- **단점**: 쿼리 시점 비용 ↑ — 매 요청마다 모든 hit 에 대해 script 실행. 대용량 결과 집합에서 latency 폭증.
- **언제**: 가격 변경 빈도 극단적, 검색 결과 집합이 작을 때 (관리자 도구 등). 사용자 검색에는 비추.

### msa 적용 가이드

`product/ProductDocument` 현재 `price` 색인됨 (§15 점검 1).

| 시나리오 | 권장 풀이 |
|---|---|
| 가격 변경 < 일 1회 (일반 커머스) | A — 그대로 두고 색인 lag SLA 만 명시 |
| 핫딜/타임세일 — 시간 단위 변경 | A + bulk_update 묶음 처리 (분 단위 batch) |
| 분 단위 가격 변동 (항공/숙박) | B — bucket 색인, 정밀은 RDB |
| 초 단위 (실시간 경매/주식) | C 또는 D — ES 는 ID 검색만, 가격은 RDB read replica |
| 검색 결과 1만 건 + 가격 정렬 필수 | A 강제 — C 는 페이지네이션 망가짐 |

→ msa 의 `product` 도메인은 일반 커머스 → **풀이 A** 유지가 합리적.
→ ADR (Architecture Decision Record, 아키텍처 결정 기록) 후보 1 의 결론: "**색인 유지 + 색인 lag P99 SLA + Δprice 모니터링**" 으로 풀어야지, "ES 에서 빼라" 가 아니다.

### 면접 한 줄 답변

> "절대 안 빼는 게 정답이 아니라, 변경 빈도 / 필터 임팩트 / 색인 lag SLA 셋의 트레이드오프입니다. 일반 커머스라면 가격을 ES 에 두고 partial update + 색인 lag P99 SLA 명시가 표준이고, 분/초 단위 변동이면 bucket 색인이나 Two-Phase + RDB 후처리로 갑니다."

---

## Q2. Refresh 와 Translog 의 관계 — 단계별

§02 5-4 의 표를 시간축으로 풀어 쓴다.

### 시간축 시나리오 (단일 doc 인덱싱 기준)

```
T+0ms: POST /products/_doc/123 { "name": "iPhone" }
       │
       ├─→ in-memory indexing buffer 에 doc 추가
       │   상태: 검색 ❌ / 디스크 ❌
       │
       └─→ translog (Transaction Log, 트랜잭션 로그 — Lucene/ES 의 WAL) 에 append
           상태: 검색 ❌ / translog 디스크 ❌

T+ε  : durability=request 인 경우 (default)
       │
       └─→ translog → 디스크 fsync
           상태: 검색 ❌ / translog 디스크 ✅
                노드 죽어도 복구 가능 (replay)
       (durability=async 면 sync_interval=5s 마다 묶어서 fsync)

T+1s : refresh 발생 (refresh_interval default)
       │
       ├─→ in-memory buffer 의 docs → 새 in-memory segment 빌드
       │   (Lucene 의 mini inverted index 구조 생성)
       │
       ├─→ buffer 비움
       │
       ├─→ IndexReader reopen → 새 segment 까지 보는 view
       │   상태: 검색 ✅ / segment 디스크 ❌ / translog 디스크 ✅
       │
       └─→ translog 는 그대로 (truncate 안 함!)
           이유: in-memory segment 가 사라질 수 있으니 안전망 유지

T+...분: flush trigger (translog 512MB 도달 등)
       │
       ├─→ in-memory segment → 디스크 segment fsync
       │
       ├─→ segments_N 메타파일 갱신 (Lucene commit point)
       │
       └─→ translog truncate (이제 안전망 불필요)
           상태: 검색 ✅ / segment 디스크 ✅ / translog 새로 시작
                완전 안전
```

### 핵심 통찰 4가지

#### 1. Refresh 와 Translog fsync 는 독립

- Refresh = **가시성** 사이클 (default 1s)
- Translog fsync = **내구성** 사이클 (durability=request 면 매 요청, async 면 5s)
- 둘은 같은 timer 가 아니다 — `refresh_interval` 과 `translog.sync_interval` 은 완전히 별개 설정.

#### 2. Refresh 후에도 Translog 는 안 비운다

- 핵심 오해 정정. refresh 가 일어나도 translog 는 truncate ❌.
- 이유: refresh 직후 in-memory segment 는 디스크 ❌ → 노드 죽으면 사라짐 → translog replay 필요.
- **Translog 는 flush (= Lucene commit) 시점에만 truncate**.

#### 3. 노드 재기동 시 복구 흐름

```
재기동 시:
1. 디스크의 segments_N 읽음 → 마지막 flush 시점의 segment 들 로드
2. translog 읽음 → segments_N 이후의 모든 변경 replay
3. replay 결과로 in-memory buffer 재구성 → 새 refresh 로 segment 만듦
```

→ **translog 가 크면 재기동 시간 ↑** → §02 8-4 의 "재기동 너무 김" 문제. 해법: flush_threshold_size 줄이기.

#### 4. WAL (Write-Ahead Log, 선기록 로그) 패턴

- DB (Database) 의 Write-Ahead Log 와 동형:
  - Translog = WAL
  - In-memory buffer / segment = buffer pool / data page
  - Refresh ≠ checkpoint (가시성용일 뿐)
  - **Flush = checkpoint** (data page fsync + WAL truncate)
- 차이점:
  - DB 는 reader 가 buffer pool 에서 MVCC (Multi-Version Concurrency Control, 다중 버전 동시성 제어) view 를 봄
  - Lucene 은 segment 단위 immutable + reader reopen 으로 view 갱신

### 멘탈 모델 — 공장 컨베이어 비유

```
[작업대]      [가시성 검수]    [영구 보관 창고]   [폐기 절차]
buffer  ──→  in-mem segment ──→ on-disk segment ──→ merge
                refresh (1s)      flush (분~)         background

[이력 장부] translog
- 작업대에 올라간 모든 작업을 별도 장부에 기록
- 영구 보관 창고에 들어간 게 확인되면 그 부분 장부 줄긋고 새로 시작
- 화재 (노드 다운) 나면 장부 보고 작업 다시 함
```

- Refresh = **검수대로 옮김** (보이지만 아직 창고 X)
- Translog = **모든 작업을 별도로 기록한 장부**
- Flush = **창고 입고 + 장부 정리**
- 가시성과 안전성을 별도 메커니즘으로 푼 게 핵심.

### 운영 결정에 미치는 영향

| 튜닝 시나리오 | 어디를 건드리나 | 효과 |
|---|---|---|
| 사용자에게 더 빨리 보이고 싶다 | refresh_interval ↓ | 가시성 ↑, segment 폭증 → merge 부하 ↑ |
| 색인 처리량 ↑ (lag 허용) | refresh_interval ↑ (10s, 30s) | 처리량 ↑, 사용자 lag ↑ |
| 노드 다운 시 손실 0 | durability=request | 안전 ↑, latency 약간 ↑ |
| 처리량 극단 ↑ (5s 손실 OK) | durability=async + sync_interval=5s | 처리량 ↑↑, 5s 윈도우 손실 가능 |
| 재기동 시간 단축 | flush_threshold_size ↓ | flush 자주 → 재기동 빠름, IO ↑ |
| Snapshot 직전 안전 | 수동 `_flush` | translog 짧게 → snapshot 일관성 |

### 면접 한 줄 답변

> "Refresh 는 메모리 버퍼를 in-memory segment 로 만들어 검색에 노출하는 가시성 단계, Translog 는 모든 인덱싱 요청을 WAL 로 기록하는 내구성 안전망입니다. Refresh 가 일어나도 translog 는 안 비웁니다 — in-memory segment 는 아직 디스크에 없어서 노드 다운 시 사라지기 때문에, flush 가 일어나야만 translog truncate 가 안전합니다. 이 분리 덕분에 가시성 (1s) 과 내구성 (분 단위 flush) 을 독립적으로 튜닝할 수 있습니다."

---

## Q3. 세그먼트의 데이터는 인덱스당 리프레시할 때 1개씩 증가?

### 짧은 답

**기본적으로 예 — refresh 1번 당 segment 1개 증가. 단 세 가지 단서가 있음:**

1. **buffer 가 비어 있으면 no-op** — 마지막 refresh 이후 인덱싱이 없으면 새 segment 안 만듦.
2. **Shard 단위로 카운트** — 인덱스 = N primary + M replica → 각 shard 가 자기 buffer / segment 를 가짐. refresh 1번에 buffer 가 있는 shard 수만큼 segment 증가.
3. **Background merge 가 동시에 줄임** — Tiered Merge Policy 가 비슷한 크기 segment 들을 합쳐서 segment 수를 다시 줄임. 그래서 단조 증가 ❌.

### 단계별 풀어보기

#### 단일 shard, 인덱싱 진행 중

```
T=0s:   buffer 에 doc 100 개 쌓임
T=1s:   refresh → segment_1 (in-mem) 생성, 검색 ✅
        buffer 비움
T=1.5s: buffer 에 doc 50 개 추가
T=2s:   refresh → segment_2 (in-mem) 생성, 검색 ✅ (segment_1 + segment_2 둘 다 검색)
        buffer 비움
T=2.5s: buffer 에 doc 0 개 (인덱싱 멈춤)
T=3s:   refresh → no-op (buffer 비어 있음, 새 segment ❌)
T=4s:   refresh → no-op
...
```

→ 인덱싱이 계속되면 1초마다 1 segment 증가, 멈추면 증가 멈춤.

#### 인덱스 = 5 shard 일 때

- Refresh 는 **shard-level 동작**. 인덱스에 refresh 명령이 오면 **모든 shard 가 각자 refresh**.
- 각 shard 의 buffer 가 비어 있는지에 따라 segment 가 0~5 개 추가.
- replica shard 도 자체 인덱싱 → primary 와 별개의 segment 가짐 (replica = 단순 복사 ❌, 자기 buffer + translog + segment 보유).

#### 24 시간 인덱싱 시뮬레이션

> "1초마다 refresh 면 86400 segment?"

답: ❌. 다음과 같이 진행:

```
0~1분:   segment 60 개 증가 (1초당 1개)
1분 ~:   Tiered Merge 가 작은 segment 10개를 1개로 합침 → 50 개로 줄어듦
계속:    인덱싱 추가 ↔ merge 가 청소 의 동적 평형
정상 운영: 보통 한 shard 당 segment 수십 ~ 수백 사이로 유지
```

운영 신호:
- `/_cat/segments?v` — 현재 segment 수
- `/_cat/indices?v` 의 `seg.count` — index-level 합계
- segment 가 수천 개로 폭증 → merge 가 따라가지 못함, latency 악화

#### 잘못된 직관 vs 실제

| 잘못된 직관 | 실제 |
|---|---|
| "refresh 마다 +1, 단조 증가" | merge 가 줄여줘서 동적 평형 |
| "인덱스 단위로 segment 1개" | shard 단위로 각자 가짐 |
| "refresh = 새 segment 강제 생성" | buffer 비어 있으면 no-op |
| "force_merge 1 = 영원히 1개" | 새 doc 가 들어오면 다시 새 segment 생성됨 |
| "replica 는 segment 복사받음" | replica 도 자체 인덱싱 → 자기 segment |

### 왜 segment 수가 중요한가

- 검색 = **모든 segment 동시 검색 후 결과 머지**
- segment 수 ↑ → 쿼리 fan-out ↑ → latency ↑
- segment 수 ↓ → merge 비용 ↑ (큰 segment 합치는 IO ↑)
- → **적정선 유지가 운영의 핵심**. Tiered Merge Policy 가 자동 관리.

### 운영 함정

#### 함정 1: refresh_interval=100ms

- 1초에 10번 refresh → 1초에 최대 10 segment 증가
- merge 가 따라가지 못함 → segment 수천 개 → latency 폭증
- §02 안티패턴. refresh_interval 1s 미만 ❌.

#### 함정 2: 단일 doc per request 인덱싱

- 매 요청이 1 doc → 1 segment 단위가 매우 작음
- merge 비용 ↑ (작은 segment 들 정리)
- 해법: **bulk indexing** (수백~수천 doc 묶기) → 같은 refresh 안에 1 segment 로 들어감

#### 함정 3: 너무 많은 작은 shard

- shard = 자기 segment 집합 보유
- shard 100 개 인덱스 → refresh 1번에 최대 100 segment 추가 가능
- §12 의 shard 적정 사이즈 (10~50GB / shard) 가이드와 직결.

### msa 적용 (§02 10 절 보강)

`search:consumer` 의 인덱싱 동작:

```
Kafka product.item.created/updated 이벤트
    ↓
search:consumer 가 batch (예: 1000 건 / 5초) 로 모음
    ↓
ES bulk request
    ↓
ES 의 buffer 에 1000 doc 추가 (각 shard 에 분산)
    ↓
1초 후 refresh → 각 shard 에 segment 1개씩 (5 shard 면 5 segment)
```

→ 5초마다 5 shard × 1 segment = 5 segment / 5초 = 1 segment / sec / index 페이스.
→ Tiered Merge 가 따라잡기 충분. 정상 운영.

대안: bulk 단위를 키우거나 (1만건 / 30초), refresh_interval=10s 로 늘리면 segment 생성 페이스가 더 줄어듦.

### 면접 한 줄 답변

> "예, refresh 1번에 buffer 가 비어 있지 않은 shard 마다 segment 1개씩 생깁니다. 단 단조 증가는 아니고, Tiered Merge Policy 가 background 에서 비슷한 크기끼리 합쳐서 segment 수가 동적 평형을 유지합니다. 그래서 refresh_interval 을 너무 짧게 (예: 100ms) 잡으면 merge 가 따라가지 못해 segment 가 폭증하고 검색 latency 가 악화됩니다 — 1초 default 미만은 안티패턴입니다."

---

## 연결 학습

- §01 5-2 — Two-Phase Lookup 4원칙
- §02 5-4 / 6 / 7 — Refresh / Translog / Flush / Merge 의 분리
- §15 점검 1 — msa product 의 price 색인 점검
- §19 ADR 후보 1 — 변동성 필드 색인 컨벤션
