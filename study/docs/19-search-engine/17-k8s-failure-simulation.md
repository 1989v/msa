---
parent: 19-search-engine
seq: 17
title: K3d 장애 시뮬레이션 — ES 노드 죽이기, Shard 리밸런싱 관찰, Yellow→Red 진단 절차서
type: deep
created: 2026-05-03
---

# 17. K3d 장애 시뮬레이션 절차서

> 묶음 3 (B) 의 실전 — 운영 사고를 미리 재현해서 진단 / 복구 절차를 검증. 본 문서는 **절차서** (실행은 선택, 절차 + 예상 결과 + 디버깅 체크리스트 작성).

## 1. 한 줄 핵심

> **운영 사고는 "준비된 사람" 만 빠르게 복구한다.**
> staging / k3d 에서 의도적으로 깨뜨려보고 진단 / 복구 절차를 손에 익히는 것이 사후 사고 비용을 압도적으로 줄인다 (chaos engineering).

## 2. 사전 준비

### 2-1. msa 클러스터 기동

```bash
# k3d 클러스터 + ingress
# (k8s/infra/local/ingress-nginx/README.md 참조)

# 인프라 + 서비스 일괄
kubectl apply -k k8s/overlays/k3s-lite

# 이미지 빌드 + 클러스터 로드
scripts/image-import.sh --all

# ES 상태 확인
kubectl get pods -n elasticsearch
kubectl port-forward -n elasticsearch svc/elasticsearch 9200:9200 &
curl -s localhost:9200/_cluster/health | jq
```

### 2-2. 시뮬레이션용 데이터 색인

```bash
# search:batch 실행으로 product DB → ES 풀 인덱싱
kubectl exec -n search deployment/search-batch -- \
  curl -X POST localhost:8085/jobs/reindex
```

또는 K8s Job 으로 batch 트리거.

### 2-3. 모니터링 / 관찰 도구

```bash
# 클러스터 상태 watching
watch -n 2 'curl -s localhost:9200/_cluster/health | jq'

# shard 분포
watch -n 2 'curl -s localhost:9200/_cat/shards/products?v'

# 노드 상태
watch -n 2 'curl -s localhost:9200/_cat/nodes?v'
```

## 3. 시나리오 1: Data Node 1개 죽이기 (Replica 가 살아남는가)

### 3-1. 사전 조건

- ES (Elasticsearch) 클러스터: 3 data nodes
- products 인덱스: 3 primary, 1 replica → 6 shard
- cluster health: green

### 3-2. 절차

```bash
# 데이터 노드 1개 강제 종료
kubectl delete pod -n elasticsearch elasticsearch-data-0 --grace-period=0 --force

# 즉시 health 확인
curl -s localhost:9200/_cluster/health | jq
# 예상: status=yellow (replica 일부 미할당)

# shard 분포 확인
curl -s localhost:9200/_cat/shards/products?v
# 예상: UNASSIGNED replica 가 보임 (또는 다른 노드로 이동 중)

# 검색 sanity
curl -s "localhost:9200/products/_search?q=갤럭시"
# 예상: 정상 응답 (replica 가 다른 노드에 있으면 검색 가능)
```

### 3-3. 예상 결과

| 시점 | cluster status | 검색 가능? | 인덱싱 가능? |
|---|---|---|---|
| pod 죽인 직후 | yellow | ✅ | ✅ |
| K8s 가 pod 재시작 (StatefulSet) | yellow → 회복 시도 | ✅ | ✅ |
| ES 가 새 노드에 replica 재배치 | yellow → green | ✅ | ✅ |
| 회복 시간 | ~1~3분 (shard 크기 의존) | - | - |

### 3-4. 디버깅 체크리스트

- [ ] cluster status 가 green 으로 자동 회복되는가
- [ ] 검색 latency 에 spike 가 있는가 (replica 미할당 시간)
- [ ] indexing 이 일시 중단되는가 (primary 가 죽으면 promote 시간)
- [ ] K8s pod 가 자동 재시작되는가 (StatefulSet 정책)
- [ ] PVC 가 재사용되는가 (데이터 보존)

### 3-5. 실패 시 (yellow 영구 지속)

```bash
# unassigned shard 이유
curl -s localhost:9200/_cluster/allocation/explain | jq

# 흔한 원인
# - max_shards_per_node 초과 → cluster setting 조정
# - allocation awareness 충돌 → zone 설정 확인
# - disk watermark → df -h 확인
```

## 4. 시나리오 2: Master Node 죽이기 (Quorum 회복)

### 4-1. 사전 조건

- master nodes: 3 (m0, m1, m2)
- 현재 elected master: m0

### 4-2. 절차

```bash
# 현재 master 확인
curl -s localhost:9200/_cat/master?v
# m0 가 master

# master 1개 죽이기
kubectl delete pod -n elasticsearch elasticsearch-master-0 --grace-period=0 --force

# 즉시 master 재선출 확인
curl -s localhost:9200/_cat/master?v
# 예상: m1 또는 m2 가 새 master (수 초 내)

# cluster health
curl -s localhost:9200/_cluster/health | jq
# 예상: 일시 yellow → green 회복
```

### 4-3. 예상 결과

| 시점 | master | 검색 / 인덱싱 |
|---|---|---|
| m0 죽음 | (election 진행) | 일시 ❌ (수 초) |
| election 완료 | m1 또는 m2 | ✅ 회복 |
| m0 자동 재시작 | 3 master 다시 가용 | ✅ |
| 총 영향 시간 | 5~30초 |

### 4-4. 디버깅 체크리스트

- [ ] election 이 자동으로 완료되는가 (수 초)
- [ ] cluster state update 가 정상 작동하는가 (인덱스 생성 / 매핑 변경 등)
- [ ] discovery.seed_hosts 설정이 정확한가

### 4-5. 만약 master 2개 죽이면 (quorum 깨짐)

```bash
kubectl delete pod -n elasticsearch elasticsearch-master-0 --grace-period=0 --force
kubectl delete pod -n elasticsearch elasticsearch-master-1 --grace-period=0 --force

# 1개 master 만 살아있음 → quorum 부족
# cluster 상태 변경 불가, 새 인덱싱 / shard allocation 정지
# 검색은 일시 가능 (기존 routing table 으로)
```

→ **master 는 절대 1개로 운영 ❌** 의 실증.

## 5. 시나리오 3: 디스크 가득 (Flood Stage)

### 5-1. 절차

```bash
# 한 노드의 디스크를 dummy 파일로 채우기
kubectl exec -it -n elasticsearch elasticsearch-data-0 -- \
  fallocate -l 90G /usr/share/elasticsearch/data/dummy.bin

# disk usage 확인
curl -s localhost:9200/_cat/allocation?v
# disk usage 95%+ 노드 표시

# cluster setting 확인
curl -s localhost:9200/_cluster/settings?include_defaults=true | \
  jq '.defaults.cluster.routing.allocation.disk.watermark'
# low: 85%, high: 90%, flood_stage: 95%

# 인덱싱 시도
curl -X POST "localhost:9200/products/_doc/test_id" -H "Content-Type: application/json" \
  -d '{"name": "test"}'
# 예상: 423 Locked (cluster_block_exception, index in read-only mode)
```

### 5-2. 복구

```bash
# dummy 파일 삭제
kubectl exec -it -n elasticsearch elasticsearch-data-0 -- \
  rm /usr/share/elasticsearch/data/dummy.bin

# 인덱스 read-only 해제
curl -X PUT "localhost:9200/products/_settings" -H "Content-Type: application/json" \
  -d '{"index.blocks.read_only_allow_delete": null}'

# 다시 인덱싱
curl -X POST "localhost:9200/products/_doc/test_id" -d '{...}'
# 예상: 정상
```

### 5-3. 디버깅 체크리스트

- [ ] flood_stage 도달 시 인덱스가 자동 read-only 가 되는가
- [ ] 디스크 정리 후 read_only_allow_delete 를 수동 해제해야 하는가
- [ ] alert 가 정확히 발화하는가 (Prometheus 룰)
- [ ] disk usage 모니터링이 노드 단위인가 (전체 평균이 아닌)

## 6. 시나리오 4: Search 쿼리 폭주 (Thread Pool Exhaustion)

### 6-1. 절차

```bash
# 무거운 쿼리를 동시 다발 (예: hey 또는 wrk)
hey -z 60s -c 200 -m POST "http://localhost:9200/products/_search" \
  -H "Content-Type: application/json" \
  -d '{"query": {"wildcard": {"name": "*갤*"}}}'

# 동시에 thread pool 모니터링
watch -n 1 'curl -s localhost:9200/_cat/thread_pool/search?v'
# active / queue / rejected 확인
```

### 6-2. 예상

```
node     name      active queue rejected
node-1   search       50    100    23
node-2   search       50     50     0
```

→ rejected = 0 이 아닌 값 = 큐 가득 → 일부 요청 거부됨 (429).

### 6-3. 진단

```bash
# hot_threads
curl -s localhost:9200/_nodes/hot_threads?threads=5&interval=1s
# 예상: search 스레드가 wildcard query 의 term traversal 에 시간 소비

# slow log 활성
curl -X PUT "localhost:9200/products/_settings" -d '{
  "index.search.slowlog.threshold.query.warn": "500ms"
}'

# 다시 부하 → slow log 확인
```

### 6-4. 디버깅 체크리스트

- [ ] thread pool rejected 가 메트릭으로 노출되는가
- [ ] 사용자 응답이 429 / timeout 인지 (5xx 아님)
- [ ] slow log 가 실제로 기록되는가
- [ ] hot_threads 가 의미 있는 정보 주는가

## 7. 시나리오 5: Network Partition (Split Brain)

### 7-1. 절차 (k3d 에서 시뮬레이션)

```bash
# NetworkPolicy 로 master quorum 분리
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: isolate-master-2
  namespace: elasticsearch
spec:
  podSelector:
    matchLabels:
      role: master
      ordinal: "2"
  policyTypes: [Ingress, Egress]
  ingress: []
  egress: []
EOF

# m2 가 격리됨, m0 + m1 quorum 유지
# m2 는 master 와 통신 못 함 → 자체적으로 master 후보 ❌ (quorum 부족)

# 5분 후 health
curl -s localhost:9200/_cluster/health | jq
# 예상: green 또는 yellow (m0, m1 정상)

# 격리 해제
kubectl delete networkpolicy -n elasticsearch isolate-master-2

# m2 재합류 확인
curl -s localhost:9200/_cat/nodes?v
```

### 7-2. 예상

- ES 의 quorum-based discovery → split-brain 방지 (m2 는 election 못 함)
- 격리 해제 시 자동 재합류

### 7-3. 디버깅 체크리스트

- [ ] split-brain 발생 안 함을 확인
- [ ] 격리된 노드의 로그에 "no master node" 메시지
- [ ] 재합류 시간이 합리적인가

## 8. 시나리오 6: 인덱스 통째로 삭제 → Snapshot Restore

### 8-1. 사전 조건

- snapshot repository 등록
- daily snapshot 1개 이상 생성

### 8-2. 절차

```bash
# 1. snapshot 가용 확인
curl -s localhost:9200/_snapshot/s3_repo/_all | jq

# 2. 인덱스 강제 삭제 (사고 재현)
curl -X DELETE "localhost:9200/products"

# 3. 검색 시도 → 404
curl -s "localhost:9200/products/_search?q=*"
# {"error": "index_not_found_exception", ...}

# 4. snapshot restore
curl -X POST "localhost:9200/_snapshot/s3_repo/snapshot_2026_05_03/_restore" \
  -H "Content-Type: application/json" \
  -d '{
    "indices": "products",
    "rename_pattern": "products",
    "rename_replacement": "products_restored"
  }'

# 5. 복구 진행 모니터링
curl -s localhost:9200/_recovery?v

# 6. 복구 완료 후 alias swap (옛 alias 가 있다면)
curl -X POST "localhost:9200/_aliases" -d '{
  "actions": [
    {"add": {"index": "products_restored", "alias": "products"}}
  ]
}'

# 7. 검증
curl -s "localhost:9200/products/_search?q=*&size=1"

# 8. RTO 측정 (3 ~ 7 단계 시간)
```

### 8-3. 디버깅 체크리스트

- [ ] snapshot 이 실제 가용한가 (S3 권한, 호환성)
- [ ] restore 시간이 RTO SLA 안에 들어가는가
- [ ] alias swap 으로 무중단 가능한가
- [ ] 복구된 인덱스의 doc 수가 snapshot 시점과 일치하는가

## 9. 시나리오 7: Reindex 중간 실패

### 9-1. 절차

```bash
# 1. search:batch reindex 시작
kubectl exec -n search deployment/search-batch -- \
  curl -X POST localhost:8085/jobs/reindex

# 2. 새 인덱스 진행 확인
watch -n 2 'curl -s localhost:9200/_cat/indices/products_v*?v'

# 3. 중간에 batch pod 강제 종료
kubectl delete pod -n search -l app=search-batch --grace-period=0 --force

# 4. cluster 상태 확인
curl -s localhost:9200/_cluster/health | jq
curl -s localhost:9200/_cat/aliases?v   # alias 가 옛 인덱스에 있어야 함

# 5. 새 인덱스 (부분 reindex) 정리
curl -X DELETE "localhost:9200/products_v20260503_*"
```

### 9-2. 예상

- ReindexJobExecutionListener 가 batch 실패 시 alias swap 안 함 (`§15` 검증) ✅
- 사용자는 옛 인덱스 그대로 사용 (lag 0)
- 새 인덱스만 부분 데이터 → 수동 정리

### 9-3. 디버깅 체크리스트

- [ ] alias 가 옛 인덱스 가리키는가
- [ ] 옛 인덱스 검색이 정상인가
- [ ] 부분 인덱스 자동 정리 메커니즘이 있는가 (없으면 운영 부담)

## 10. 시나리오 8: Kafka Consumer Lag 폭증

### 10-1. 절차

```bash
# 1. product 서비스에서 의도적 폭주 (대량 update)
for i in {1..10000}; do
  curl -X PUT "http://localhost:8081/products/$i" \
    -H "Content-Type: application/json" \
    -d '{"price": '$((100000 + i))'}' &
done

# 2. Kafka consumer lag 모니터링
kubectl exec -n kafka kafka-0 -- \
  kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group search-indexer

# 3. ES 인덱싱 throughput 모니터링
watch -n 2 'curl -s localhost:9200/_cluster/stats | jq .indices.indexing'

# 4. 5분 후 lag 회복 시간 측정
```

### 10-2. 예상

- consumer lag spike → 점진 회복
- 회복 속도 = consumer 처리 throughput
- 너무 느리면 → consumer scale-out (replica ↑) 또는 batch ↑

### 10-3. 디버깅 체크리스트

- [ ] consumer lag 메트릭이 노출되는가
- [ ] lag SLA 알람이 있는가 (예: lag > 1만 = warning)
- [ ] consumer scale-out 으로 회복 속도 빨라지는가
- [ ] DLQ 로 실패 메시지 분리되는가

## 11. 시나리오 9: 임베딩 모델 교체 (Vector 적용 후)

### 11-1. 절차 (PoC 가정 — §18 PoC 후)

```bash
# 1. 새 임베딩 모델 (예: bge-m3 → multilingual-e5-large) 결정
# 2. dual indexing 시작
#    - new 인덱스에 새 모델 임베딩
#    - old 인덱스 유지

# 3. 새 인덱스에 모든 doc 재인덱싱 (시간 소요)
kubectl exec -n search deployment/search-batch -- \
  curl -X POST "localhost:8085/jobs/reindex?embedding_model=multilingual-e5-large"

# 4. A/B 비교 (검색 품질 메트릭)

# 5. 검증 후 alias swap
curl -X POST "localhost:9200/_aliases" -d '{ ... }'

# 6. 옛 인덱스 정리
```

### 11-2. 디버깅 체크리스트

- [ ] mapping 의 model 메모가 정확한가
- [ ] dual indexing 동안 메모리 / 디스크 충분한가
- [ ] 임베딩 추론 throughput 이 인덱싱 throughput 의 병목인가
- [ ] 검색 품질 (nDCG) 이 신모델에서 향상되는가

## 12. 운영 체크리스트 (시뮬레이션 결과 기반)

장애 시뮬레이션 후 다음 항목들이 확인되어야:

### 12-1. 가용성

- [ ] 데이터 노드 1개 죽어도 검색 정상 (replica 가용)
- [ ] master 1개 죽어도 election 정상 (3 master)
- [ ] zone 1개 다운 시 자동 페일오버 (allocation awareness)

### 12-2. 데이터 보호

- [ ] daily snapshot 자동 생성 + S3 보관 + retention
- [ ] snapshot restore 절차 검증 (분기 1회)
- [ ] product DB → ES 재인덱싱 RTO 측정

### 12-3. 모니터링 / 알람

- [ ] cluster health alert (yellow > 5분 / red 즉시)
- [ ] disk watermark alert (85% / 90% / 95%)
- [ ] consumer lag alert
- [ ] thread pool rejected alert
- [ ] heap usage alert

### 12-4. 사고 대응

- [ ] runbook (`docs/runbooks/search-incident-response.md`) 작성
- [ ] hot_threads / slow_log 활용 절차 명시
- [ ] on-call 담당 / escalation 프로세스

## 13. 시뮬레이션 결과 기록 템플릿

```markdown
# 검색 장애 시뮬레이션 결과 — YYYY-MM-DD

## 환경
- 클러스터: k3d local / staging
- ES 버전: 8.x
- 노드: 3 master + 3 data
- 인덱스: products (1 primary, 1 replica, ~100MB)

## 시나리오 결과

### 시나리오 1: data node 죽이기
- 회복 시간: 약 1분 30초
- 검색 영향: latency P99 일시 ↑ (1초 → 2초), 5분 후 정상
- 인덱싱 영향: 없음
- 발견 사항: K8s StatefulSet 자동 재시작 OK, PVC 재사용 정상

### 시나리오 2: master quorum
...

## 개선 항목
- [ ] disk watermark alert 임계값 조정 (85% → 80%)
- [ ] snapshot retention 30일 → 60일
- ...
```

→ 시뮬레이션을 분기마다 수행하고 결과 기록 / 추적.

## 14. 다음 학습

- [18-hybrid-search-poc.md](18-hybrid-search-poc.md) — vector 적용 후 시뮬레이션 시나리오 추가
- [19-improvements.md](19-improvements.md) — 시뮬레이션 결과 기반 ADR
- [20-interview-qa.md](20-interview-qa.md) — 장애 대응 면접 질문

> **§17 회독 체크리스트**:
> - [ ] 9개 시나리오의 절차 / 예상 / 디버깅 체크리스트 이해
> - [ ] data node vs master node 장애의 차이
> - [ ] flood_stage 시 자동 read-only 와 수동 해제
> - [ ] split-brain 방지 (quorum) 의 실증
> - [ ] snapshot restore 의 RTO 실측
> - [ ] reindex 중간 실패 시 alias 안전성
> - [ ] chaos engineering 의 운영 가치 (사후 비용 vs 사전 비용)
