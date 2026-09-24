---
title: OpenSearch 클러스터 사이징 프롬프트 — AI 에 샤드 · 노드 수 산정을 시킬 때 주는 입력과 금지 규칙
slug: opensearch-cluster-sizing-prompt
category: /tech/server/search
summary: 검색 클러스터의 노드 수 · 인스턴스 · 인덱스별 샤드와 사본 수를 LLM 에 산정시키는 프롬프트다. 목표 SLO 와 _cat · _nodes/stats · 쿼리 DSL · 시계열 지표를 입력으로 받고, 피크 RPS × 샤드 수로 필요 스레드를 계산해 노드 수를 정한다. 크기만으로 샤드를 정하는 것, 평균 RPS, 값 추정을 금지하고 모르는 값은 「측정 필요」로 남긴다.
---

검색 클러스터의 노드 수 · 인스턴스 · 인덱스별 샤드 수를 LLM 에 산정시킬 때 쓰는 프롬프트와 그 설계 기준이다. [사이징 공식 글](/posts/search-cluster-capacity-sizing)이 「무엇으로 정해지는가」라면 이 글은 「무엇을 주고 무엇을 받는가」다.

| 항목 | 값 |
|---|---|
| 대상 | AWS Managed OpenSearch(OpenSearch Service) · 3 AZ · 2026-09 기준 |
| 입력 | 목표 SLO · `_cat/nodes` · `_cat/indices` · `_cat/shards` · `_cat/aliases` · 쿼리 DSL + 트래픽 비중 · CloudWatch 시계열 |
| 결정 | 노드 수 · 인스턴스 · 노드 역할 · 인덱스별 P/R · 병목 · 확장 기준 · 마이그레이션 · 벤치마크 |
| 용량 기준 | 평균이 아니라 피크 RPS. 피크에 CPU 100% 인 구성은 추천 금지 |
| 샤드 결정 | 크기 · 문서 수 · RPS · 쿼리 복잡도 넷을 함께. 인덱스별 독립 |
| 노드 수의 근거 | 필요 스레드 = 피크 RPS × 샤드 수 × 샤드 쿼리 시간, 총 스레드 = 노드 수 × ((vCPU × 3) / 2 + 1) |
| 모르는 값 | 추정 금지 · 「측정 필요」 표시 · 추가 데이터를 우선순위순으로 요청 |
| 구조 | 역할 · 입력 · 절차 · 출력 · 원칙 다섯 블록 |

## 프롬프트는 다섯 블록이다

블록마다 하는 일이 하나다. 절차와 출력 형식을 한 블록에 섞으면 같은 지시가 두 번 나가고, 모델은 둘 중 어느 순서를 따를지 흔들린다.

| 블록 | 담는 것 | 없으면 생기는 일 |
|---|---|---|
| 역할 · 목표 | 페르소나, 결정할 것 다섯, 「실제 워크로드 우선」 | AWS 일반 권장값을 그대로 옮긴다 |
| 입력 | 목표 SLO, 데이터 항목과 뽑는 명령 | 빠진 값을 추정으로 메운다 |
| 분석 절차 | 12단계, 앞 단계 결론이 뒤 단계 입력 | 샤드 수를 데이터 크기만 보고 정한다 |
| 출력 형식 | 14절의 순서와 표 열 | 같은 결론이 절마다 흩어져 나온다 |
| 원칙 | 금지 판단 7개 | 평균 RPS · 짝수 master 같은 옛 상식이 섞인다 |

## 입력에 목표가 없으면 헤드룸은 근거가 없다

「충분한 여유를 두라」는 지시만으로는 몇 %가 여유인지 정할 수 없다. 목표 P99 · 가용성 · 비용 상한 · AZ 1개 장애 시 허용 저하를 필수 입력으로 두면 헤드룸이 그 값에서 나온다.

| 입력 | 뽑는 곳 | 이것이 정하는 것 |
|---|---|---|
| 목표 SLO | 서비스 요구사항 | 헤드룸 · replica 수 · 장애 허용 |
| 노드 | `_cat/nodes?v&h=name,node.role,cpu,heap.percent,ram.percent,disk.used_percent` + `_cat/nodeattrs?v`(AZ) | 총 vCPU · 스레드 · 파일캐시 · AZ 배치 |
| 인덱스 | `_cat/indices?v&bytes=gb&h=index,pri,rep,docs.count,docs.deleted,pri.store.size,store.size` | 샤드 크기 · 삭제 비율 |
| 샤드 배치 | `_cat/shards?v&bytes=gb` | 핫 샤드 · 편중 |
| alias | `_cat/aliases?v` | 서빙 인덱스와 리인덱스 사본 구분 |
| 쿼리 | 대표 DSL 전문 + 트래픽 비중(%) | CPU · 메모리 · 디스크 중 어디가 무거운가 |
| 클라이언트 RPS | 앱 · 로드밸런서의 인덱스별 요청 수, 평균 · P95 · 피크 · 지속 시간 | 용량 산정의 기준 부하 |
| 시계열 | CloudWatch CPUUtilization · JVMMemoryPressure · ThreadpoolSearchQueue · ThreadpoolSearchRejected · SearchLatency | 노드별 피크 · 큐 적체 |
| 검색 통계 | `_nodes/stats/indices/search` 의 `query_total` · `query_time_in_millis` 델타 | 샤드 쿼리 1건당 시간 |

날짜 suffix 인덱스는 alias 가 가리키는 것만 서빙이다. 나머지는 검색 팬아웃에서 빼고 저장 피크 계산에만 넣는다.

## 스레드 계산이 샤드 수와 노드 수를 잇는다

샤드 수는 데이터 크기로, 노드 수는 RPS 로 따로 정하면 둘이 안 맞는다. 쿼리 하나가 샤드 수만큼 스레드를 쓰므로, 필요 스레드를 계산하면 두 값이 한 식에 묶인다.

```text
피크 동시 샤드 쿼리 수 = 피크 RPS × 쿼리당 대상 샤드 수(primary 수)
노드당 search 스레드   = (vCPU × 3) / 2 + 1          ← 설정이 아니라 파생값
총 스레드             = 노드 수 × 노드당 search 스레드
샤드 쿼리 1건당 시간  = Δ query_time_in_millis ÷ Δ query_total
필요 스레드           ≈ 피크 동시 샤드 쿼리 수 × 샤드 쿼리 1건당 시간(초)
```

필요 스레드가 총 스레드에 가까우면 큐가 쌓이고 rejected 가 난다. primary 를 늘리면 샤드는 작아지지만 팬아웃이 같이 늘어 필요 스레드도 는다.

| 병목 신호 | 먼저 볼 것 |
|---|---|
| 전 노드 CPU 90~100% | 클러스터 CPU 용량. 단 query cache 적중률이 낮으면 파일캐시 부족이 CPU 로 나타난 것 |
| 일부 노드만 90~100% | `_cat/shards` 분포 — 핫 샤드 · 편중 · 라우팅. 노드를 늘리기 전에 본다 |
| CPU 낮은데 지연 높음 | JVM/GC · 디스크 I/O · 스레드 풀 큐 · 팬아웃 · 조정 노드 병합 |

## 프롬프트가 금지하는 판단

금지는 모델이 실제로 자주 하는 판단만 담는다. 목록이 길어지면 앞 절의 재진술이 되어 길이만 는다.

| 금지 | 대신 | 이유 |
|---|---|---|
| AWS 권장값을 그대로 적용 | 입력 워크로드 우선 | 권장값은 워크로드를 모르는 기본값이다 |
| 데이터 크기 ÷ 목표 샤드 크기 | 크기 · 문서 수 · RPS · 복잡도 넷 | 작은 인덱스도 RPS 가 높으면 팬아웃이 필요하다 |
| 「노드 3대니 전부 3 primary」 | 인덱스별 후보 1 · 3 · 6 비교 | 인덱스마다 크기와 RPS 가 다르다 |
| 평균 RPS 로 용량 산정 | 피크 RPS + 지속 시간 | 큐는 피크에 쌓인다 |
| replica 를 늘리면 읽기가 선형 증가 | 노드 수와 함께 계산 | 노드가 그대로면 같은 vCPU 를 나눠 쓴다 |
| 노드부터 늘리기 | 병목 식별 → 핫 샤드 → 쿼리 최적화 | 편중은 노드를 늘려도 남는다 |
| 가격 · 모르는 값 추정 | 인스턴스 타입 명시 · 「측정 필요」 | 추정치가 표에 들어가면 근거로 굳는다 |

## 모델이 틀리기 쉬운 AWS 제약은 프롬프트에 적어 둔다

「현재 공식 문서를 확인하라」는 웹 접근이 없는 모델에는 빈 지시다. 자주 틀리는 제약은 프롬프트에 값으로 적고, 나머지는 지식 시점을 밝히고 「확인 필요」를 표시하게 한다.

| 항목 | 관리형의 실제 | 모델이 흔히 하는 말 |
|---|---|---|
| 노드 역할 | data · dedicated master · dedicated coordinator(2024-11 지원 시작) · UltraWarm · cold. ingest-only 없음 | 「ingest 노드를 분리하라」 |
| JVM heap | RAM 의 절반, 상한 약 32GB, 고정 | 「heap 을 조정하라」 |
| master-eligible 짝수 | 투표 구성이 자동 조정되어 split-brain 없음. 6대는 5대와 같은 2대 장애 허용 | 「짝수는 split-brain」 |
| dedicated master 의 근거 | 클러스터 상태 작업을 검색 CPU 에서 격리 | 「쿼럼 때문」 |
| primary 수 변경 | `_split` · `_shrink` 에 read-only 블록과 routing shard 조건. 풀 리인덱스 구조면 새 인덱스 + alias 전환 | 「불가능」 |
| CloudWatch `SearchRate` | 데이터 노드별 · 분당 · **샤드 단위** 검색 수. 클라이언트 요청 1건이 샤드 수만큼 센다 | 「초당 검색 요청 수」 |
| 벤치마크 도구 | OpenSearch Benchmark | 「Rally」 |

> [!IMPORTANT] Elasticsearch 7.x 이전 동작과 섞인다
> `minimum_master_nodes` 시절의 짝수 금기, heap 튜닝, Rally 는 옛 Elasticsearch 지식이다. 프롬프트 원칙에 「7.x 와 최신 OpenSearch 를 혼동하지 않는다」를 명시해도 값을 적어 두는 쪽이 확실하다.

## 출력은 0 절부터 14 절까지다

절의 순서를 고정하면 답을 비교할 수 있다. 같은 프롬프트에 두 클러스터의 데이터를 넣으면 같은 절끼리 나란히 놓인다.

입력 검증에 0 절을 따로 준다. 자리가 없으면 모델이 절을 스스로 끼워 넣어 번호가 밀린다.

0. Input Validation — 인덱스 분류 · 입력 간 모순 · 추가로 필요한 데이터(우선순위순)
1. Executive Summary — 가장 중요한 문제 3~5개
2. Current Workload — 항목 × 현재값 · 피크 · 평가 표
3. Node Architecture Candidates — 3 노드 · 6 노드 등 후보 비교 표
4. Node Role Architecture — 노드 수별 겸용 · 분리 토폴로지
5. Index Shard Recommendation — 인덱스별 현재 P/R · 추천 P/R · 근거 표
6. Primary Shard Reasoning — 인덱스별 크기 · RPS · 복잡도 · 필요 스레드 → 추천 P
7. Replica Recommendation — 인덱스별 0 · 1 · 2 비교
8. Peak Bottleneck — CPU · JVM · 디스크 · 큐 · 팬아웃 중 무엇인가
9. Scaling Triggers — scale-up · scale-out · 쿼리 최적화 · replica · primary 각각의 조건
10. Recommended Final Architecture — 고정 형식 한 블록
11. Cost — 현재 · 후보별
12. Migration Plan
13. Benchmark Plan
14. 추천을 뒤집는 조건

## 빈틈을 넣은 입력으로 확인한 동작

합성 입력(3 AZ · 3 노드 · 인덱스 셋)에 빈틈 넷을 넣고 프롬프트를 새 세션에서 실행한 결과다. 2026-09-24 · Claude Opus 기준, 응답 약 29KB.

| 입력의 빈틈 | 응답 |
|---|---|
| 목표 P99 없음 | 지연을 「판정 불가」로 두고 추가 데이터 2순위로 요청 |
| `query_time` 델타 없음 | 필요 스레드를 `샤드 쿼리 수 × t` 로 남기고 t 를 「측정 필요」로 표시 |
| 지표가 5분 해상도 | 「초 단위 스파이크는 측정 필요」, 큐 140 과 rejected 의 불일치를 그 근거로 지적 |
| 노드 하나만 CPU 97% | 노드 증설 대신 요청 편중부터 의심. replica 2 × 3 노드면 모든 노드가 전 샤드를 가져 primary 위치로는 설명되지 않는다고 판단 |

같은 실행에서 두 가지를 검증한다. 출력은 0~14 절을 번호 그대로 지킨다. 노드별 `SearchRate` 합계(분당 248,000)를 `클라이언트 RPS × 팬아웃 × 60` 과 대조해 입력의 정합성을 확인한다.

## 쓰는 법

1. 피크 시간대에 수집 스크립트를 돌린다. 이름을 가린 「입력 데이터」 블록이 나온다.
2. `<채울 것>` 을 채운다 — 목표 SLO · 인스턴스 타입 · 클라이언트 RPS · 쿼리 DSL · CloudWatch 지표.
3. 프롬프트 전문 뒤에 그 블록을 붙인다.
4. 첫 응답 0 절의 「추가로 필요한 데이터」를 우선순위순으로 채워 다시 넣는다.
5. 결과의 숫자는 벤치마크 계획을 돌리기 전까지 가설로 다룬다.

```bash
# github.com/1989v/msa — tools/opensearch-sizing/collect.py (표준 라이브러리만)
python3 collect.py --url https://host:9200 --user admin:pass -o input.md
python3 collect.py --url https://search-xxx.es.amazonaws.com --sigv4 ap-northeast-2 -o input.md
```

| 스크립트가 하는 일 | 값 |
|---|---|
| 수집 | `_cat/indices` · `_cat/shards` · `_cat/aliases` · `_nodes` · `_nodes/stats` 표본 N개(기본 60초 × 6 = 5분) |
| 계산 | 노드별 샤드 쿼리/초 · 쿼리 ms/건 · 큐 최대 · rejected 증가 · old GC 증가 |
| 구분 | alias 가 가리키면 서빙. 같은 계열은 suffix 로 새 세대(리인덱스 중) · 이전 세대를 가른다 |
| 가림 | 인덱스 계열명 · alias → `idx-a`, 노드 → `node-1`, AZ → `az-1`. 날짜 suffix 는 남긴다 |
| 게이트 | 받은 원래 이름이 출력에 하나라도 남으면 출력하지 않고 종료 코드 1 |

스크립트 없이 뽑을 때의 명령이다. `_nodes/stats` 는 피크 전후 두 번 받아 델타를 만든다.

```bash
curl -s "$OS/_cat/nodes?v&h=name,node.role,cpu,heap.percent,ram.percent,disk.used_percent"
curl -s "$OS/_cat/nodeattrs?v"
curl -s "$OS/_cat/indices?v&bytes=gb&h=index,pri,rep,docs.count,docs.deleted,pri.store.size,store.size"
curl -s "$OS/_cat/shards?v&bytes=gb"
curl -s "$OS/_cat/aliases?v"
curl -s "$OS/_nodes/stats/indices,thread_pool,jvm"   # 피크 전 · 후 두 번
```

> [!WARNING] `_nodes/stats` 의 두 번째 경로 조각은 indices 전용이다
> `_nodes/stats/indices/search` 는 되지만 `indices/search,thread_pool/search` 는 400 이다. 여러 metric 을 받을 때는 metric 만 나열하고 `filter_path` 로 좁힌다. `_cat/nodes` 는 모르는 열(`zone`)을 오류 없이 빼고 돌려준다.

> [!CAUTION] 외부 LLM 에 넣기 전에 가린다
> 인덱스명 · 호스트 · 계정 ID · 비용은 마스킹한다. AZ 수 · 노드 수 · 풀 리인덱스 방식 같은 구조는 업계 표준 패턴이라 식별 정보가 아니다. 프롬프트에 실제 데이터를 넣고 받은 **답변**은 공개하지 않는다.

## 프롬프트 전문

```text
# 역할과 목표

너는 AWS Managed OpenSearch(OpenSearch Service)를 설계·운영하는
Principal Search Engineer 겸 SRE 다.
아래 입력 데이터를 분석해 현재 검색 클러스터의 적정 구성을 결정하라.

결정할 것
1. 데이터 노드 수와 인스턴스 스펙 — vCPU · RAM · JVM heap · EBS 크기 · IOPS/처리량
2. AZ 배치와 노드 역할 — 전 노드 겸용 vs dedicated master · coordinator
3. 인덱스별 primary · replica 수, 현재 샤드 수의 과다/부족 판정
4. 평상시·피크의 병목(CPU · JVM · 디스크 · 큐 · 팬아웃)과 과소/과대 프로비저닝
5. 3 노드 · 6 노드 등 후보 아키텍처 비교, 확장 기준, 마이그레이션·벤치마크 계획

원칙: AWS 일반 권장값이 아니라 아래 실제 워크로드가 우선이다.
모르는 값은 추정하지 말고 「측정 필요」라고 쓴다.

# 입력 데이터

아래 순서로 준다. 빠진 항목은 분석 첫머리에서 우선순위를 매겨 요청하라.

## 목표 (필수)
- 목표 P99 검색 지연: ? ms · 목표 가용성: ? · 월 비용 상한: ?
- AZ 1개 장애 시 허용되는 지연 저하와 용량 감소: ?

## 클러스터
- OpenSearch 버전 · 리전 · AZ 수 · zone awareness
- 노드 수 · 인스턴스 타입 · vCPU · RAM · JVM heap · EBS 크기 · IOPS · 처리량
- dedicated master 유무 · 노드 역할 · 클러스터 설정
- 형식: _cat/nodes?v&h=name,node.role,cpu,heap.percent,ram.percent,disk.used_percent
        _cat/nodeattrs?v (AZ)
        _cluster/settings

## 인덱스
- _cat/indices?v&bytes=gb&h=index,pri,rep,docs.count,docs.deleted,pri.store.size,store.size
- _cat/shards?v&bytes=gb 전체
- _cat/aliases?v
- 인덱스별 일/주 증가량 · 색인 주기 · 풀 리인덱스 여부와 시간대

## 쿼리
- 대표 쿼리 DSL 전문 · 각 쿼리의 트래픽 비중(%) · 대상 인덱스

## 부하
- 클라이언트 RPS(앱 · 로드밸런서 기준, 인덱스별): 평균 · P95 · P99 · 피크 · 피크 지속 시간
- CloudWatch SearchRate 는 노드별 · 분당 · 샤드 단위 검색 수다. RPS 로 쓰지 않는다

## 시계열 지표 (CloudWatch 또는 _nodes/stats 델타)
- 노드별 CPUUtilization 평균 · P95 · 피크
- JVMMemoryPressure · ThreadpoolSearchQueue · ThreadpoolSearchRejected · SearchLatency
- _nodes/stats/indices/search 의 query_total · query_time_in_millis 델타
- 디스크 사용량 · 풀 리인덱스 시간대와 그 동안의 CPU

# 분석 절차

아래 순서로 분석하고, 각 단계의 결론을 다음 단계의 입력으로 쓴다.

## 1. 입력 검증
- 인덱스를 「서빙」「리인덱스 중 사본」「백업」으로 분류한다.
  날짜 suffix 인덱스는 alias 가 가리키는 것만 서빙이다.
- 서빙이 아닌 인덱스는 검색 팬아웃에서 빼고 저장 피크 계산에만 넣는다.
- 지표의 시간 범위와 해상도를 확인한다.
  1분 해상도가 아니면 초 단위 스파이크는 「측정 필요」다.

## 2. 쿼리 복잡도
쿼리마다 절 구성을 세고 Low / Medium / High / Very High 로 분류한다.
- 대상: must · should · filter · match · multi_match · term · terms · prefix ·
  wildcard · regexp · phrase · nested · geo · function_score · script_score ·
  sort · aggregation · highlight · collapse · rescore · kNN · hybrid · Painless
- 기준은 DSL 길이가 아니라 자원이다.
  CPU:    script_score · function_score · wildcard/regexp · 고카디널리티 집계 ·
          rescore · kNN · should 다수. 점수 계산과 집계는 매칭 문서 수에 비례한다.
  메모리: 집계 · fielddata · 정렬 · 큰 result set · 캐시 압력
  디스크: 콜드 데이터 랜덤 읽기 · 머지 · 색인 · 리커버리
- 트래픽 비중을 곱해 가중 복잡도를 만든다.

## 3. 피크 워크로드와 스레드
용량 산정은 평균이 아니라 피크 RPS 다.
평균 · P95 · P99 · 피크를 분리하고, 피크가 초 단위 스파이크인지
분 단위 지속인지 구분한다. 스레드를 함께 계산한다.

  피크 동시 샤드 쿼리 수 = 피크 RPS × 쿼리당 대상 샤드 수(primary 수)
  노드당 search 스레드   = (vCPU × 3) / 2 + 1   ← 설정이 아니라 파생값
  총 스레드             = 노드 수 × 노드당 search 스레드
  샤드 쿼리 1건당 시간  = Δ query_time_in_millis ÷ Δ query_total
  필요 스레드           ≈ 피크 동시 샤드 쿼리 수 × 샤드 쿼리 1건당 시간(초)

필요 스레드가 총 스레드에 가까우면 큐가 쌓이고 rejected 가 난다.
primary 를 늘리면 팬아웃이 같이 는다.

## 4. CPU
노드별 평균 · P95 · 피크 CPU 를 search 큐 · rejected · 지연과 같이 본다.
- 전 노드 90~100%: 클러스터 CPU 용량 부족.
  단 query cache 적중률이 낮으면 파일캐시 부족이 CPU 로 나타난 것이다.
- 일부 노드만 90~100%: 핫 샤드 · 샤드 편중 · 라우팅.
  노드를 늘리기 전에 _cat/shards 분포부터 본다.
- CPU 낮은데 지연 높음: JVM/GC · 디스크 I/O · 스레드 풀 큐 · 팬아웃 ·
  조정 노드 병합 · 네트워크.
- 클러스터 간 비교는 백분율이 아니라 샤드 쿼리 1건당 CPU 시간으로 한다.
- docs.deleted 비율이 10% 를 넘으면 같은 쿼리가 그만큼 비싸다.

## 5. JVM · 메모리
heap 사용률 · GC 빈도와 정지 · old gen · circuit breaker · fielddata ·
query/request cache 를 본다.
AWS 관리형은 heap 이 RAM 의 절반(상한 약 32GB)으로 고정이라 튜닝 대상이 아니다.
나머지 RAM 이 파일시스템 캐시다 — 데이터:캐시 비율을 적는다.

## 6. 디스크
현재 store.size 가 아니라 피크를 쓴다.

  피크 = 서빙 인덱스 × (1 + replicas)
       + 리인덱스 중 새 인덱스 × (1 + 색인 시 replicas)
       + 머지 여유(약 +20%) + OS/예약분
  워터마크 85 / 90 / 95% 대비 여유를 적는다.

리인덱스 시간대가 검색 피크와 겹치는지,
색인 중 replica 0→N · refresh_interval 조정을 쓰는지 확인한다.

## 7. 인덱스별 primary 수
인덱스마다 독립으로 정한다. 「노드 3대니 전부 3 primary」식으로 정하지 않는다.
- 후보(1 · 3 · 6 등)마다 샤드 크기 · docs/샤드 · 팬아웃 · 3단계의 필요 스레드 ·
  리커버리 시간 · 향후 증가를 표로 비교한다.
- 샤드 크기 10~50GB 는 참고 구간이지 법칙이 아니다.
  작은 샤드가 많으면 샤드 오버헤드(heap 1GB 당 20개 이하가 참고치),
  큰 샤드는 리커버리 · 머지 · 지연.
- primary 수는 사후에 바꾸기 어렵다 — _split · _shrink 는 read-only 블록과
  routing shard 조건이 붙는다. 풀 리인덱스 구조라면 새 인덱스로 만들고
  alias 를 옮긴다.

## 8. 인덱스별 replica 수
replica 는 HA 와 읽기 분산 두 역할이다.
AZ 수 · 노드 수 · 읽기 RPS · 색인량 · 저장 비용 · 리커버리를 넣어
0 · 1 · 2 를 비교한다.
- 3 AZ 에서 replica = AZ − 1 이면 AZ 마다 사본이 놓여
  AZ 1개 장애에 전 샤드가 살아남는다.
- replica 를 늘려도 읽기 처리량은 선형으로 늘지 않는다.
  노드가 그대로면 같은 vCPU 를 나눠 쓴다.

## 9. 노드 수와 역할
후보: 3 노드 · 6 노드. 필요하면 4 · 5 — 단 AZ 배수가 아니면 샤드가 고르게 놓이지 않는다.
후보마다 AZ 분산 · 총 vCPU · 총 스레드 · 샤드/사본 배치 ·
AZ 1개 장애 시 남는 노드와 샤드 가용성 · 리인덱스 여력 · 리커버리 시간 ·
비용 · 운영 복잡도를 비교한다.

역할:
- 전 노드 겸용(master-eligible + data + coordinating)이 작은 클러스터의 기본이다.
  역할 분리는 노드 수와 비용을 늘린다.
- dedicated master 의 근거는 쿼럼이 아니라 클러스터 상태 작업을
  검색 CPU 에서 격리하는 것이다. 최신 OpenSearch 는 투표 구성이 자동이라
  master-eligible 이 짝수여도 split-brain 은 없다.
  다만 6대는 5대와 같은 2대 장애를 견디므로 6번째는 쿼럼에 기여하지 않는다.
- dedicated coordinator 는 높은 RPS · 큰 집계 · 큰 팬아웃 · 큰 응답 병합으로
  데이터 노드 CPU 가 조정 작업과 경쟁할 때 검토한다.
- AWS 관리형 제약: 노드 역할은 data · dedicated master ·
  dedicated coordinator(2024-11 지원 시작) · UltraWarm · cold 뿐이다.
  ingest-only 는 없다. 역할 커스텀은 불가하다.

## 10. 헤드룸
최종 구성은 피크 기준이되 피크에 CPU 100% 를 쓰는 구성은 추천하지 않는다.
「몇 % 가 적정」은 법칙이 아니라 피크 지속 시간 · 스파이크 빈도 · 목표 지연으로 정한다.
현재와 추천 구성의 평균/피크 CPU · heap · 디스크 · 큐 · rejected · 지연을 나란히 적는다.

## 11. 비용
ap-northeast-2 기준. 가격을 확인할 수 없으면 추정하지 말고
인스턴스 타입 · 수 · EBS 만 명시해 사용자가 AWS Pricing Calculator 에서 보게 한다.

## 12. 검증 계획
- 마이그레이션: 새 샤드 구성으로 인덱스 생성 → 풀 색인 → 결과/성능 검증 →
  alias 전환 → 옛 인덱스 보존 → 문제 없으면 삭제.
- 벤치마크: primary 1 vs 3 vs 6, 3 노드 vs 6 노드,
  대표 쿼리별 P50 · P95 · P99 · CPU · JVM · 처리량.
  도구는 OpenSearch Benchmark 또는 운영 쿼리 리플레이.

# 출력 형식

아래 순서와 제목 그대로 쓴다. 절을 새로 만들지 않는다.
분석 절차의 계산 과정은 그 결과가 들어가는 절(6 · 8 등) 안에 쓴다.

0. Input Validation — 인덱스 분류(서빙 · 사본 · 백업) · 입력 간 모순 ·
   추가로 필요한 데이터(우선순위순)
1. Executive Summary — 가장 중요한 문제 3~5개
2. Current Workload — 표: 항목(Node · CPU · RPS · JVM · Disk · Docs · Primary data)
   × 현재값 · Peak · 평가
3. Node Architecture Candidates — 표: 구성 · 노드 수 · 인스턴스 · 역할 ·
   예상 CPU · HA · 비용 · 특징
4. Node Role Architecture — 3 노드 · 6 노드별 겸용/분리 토폴로지
5. Index Shard Recommendation — 인덱스별 표: Docs · Primary size · 현재 P/R ·
   추천 P/R · Shard size · RPS · Complexity · 근거.
   불확실하면 「1 vs 3 벤치마크 필요」로 표시
6. Primary Shard Reasoning — 인덱스별로
   현재 P · 예상 샤드 크기 · 예상 RPS · 복잡도 · 필요 스레드 → 추천 P
7. Replica Recommendation — 인덱스별 0 · 1 · 2 비교.
   3 AZ · 3 노드 · replica 2 와 3 AZ · 6 노드 · replica 2 의 차이를 명시
8. Peak Bottleneck — CPU · JVM · 디스크 · 큐 · 팬아웃 중 무엇이 병목인가
9. Scaling Triggers — scale-up · scale-out · 쿼리 최적화 · replica 증가 ·
   primary 증가 각각의 조건
10. Recommended Final Architecture — 아래 형식
    AWS Managed OpenSearch / AZ: N
    Data nodes: N / Instance / vCPU / RAM / EBS / IOPS
    Dedicated master: Yes·No (N) / Coordinator: Yes·No / Zone awareness
    인덱스별 P/R
11. Cost — 현재 · 후보별
12. Migration Plan
13. Benchmark Plan
14. 추천을 뒤집는 조건

# 원칙

1. 샤드 수는 데이터 크기 · 문서 수 · RPS 중 하나로 정하지 않는다.
   셋과 쿼리 복잡도를 함께 본다.
2. 모든 인덱스에 같은 P/R 을 강제하지 않는다.
3. 노드를 늘리기 전에 병목을 식별한다. 일부 노드만 CPU 가 높으면 핫 샤드부터.
4. 피크와 AZ 1개 장애를 반드시 계산한다.
   풀 리인덱스가 있으면 저장 피크와 CPU 겹침을 계산한다.
5. 모든 숫자 추천에 근거를 붙이고, 모르는 값은 「측정 필요」로 둔다.
6. 웹 접근이 없으면 AWS · OpenSearch 문서의 기준 시점을 밝히고
   확인 필요 항목을 표시한다. Elasticsearch 7.x 와 최신 OpenSearch 의
   동작을 혼동하지 않는다.
7. 입력이 부족하면 결론을 억지로 만들지 말고
   추가 데이터를 우선순위순으로 요청한다.
```

## 정리

1. **입력에 목표 SLO 를 넣는다.** 헤드룸은 지시가 아니라 목표에서 나온다.
2. **샤드 수와 노드 수를 스레드 식 하나로 묶는다.** 피크 RPS × 샤드 수 × 샤드 쿼리 시간이 총 스레드를 넘으면 큐가 쌓인다.
3. **인덱스별로 독립 판단시킨다.** 노드 수와 primary 수는 다른 값이다.
4. **모델이 틀리기 쉬운 관리형 제약은 값으로 적어 둔다.** 「문서를 확인하라」는 웹 접근이 없으면 빈 지시다.
5. **모르는 값은 추정 금지.** 「측정 필요」와 추가 데이터 요청이 답의 일부다.
6. **답변은 공개하지 않는다.** 프롬프트는 구조만 담아 공개해도 되지만, 실제 데이터를 넣은 답은 그 클러스터의 것이다.

> [!NOTE] 기준
> AWS Managed OpenSearch 의 노드 역할 · heap 정책 · coordinator 지원 시점은 2026-09 기준이다. 벤더 문서가 바뀌면 프롬프트의 제약 표부터 갱신한다.
