---
parent: 12-latency-numbers
phase: 2
order: 03
title: DRAM vs SSD vs HDD — 자릿수가 갈리는 물리적 이유
created: 2026-04-26
estimated-hours: 1
---

# 03. DRAM vs SSD vs HDD — 자릿수가 갈리는 물리적 이유

> **B 수준** (핵심 메커니즘): 전기 신호 ns / NAND 페이지 µs / seek+회전 ms.
> **C 수준** (FTL / write amplification / wear leveling) 은 확장 트리거로만 언급.

## 0. 이 파일에서 얻을 것

- DRAM ~ SSD ~ HDD 가 **각각 다른 자릿수에 머무는 물리적 이유** 를 설명할 수 있다
- "DRAM → SSD = ×1000" 비율이 왜 그런지 직관 보유
- 4KB 페이지 / sequential vs random / read vs write 의 자릿수 차이
- 면접 답변 카드: "SSD 가 HDD 보다 왜 빠른가요?"

---

## 1. DRAM — 전기 신호의 속도

### 어떻게 동작하는가

- 각 비트는 작은 **커패시터 + 트랜지스터** 한 쌍에 저장
- 커패시터의 충/방전 = 0/1
- 읽기 = 커패시터의 전압을 sense amplifier 로 측정
- 거의 즉시 (ns 단위)

### 자릿수가 ns 인 이유

- **물리적 거리가 짧다**: CPU 패키지 옆 메인보드 슬롯, 수 cm
- **기계적 운동 없음**: 100% 전자/전기 신호
- **병렬 access**: 여러 채널이 동시에 동작
- 한계: 전기 신호 속도 + DRAM cell 의 row activation latency (~수십 ns)

### 휘발성 — 왜 DRAM 만으로는 안 되는가

- 전원 끊으면 데이터 사라짐 (커패시터 방전)
- 켜진 상태에서도 주기적으로 **refresh** 필요 (수 ms 마다 모든 cell 재충전)
- → 영구 저장은 SSD/HDD 같은 **non-volatile storage** 가 필요

### 비용 — 왜 DRAM 만 무한히 못 키우는가

- $5-10/GB (2026 기준 대략) — SSD 의 ×10, HDD 의 ×100
- 서버 한 대당 수백 GB ~ TB 가 한계 (가격 + 메인보드 슬롯 한계)
- → "TB 단위 데이터는 SSD/HDD 로" 가 경제적 강제

---

## 2. SSD — NAND 의 페이지 단위 access

### 어떻게 동작하는가

- **NAND 플래시**: 셀에 전자를 가두어 0/1 표현
- 읽기 단위: **페이지 (보통 4KB ~ 16KB)** — 1 byte 만 읽고 싶어도 페이지 전체 read
- 쓰기 단위: **블록 (수백 KB ~ 수 MB)** — 작은 수정도 큰 블록 erase + rewrite
- 기계적 운동 없음 (NAND 셀 = 전기적 access)

### 자릿수가 µs 인 이유

- **NAND read 자체가 µs** — 셀의 전압 측정 + ECC 검증
- **인터페이스 (NVMe)** 가 추가 µs — PCIe 통과
- **컨트롤러 처리** (FTL, wear leveling) 가 추가 µs
- 합쳐서 random read ~16 µs (Jeff Dean 표 기준, 2009 ~ 2026 거의 동일)

### Sequential vs Random — 자릿수가 같다

- HDD 와 달리 SSD 는 **seek** 이 없음 → sequential 과 random 의 차이가 작다
- sequential read 는 캐시/prefetch 효과로 약간 빠른 정도 (~2-3배), 자릿수는 동일
- → 데이터베이스 인덱스 설계의 자유도가 HDD 시대보다 높다

### Read vs Write — 자릿수가 다를 수 있다

- **Read ~16µs / Write ~수십 µs** (큰 차이는 아님)
- 그러나 SSD 가 **거의 가득 차면 (~80%+)** write latency 가 폭증 — GC (garbage collection) 와 wear leveling 충돌
- 실무 시그널: "SSD 사용률 90% 넘으면 P99 가 갑자기 ms 단위로 늘어남"

---

## 3. HDD — 회전 + seek 의 물리적 한계

### 어떻게 동작하는가

- 회전하는 자기 platter + arm 끝의 read/write head
- 데이터 access 단계:
  1. **Seek time**: head 가 원하는 트랙으로 이동 (~5-10 ms)
  2. **Rotational latency**: platter 가 원하는 섹터까지 회전 (~4 ms @ 7200 rpm 평균)
  3. **Transfer**: 데이터 read (~수 µs)

### 자릿수가 ms 인 이유

- **기계적 운동의 한계** — head arm 의 물리적 이동, platter 의 회전
- 7200 rpm = 초당 120회전 = 1회전 8.3 ms → 평균 4 ms 회전 대기
- 광속/전기 속도와 무관, **순수 기계 시간**
- → ms 그룹에서 영원히 못 벗어남

### Sequential vs Random — 큰 차이

- Sequential: head 가 한 트랙을 따라 쭉 read → ~100 MB/s
- Random: 매번 seek + rotational 대기 → 1 IOPS 당 ~10 ms → 100 IOPS 한계
- → HDD 시대 데이터베이스는 **sequential I/O 최적화** 가 절대 명령 (B-tree, append-only, sorted file)

### 왜 아직도 HDD 를 쓰는가

- $0.02/GB 수준 — SSD 의 1/10 이하
- 콜드 스토리지, 백업, 대용량 로그 — latency 보다 용량/비용이 우선인 케이스
- 클라우드의 "Cold Storage" 티어 (S3 Glacier, GCS Coldline) 는 HDD + 추가 지연

---

## 4. 자릿수 비교 — 왜 ×1000 인가

```
DRAM:  ~100 ns        (전기 신호, 거리 ~cm)
SSD:   ~16 µs         (NAND read + 컨트롤러 + PCIe)
HDD:   ~10 ms (seek)  (기계적 회전 + arm 이동)
─────────────────────────────────────────────
DRAM → SSD:  ×160     (전기→전자+컨트롤러)
SSD → HDD:   ×600     (전자→기계)
DRAM → HDD:  ×100,000 (5자리수 차이!)
```

**핵심 직관**:
- DRAM ~ SSD: "같은 전자식이지만 NAND 컨트롤러 / PCIe 가 추가됨"
- SSD ~ HDD: "전자식 vs 기계식의 본질적 차이"
- 외울 비율은 **DRAM → SSD ≈ ×1000** (라운딩, 직관용)

---

## 5. msa 프로젝트와의 연결

### 인프라 매핑

- **MySQL** (`k8s/infra/local/mysql/`): 데이터 = SSD, 버퍼 풀 = DRAM
  - 인덱스가 버퍼 풀에 hit → ns 그룹
  - 인덱스 miss + 디스크 access → µs ~ ms 그룹 (SSD 가정)
- **Redis** (`k8s/infra/local/redis/`): **순수 DRAM** → 모든 access ns 그룹 (네트워크 RTT µs 추가됨)
- **Elasticsearch** (`k8s/infra/local/elasticsearch/`): SSD + JVM heap 캐시
- **ClickHouse** (`k8s/infra/local/clickhouse/`): SSD + 컬럼 압축 + memory mapped
- **Kafka** (`k8s/infra/local/kafka/`): **append-only sequential write** = SSD/HDD 모두 잘 활용 (sequential I/O 의 우위)

### 설계 시사점

- **"왜 캐시 레이어를 두는가"** → MySQL hit 시 µs/ms vs Redis hit 시 µs (네트워크 RTT 가 dominant)
- **"왜 Kafka 가 빠른가"** → sequential append 로 HDD 시대에도 빠르게 설계 (현재는 SSD)
- **"왜 OLTP DB 와 OLAP DB 가 다른가"** → row vs column, random vs sequential access pattern 의 자릿수 차이

---

## 6. 자가 점검

- [ ] DRAM 이 ns 자릿수인 물리적 이유 (전기 신호, 거리)
- [ ] SSD 가 µs 자릿수인 이유 (NAND + 컨트롤러 + PCIe)
- [ ] HDD 가 ms 자릿수인 이유 (회전 + seek 의 기계적 한계)
- [ ] DRAM → SSD ≈ ×1000 비율
- [ ] HDD 의 sequential vs random 자릿수 차이 (~×100)
- [ ] SSD 의 sequential vs random 자릿수 차이 (~동일, 약간 차이)

## 7. 면접 답변 카드

**Q: "SSD 가 HDD 보다 왜 빠른가요?"**

> SSD 는 NAND 플래시 셀에 전기적으로 access 하고, HDD 는 회전하는 자기 디스크에서 head 를 움직여 access 합니다. SSD 는 seek 시간이 없고, HDD 는 평균 5-10 ms 의 기계적 이동이 필요해요. 그래서 random read 기준 SSD 가 HDD 보다 약 1000배 빠릅니다 (µs vs ms).

**Q (꼬리): "그럼 SSD 도 sequential 이 random 보다 빠른가요?"**

> 자릿수는 같지만 약간 차이는 있습니다. SSD 는 prefetch / 컨트롤러 캐시 효과로 sequential 이 ~2-3배 빠른 정도. HDD 는 seek 가 없어지니 sequential 이 random 의 ~100배 빠릅니다.

**Q (꼬리): "DRAM 은 왜 SSD 보다 빠른가요?"**

> 둘 다 전자식이지만 DRAM 은 메인보드 옆 칩, SSD 는 PCIe 통과 + NAND 컨트롤러 + ECC 검증이 추가됩니다. 또 NAND 의 read 자체가 SRAM/DRAM 의 셀 access 보다 본질적으로 µs 단위에요. 합쳐서 ~1000배 차이입니다.

---

## C 수준 확장 트리거

- **FTL (Flash Translation Layer)**: 논리 → 물리 주소 매핑
- **Write amplification**: 작은 쓰기가 큰 블록 erase 를 유발 → 실제 NAND 쓰기는 더 많음
- **Wear leveling**: NAND 셀의 쓰기 횟수 한계 (~수천 ~ 수만회) 분산
- **TRIM**: OS 가 SSD 에 "이 블록은 더 이상 사용 안 함" 통지
- **Persistent Memory (Optane)**: DRAM-like latency + 비휘발성 (Intel 단종, 사실상 사라짐)

## 다음 파일

- **04. 네트워크 물리** ([04-network-physics.md](04-network-physics.md))
