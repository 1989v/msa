---
parent: 19-search-engine
seq: 02
title: Lucene 내부 — Segment / Refresh / Translog / Flush / Merge, 가시성 ≠ 내구성
type: deep
created: 2026-05-03
---

# 02. Lucene 내부

> 묶음 1 (B) 약점 정조준. "refresh / flush / commit 의 차이" 는 시니어 검색 면접에서 가장 자주 나오는 질문이고, 운영 중 "왜 색인했는데 검색이 안 되지?" / "왜 ES 가 갑자기 IO 폭증?" 같은 사고의 95% 가 여기서 옴.

## 1. 한 줄 핵심

> **가시성 (search visibility) 과 내구성 (durability) 은 분리되어 있다.**
> Refresh = 가시성, Flush = 내구성, Translog = 둘 사이 안전망, Merge = 청소.

이 한 문장만 외워도 면접 답변의 70% 는 만들 수 있다. 이제 그 안의 메커니즘을 푼다.

## 2. Append-only 의 미학 — Lucene 설계 원리

Lucene 의 모든 설계 결정은 한 가지 원칙에서 출발한다:

> **"한 번 쓴 segment 는 절대 수정하지 않는다."**

### 왜 append-only 인가

- inverted index 의 자료구조 (sorted term dict + postings) 는 수정 비용이 매우 큼 — 한 단어 추가가 여러 페이지 재작성 유발
- 대신 **불변 파일** 로 만들고, 여러 개를 합쳐서 검색하면 됨
- 삭제는 "tombstone bit" 로 표시만, 실제 제거는 merge 시점
- 수정 = 삭제 + 추가

### 효과

| 효과 | 의미 |
|---|---|
| Lock-free 읽기 | 여러 searcher 가 같은 segment 를 동시 읽기 안전 (immutable) |
| 캐시 친화 | 한 번 메모리에 올린 segment 는 재계산 불필요 |
| 복구 단순 | segment 파일 + translog 만 있으면 상태 재구성 |
| OS 페이지 캐시 활용 | mmap 으로 segment 를 OS 가 자동 캐싱 |

### 비용

| 비용 | 의미 |
|---|---|
| 쓰기 amplification | 같은 doc 의 update 가 segment 에 여러 사본 (구버전 + 신버전) |
| 디스크 사용량 | 삭제된 doc 도 merge 전까지 공간 차지 (deletes_pct) |
| Merge IO | background merge 가 IO 점유 (운영 사고 흔한 원인) |

> **멘탈 모델**: Git 이랑 비슷하다. 매 커밋이 불변 객체, 변경은 "새 커밋 + 옛 커밋 무시", GC 가 가비지 정리. Lucene 은 segment 가 git object, merge 가 git gc, refresh 가 working tree → index 반영.

## 3. Segment — Lucene 의 단위

### 3-1. Segment 의 정체

- **하나의 완결된 mini inverted index** — 자체적으로 검색 가능
- 디스크 위 여러 파일 묶음 (`.tim`, `.doc`, `.pos`, `.fdt`, ...) — `_0.cfs` 처럼 묶이기도
- 한 shard 는 **여러 segment 의 집합**
- 검색 = 모든 segment 를 동시에 검색 후 결과 머지

### 3-2. Segment 가 만들어지는 흐름

```
인덱싱 요청 (POST /index/_doc)
        │
        ▼
┌──────────────────────────┐
│  In-memory buffer        │ ← 아직 검색 ❌, 디스크 ❌
│  (doc 들의 raw)          │
└──────────┬───────────────┘
           │ refresh (1s default)
           ▼
┌──────────────────────────┐
│  In-memory segment       │ ← 검색 ✅, 디스크 ❌
│  (Lucene IndexReader)    │   (OS page cache 에 mmap 가능)
└──────────┬───────────────┘
           │ flush (5s ~ 30분 등 다양)
           ▼
┌──────────────────────────┐
│  On-disk segment         │ ← 검색 ✅, 디스크 ✅, 안전
│  (.cfs / .si / .doc...)  │
└──────────┬───────────────┘
           │ merge (background)
           ▼
┌──────────────────────────┐
│  Larger merged segment   │ ← 작은 segment 들이 합쳐짐
│  (deleted docs 제거)     │
└──────────────────────────┘
```

핵심: **"검색 가능" 과 "디스크 저장" 이 같은 시점이 아니다.**

## 4. Refresh — 가시성의 메커니즘

### 4-1. Refresh 가 하는 일

> in-memory buffer 에 쌓인 doc 들을 **새로운 in-memory segment** 로 만들어 IndexReader 가 보게 한다.

- 디스크 fsync ❌
- 새 segment 가 메모리에 그대로 (아직 안전하지 않음)
- IndexReader 가 reopen 되어 새 segment 까지 포함하는 view 갖게 됨

### 4-2. 기본값과 변경

| 설정 | default | 의미 |
|---|---|---|
| `index.refresh_interval` | `1s` | 1초마다 자동 refresh |
| `?refresh=true` | (수동) | 인덱싱 후 즉시 refresh (한 doc 때문에 비싼 작업 — 운영 ❌) |
| `?refresh=wait_for` | (수동) | 다음 refresh 까지 응답 대기 (적당) |
| `?refresh=false` | default | refresh 안 기다림 (정상) |

### 4-3. Refresh 가 비싼 이유

- **새 segment 파일 생성** (메모리지만 segment 구조 빌드 비용)
- **IndexReader reopen** — 기존 segment + 새 segment 를 모두 보는 view 생성
- **검색 캐시 무효화** — query cache, fielddata cache 일부 무효
- 잦은 refresh (예: 100ms) → segment 폭증 → merge 부하 ↑

### 4-4. 운영 결정

| 워크로드 | 권장 refresh_interval |
|---|---|
| 사용자 검색 (실시간성 필요) | `1s` (default) |
| 로그/메트릭 (실시간 X, 처리량 ↑) | `30s` ~ `60s` |
| 대량 bulk 인덱싱 중 | `-1` (refresh 끔) → 완료 후 `1s` 복구 |
| Kafka consumer 로 분산 인덱싱 | `5s` ~ `10s` (사용자 검색 lag 허용 범위 내) |

> **시니어 함정**: "refresh_interval 을 늘리면 lag 가 늘어난다" 는 정확하지 않다. **사용자에게 보이는 lag** 가 늘어나는 것 — Kafka consumer → ES bulk → refresh 까지의 총 lag 가 SLA. 이게 §14 의 "색인 lag SLA P99" 와 직결.

### 4-5. msa 시사점

- `search:consumer` 가 Kafka 이벤트를 받아 bulk 인덱싱 → `?refresh=false` 가 정답 (default). bulk 후 자동 1s refresh 로 충분.
- `search:batch` 의 reindex 시 → 인덱싱 중 `refresh_interval=-1` 로 끄고, 완료 후 alias swap + refresh 복구가 표준.
- 사용자 직접 액션 후 (예: 리뷰 작성 → 즉시 검색 노출) 가 필요하면 `wait_for` 사용. **`true` 는 절대 ❌** (per-request refresh 폭주).

## 5. Translog — 내구성의 안전망

### 5-1. Translog 가 풀려는 문제

Refresh 는 디스크 동기화 안 함 → **메모리만 있는 segment 가 노드 죽으면 사라짐**. 그렇다고 매 인덱싱마다 disk fsync 하면 너무 느림.

해법: **Write-Ahead Log** 패턴.
- 모든 인덱싱 요청을 translog 에 sequential write (빠름)
- translog 는 주기적 fsync (default 5s 또는 매 request)
- 노드 재시작 시 translog 를 replay 해서 lost segment 복구

### 5-2. Translog 의 동작

```
인덱싱 요청 (index/update/delete)
    │
    ├─→ in-memory buffer 추가
    │
    └─→ translog 에 append (메모리 buffer)
            │ flush_threshold (default sync_interval=5s)
            ▼
        translog fsync to disk
```

### 5-3. Translog durability 모드

| 설정 | default | 의미 | 동작 |
|---|---|---|---|
| `index.translog.durability` | `request` | 매 request 마다 fsync | 안전, 약간 느림 |
| `index.translog.durability` | `async` | sync_interval (5s default) 마다 fsync | 빠름, 5s 윈도우 손실 가능 |

→ 사용자 데이터 = `request` (default 유지). 로그/메트릭 = `async` 검토.

### 5-4. Refresh 와 Translog 의 관계

| 시점 | in-memory buffer | translog | in-memory segment | on-disk segment | 검색 가시성 | 노드 죽으면 |
|---|---|---|---|---|---|---|
| 인덱싱 직후 | doc 있음 | append (still mem) | ❌ | ❌ | ❌ | 손실 |
| translog fsync 후 (5s) | doc 있음 | fsynced | ❌ | ❌ | ❌ | **복구 가능 (translog replay)** |
| refresh 후 (1s) | 비움 | fsynced | doc 있음 | ❌ | ✅ | **복구 가능 (translog replay)** |
| flush 후 (수십 분) | 비움 | 비움 (truncate) | (병합) | doc 있음 | ✅ | 안전 |

→ **translog 가 있어서 refresh 와 flush 를 분리할 수 있다.** translog 없으면 매 인덱싱이 곧 fsync 여야 함 (느림).

## 6. Flush — Lucene Commit

### 6-1. Flush 가 하는 일

> **in-memory segment 를 디스크 segment 로 fsync + translog 비움.** 이게 Lucene 용어로 "commit".

- 새 segment 파일을 디스크에 fsync
- segments_N 메타데이터 파일 갱신 (이게 Lucene commit point)
- translog truncate (이제 segment 가 disk 에 있으니 translog 안전망 불필요)

### 6-2. Flush 트리거

자동:
- `index.translog.flush_threshold_size` (default 512MB) — translog 가 이 크기 도달하면 flush
- 일정 시간 (구현마다 다름, 보통 30분)
- 노드 종료 / 인덱스 close

수동:
- `POST /index/_flush` — 즉시 flush (snapshot 직전 권장)

### 6-3. 용어 혼란 정리

| 용어 | 의미 | 비고 |
|---|---|---|
| **Refresh** | in-mem buffer → in-mem segment, **검색 가능** | ES 용어 |
| **Flush** | in-mem segment → disk segment + translog clear | ES 용어 |
| **Commit** | flush 의 Lucene 용어 | 같은 것! |
| **Sync (translog)** | translog fsync | translog 만 |
| **Fsync** | OS-level disk sync | 일반 용어 |

→ 시니어가 자주 헷갈리는 부분: ES 의 "flush" 가 Lucene 의 "commit" 이다. ES 의 "refresh" 는 Lucene 의 "reopen" 에 가까움.

## 7. Merge — Segment 통합

### 7-1. Merge 가 필요한 이유

- 인덱싱이 계속되면 segment 개수가 폭증 (refresh 마다 1 segment)
- 검색 = 모든 segment 동시 검색 → segment 많으면 검색 느려짐
- 삭제 doc 은 tombstone 으로만 표시 → merge 가 실제 제거
- update 의 옛 버전도 merge 가 청소

### 7-2. Merge 정책

기본: **Tiered Merge Policy**
- 비슷한 크기 segment 들을 묶어서 한 단계 큰 segment 로 merge
- 큰 segment 는 잘 안 건드림 (비용 ↑)
- 한 shard 의 max segment 크기 제한 (default 5GB)

### 7-3. Force Merge

```
POST /index/_forcemerge?max_num_segments=1
```

- 모든 segment 를 1개로 병합 (read-only 인덱스에서 의미)
- **운영 인덱스에서 ❌** — 거대한 IO + 새 doc 에 다시 small segment 생김
- 시계열 인덱스가 더 이상 쓰기 없을 때 (어제 인덱스) 만 권장

### 7-4. Merge 가 사고 원인이 되는 패턴

- `refresh_interval=100ms` 로 너무 자주 refresh → segment 폭증 → background merge 가 IO 점유 → search latency spike
- bulk 인덱싱 중 merge 가 동시에 → IO 경합
- shard 너무 작으면 (수MB) merge 효율 ↓

## 8. 사용자 시각 일관성 모델

검색 클라이언트가 마주치는 일관성 시나리오:

### 8-1. "방금 쓴 글이 검색에 안 보임"

원인: refresh 전. 해법:
- 일반: 1s 기다리면 보임 (default)
- UX 즉시 노출 필요: `?refresh=wait_for` (다음 refresh 까지 대기)
- **❌ ?refresh=true** — 단일 doc 때문에 segment 1개 추가 + 캐시 무효화

### 8-2. "ES 에 잘 들어갔는데 노드 재시작 후 사라짐"

원인: refresh 됐지만 flush 전 + translog durability=async + sync_interval 윈도우 안에 죽음. 해법: durability=request (default).

### 8-3. "검색 latency 가 급증"

흔한 원인:
- segment 폭증 (refresh 너무 잦음)
- background merge 진행 중 (`hot_threads` 로 확인)
- query cache 무효화 (refresh 가 일부 무효화)
- field data cache OOM (분석 필드의 sort/agg)

### 8-4. "재기동 시간이 너무 김"

원인: translog 가 너무 커서 replay 시간 ↑. 해법: flush_threshold_size 줄이기 / 정기 수동 flush.

## 9. 운영 튜닝 체크리스트 (시니어 의사결정)

| 상황 | 튜닝 |
|---|---|
| 사용자 검색 (실시간성 ↑) | `refresh_interval=1s` (default), `durability=request` (default) |
| 로그/메트릭 (처리량 ↑) | `refresh_interval=30s`, `durability=async`, `sync_interval=5s` |
| 대량 bulk 인덱싱 | `refresh_interval=-1` 인덱싱 중 끄기 → 완료 후 복구, replica=0 → 완료 후 1 (replica 도 인덱싱 받으므로) |
| 시계열 인덱스 (어제 데이터) | `_forcemerge?max_num_segments=1`, read-only 마킹 |
| Snapshot 직전 | `POST /_flush` 수동 호출 권장 (translog 짧게) |
| 검색 latency spike | hot_threads 확인 → merge 진행 중인지, segment 개수 확인 (`/_cat/segments`) |

## 10. msa 적용 (Phase 3 grounding)

`search/CLAUDE.md` 의 4-모듈에 매핑:

- **search:consumer** (Kafka → ES 인덱싱):
  - bulk request 로 모아서 인덱싱 (5초 / 1000건 단위 같은 batch)
  - `?refresh=false` (default) — 사용자 lag 1s 허용
  - durability=request 유지 (사용자 데이터, 손실 ❌)
  - 멱등성: `?version_type=external` + `version` 필드로 out-of-order 방어 (ADR-0012 와 결합)

- **search:batch** (전체 reindex):
  - 새 인덱스 생성 시 `refresh_interval=-1`, `replica=0` 으로 시작
  - 인덱싱 완료 후 `refresh_interval=1s`, `replica=N` 복구
  - alias swap (atomic) — 사용자에게 lag 0
  - 옵션: 완료 후 `_forcemerge?max_num_segments=1` (read-only 까지는 안 가지만 segment 정리)

- **search:app** (검색 API):
  - 사용자 직접 액션 후 (예: 본인 리뷰 작성 직후 검색) 만 `?refresh=wait_for` 검토
  - 일반 검색은 default

→ 자세한 grounding 은 §15.

## 11. 자주 듣는 오해 정정

> **"refresh 하면 디스크에 저장된다"**

- ❌ refresh 는 메모리 segment 만 만든다. 디스크 저장은 flush.

> **"flush 가 자주 일어나야 안전하다"**

- ⚠ translog 가 안전망. translog durability=request 면 매 request 가 안전. flush 는 효율 + 복구 시간 단축이 목적.

> **"refresh_interval 을 1s 미만으로 줄이면 더 실시간이 된다"**

- ⚠ 가능하지만 segment 폭증 → merge 부하 → 결국 검색 latency 악화. **1s 미만은 안티패턴**.

> **"force_merge 를 주기적으로 돌리면 검색이 빨라진다"**

- ❌ 운영 인덱스에서 force_merge 는 IO 폭증 + 새 doc 의 small segment 가 다시 생김. **read-only 인덱스에서만**.

> **"translog durability=async 가 기본이다"**

- ❌ default 는 `request` (매 request fsync). async 는 명시적으로 바꿔야 함.

> **"Lucene commit 이 ES flush 보다 자주 일어난다"**

- ❌ 같은 거다. ES 의 flush = Lucene 의 commit. 용어 혼란.

## 12. 다음 학습

- [03-inverted-index-deep.md](03-inverted-index-deep.md) — segment 안의 자료구조 (term dict / postings / skip list)
- [04-analyzer-pipeline.md](04-analyzer-pipeline.md) — 인덱싱 시점의 토큰화 (refresh 전 단계)
- [13-indexing-pipeline-ilm.md](13-indexing-pipeline-ilm.md) — alias swap, ILM 와 결합
- [14-sync-outbox-cdc.md](14-sync-outbox-cdc.md) — refresh_interval 과 색인 lag SLA 의 관계
- [16-operations-monitoring-rto.md](16-operations-monitoring-rto.md) — segment / merge / hot threads 운영 모니터링

> **§02 회독 체크리스트** (묶음 1 약점 직격):
> - [ ] **refresh / flush / commit / sync** 4개 용어를 한 줄씩 정의할 수 있다
> - [ ] "방금 인덱싱한 doc 이 검색 안 됨" → 원인과 해법 3가지 (wait, wait_for, true 의 차이)
> - [ ] translog 가 없으면 어떤 일이 벌어지는지 설명할 수 있다
> - [ ] refresh_interval 을 1s 미만으로 줄이면 안 되는 이유
> - [ ] bulk 인덱싱 시 refresh_interval=-1 + replica=0 패턴의 근거
> - [ ] "ES flush 가 Lucene 의 무엇과 같은가" 답할 수 있다 (= commit)
