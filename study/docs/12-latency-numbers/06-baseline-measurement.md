---
parent: 12-latency-numbers
phase: 3
order: 06
title: 기본 실측 — redis-cli / curl / ping / dd
created: 2026-04-26
estimated-hours: 2
---

# 06. 기본 실측 — 자릿수가 진짜 그런지 내 손으로 확인

> Phase 3 의 시작. 표 값과 **내 시스템의 실제 값** 을 자릿수로 대조한다.
> 환경: 로컬 k3d (k3s-lite), `kubectl apply -k k8s/overlays/k3s-lite` 적용 가정.

## 0. 이 파일에서 얻을 것

- 표 값과 실측값을 자릿수로 대조하는 감각
- `redis-cli --latency`, `curl -w`, `ping`, `mtr`, `dd` 의 핵심 사용법
- "측정값이 표보다 빠르거나 느리다" 의 원인 추론
- Phase 4 면접 카드: "직접 측정해 본 적 있나요?" 의 실측 일화 재료

---

## 1. Redis 실측 — `redis-cli --latency`

### 명령

```bash
# Pod 으로 들어가거나 port-forward
kubectl port-forward -n infra svc/redis 6379:6379 &

# 1초 간격으로 PING latency 측정 (Ctrl+C 로 종료)
redis-cli --latency

# 히스토리 (1초마다 통계 출력)
redis-cli --latency-history -i 1

# 분포 히스토그램 (latency-dist)
redis-cli --latency-dist
```

### 예상 자릿수

- **같은 Pod 내** (loopback): ~50-200 µs
- **같은 노드 다른 Pod**: ~200-500 µs
- **다른 노드 (managed K8s)**: ~500 µs ~ 1 ms
- **port-forward 경유** (kubectl): +~200 µs (kubectl proxy 추가)

### 해석 가이드

```
min  max  avg  p50   p99   p999
80   3500 320  250   1200  3000   (단위: µs)
```

- **avg ~320 µs / p99 ~1.2 ms** → 표의 "DC 내 RTT 500 µs" 와 자릿수 일치 ✅
- p999 가 avg 의 ~10배 → 외울 비율 #5 (평균→P99 ×3-10) 검증
- max 가 ms 영역 → outlier (GC, kube-proxy, network jitter) 존재

### 만약 표보다 훨씬 느리다면

| 증상 | 의심 |
|---|---|
| avg 가 ms 단위 | port-forward / kubectl proxy 오버헤드 |
| p99 / max 가 100ms+ | Redis 자체 GC, RDB 저장, AOF rewrite |
| 모든 값이 들쭉날쭉 | 노드 CPU contention, hypervisor noisy neighbor |

---

## 2. HTTP latency 분해 — `curl -w`

### 명령

```bash
# curl-format.txt 작성
cat > curl-format.txt <<'EOF'
    time_namelookup:  %{time_namelookup}s
       time_connect:  %{time_connect}s
    time_appconnect:  %{time_appconnect}s
   time_pretransfer:  %{time_pretransfer}s
      time_redirect:  %{time_redirect}s
 time_starttransfer:  %{time_starttransfer}s
                    -----
         time_total:  %{time_total}s
EOF

# gateway → product 호출 측정 (예시 endpoint)
curl -w '@curl-format.txt' -o /dev/null -s \
  http://localhost/api/v1/products/1
```

### 단계별 의미

| 단계 | 의미 | 일반 자릿수 |
|---|---|---|
| `time_namelookup` | DNS 조회 시간 | µs (캐시) ~ ms (cold) |
| `time_connect` | TCP handshake (3-way) 완료 | DC 내 ~ms |
| `time_appconnect` | TLS handshake 완료 | +수 ms (TLS 비용) |
| `time_pretransfer` | 요청 전송 직전 | ~time_appconnect |
| `time_starttransfer` | 첫 byte 받기 시작 (TTFB) | + 서버 처리 시간 |
| `time_total` | 응답 종료 | + 응답 본문 전송 시간 |

### TTFB - time_pretransfer = "순수 서버 처리 시간"

```
서버 처리 시간 = time_starttransfer - time_pretransfer
```

이 값이 **µs ~ ms 자릿수** 면 정상. **수십 ms ~ 100ms+** 면 서버 내부 (DB, 외부 API) 가 dominant.

### 반복 측정 (변동성 보기)

```bash
for i in {1..100}; do
  curl -w '%{time_total}\n' -o /dev/null -s http://localhost/api/v1/products/1
done | sort -n | awk '
  { a[NR] = $1; sum += $1 }
  END {
    print "count:", NR
    print "min:", a[1]
    print "p50:", a[int(NR*0.5)]
    print "p95:", a[int(NR*0.95)]
    print "p99:", a[int(NR*0.99)]
    print "max:", a[NR]
    print "avg:", sum/NR
  }
'
```

→ 단일 호출 P50 / P99 분포를 자릿수로 확인. 07번 부하 테스트에서 더 정밀한 분포.

---

## 3. 네트워크 RTT — `ping` / `mtr`

### 같은 노드 vs 다른 노드 RTT

```bash
# Pod IP 알아내기
kubectl get pods -o wide

# Pod ↔ Pod ping
kubectl exec -it <source-pod> -- ping <target-pod-ip> -c 20
```

예상:
- 같은 노드 ↔ 같은 노드: ~100-300 µs
- 다른 노드 (managed K8s): ~500 µs ~ 1 ms
- 다른 AZ: ~1-5 ms (AWS/GCP 기준)

### `mtr` — hop 별 latency

```bash
# 외부 호스트로의 hop 별 RTT
mtr --report --report-cycles 30 example.com
```

각 hop 마다 latency 가 점점 늘어남. 어느 hop 에서 점프하는지 보면 병목 위치 파악.

### 한국 → 미국 RTT 직접 측정

```bash
ping -c 10 google.com           # 가까운 PoP, ~수 ms
ping -c 10 us.example.com       # 미국 호스트, ~150 ms
```

→ 표의 "150 ms" 가 실제로 자기 네트워크에서 그 자릿수인지 검증.

---

## 4. 디스크 throughput — `dd`

### sequential write

```bash
# 1GB sequential write
dd if=/dev/zero of=/tmp/test bs=1M count=1024 oflag=direct
# 결과: 1073741824 bytes (1.1 GB) copied, 1.5 s, 720 MB/s
```

### sequential read

```bash
# 1GB sequential read
dd if=/tmp/test of=/dev/null bs=1M
# 결과: 1073741824 bytes (1.1 GB) copied, 0.4 s, 2.7 GB/s
```

### 자릿수 검증

| 매체 | 예상 sequential read |
|---|---|
| **DRAM** (`/dev/shm/test`) | 5-10 GB/s |
| **NVMe SSD** | 1-3 GB/s |
| **SATA SSD** | 500 MB/s |
| **HDD** | 100-200 MB/s |

→ "SSD 가 HDD 의 ~10배" 가 throughput 에서 직관적으로 확인됨.

### Random I/O 측정 — `fio`

```bash
# 4KB random read, 30초
fio --name=randread --ioengine=libaio --rw=randread \
    --bs=4k --numjobs=4 --size=1G --runtime=30 \
    --time_based --direct=1
```

→ random IOPS, latency 분포 (avg / p99 / p999) 출력. SSD 의 µs 자릿수 검증.

---

## 5. 측정 결과 정리 양식 (실측 노트)

각 측정 결과를 같은 양식으로 기록 → Phase 4 의 면접 답변 스토리에 재활용.

```markdown
## 측정 #1: redis-cli --latency (k3d, 같은 노드)
- 일시: 2026-04-26 14:30
- 환경: k3d v5, single node, Redis standalone
- 명령: `redis-cli --latency-history -i 1`
- 결과:
  - min: 80 µs / max: 3500 µs / avg: 320 µs / p99: 1200 µs
- 표 대조: ✅ 자릿수 일치 (DC 내 RTT 500 µs 그룹)
- 특이사항: max 가 ms 영역, RDB 저장 시점 의심
- 학습 포인트: 평균과 p99 의 ×4 차이 직접 관찰
```

→ 측정 5-10건을 누적하면 면접에서 "직접 측정해 본 결과 ..." 라는 강한 카드 완성.

---

## 6. 자가 점검

- [ ] redis-cli --latency 실행하여 µs 자릿수 확인
- [ ] curl -w 로 HTTP 단계별 latency 분해 가능
- [ ] ping 으로 같은 노드 vs 다른 노드 RTT 자릿수 차이 확인
- [ ] dd 로 디스크 throughput 측정 (sequential)
- [ ] 측정값과 표 값을 자릿수로 대조하는 습관

## 7. 면접 답변 카드

**Q: "Redis latency 직접 측정해 본 적 있나요?"**

> 네. `redis-cli --latency-history` 로 측정해 보면 같은 K8s 노드 기준 avg ~300 µs, p99 ~1ms 정도 나옵니다. Jeff Dean 표의 "DC 내 RTT 500µs" 자릿수와 일치하고, p99 가 평균의 ~3-4배라는 tail latency 비율도 직접 확인했어요. max 가 가끔 ms 영역으로 튀는데 RDB 저장이나 AOF rewrite 영향으로 추정합니다.

**Q (꼬리): "HTTP latency 가 느린데 어디부터 보겠어요?"**

> `curl -w` 로 단계별 분해부터 합니다. DNS → TCP connect → TLS handshake → TTFB → 본문 전송 으로 쪼개면 어느 구간이 dominant 인지 보여요. TTFB - pretransfer 가 순수 서버 처리 시간이라, 그게 ms 단위로 크면 서버/DB 쪽, 그게 작은데 total 이 크면 네트워크/본문 크기 의심합니다.

---

## 다음 파일

- **07. 부하 테스트 + tail 측정** ([07-load-test-tail.md](07-load-test-tail.md))
