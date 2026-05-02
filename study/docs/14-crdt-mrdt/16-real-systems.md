---
parent: 14-crdt-mrdt
seq: 16
title: 실 시스템 — Riak DT · Redis CRDB · Yjs · Automerge · Roshi · Figma
type: deep
created: 2026-05-01
---

# 16. 실 시스템에서의 CRDT

이론은 명확. **production 에선 운영 디테일이 차이를 만든다**. 대표 시스템 6개.

## 1. Riak DT (Riak Data Types)

Basho 의 Riak 2.0 (2014) 에서 정식 도입. CRDT 의 첫 production-grade 시스템.

```
지원 타입:
  - Counter (PN-Counter)
  - Set (OR-Set)
  - Map (재귀 OR-Map)
  - Register (LWW)
  - Flag (enable/disable)
```

### 운영 모델

```
- 단일 클러스터 안에서 동작
- gossip 기반 anti-entropy
- 데이터 분산 (consistent hashing) + replication (N=3 default)
- delta-CRDT 로 update 전파

장점:
  - sibling 노출 사라짐 (CRDT 가 자동 merge)
  - 다양한 자료구조 직접 사용 가능

단점:
  - tombstone 누적 (Set, Map 의 큰 약점)
  - 메타데이터 오버헤드 (PN-Counter 1만 entry 가 흔함)
  - Basho 파산 (2017) → 커뮤니티 maintenance
```

### 사용 사례

- Bet365 (베팅 데이터 카운터)
- Riot Games (Game state)
- 다양한 IoT 백엔드

## 2. Redis Enterprise CRDB (Active-Active)

Redis Labs (Redis Inc.) 의 *Redis Enterprise* 기능. multi-region active-active.

```
지원 타입:
  - String (LWW-Register)
  - Counter (PN-Counter)
  - Set (OR-Set)
  - Sorted Set (specialized CRDT)
  - Hash (OR-Map of Registers)
  - List, HyperLogLog, Stream 등 일부
```

### 운영 모델

```
- 다수 region 의 Redis cluster 가 active-active
- region 간 비동기 replication (CRDT merge)
- region 내부는 일반 Redis (master-replica)

이점:
  - 글로벌 사용자에게 가장 가까운 region 으로 routing
  - region 장애 시 다른 region 이 즉시 처리
  - geo-distributed cache + state

단점:
  - Enterprise 라이선스
  - eventual consistency (region 간)
  - tombstone GC 운영 필요
```

### 사용 사례

- 글로벌 게이밍 leaderboard
- multi-region session store
- IoT device state

## 3. Yjs

Kevin Jahns 가 개발. **production-grade 협업 에디터 CRDT** 의 표준.

```
지원 타입 (Shared Types):
  - Y.Map
  - Y.Array
  - Y.Text (RGA / Yata)
  - Y.XmlFragment, Y.XmlElement (rich text)
  - 사용자 정의 타입 가능
```

### 운영 모델

```
- 클라이언트 라이브러리 (JS) + transport adapter
- y-websocket: WebSocket 서버 (단순 relay 또는 persistence)
- y-webrtc: P2P (signaling 만 서버)
- y-leveldb: LevelDB persistence
- y-redis: Redis 기반

이점:
  - 가벼운 서버 (단순 relay)
  - 오프라인 작업 자연
  - binary encoding 으로 효율적
  - Y-CRDT (Rust) 로 성능 SOTA

단점:
  - history 압축 정책 정해진 (time travel 제한)
  - JavaScript 중심 생태계 (다른 언어 지원 시작 단계)
```

### 사용 사례

- HackMD, dynalist 비슷한 노트 도구
- Codeshare, JsFiddle 같은 코드 협업
- Notion 의 일부 (확실치 않음)
- 다양한 tldraw / drawio 같은 그림 도구

## 4. Automerge

Ink & Switch + Martin Kleppmann. **local-first** 패러다임의 reference implementation.

```
지원 타입:
  - JSON-compatible
  - 모든 mutation 이 op (history 보존)
  - Time travel 가능
```

### 운영 모델

```
- 클라이언트 라이브러리 (Rust core + JS / Swift / etc.)
- automerge-repo: 통합 sync framework
- 다양한 storage / sync adapter

이점:
  - JSON 같은 직관적 인터페이스
  - 모든 history 보존 → audit, time travel
  - local-first 이상 충실

단점:
  - 메모리 + 저장소 큼 (history)
  - 큰 document 에서 성능
  - production 사례 아직 적음
```

### 사용 사례

- Pushpin, Trellis (note 앱)
- 일부 local-first 실험 도구

## 5. Roshi (SoundCloud)

SoundCloud 의 timeline 데이터 위해 만든 시스템 ([오픈소스](https://github.com/soundcloud/roshi)).

```
자료구조:
  - LWW-element-set (timeline 의 listen 기록)
  - score = timestamp → recent listen 우선
```

### 운영 모델

```
- Redis backend
- 클러스터 multiple Redis instances + write-quorum / read-repair
- HTTP API

이점:
  - 단일 timeline 자료구조에 특화 → 단순
  - Redis 기반이라 운영 익숙
  - eventual consistency OK 한 use case

단점:
  - SoundCloud 만 maintenance (방치)
  - 일반 CRDT 가 아닌 *특화* 솔루션
```

## 6. Figma

협업 디자인 도구. CRDT 의 가장 성공적인 production 사례 중 하나.

```
사용 자료구조:
  - 자체 구현 (Yjs/Automerge 사용 안 함)
  - 도형 + 속성 + 트리 구조에 최적화
```

### 운영 모델

```
- WebSocket 으로 클라이언트 ↔ 서버 sync
- 서버가 *master* — 클라이언트의 op 정렬 + broadcast
- 일부 "OT-like" 변환 + CRDT 의 자료구조 결합

이점:
  - 백만 동시 편집 사용자 지원
  - 매우 빠른 응답
  - 클라이언트 오프라인 지원

단점:
  - 비공개 (오픈소스 아님)
  - 자체 구현 → 유지비
```

[Figma 의 Multiplayer 블로그](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) 가 좋은 reference.

## 시스템별 사용처 분류

```
분산 KV / DB:
  - Riak DT — production (Basho legacy)
  - Redis Enterprise CRDB — production (글로벌)
  - Akka Distributed Data — production (Lightbend)

협업 도구:
  - Yjs — production 표준 (오픈소스)
  - Automerge — local-first 표준
  - Figma — 자체 구현 production
  - tldraw — Yjs 사용

블록체인 / federation:
  - Matrix — event 기반, 부분 CRDT
  - Secure Scuttlebutt — append-only feed
```

## 채택 패턴 요약

```
CRDT 채택의 트리거:
  1. multi-region active-active (분산 KV)
  2. 협업 / local-first (협업 도구)
  3. 오프라인 우선 모바일 앱
  4. P2P / federation

CRDT 도입 안 하는 환경:
  1. single-region single-master (대부분 OLTP) ← 현 msa
  2. 강한 정합성 필수 (금융 거래)
  3. 합의 가능 + 비용 OK (PostgreSQL replica)
```

## 트레이드오프 비교 표

| 시스템 | 모델 | 데이터 | 분산성 | 운영 부담 |
|---|---|---|---|---|
| Riak DT | KV + CRDT | Counter/Set/Map | 클러스터 | 중간 (gossip + GC) |
| Redis CRDB | 글로벌 KV | 다양 | multi-region | 높음 (Enterprise) |
| Yjs | 협업 도구 | shared types | P2P / 서버 | 낮음 (단순 relay) |
| Automerge | 협업 도구 | JSON-compatible | P2P / 서버 | 낮음 |
| Roshi | 특화 | timeline only | 클러스터 | 낮음 |
| Figma | 자체 구현 | shape tree | 서버 중심 | 자체 운영 |

## msa 시사점

현 msa 에 직접 CRDT 시스템 도입할 곳은 없다. 다만 *향후 검토 시나리오* 정리:

```
multi-region 이 결정되면:
  - 가장 자연: Redis Enterprise CRDB (글로벌 cache)
  - 비용 부담: Redis OSS + 자체 anti-entropy 검토 (위험 큼)

협업 도구를 추가하면:
  - admin / agent-viewer 에 협업 → Yjs 자연
  - ideabank 의 PRD 협업 편집 → Yjs 자연

P2P 또는 오프라인 모바일 앱:
  - Automerge 또는 Yjs
```

자세한 결론은 [17-msa-application.md](17-msa-application.md) 와 [18-improvements.md](18-improvements.md).

## 면접 포인트

- **"production 에서 CRDT 채택한 시스템 예?"** — Riak DT, Redis Enterprise CRDB (분산 KV), Yjs / Automerge (협업 도구), Figma (자체 구현). 협업 도구 영역이 가장 활발.
- **"Yjs vs Automerge 의 production 차이?"** — Yjs 는 binary encoding 효율 + 큰 document 처리 잘됨, history 압축. Automerge 는 history 보존 + time travel + local-first 충실. 큰 document 협업은 Yjs, 데이터 보존이 critical 한 local-first 는 Automerge.
- **"Figma 가 Yjs 안 쓴 이유?"** — 자체 자료구조 (도형 + 속성 + 트리) 에 특화 + 서버 중심 모델. Yjs 의 일반 shared type 으로 표현하기 어려움.
- **"Riak DT 채택 안 늘어난 이유?"** — Basho 파산 (2017) + Riak 자체의 시장 축소. 기술이 아닌 비즈니스 요인.

## 다음 학습

- [17-msa-application.md](17-msa-application.md) — msa 코드 직접 분석한 적용 검토
- [18-improvements.md](18-improvements.md) — 도입 결론 및 ADR 후보
