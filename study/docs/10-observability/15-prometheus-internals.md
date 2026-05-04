---
parent: 10-observability
seq: 15
title: Prometheus Internals — TSDB / Block / WAL / Compression / SD / Federation / Remote Write / HA / Cardinality
type: deep-dive
created: 2026-05-05
updated: 2026-05-05
status: completed
related:
  - 99-concept-catalog.md
  - 02-prometheus-pull-model.md
  - 03-metric-types-and-cardinality.md
  - 04-promql-and-alerting.md
  - 12-msa-current-state.md
  - 16-opentelemetry-deep.md
sources:
  - https://prometheus.io/docs/prometheus/latest/storage/
  - https://prometheus.io/docs/prometheus/latest/configuration/configuration/
  - https://prometheus.io/docs/prometheus/latest/federation/
  - https://prometheus.io/docs/practices/naming/
  - https://www.robustperception.io/how-much-ram-does-prometheus-2-x-need
  - https://github.com/prometheus/prometheus/tree/main/tsdb
  - https://github.com/prometheus/prometheus/blob/main/docs/feature_flags.md
  - https://grafana.com/docs/mimir/latest/
  - https://thanos.io/tip/thanos/quick-tutorial.md/
  - https://www.usenix.org/conference/atc15/technical-session/presentation/pelkonen
catalog-row: "§A (Native Histogram / Federation / Mimir·Thanos·VictoriaMetrics) + §J (cardinality / Pushgateway 함정) — Prometheus 내부 (★ → ✅)"
---

# 15. Prometheus Internals — TSDB / Block / WAL / Compression / SD / Federation / Remote Write / HA / Cardinality

> 카탈로그 매핑: §99 §A `Native Histogram` / `Federation` / `Mimir·Cortex·Thanos·VictoriaMetrics`, §J `Pushgateway 함정` / `cardinality`, §G `Recording rules / Alerting rules` (★ → ✅).
> 학습 시간 예상: ~3h · 자가평가 입구 레벨: B+

> §02 (Pull 모델 / ServiceMonitor) 의 layer 아래. Prometheus 가 "왜 이렇게 빠르고 가볍게 수십만 series 를 다루는가" 의 답은 TSDB (Time-Series DataBase, 시계열 데이터베이스) 의 head + persistent block + WAL (Write-Ahead Log, 선기록 로그) 3-tier 구조와 Gorilla XOR 압축에 있다. 본 글은 (1) on-disk 레이아웃, (2) 샘플 압축, (3) chunk 라이프사이클, (4) Service Discovery (SD) + relabel_configs 의 위력, (5) PromQL (Prometheus Query Language) 의 vector 모델 함정, (6) Federation / Remote Write / HA, (7) cardinality 폭증 방어를 다룬다. msa 의 retention 15d / scrape 30s 결정 근거가 어디서 오는지 grounding.

---

## 1. 한 줄 핵심

> **Prometheus = "head block (RAM) + 2h persistent block (디스크) + WAL (crash recovery)" 3-tier TSDB 위에 Gorilla XOR 압축을 얹은 single-binary 시스템.**
> 단일 프로세스에서 수백만 active series 를 처리할 수 있는 핵심은 (1) 16-byte 샘플이 압축 후 평균 1.3 byte 로 줄어드는 XOR + delta-of-delta 알고리즘과 (2) 쓰기는 전부 head 에 모았다가 2시간 단위로 immutable block 으로 떨궈서 write amplification 을 막는 LSM 류 디자인이다. HA / 장기 저장은 외부 (Thanos / Mimir / VictoriaMetrics) 로 미루는 의도된 단순화.

---

## 2. 등장 배경 — 왜 새 TSDB 인가

### 2-1. 1.x TSDB 의 한계

Prometheus 1.x 는 series 당 한 파일을 쓰는 **per-series file** 모델 — series 가 100만 넘으면 inode 폭발, OS 페이지 캐시도 무용지물. 2.x (2017+) 의 TSDB v3 가 Fabian Reinartz 의 "Writing a Time Series Database from Scratch" 글에서 제시한 head + block 모델로 갈아엎으면서 단일 노드의 한계가 한 자릿수 → 두 자릿수 백만 series 로 확장됐다.

### 2-2. Gorilla 논문 (Facebook 2015)

Pelkonen et al., VLDB 2015. "샘플 1개 = `(timestamp 8B, value 8B) = 16B` 인데 시계열 데이터는 자기 자신과 매우 닮았다 → XOR 차이만 저장하면 평균 1.37 byte 까지 줄어든다." Prometheus 2.x 가 이 알고리즘을 chunk 압축에 그대로 채택. **압축이 본질**, 디자인의 다른 부분은 이걸 살리기 위한 인프라.

### 2-3. msa 컨텍스트

`k8s/infra/prod/monitoring/values.yaml` 는 retention 15d + memory limit 2Gi. 이 두 숫자가 어떻게 얽혀있는지 (head series × bytes-per-sample × samples-per-second × retention) 의 산술을 §11 에서 grounding.

---

## 3. 동작 원리 — TSDB 3-tier 구조

### 3-1. 전체 다이어그램

```
                      ┌──────────────────────────────────────┐
   scrape (30s) ─────▶│  HEAD (in-memory, mmap'd chunks)     │
                      │  - 가장 최근 ~3h 의 샘플             │
                      │  - active series index               │
                      │  - WAL append (매 sample)            │
                      └─────────────┬────────────────────────┘
                                    │ 매 2h compact
                                    ▼
            ┌────────────────────────────────────────────┐
            │  Persistent Block 1  (2h window, immutable)│
            │  ├─ chunks/        ← 압축된 샘플           │
            │  ├─ index          ← postings + label idx  │
            │  ├─ tombstones     ← 삭제 마크             │
            │  └─ meta.json      ← 블록 메타             │
            └────────────────────────────────────────────┘
            ┌────────────────────────────────────────────┐
            │  Block 2 / 3 / ...  (background compaction)│
            └────────────────────────────────────────────┘
                                    │
                                    ▼
                      retention 만료 시 디렉터리 삭제
```

3 layer:
- **Head block**: in-memory, 가장 핫한 데이터. 모든 쿼리의 첫 번째 진입점.
- **Persistent block**: 2 시간 윈도우 단위 immutable. 디스크.
- **WAL**: head 의 "log". 크래시 시 재구성.

### 3-2. Head block 의 in-memory 구조

```
HEAD = {
  series_index: stripeMap<labelHash, *memSeries>     // 1 << 14 stripe 로 락 분산
  postings:     map<labelName -> map<labelValue -> []seriesRef>>
  symbols:      string interning table
  chunks:       memSeries[].headChunk (mmap 가능)
  WAL:          append-only segment 들
}
```

핵심 포인트:
1. **series 자체는 RAM**: 메모리에 active series 마다 `memSeries` 구조체 (라벨 해시 + 압축 chunk 64KB 정도) 가 상주. → series 1개당 약 3KB ~ 12KB (라벨 길이/개수 따라). **이게 Prometheus 의 RAM 지배 요인**.
2. **stripeMap**: lock contention 회피. 16K 개 lock stripe.
3. **postings index**: `(labelName, labelValue) -> series IDs` 의 sorted list. PromQL 의 `{job="api", method="GET"}` 같은 selector 가 이 inverted index 로 series 를 찾는다.
4. **mmap'd head chunks**: head 가 너무 크면 일부 chunk 를 OS 가 디스크로 swap 가능 (`chunks_head/` 디렉터리). 2.19+ 부터.

### 3-3. Persistent block 디스크 구조

`data/<ULID>/` 디렉터리:

```
01HXYZABCDEF.../
├─ chunks/
│   ├─ 000001            # 512MB 단위로 잘라진 chunk segment 파일
│   ├─ 000002
│   └─ ...
├─ index               # postings + symbols + series + chunk pointers
├─ tombstones         # 삭제 마크 (drop API)
└─ meta.json
```

- **ULID 디렉터리명**: 시간 정렬 가능한 unique ID. compaction 결과 합쳐진 새 블록도 같은 형식.
- **chunks/**: 실제 압축 샘플. block 안에서 series 한 개의 모든 chunk 가 거기 들어감.
- **index**: 8 종 섹션 (symbols / series / label index / postings / postings offset table / TOC ...). PromQL 의 첫 단계 = postings 리졸루션.
- **tombstones**: 삭제 (API `/admin/tsdb/delete_series`) 시 즉시 지우지 않고 마크. 다음 compaction 에서 실제 제거.
- **meta.json**:

```json
{
  "ulid": "01HXYZABCDEF...",
  "minTime": 1714617600000,
  "maxTime": 1714624800000,
  "stats": {
    "numSamples": 28934123,
    "numSeries": 154321,
    "numChunks": 320145
  },
  "compaction": { "level": 1, "sources": ["..."] },
  "version": 1
}
```

### 3-4. WAL — crash recovery 의 보험

WAL (Write-Ahead Log, 선기록 로그) 는 head block 의 모든 mutation 을 디스크에 append:

```
data/wal/
├─ 00000128            # 128MB segment
├─ 00000129
└─ checkpoint.000130/  # 오래된 WAL 을 압축 + truncated 한 결과
```

흐름:
1. scrape → head 에 sample append → WAL 에도 동시 append.
2. 2h 마다 head → persistent block compact 가 끝나면 그 시점 이전 WAL 은 truncate.
3. checkpoint: 더 큰 단위로 정리. 재시작 시 read 비용 절감.

크래시 시:
1. WAL 의 모든 record replay.
2. head 가 메모리에 재구성됨 — 시간 비례.
3. 재시작 시간이 곧 active series 수 × WAL 길이.

**msa 적용 시사**: kube-prometheus-stack 의 default storage 가 PVC (PersistentVolumeClaim, 영구 볼륨 요청) 라서 WAL 도 함께 보존. Pod 재시작 시 head 가 자동 복구. PVC 가 없으면 (`emptyDir`) 재시작마다 head 손실 — 운영에선 절대 금지.

---

## 4. Sample compression — Gorilla XOR + delta-of-delta

### 4-1. 압축 전: 16 byte / sample

```
sample = (timestamp int64, value float64) = 8 + 8 = 16 bytes
```

15초 scrape × 1만 series × retention 15d ≈ 8.6억 sample. 압축 안 하면 ~14GB. 압축 후 ~2GB. **압축이 retention 의 비용 결정**.

### 4-2. timestamp — delta-of-delta

scrape 는 거의 일정 간격이라 timestamp 의 1차 차분도 일정. 2차 차분은 거의 0:

```
t1   = 1714617600
t2   = 1714617615   // delta = 15
t3   = 1714617630   // delta = 15, delta-of-delta = 0
t4   = 1714617646   // delta = 16, delta-of-delta = +1
```

알고리즘:
1. 첫 timestamp 는 raw int64.
2. 두 번째는 delta (varint).
3. 세 번째부터는 delta-of-delta. 0 이면 1bit ("0"), 작으면 짧은 prefix code, 클 때만 풀 비트.

→ scrape 가 정확히 일정하면 timestamp 는 sample 당 평균 1bit 까지.

### 4-3. value — XOR

float64 두 개의 XOR 은 거의 비슷한 값일수록 leading/trailing zero 가 많다:

```
v1 = 0x4034000000000000   // 20.0
v2 = 0x4034400000000000   // 20.5
xor = 0x0000400000000000  // leading 18 hex zero
```

알고리즘:
1. 첫 value 는 raw float64 (8 byte).
2. 다음부터 XOR 계산.
3. XOR 가 0 이면 1bit ("0").
4. 아니면 leading zero 수 + meaningful 비트만 저장 (5+6+meaningful).

→ Counter (단조 증가, 비슷한 값) 에 가장 강력. Gauge 도 보통 1~2 byte/sample.

### 4-4. Native Histogram (Prom 2.40+) — sparse exponential bucket

기존 Histogram:
- bucket boundary 를 application 이 정의 → cardinality 폭증.
- 100 ms latency histogram 에 bucket 30개 = `_bucket` series 30개 + `_count` + `_sum`.

Native Histogram:
- 단일 series 가 sparse exponential bucket 을 자체 보유.
- bucket index = `floor(log_2(value) * 2^schema)` — schema 가 정밀도 (default 0 → factor 2, schema 8 → factor 1.0027).
- 수십~수백 bucket 을 series 1개에 — cardinality 1/30.
- exposition format: protobuf 만 (text/plain 아님).
- PromQL: `histogram_quantile`, `rate` 등 그대로 동작 (특수 함수 추가).

```
# 일반 Histogram
http_server_requests_seconds_bucket{le="0.005",method="GET",status="200"} 1247
http_server_requests_seconds_bucket{le="0.01",method="GET",status="200"} 1389
# ... × 8개 bucket

# Native Histogram
http_server_requests_seconds{method="GET",status="200"} <NHCB encoded>
# series 1개로 모든 bucket 표현
```

→ msa ADR-0025 가 강제하는 `percentiles-histogram=true` 를 Native Histogram 으로 바꾸면 high-cardinality 함정 해소. Spring Boot Micrometer 1.11+ 가 지원 시작 (옵트인).

### 4-5. 압축률 — 실제 수치

Robust Perception (Brian Brazil) 의 운영 수치:
- 평균: **1.3 ~ 2.0 bytes / sample** (압축 후, head + persistent block 평균).
- counter (rate): 1.0 ~ 1.3 bytes.
- gauge (CPU usage 등 노이즈 많음): 2.5 ~ 5 bytes.
- histogram bucket: 1.5 ~ 2.5 bytes (bucket 들끼리 비슷한 값이라 압축 잘됨).

운영 산식:

```
RAM (GB) ≈ active_series × 3KB / 1024 / 1024 + head_chunk_size
disk (GB/day) ≈ active_series × samples_per_sec × 86400 × 1.7 / 1e9
```

예: msa active series 5만, scrape 30s, retention 15d:
- samples/sec = 50000 / 30 ≈ 1670
- disk/day = 1670 × 86400 × 1.7 / 1e9 ≈ 0.25 GB
- 15d ≈ 3.7 GB
- RAM = 50000 × 3KB ≈ 150 MB + head chunks ~500MB ≈ 650MB

→ msa values.yaml 의 limit 2Gi 는 충분. 하지만 active series 가 50만 (예: cardinality 사고) 이면 RAM = 1.5GB 만으로 시작 → death spiral 직전.

---

## 5. Chunk 라이프사이클 — head → persistent → compaction → retention

### 5-1. head chunk 생성

새 series 의 첫 sample 이 들어오면:
1. labels 해시로 stripeMap 검색, 없으면 `memSeries` 생성.
2. `memSeries.headChunk` = 새 빈 chunk (XOR encoder 초기화).
3. WAL 에 series record + sample record append.

### 5-2. head chunk 회전

chunk 1개당 sample 수 한도 (default 120 samples) 또는 시간 (default 2h):
- 한도 초과 → 현재 chunk 를 mmap 가능한 형태로 disk-backed (`chunks_head/`) 로 떨굼.
- 새 head chunk 시작.

### 5-3. 2h compact

Prometheus 가 매 2h boundary (clock-aligned) 에:
1. 그 윈도우의 모든 head chunk 를 모아서 새 persistent block 생성 (`<ULID>/`).
2. WAL truncate — 그 시점 이전 segment 삭제.
3. 메모리에서 윈도우 전 데이터 해제.

### 5-4. 백그라운드 compaction

작은 block 을 큰 block 으로 합치는 단계:

| 레벨 | 윈도우 |
|---|---|
| L1 | 2h (head 직출력) |
| L2 | 6 ~ 8h (3~4 개 L1 합침) |
| L3 | 1 ~ 2d |
| L4+ | retention 한계까지 (max 31d 기본) |

목적:
- 작은 block 이 많으면 PromQL query 가 모든 block 을 열어야 해서 느려짐.
- compaction 으로 block 수를 log scale 로 유지 — 최대 ~10 개 정도.
- compaction 이 새 block 을 만들면 oldest block 의 source 를 metadata 에 기록 (lineage).

### 5-5. retention 만료

`--storage.tsdb.retention.time=15d` (msa). compactor 가 매 주기마다:
- `block.maxTime < now - retention` 인 디렉터리 통째로 삭제.

→ retention 이 곧 디스크 상한. msa 15d 는 hot 데이터 + Grafana 대시보드 1주 lookback 충분.

---

## 6. Service Discovery — relabel_configs 의 위력

### 6-1. SD 프로바이더 종류

| 프로바이더 | 적용 |
|---|---|
| `static_configs` | 고정 IP/hostname (테스트) |
| `file_sd_configs` | JSON/YAML 파일 watch — Consul / Nomad 통합 |
| `kubernetes_sd_configs` | K8s API server watch (5 role: node/service/pod/endpoints/endpointslice/ingress) |
| `consul_sd_configs` | Consul agent |
| `ec2_sd_configs` | AWS EC2 (Elastic Compute Cloud, 가상 머신 서비스) tag 기반 |
| `dns_sd_configs` | A / SRV record |
| `eureka_sd_configs` | Netflix Eureka (msa ADR-0019 에서 제거) |

msa 는 **kube-prometheus-stack + ServiceMonitor / PodMonitor CRD (Custom Resource Definition, 커스텀 리소스 정의)** 패턴 — Operator 가 ServiceMonitor 를 읽어서 위 `kubernetes_sd_configs` 를 자동 합성.

### 6-2. relabel_configs vs metric_relabel_configs

```
relabel_configs        : SD 결과를 scrape 전 변환 (target 선택 / drop)
metric_relabel_configs : scrape 직후 metric label 변환 (drop / keep / replace)
```

ServiceMonitor 가 합성하는 raw config 의 핵심:

```yaml
relabel_configs:
  - source_labels: [__meta_kubernetes_pod_label_app_kubernetes_io_part_of]
    action: keep
    regex: commerce-platform
  - source_labels: [__meta_kubernetes_namespace]
    target_label: namespace
  - source_labels: [__meta_kubernetes_pod_name]
    target_label: pod
  - source_labels: [__meta_kubernetes_pod_label_app]
    target_label: application

metric_relabel_configs:
  - source_labels: [__name__]
    regex: 'go_.*'
    action: drop                      # Go 런타임 메트릭 제거
  - source_labels: [pod]
    regex: 'product-([0-9a-f]+).*'
    target_label: pod_short
    replacement: '$1'
```

### 6-3. relabel 7가지 action

| action | 의미 |
|---|---|
| `keep` | regex 매치되는 target/series 만 남김 |
| `drop` | regex 매치되는 것 제거 |
| `replace` | source_labels 를 regex 로 추출해 target_label 에 대입 (default) |
| `labelmap` | regex 로 라벨 이름 매핑 (예: meta_*  → label_*) |
| `labeldrop` | 매칭 라벨 자체 삭제 (cardinality 응급조치) |
| `labelkeep` | 매칭 라벨만 남김 |
| `hashmod` | source_labels 해시 % modulus → 샤딩 |

### 6-4. hashmod — Prometheus 샤딩

같은 SD 결과를 N 대 Prometheus 가 나눠 scrape 할 때:

```yaml
relabel_configs:
  - source_labels: [__address__]
    modulus: 4
    target_label: __tmp_shard
    action: hashmod
  - source_labels: [__tmp_shard]
    regex: 0          # 이 인스턴스는 shard 0 만
    action: keep
```

→ 1대로 안 되는 규모를 4대로 함수적 분산. msa 는 아직 단일 인스턴스라 미사용. Mimir 도입 시 자동.

### 6-5. msa 적용 — 새 서비스 추가 시

```yaml
# k8s/overlays/.../{service}-deployment.yaml
metadata:
  labels:
    app.kubernetes.io/part-of: commerce-platform   # ← 이 라벨 1줄
```

→ ServiceMonitor 의 `selector.matchLabels` 가 자동 매치, Prometheus 가 별도 config 변경 없이 scrape 시작. **zero-config 추가** 가 가능한 이유는 relabel_configs 의 `keep + part_of` 1줄.

---

## 7. PromQL 내부 — vector 모델 함정

### 7-1. instant vector vs range vector

```
http_server_requests_seconds_count                 → instant vector (현재 시점)
http_server_requests_seconds_count[5m]             → range vector (지난 5분 샘플들)
rate(http_server_requests_seconds_count[5m])       → instant (range → instant)
```

규칙:
- aggregation (sum/avg) 은 instant 를 받음.
- rate / increase / avg_over_time 은 range 를 받음.
- `http_server_requests_seconds_count[5m]` 자체는 plot 불가 (range 라서) — **PromQL editor 에서 흔한 실수**.

### 7-2. rate vs increase — extrapolation 함정

```
rate(counter[5m])     = (last - first) / 5m  + 외삽 보정
increase(counter[5m]) = rate × 5m            (extrapolated)
```

함정 1: **counter reset detection**.
- prometheus 는 `t2.value < t1.value` 를 reset 으로 간주, 0 으로 점프했다고 가정.
- 진짜 reset (Pod restart) 이 아닌 일시적 음수 (clock skew, scrape race) 도 reset 으로 처리 → over-count.

함정 2: **boundary extrapolation**.
- range 의 시작/끝이 정확히 sample 시점에 안 맞아 → linear extrapolation 으로 보정. 매우 짧은 range (예: 30s 와 scrape interval 30s) 는 extrapolation 오차가 큼.
- 권장: `rate(...[N×scrape_interval])` 에서 N ≥ 4. msa scrape 30s 면 range ≥ 2m.

함정 3: **rate × duration ≠ increase** (정확히는 같지만 floor 차이).
- 카운트로 환산할 때는 `increase()` 가 명시적.

### 7-3. histogram_quantile 함정

```promql
histogram_quantile(0.99,
  sum(rate(http_server_requests_seconds_bucket[5m])) by (le, application)
)
```

함정 1: **bucket boundary 가 아니면 추정**.
- bucket 이 `[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, +Inf]` 라면, P99 의 실제 값이 0.07s 이라도 bucket boundary 0.05 와 0.1 사이의 linear interpolation 결과만 반환 → 정확도 ±50%.
- SLO P99 = 100ms 면 bucket 에 90/95/100/110/120 ms 같은 fine-grained 가 있어야 정확.

함정 2: **rate 를 sum 안에 넣어야**.
- `histogram_quantile(0.99, rate(sum(bucket)[5m]))` ❌ — sum 안 해야.
- `histogram_quantile(0.99, sum(rate(bucket[5m])) by (le))` ✅ — by le 는 필수.

함정 3: **scrape skip + reset combination**.
- bucket counter 가 reset → quantile 이 NaN 으로.

### 7-4. topk / bottomk — group selection

```
topk(5, sum by (pod) (rate(http_server_requests_seconds_count[5m])))
```

- `topk(N, expr)`: 상위 N 개 series 만 반환.
- 함정: alerting 에 쓰면 N 이상 시 일부가 누락 — alert 를 놓침. **alerting 엔 부적합**.

### 7-5. predict_linear — 디스크 풀 alert

```
predict_linear(node_filesystem_avail_bytes[1h], 4 * 3600) < 0
```

→ 1시간 추세를 4시간 후로 외삽 → 4시간 안에 디스크 0 이 될 series alert. 운영 표준 패턴.

---

## 8. Federation — hierarchical scraping

### 8-1. /federate endpoint

각 Prometheus 가 expose 하는 특수 endpoint:

```
GET /federate?match[]={__name__=~"job:.+"}
```

→ 매칭되는 series 의 **현재 값** 을 exposition format 으로 응답. 다른 Prometheus 가 이걸 scrape 하면 cross-cluster aggregation 가능.

### 8-2. hierarchical 패턴

```
[Cluster A Prom] ──┐
[Cluster B Prom] ──┼─→ [Global Prom]   (각 cluster prom 의 /federate scrape)
[Cluster C Prom] ──┘
```

- 각 cluster 는 자기 raw 를 보유.
- global 은 미리 aggregated 된 series 만 (`job:http_request_rate:5m`) federate.
- 권장: federate 는 **recording rule 결과만** — raw scrape 하면 카디널리티 폭발.

### 8-3. recording rule 가 federation 의 짝

```yaml
groups:
  - name: cluster-aggregations
    interval: 30s
    rules:
      - record: job:http_requests:rate5m
        expr: sum by (job) (rate(http_server_requests_seconds_count[5m]))
```

→ 매 30s 마다 미리 계산해서 series 로 저장. global 이 federate 할 때 이것만.

### 8-4. federation 의 한계

- timestamp 가 Prometheus 의 **마지막 scrape 시점** 으로 찍힘 — 정확한 timestamp 손실.
- exemplar / native histogram 손실.
- **HA 솔루션 아님** — 1대 죽으면 그 cluster 데이터 끊김.

→ 본격적인 멀티 cluster 는 Mimir / Thanos 의 remote_write 로 (§9).

---

## 9. Remote write / read — Mimir / Cortex / Thanos / VictoriaMetrics

### 9-1. remote_write 프로토콜

Prometheus 가 매 scrape 직후 sample 들을 외부 endpoint 로 push:

```yaml
# prometheus.yml
remote_write:
  - url: https://mimir.commerce.svc/api/v1/push
    queue_config:
      capacity: 10000
      max_samples_per_send: 2000
    metadata_config:
      send: true
```

- protobuf snappy compressed.
- shard 별 in-memory queue → batch flush.
- 실패 시 retry (지수 백오프, max retry).

### 9-2. 각 long-term storage 비교

| 시스템 | 설계 | 강점 | 약점 |
|---|---|---|---|
| **Thanos** | Prometheus + sidecar + S3 (Simple Storage Service, 객체 스토리지) + querier/store-gateway | 기존 Prom 그대로 사용, multi-cluster query | 복잡한 컴포넌트 다수, query 분산 비용 |
| **Mimir (Grafana)** | clean-room rewrite, stateless ingester + S3 | multi-tenant 대규모, native PromQL, alertmanager 통합 | Prometheus 와는 별 시스템 (remote_write only) |
| **Cortex** | Mimir 의 모태 (2018~) | 검증된 멀티 테넌시 | Grafana 가 Mimir 로 fork 후 상대적 정체 |
| **VictoriaMetrics** | Go 단일 바이너리 + cluster 모드 | 압축률 ~7x, 단순함, 빠름 | 일부 PromQL 함수 비호환 (MetricsQL 우선) |

### 9-3. 선택 기준

| 조건 | 권장 |
|---|---|
| 단일 cluster, retention 30d ~ 1y | Thanos sidecar + S3 |
| 멀티 cluster, multi-tenant | Mimir |
| 단순함 + 압축 우선, native PromQL 일부 포기 | VictoriaMetrics |
| 기존 Cortex 운영 중 | Mimir 로 마이그레이션 (동일 author) |

### 9-4. msa 시사

현재 retention 15d. 1년 audit 요구 (예: 결제 분쟁 대응) 가 생기면:
1. Phase 1: Thanos sidecar 1개 + S3 — 가장 가벼움.
2. Phase 2: 클러스터 수 늘면 Mimir 로 전환.

remote_write 자체는 single-line 추가로 도입 가능 — 운영 부담은 receiver 쪽.

---

## 10. HA 패턴 — Prometheus 자체는 HA 가 어렵다

### 10-1. Prometheus single-writer 모델

- replication 없음 — 1대가 죽으면 그 시간대 데이터 손실.
- WAL + PVC 가 있어도 Pod 가 다운되면 그 동안 scrape 누락.

### 10-2. HA = "같은 config 의 2대 + dedup"

```
[Prom-A]  scrape   ┐
                   ├─→ [Thanos sidecar A] → S3
[Prom-B]  scrape   ┘                                ↓
                                              [Thanos Querier] (dedup)
                                              [Grafana / Alertmanager]
```

dedup 옵션:
- **Thanos**: querier 의 `--query.replica-label=replica` 옵션 + 각 Prom 에 외부 라벨 `replica=a/b`. query 시 동일 sample 중 최신만.
- **Mimir**: ingester 가 동일 series 의 중복 sample 을 자동 dedupe.
- **Native**: 2.32+ 의 agent mode + remote_write 만 쓰는 패턴.

### 10-3. Alertmanager HA

- Alertmanager 자체는 cluster 모드 (gossip) 지원.
- 중복 알람 자동 제거 (notification dedup).
- 2~3 대 권장.

### 10-4. msa 시사

현재 단일 Prometheus + 단일 Alertmanager (kube-prometheus-stack default 1 replica). Tier 1 SLO 운영하려면:
- Prometheus 2대 + Thanos sidecar.
- Alertmanager 3대 cluster.

→ Phase 2 ADR 후보.

---

## 11. Cardinality 폭증 방어

### 11-1. cardinality 가 뭐가 비싼가

복습 (#03):
- active series = label 조합의 유니크 수.
- series 1개당 RAM ~3KB + WAL 1KB + persistent 0.5KB.
- 100만 series × 3KB = 3GB RAM.

폭증 요인 (실수 패턴):
1. **userId / orderId / requestId** 같은 무한 값을 라벨에.
2. **path** 의 path variable (`/products/12345`) 미정규화 (`/products/{id}` 로 normalize 해야).
3. **error message** 본문을 라벨에.
4. **dynamic 라벨** — 코드 분기에서 새 라벨 키를 동적으로 추가.

### 11-2. 신호 — TSDB 메트릭

Prometheus 자기 자신이 노출:

| 메트릭 | 의미 |
|---|---|
| `prometheus_tsdb_head_series` | active series 수 |
| `prometheus_tsdb_head_series_created_total` | 누적 생성 (rate 가 새 라벨 도입 시 튐) |
| `prometheus_tsdb_head_chunks` | active chunk 수 |
| `prometheus_tsdb_compactions_failed_total` | compaction 실패 (메모리 부족) |
| `prometheus_target_scrapes_exceeded_sample_limit_total` | scrape 당 sample 한도 초과 |

alert 권장:

```yaml
- alert: PrometheusHighCardinality
  expr: prometheus_tsdb_head_series > 1000000
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Prometheus active series > 1M ({{ $value }})"
```

### 11-3. 응급 조치 — labeldrop

배포 후 폭증 감지 시:

```yaml
metric_relabel_configs:
  - source_labels: [__name__]
    regex: 'cart_item_added_total'
    target_label: userId
    action: labeldrop          # userId 라벨 즉시 제거
```

→ Prometheus reload (`/-/reload`) → 다음 scrape 부터 새 series 생성 멈춤. 기존 series 는 retention 만료까지 잔존.

### 11-4. 영구 조치

1. **코드 레벨 cardinality 룰**: msa quant 의 `QuantMetrics.kt` 처럼 코드 주석으로 거버넌스 (#12 §5.2 참조).
2. **scrape sample limit**:

```yaml
scrape_configs:
  - job_name: ...
    sample_limit: 5000     # 한 target 한 scrape 가 5000 sample 넘으면 drop + alert
```

3. **recording rule 로 사전 집계**: high-cardinality raw 를 안 노출하고 aggregated 만.
4. **Native Histogram** 도입 (§4-4) — bucket cardinality 1/30 으로.

### 11-5. agent mode — push-only

Prometheus 2.32+ 의 `--agent` 모드:
- TSDB / query / alerting 비활성, scrape + remote_write 만.
- WAL 만 사용 (디스크 작음), head 없음.
- **에지 / IoT / cardinality 분산** 에 적합.
- Mimir / Thanos receiver 가 본진.

→ cluster 가 늘어 고-cardinality 가 한 곳에 몰리면 agent mode 로 cluster 별 분산.

---

## 12. 트레이드오프 / 안티패턴

### 12-1. emptyDir storage

- Pod 재시작 시 head 손실 + WAL 없으면 복구 불가 → 알람 공백.
- **운영 금지**. PVC 필수.

### 12-2. retention = 1y

- single Prometheus 로 1년 보관 → block 수십 개, query 매우 느림, RAM 폭증.
- 30d 이상은 long-term storage (Thanos/Mimir/VM) 로.

### 12-3. scrape_interval = 5s

- Prometheus 부하 6배. Counter 정밀도 향상은 미미.
- 실시간 대시보드라도 15s 면 충분.
- Tier 1 alerting 만 15s, 나머지 60s 도 합리적.

### 12-4. Pushgateway 남용

- Prometheus 의 healthcheck 효과 손실 (instance 살아있는지 모름).
- Pushgateway 자체가 SPOF.
- 짧은 cron job 결과 메트릭 만. 일반 서비스 메트릭은 ❌.

### 12-5. exemplar storage 미활성

- ADR-0025 강제하는 metric → trace 점프가 동작 안 함.
- `--enable-feature=exemplar-storage` + `exemplar-storage-size` 설정 필요.
- kube-prometheus-stack values 에 `additionalArgs` 로 추가.

### 12-6. recording rule 폭주

- rule 수십 개 × 30s 평가 = Prometheus query CPU 의 대부분 차지.
- group `interval` 을 적절히 (1m / 5m), 같은 group 안에 종속 rule 묶기.

### 12-7. relabel_configs 미사용 → cardinality 무방비

- ServiceMonitor 의 `metricRelabelings` 로 Go runtime / cAdvisor 의 미사용 메트릭 drop 안 하면 series 수 2배.
- 신규 cluster 도입 시 첫 1주에 metric_relabel 정리 권장.

### 12-8. native histogram 모르고 일반 histogram bucket 30개

- bucket cardinality × 모든 라벨 조합 = 폭증.
- bucket 은 5~10 개로 압축, 핵심 SLO 주변만 fine-grained.

---

## 13. msa 적용 — 현재 결정 근거 + 개선안

### 13-1. msa 의 현재 (`#12` 인용)

| 설정 | 값 | 근거 |
|---|---|---|
| `retention` | 15d | hot lookback + Grafana 1주 충분 |
| `scrape_interval` | 30s | RAM 절약 + alert 1m 평가에 충분 (4× 룰) |
| `serviceMonitorSelector` | `release: kube-prometheus-stack` | Helm chart 와 동기 |
| storage | PVC (StatefulSet) | head/WAL 보존 |
| HA | 1 replica | Phase 1 단순화 |
| long-term storage | 없음 | retention 15d 로 충분 |

### 13-2. RAM 산정 (현재)

active series 는 `prometheus_tsdb_head_series` 로 알 수 있으나 그 값이 본 study 작성 시점에 직접 검증되지 않음. 예상치:

| 메트릭 군 | series 추정 |
|---|---|
| `http_server_requests_seconds_*` (16 services × 5 endpoint × 4 status × 12 bucket) | ~3800 |
| `jvm_*` (16 services × ~30) | ~480 |
| `kafka_consumer_*` (16 × ~10) | ~160 |
| `hikaricp_*` (16 × ~5) | ~80 |
| `quant_*` (21개 × tag 평균 5) | ~100 |
| Kubernetes (kube-state-metrics + cAdvisor) | ~15000 |
| Node Exporter | ~3000 |
| 기타 | ~2000 |

**총 ~25K series** → RAM ~75MB + head chunk ~300MB = 약 400MB. limit 2Gi 충분. 단 cardinality 사고 시 5x 점프 가능.

### 13-3. 개선 ADR 후보

| 우선순위 | 항목 | 근거 |
|---|---|---|
| 1 | **exemplar-storage 활성** | ADR-0025 의 metric→trace 점프 강제, OTel 도입 시 필수 |
| 2 | **percentiles-histogram → Native Histogram** 검토 | 1.11+ Micrometer 지원, cardinality 1/30 |
| 3 | **PrometheusRule 작성** (Tier 1 P99 alert + cardinality alert) | ADR-0025 §3 강제 |
| 4 | **Tier 1 서비스만 scrape 15s** | gateway / product / order — 버스트 인지 |
| 5 | **HA = 2 replica + Thanos sidecar** | 단일 Prometheus SPOF 해소 |
| 6 | **agent mode 분리** (장기) | cluster 늘면 cardinality 분산 |
| 7 | **Mimir 도입 검토** (장기) | retention 1y 요구 시 |

### 13-4. 즉시 PR (작은 단위)

```yaml
# k8s/infra/prod/monitoring/values.yaml 변경
prometheus:
  prometheusSpec:
    retention: 15d
    additionalArgs:                                # ← 추가
      - --enable-feature=exemplar-storage
      - --storage.tsdb.exemplars-storage-size=100MB
    enableAdminAPI: false                          # 보안
    walCompression: true                           # WAL 30~50% 절감
```

```yaml
# k8s/infra/prod/monitoring/cardinality-rules.yaml 신규
groups:
  - name: prometheus-self
    rules:
      - alert: PrometheusHighCardinality
        expr: prometheus_tsdb_head_series > 100000
        for: 10m
        labels: { severity: warning }
        annotations:
          summary: "Prometheus active series > 100K (current {{ $value }})"
      - alert: PrometheusScrapeSampleLimitHit
        expr: increase(prometheus_target_scrapes_exceeded_sample_limit_total[5m]) > 0
        for: 5m
        labels: { severity: warning }
```

### 13-5. ServiceMonitor 의 metric_relabel 강화 (cardinality 사전 방어)

```yaml
# servicemonitor-apps.yaml 보강
spec:
  endpoints:
    - port: http
      path: /actuator/prometheus
      interval: 30s
      metricRelabelings:                                    # ← 추가
        - sourceLabels: [__name__]
          regex: 'jvm_buffer_(memory_used|count)_.*'
          action: drop                                      # 사용 안 하는 JVM buffer 군 drop
        - sourceLabels: [uri]
          regex: '/actuator/.*'
          action: drop                                      # actuator 자체 호출 노이즈 제거
        - sourceLabels: [exception]
          regex: '.{50,}'
          replacement: 'truncated'
          targetLabel: exception                            # 긴 exception name 자르기
```

---

## 14. ADR 후보

> **ADR-XXXX-A: Prometheus 운영 표준 — exemplar / native histogram / cardinality 가드 / HA 단계화**
>
> **Context**: msa 의 Prometheus 인프라는 kube-prometheus-stack + ServiceMonitor 로 zero-config scrape 가 가능한 상태이나 (1) exemplar 미활성으로 ADR-0025 의 metric→trace 점프가 실제로 동작하지 않음, (2) Native Histogram 미사용으로 percentiles-histogram 도입 시 cardinality 부담, (3) PrometheusRule 0개 — Tier 1 P99 alert 가 데이터로만 존재하지 알람화 안 됨, (4) 단일 replica → SPOF.
>
> **Decision**: 4단계 도입.
> - **P1 (1주)**: exemplar-storage 활성 + walCompression + cardinality self-alert (PrometheusRule).
> - **P2 (2주)**: ADR-0025 Tier 1 P99 alert 작성, Native Histogram 시범 (Tier 1 서비스만 Micrometer 1.11+ 옵션).
> - **P3 (1개월)**: Prometheus 2 replica + Thanos sidecar (S3) — HA + 30d retention 까지 확장.
> - **P4 (장기)**: cluster 수 / cardinality 폭증 시 Mimir / agent mode 분산.
>
> **Consequences**:
> - (+) ADR-0025 의 metric↔trace 통합이 실제 동작.
> - (+) cardinality 사고 자체 alert 로 사전 인지.
> - (+) HA 로 alert 공백 제거.
> - (-) Thanos 도입은 S3 비용 + sidecar 운영 부담.
> - (-) Native Histogram 은 backend (Tempo/Grafana) 호환성 검증 필요.
>
> **Alternatives 검토**:
> - VictoriaMetrics 로 직접 교체 — Prometheus PromQL 100% 호환은 아님 (MetricsQL 차이). 채택 ❌ for now.
> - Mimir P1 부터 도입 — 운영 부담 과다. 채택 ❌.
> - exemplar 만 활성하고 나머지 패스 — ADR-0025 절반 충족이라 채택 ❌.

---

## 15. 면접 한 줄 답변

### Q. Prometheus 의 TSDB 가 단일 노드에서 백만 series 를 어떻게 처리합니까?

> "head + 2h persistent block + WAL 의 3-tier 구조 + Gorilla XOR 압축이 핵심입니다. 모든 쓰기는 in-memory head 에 들어가고 WAL 에 동시 기록되어 crash recovery 를 보장합니다. 매 2시간마다 head 를 immutable persistent block 으로 떨궈 write amplification 을 막고, sample 자체는 timestamp 의 delta-of-delta + value 의 XOR 로 평균 1.3 byte 까지 압축됩니다. series 1개당 RAM 약 3KB 정도라 active series 50만이라도 1.5GB 면 됩니다."

### Q. Prometheus 가 쓰는 압축 알고리즘은 무엇이고 왜 효율적입니까?

> "Facebook Gorilla 논문의 알고리즘입니다. timestamp 는 delta-of-delta — scrape 가 일정 간격이라 2차 차분이 거의 0 이므로 1bit 까지 줄어듭니다. value 는 XOR 차분 — 비슷한 float 끼리는 XOR 결과의 leading/trailing zero 가 많아 meaningful bit 만 저장합니다. 결과적으로 16 byte / sample 이 평균 1.3 byte 까지 줄어들어 retention 비용이 결정됩니다."

### Q. WAL 의 역할과 위험은?

> "head 의 모든 sample 변경을 디스크에 append 하는 log 입니다. Prometheus 가 죽었다 살아나면 WAL replay 로 head 를 재구성합니다. 위험은 WAL 이 너무 커지거나 PVC 가 없으면 (예: emptyDir) 재시작 후 head 손실 + replay 불가로 alert 공백이 생긴다는 점입니다. 운영에선 PVC 필수, walCompression 옵션으로 30~50% 디스크 절감이 권장됩니다."

### Q. relabel_configs 와 metric_relabel_configs 의 차이는?

> "relabel_configs 는 Service Discovery 결과를 scrape 전에 변환합니다 — target 자체를 keep/drop 하거나 라벨을 정리하는 단계입니다. metric_relabel_configs 는 scrape 직후 metric 의 라벨을 변환합니다 — cardinality 응급 조치로 라벨을 drop 하거나 특정 메트릭 자체를 drop 하는 데 씁니다. 두 단계 모두 7가지 action (keep/drop/replace/labelmap/labeldrop/labelkeep/hashmod) 을 공유합니다."

### Q. Prometheus 가 HA 가 어렵다는데, 어떻게 합니까?

> "Prometheus 자체는 single-writer 라서 replication 이 없습니다. HA 패턴은 같은 scrape config 의 Prometheus 2대를 각각 돌리고 Thanos sidecar 또는 Mimir 가 dedup 하는 방식입니다. Thanos 는 querier 가 replica label 로 dedup, Mimir 는 ingester 가 자동 dedup 합니다. Alertmanager 는 자체 cluster 모드 (gossip) 를 지원하므로 2~3대 권장입니다."

### Q. Federation 과 Remote Write 의 차이는 무엇이고 언제 무엇을 써야 합니까?

> "Federation 은 Prometheus 가 다른 Prometheus 의 `/federate` endpoint 를 scrape 하는 hierarchical 모델로, recording rule 의 미리 집계된 series 만 가져오는 데 적합합니다. timestamp 가 부정확해지고 exemplar 손실이 있습니다. Remote Write 는 매 scrape 직후 sample 을 protobuf 로 push 하는 방식으로 Mimir / Thanos / VictoriaMetrics 같은 long-term storage 의 표준입니다. raw 보존 + 멀티 클러스터 + retention 1년 같은 요구는 Remote Write 가 정답이고, 가벼운 cross-cluster 대시보드면 Federation 으로 충분합니다."

### Q. histogram_quantile 의 정확도가 안 좋다고 들었는데?

> "bucket boundary 사이는 linear interpolation 이라서 P99 = 100ms 인데 bucket 이 50/100/250ms 라면 ±50% 오차가 납니다. 해법은 SLO 주변에 fine-grained bucket 을 명시적으로 (`slo: 50ms, 100ms, 200ms` 식으로) 추가하는 것이고, 더 근본적으로는 Prometheus 2.40+ Native Histogram 으로 가면 sparse exponential bucket 이 series 1개에 들어가서 cardinality 1/30 + 정밀도 향상을 동시에 얻습니다."

### Q. cardinality 가 폭증하면 어떻게 합니까?

> "1단계는 Prometheus self metric (`prometheus_tsdb_head_series`) 으로 감지하는 것이고, 2단계는 metric_relabel_configs 의 labeldrop 으로 즉시 새 series 생성을 막는 것이고 (Prometheus reload), 3단계는 코드에서 라벨 추출 — 보통 path variable 미정규화나 userId 같은 무한 값이 라벨에 들어간 경우입니다. 영구 조치로는 `sample_limit` per-target, recording rule 로 사전 집계, Native Histogram 도입, agent mode 로 분산까지 단계화합니다. msa 는 quant 가 코드 주석으로 cardinality 룰을 거버넌스하는 모범이 있습니다."

### Q. msa 의 retention 15d, scrape 30s 는 어떻게 결정됐습니까?

> "scrape 30s 는 Prometheus 권장인 `scrape_interval >= 4 × evaluation_interval` 룰을 따른 것입니다. alert 평가가 1m 이라 30s 가 표준이고, RAM 부하도 5s 의 1/6 입니다. retention 15d 는 hot lookback + Grafana 1주 대시보드 + 운영 후행 분석 1주 를 포함한 값으로, 지금 active series 추정 25K + 평균 1.7 byte/sample 로 계산하면 디스크 약 4GB 면 됩니다. 1년 audit 가 요구되면 Thanos sidecar + S3 가 다음 ADR 후보입니다."

---

## 16. 흔한 오해 정정

> **"Prometheus 는 cluster 모드를 지원한다"**

- ❌ single-writer. cluster 처럼 보이는 건 외부 Thanos / Mimir 가 합쳐 보여주는 것.

> **"persistent block 이 SQLite 같은 DB 다"**

- ❌ chunks (압축 파일) + index (postings) + meta.json 의 directory. 자체 포맷이며 DB 가 아님.

> **"WAL 만 있으면 된다, head 는 사치다"**

- ❌ WAL 은 replay 용일 뿐. 쿼리는 head + persistent block 에 직접. WAL replay 는 재시작 시간 비용.

> **"bucket 을 많이 만들수록 정확하다"**

- ⚠ 정확도는 올라가지만 cardinality 가 bucket 수 × 다른 라벨 조합으로 폭증. SLO 주변 5~10개가 균형점.

> **"Pushgateway 가 push 모델 정답이다"**

- ❌ Pushgateway 는 short-lived job 용 우회로. 일반 서비스에 쓰면 healthcheck 효과 손실 + SPOF.

> **"federation 으로 multi-cluster HA 가능"**

- ❌ federation 은 부분 데이터 + 부정확한 timestamp. HA 는 Remote Write + Mimir/Thanos.

> **"compaction 이 자주 일어날수록 좋다"**

- ❌ compaction 은 비싼 작업. block 수가 너무 많아지지 않도록 적당히. default tuning 이면 충분.

> **"native histogram 은 cardinality 0 다"**

- ❌ series 1개로 줄어들 뿐, 라벨 조합은 그대로. 라벨 폭발은 별도 문제.

> **"Thanos / Mimir 가 있으면 Prometheus 가 필요 없다"**

- ❌ 둘 다 ingester 단계가 Prometheus(또는 그 호환) 자체. 또는 OTel Collector 의 prometheusexporter.

---

## 17. 회독 체크리스트

> §15 회독 체크리스트:
> - [ ] head + 2h persistent block + WAL 의 3-tier 구조와 각 역할
> - [ ] block 디렉터리 구조 (chunks/ index tombstones meta.json)
> - [ ] WAL 의 segment + checkpoint 모델 + 재시작 시 replay
> - [ ] timestamp delta-of-delta + value XOR 압축의 결과 (평균 1.3 byte/sample)
> - [ ] Native Histogram 의 sparse exponential bucket 이 cardinality 를 1/30 로 줄이는 원리
> - [ ] head chunk → persistent block 회전 트리거 (sample 한도 / 2h boundary)
> - [ ] compaction level (L1=2h, L2=8h, L3=2d, ...) 와 retention 의 관계
> - [ ] kubernetes_sd_configs 의 5 role 과 ServiceMonitor 가 합성하는 raw config
> - [ ] relabel_configs 7 action (keep/drop/replace/labelmap/labeldrop/labelkeep/hashmod) — 특히 hashmod 로 샤딩
> - [ ] PromQL 의 instant vs range vector 구분 + range[5m] 자체는 plot 불가
> - [ ] rate() 의 counter reset detection + boundary extrapolation 함정
> - [ ] histogram_quantile 의 bucket boundary linear interpolation 한계
> - [ ] /federate endpoint 의 한계 (timestamp / exemplar 손실, raw HA 아님)
> - [ ] remote_write protobuf snappy + Thanos / Mimir / Cortex / VictoriaMetrics 의 4-way 비교
> - [ ] Prometheus 2 replica + dedup 패턴 (Thanos querier replica-label / Mimir ingester dedupe)
> - [ ] cardinality 폭증 신호 메트릭 (`prometheus_tsdb_head_series`) + 응급 labeldrop
> - [ ] sample_limit per-target / recording rule / Native Histogram / agent mode 의 영구 조치 계층
> - [ ] msa 의 retention 15d + scrape 30s 결정 근거 (RAM/디스크 산식)
> - [ ] exemplar-storage 활성화가 ADR-0025 의 metric→trace 점프에 필수

---

## 18. 연결 학습

- §02 Prometheus pull 모델 / Pushgateway / ServiceMonitor — 본 글의 layer 위 (외부에서 본 Prometheus)
- §03 메트릭 타입 / cardinality — 본 글 §11 의 영구 조치 출발점
- §04 PromQL / alerting — 본 글 §7 PromQL 함정의 운영 적용
- §12 msa 현 상태 — 본 글 §13 의 산정에 사용된 ServiceMonitor / values.yaml 인용
- §16 OpenTelemetry deep — exemplar 의 OTel 측 짝꿍, OTLP 와 remote_write 의 관계
- ADR-0025 latency budget — `percentiles-histogram` / SLO bucket 강제와 본 글 §4-4 (Native Histogram) 의 미래
- (예정) §17 SLO / Burn rate alerting — recording rule + multi-window alert 의 본격
