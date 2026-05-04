---
parent: 6-kafka-internals
seq: 05
title: Broker 내부 — Log Segment · Page Cache · Zero-Copy
type: deep
created: 2026-05-01
---

# 05. Broker 내부 — Log Segment / Page Cache / Zero-Copy

## 한 줄 요약

> "Kafka 가 왜 빠른가요?" 면접 단골. 답은 **append-only sequential I/O + OS page cache + sendfile (zero-copy)**. 메시지 브로커라기보다 **OS 의 파일시스템에 가깝게 동작** 하도록 설계됐다.

## 1. 파티션의 디스크 레이아웃

각 파티션은 broker 의 디스크에 디렉토리 하나.

```
$KAFKA_LOG_DIR/order.order.completed-0/      ← 토픽-파티션
├── 00000000000000000000.log         ← segment 0 의 메시지 본체
├── 00000000000000000000.index       ← offset → 파일 position 인덱스
├── 00000000000000000000.timeindex   ← timestamp → offset 인덱스
├── 00000000000000150000.log         ← segment 1
├── 00000000000000150000.index
├── 00000000000000150000.timeindex
├── 00000000000000300000.log         ← segment 2 (현재 활성)
├── 00000000000000300000.index
├── 00000000000000300000.timeindex
└── leader-epoch-checkpoint
```

**파일명 = 그 segment 의 base offset** (해당 segment 에 들어있는 첫 메시지의 offset).

## 2. Segment 의 작동 원리

| 항목 | 동작 |
|---|---|
| 활성 segment | 1개만 존재. append 만 가능 |
| 닫힘 | `segment.bytes` (1GB) / `segment.ms` (7d) 도달 시 |
| 닫힌 segment | 읽기 전용. retention/compaction 대상 |
| 삭제 | retention 만료된 segment 단위로 통째로 unlink |

**왜 segment 로 나누는가**:
- 읽기 전용 segment 는 mmap / sendfile 안전
- 삭제가 빠름 (파일 unlink 1번)
- index 가 segment 마다 → 작아서 빠름

## 3. .index 와 .timeindex

파일 끝 도달까지 처음부터 스캔하면 너무 느림 → sparse index.

### `.index` (offset → 파일 byte position)
```
relative offset (4B)  | physical position (4B)
─────────────────────────────────────────────
0                     | 0
4096                  | 1048576       ← 약 1MB 마다 1 entry
8192                  | 2097152
...
```

**검색 흐름**:
1. 원하는 offset 으로 `index` 에서 binary search → 가장 가까운 lower bound 의 position 획득
2. `.log` 파일의 그 position 부터 sequential read → 정확한 offset 도달

### `.timeindex` (timestamp → offset)
- `kafka-consumer-groups.sh --reset-offsets --to-datetime` 같은 시간 기반 lookup 에 사용
- 마찬가지로 sparse

**index.interval.bytes** (default 4KB) — 몇 byte 마다 index entry 추가. 작을수록 검색 정확, 인덱스 큼.

## 4. Append-Only Sequential I/O

Producer 가 보낸 batch 는 **무조건 segment 끝에 추가**. random write 없음.

```
HDD random I/O:  ~100 IOPS (10ms seek)
HDD sequential:  ~100 MB/s (seek 없음)
                 → 1000x 차이
```

SSD 시대에도 sequential 이 random 보다 5–10x 빠름. Kafka 는 이 차이를 최대한 활용:
- 여러 partition 을 한 디스크에 두면 random 처럼 보일 수 있지만, broker 가 batch 단위로 묶어 보내서 partition 별로는 sequential 패턴 유지
- 디스크 head 가 한 곳에 머무름 → throughput 극대화

## 5. Page Cache 와 fsync 정책

Kafka 의 **놀라운 결정**: 메시지 발행 시 fsync 를 강제하지 않는다 (default).

```kotlin
log.flush.interval.messages = Long.MAX_VALUE   // 매 메시지 fsync 안 함
log.flush.interval.ms = null                   // 시간 기반도 안 함
```

대신 **OS page cache 에 의존**.

```
write() syscall → page cache 에 저장 → 즉시 리턴 (사용자 관점 "저장 완료")
                              │
                              ▼
                     OS background flusher
                     (vm.dirty_*_ratio 정책)
                              │
                              ▼
                     디스크에 fsync
```

**그럼 fsync 안 했는데 데이터 손실은?** → **Replication 이 fsync 를 대신**. acks=all + RF=3 + min.ISR (In-Sync Replicas)=2 → 두 개 broker 의 page cache 에 동시에 손실되어야 데이터 잃음. 매우 낮은 확률.

**Kafka 철학**: "fsync 는 너무 비싸다. 대신 N 대 서버에 복제하는 게 더 빠르고 안전하다."

→ msa 도 별도 fsync 강제 안 함. RF=3 + min.ISR=2 로 안전 확보.

## 6. Zero-Copy (sendfile)

Consumer 가 메시지 가져갈 때 **사용자 공간 거치지 않고** 디스크 → 네트워크로 직접 전송.

### 일반적인 read + send 흐름
```
1. read(file) → kernel buffer 로 데이터 읽기 (DMA)
2. kernel buffer → user buffer 로 copy
3. user buffer → socket buffer 로 copy
4. socket buffer → NIC (DMA)
```
→ **4번의 context switch + 2번의 user/kernel copy**

### sendfile (zero-copy) 흐름
```
1. sendfile(in_fd, out_fd, ...) → kernel 이 직접 file → socket buffer 복사
2. socket buffer → NIC (DMA)
```
→ **2번의 context switch + 0번의 user/kernel copy**

```
일반:    file → page cache → user buffer → socket buffer → NIC
zero-copy: file → page cache ──────────────→ NIC
                  (Linux: splice() / FreeBSD: sendfile())
```

**효과**: CPU 사용률 ↓, throughput ↑ (보통 2–4x). 메시지가 큰 시스템일수록 효과 큼.

**제약**:
- 메시지 변환 (decompression, format 변환) 필요하면 zero-copy 불가
- TLS (Transport Layer Security, 전송 계층 보안) 활성화 시도 zero-copy 불가 (kernel 이 평문→암호문 변환을 user 공간에서 못 함)

## 7. Compression 과 Zero-Copy

- **Producer 압축, broker 그대로 저장** (`compression.type=producer`) → consumer 가 받을 때도 압축 상태 → zero-copy 가능
- broker 가 재압축 (`compression.type=lz4` 같이 강제) → 압축 풀어서 다시 압축 → zero-copy 불가, CPU 비용 ↑

→ 가능하면 producer/broker compression 일치시키는 게 성능 우위.

## 8. Broker 의 read 흐름 (Consumer 응답)

```
Consumer fetch request → broker
  │
  ▼
1. partition leader 의 log segment 찾기
2. .index 에서 binary search → 시작 position
3. fetch.min.bytes / fetch.max.bytes / fetch.max.wait.ms 만족할 때까지 대기
4. sendfile() 로 socket 에 직접 전송 (zero-copy)
5. consumer 가 받음
```

**fetch.min.bytes** (기본 1) — 이 바이트 이상 모일 때까지 broker 가 응답 보류. 0 으로 두면 small response 폭주.

**fetch.max.wait.ms** (기본 500ms) — 위가 안 차도 이 시간 후엔 응답.

→ throughput 우선이면 fetch.min.bytes 를 1KB 이상으로.

## 9. 디스크 I/O 패턴 정리

| 작업 | 패턴 | 비고 |
|---|---|---|
| Producer write | sequential append | log 파일 끝에만 추가 |
| Replication (follower) | sequential read | leader 의 log 끝부터 읽기 |
| Consumer read (recent) | page cache hit | 최근 메시지 → 메모리에서 바로 |
| Consumer read (old) | sequential disk read | retention 끝쪽 메시지 → 디스크에서 |
| Compaction | random read + sequential write | 옛 segment 읽고 새 segment 쓰기 |

→ **최근 메시지 처리에 최적화**. lag 이 누적되어 disk 까지 내려가면 throughput 떨어짐.

## 10. Page Cache 운영 팁

- broker JVM (Java Virtual Machine, 자바 가상 머신) heap 은 **6GB 이하** 로 잡아라 — 나머지는 OS page cache 에 양보
- 메모리 64GB → JVM 6GB + page cache 가용 ~50GB → 최근 50GB 데이터는 디스크 안 가도 됨
- swap 끄거나 swappiness=1 로 — page cache 가 swap 으로 밀려나면 broker 느려짐
- fast disk (NVMe SSD) — segment 가 늘어 page cache 못 다 못 담을 때 영향
- XFS / ext4 권장. 너무 큰 partition (수만) 은 파일핸들 / inode 부하

## 11. 면접 포인트

- **Q. Kafka 가 fsync 안 하는데 데이터 손실 안 일으키나?**
  > Replication 으로 보완. acks=all + min.ISR=2 + RF=3 → 두 broker 의 page cache 에 동시 손실되어야 잃음. 그리고 OS 가 background 로 결국 디스크에 flush. 한 broker 의 power loss 는 다른 broker 가 follow up 으로 복구. fsync 비용을 replication 비용으로 대체한 셈.

- **Q. zero-copy (sendfile) 이 실제 어떻게 빠른가?**
  > 일반 read+send 는 user/kernel context switch 4 + memory copy 2 회. sendfile 은 kernel 안에서 file → socket buffer 직접 복사. CPU 사용 ↓ (memory bandwidth 절약), throughput ↑. 메시지 큰 시스템에서 2-4x 효과.

- **Q. broker 의 JVM heap 을 크게 잡으면 안 되는 이유?**
  > Kafka 는 Java 객체 캐싱을 거의 하지 않는다 (page cache 신뢰). 큰 heap → GC (Garbage Collection, 가비지 컬렉션) pause ↑. heap 작게 (4-6GB) + 나머지 OS 가 page cache 로 활용 → 최근 데이터 in-memory 효과. 보통 NewGen ↑ + G1GC.

- **Q. TLS 활성화 시 throughput 떨어지는 이유?**
  > zero-copy 가 깨진다. 평문 file → user buffer 에서 암호화 → socket 으로 보내야 하므로 sendfile 사용 불가. CPU 비용도 ↑. AES-NI 같은 hw 가속 + 충분한 코어 필요.

- **Q. Compaction 토픽이 일반 토픽보다 디스크 I/O 큰 이유?**
  > 일반 토픽은 sequential write only. compaction 은 옛 segment 를 읽으며 살릴 메시지만 새 segment 로 쓰기 → random read + sequential write 패턴. cleaner thread 가 백그라운드로 돌면서 추가 I/O 발생. 큰 compact 토픽은 디스크 throughput 여유 필요.

## 12. 다음 단계

- [06-replication-isr.md](06-replication-isr.md) — acks=all 의 ack 가 어떻게 결정 (ISR / HW 메커니즘)
- [02-offset-retention-compaction.md](02-offset-retention-compaction.md) — segment 가 어떻게 retention 되는지
- [04-producer-tuning.md](04-producer-tuning.md) — producer batch 가 어떻게 broker 에 도달하는지
