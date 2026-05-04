---
parent: 19-search-engine
seq: 31
title: Cross-Cluster Search (CCS) + Cross-Cluster Replication (CCR) + Searchable Snapshots
type: deep-dive
created: 2026-05-04
updated: 2026-05-04
status: completed
related:
  - 99-concept-catalog.md
  - 12-cluster-topology-shard-sizing.md
  - 16-operations-monitoring-rto.md
sources:
  - https://www.elastic.co/docs/reference/elasticsearch/cross-cluster-search
  - https://www.elastic.co/docs/reference/elasticsearch/ccr
  - https://www.elastic.co/docs/reference/elasticsearch/searchable-snapshots
catalog-row: "§L CCS / CCR + §K Searchable Snapshots"
depth: full
---

# 31. Cross-Cluster Search / Replication + Searchable Snapshots

> 카탈로그 매핑: §99 §L (CCS / CCR) + §K (Searchable Snapshots / Frozen) — `★ 신규` → `✅ 커버`
> 학습 시간: ~2h · 자가평가: B

---

## 1. 한 줄 핵심

- **CCS (Cross-Cluster Search, 교차 클러스터 검색)**: 여러 클러스터의 인덱스를 한 검색으로 조회 (`cluster_one:index*`)
- **CCR (Cross-Cluster Replication, 교차 클러스터 복제)**: leader → follower 단방향 복제 — DR (Disaster Recovery, 재해 복구) / 지역 분산 — **Elastic 라이선스 전용**
- **Searchable Snapshots / Frozen tier**: snapshot 을 마운트해 직접 검색 — 스토리지 비용 ↓ (Elastic 전용)

## 2. CCS 동작

```
                    ┌── coordinator (local)
                    │
                    ├──▶ cluster_one:idx-*  (remote)
                    └──▶ cluster_two:logs-* (remote)
                              │
                       각 cluster 의 결과를 머지
```

연결 모드:
| 모드 | 동작 | 권장 |
|---|---|---|
| **sniff** | 모든 노드 발견 후 직접 통신 | 클러스터 노드 노출 가능 환경 |
| **proxy** | 단일 endpoint (load balancer) 통과 | 방화벽 / VPN / 멀티 리전 표준 |

**검색 syntax**:
```http
GET /local-idx,cluster_one:remote-idx/_search
```

옵션:
- `ccs_minimize_roundtrips` (기본 true): coordinator 가 remote 마다 1회 round-trip 으로 끝
- `skip_unavailable`: remote 다운 시 무시
- 파티션·정렬·집계 모두 지원 — but 일부 ML/runtime field 한계

## 3. CCR 동작

```
[Leader cluster] index 변경
       │
       ▼ (소화: shard-level changes API)
[Follower cluster] follower index 가 leader 의 변경을 pull
```

- **단방향**: follower 는 read-only mirror
- **shard granular**: 변경을 shard-level 로 pull
- **auto-follow patterns**: 신규 인덱스 패턴 자동 follow
- **bidirectional 패턴**: 두 leader/follower 쌍을 만들어서 cross-region 양방향 (앱 라우팅 책임)

**활용**:
- **DR**: 한 리전 leader, 다른 리전 follower → 리전 장애 시 follower 승격
- **지역 분산**: leader 리전 + N follower → 리전 가까운 사용자가 follower 검색
- **CQRS**: leader = 색인 헤비, follower = 검색 헤비 (데이터/검색 분리)

> ★ **Elastic 라이선스 전용** (Platinum+). OpenSearch 에는 cross-cluster replication plugin 별도 (이름은 동일 / 메커니즘 비슷).

## 4. Searchable Snapshots / Frozen tier

```
[Hot]   현재 활성 인덱스
   │
[Warm]  덜 자주 검색
   │
[Cold]  드물게 검색 (snapshot 으로 마운트, fully cached)
   │
[Frozen] snapshot 직접 검색 (cache 일부만, on-demand fetch)
   │
[Delete]
```

- **Searchable Snapshot**: snapshot 자체를 인덱스로 마운트 → 디스크 전체 내려받지 않고 필요시 fetch
- **Frozen tier**: 부분 캐시만 → 검색 latency ↑ but 스토리지 비용 ~95% ↓ (장기 보존)
- **유즈케이스**: 시계열 로그 (90일 hot/warm + 1년 frozen)
- **Elastic 라이선스 전용**

## 5. 사용 예제

### 5-A. Remote cluster 등록 (proxy 모드)

```http
PUT /_cluster/settings
{
  "persistent": {
    "cluster": {
      "remote": {
        "cluster_one": {
          "mode": "proxy",
          "proxy_address": "remote-cluster.example.com:9300"
        }
      }
    }
  }
}
```

### 5-B. CCS 검색

```http
GET /local-products,cluster_one:archive-products/_search
{ "query": { "match": { "title": "shoes" } } }
```

### 5-C. CCR follower 생성

```http
PUT /follower-products/_ccr/follow
{
  "remote_cluster": "cluster_one",
  "leader_index": "products"
}
```

### 5-D. Searchable Snapshot 마운트

```http
POST /_snapshot/my-repo/snapshot-2025-04/_mount?wait_for_completion=true
{
  "index": "logs-2025-04",
  "renamed_index": "logs-2025-04-mounted",
  "index_settings": { "index.number_of_replicas": 0 }
}
```

## 6. 트레이드오프 / 안티패턴

| 측면 | 장점 | 비용 |
|---|---|---|
| CCS | 단일 검색으로 멀티 클러스터 | 한 remote 가 느리면 latency 끌고 감 — `skip_unavailable` 활용 |
| CCR | DR / 지역 분산 / CQRS 분리 | 라이선스 비용, 복제 lag 모니터 필수 |
| Searchable Snapshot | 스토리지 비용 ↓ | 검색 latency ↑ (frozen tier 특히) |

- **안티패턴**:
  - CCS 로 sub-second latency 기대 — 네트워크 RTT 직접 영향
  - CCR follower 로 색인 — 단방향 read-only 위반
  - Frozen tier 에 high-QPS 검색

## 7. ES vs OpenSearch

| 항목 | ES | OS |
|---|---|---|
| CCS | 표준 | 표준 (OpenSearch CCS) |
| CCR | **Elastic Platinum 라이선스** | **plugin (Apache 2.0)** — opensearch-project/cross-cluster-replication |
| Searchable Snapshots | **Elastic Enterprise** | OS 도 일부 (snapshot management plugin + remote-backed storage) |
| Frozen tier | Elastic 고유 | OS 미지원 (대안: 별도 cold tier) |

> **OS 의 라이선스 우위**: CCR 가 OSS — DR 시나리오를 라이선스 없이 구축 가능.

## 8. 운영 / 모니터링

- **CCR lag**: `_ccr/stats` 의 `time_since_last_read_millis` — 임계 알람
- **CCS latency**: profile per cluster, slow cluster 격리
- **Network**: 리전 간 RTT, bandwidth 사이징 (CCR 는 binlog-like 트래픽)
- **인증**: cross-cluster API key (8.x+) — 권한 최소화

## 9. msa 코드베이스 grounding

| 시나리오 | 적용 후보 |
|---|---|
| 단일 리전 운영 | 현재 — CCS/CCR 미적용 |
| DR (다른 리전 백업) | snapshot 정기 + 외부 repo (현재 가능) |
| 멀티 리전 사용자 | CCR follower (OS plugin) — read 트래픽 분산 |
| analytics 와 search 분리 | 다른 클러스터에 두고 CCS 로 cross 조회 |

> 현 시점 msa 는 단일 리전 가정 — 본 문서는 미래 시나리오 reference.

## 10. 적용 후보 / ADR

**ADR-XXXX (Proposed)**: "DR 전략 — single-region 단계는 snapshot only, multi-region 단계는 OS CCR follower 검토"
- **이유**: CCR 는 운영 복잡도 큰 결정 — 멀티 리전 필요성 정당화 후
- **위험**: ES 사용 시 CCR 라이선스 비용 → ADR-3 (ES vs OS 일원화) 와 결합 검토

## 11. 면접 카드 + 꼬리질문

| Q | 핵심 답변 | 꼬리 |
|---|---|---|
| Q1. CCS 의 라우팅 syntax 와 한계? | `cluster:index` 패턴, 모든 remote 의 응답 머지. 한 remote 느리면 전체 느려짐 | minimize_roundtrips=false 시 어떤 모양? |
| Q2. CCR vs snapshot 기반 DR 비교? | CCR = 거의 실시간 (lag 초~분), snapshot = 주기적 (분~시) + 라이선스 무료 | 어떤 SLA 가 CCR 를 정당화? |
| Q3. Searchable Snapshot 의 동작 원리? | snapshot 을 인덱스로 마운트 — disk fetch on demand. Frozen tier 는 부분 캐시 | latency 영향과 적합 워크로드 |
| Q4. ES → OS CCR 마이그레이션 비용? | CCR 는 OS plugin 으로 OSS — 라이선스 절감, but 매핑/설정 차이 | 같은 데이터를 두 진영에 동시 두기 (이중 트랙) |
| Q5. CCR follower 가 실패하면? | leader 와 lag → fail-over 어려움. fail-over 시 follower → unfollow → 일반 인덱스 승격 | unfollow API 동작 |

## 12. 자주 듣는 오해 정정

| 오해 | 실제 |
|---|---|
| "CCS 는 sub-ms" | 네트워크 RTT 직접 영향 |
| "CCR 는 양방향" | 단방향. 양방향은 두 쌍 + 라우팅 |
| "Searchable Snapshot 도 hot 만큼 빠름" | 부분 캐시 미스 시 큼 |
| "CCR 가 OSS 진영엔 없다" | OS 의 cross-cluster-replication plugin 으로 가능 |

## 13. 다음 학습

- §99 §K SLM (Snapshot Lifecycle Management) — snapshot 자동화
- §99 §L 의 auth realms / API keys — cross-cluster 인증
- ADR-3 (ES vs OS 일원화) 검토 시 본 문서 + #29 + #11 동시 참조
