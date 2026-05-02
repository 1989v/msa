---
parent: 2-jvm-gc
seq: 09
title: GC 로그 분석 — -Xlog:gc* / GCViewer / GCEasy
type: deep
created: 2026-05-01
---

# 09. GC 로그 분석

## TL;DR

GC 로그는 **모든 튜닝의 출발점**. JDK 9+ 부터 통합 로그(`-Xlog:gc*`) 가 기본. 핵심 지표는 **Pause Time / Throughput / Allocation Rate / Promotion Rate / Heap Occupancy 추이** 5가지. 면접에서 "GC 로그 어떻게 봤냐" 질문은 이 5가지를 순서대로 답하면 된다. 도구는 **GCViewer** (로컬 GUI), **GCEasy.io** (웹, 자동 분석 리포트), **gceasy CLI** (배치). 로그를 안 남기고 운영하면 장애 후 원인 진단이 거의 불가능 — 무조건 켜야 하는 운영 옵션.

---

## 1. GC 로그 켜기 (JDK 21~25)

### 권장 옵션 세트

```bash
-Xlog:gc*,gc+heap=debug,gc+age=trace,safepoint:file=/var/log/gc.log:time,uptime,level,tags:filecount=10,filesize=20M
```

### 옵션 분해

| 부분 | 의미 |
|---|---|
| `-Xlog:gc*` | 모든 gc 태그 (info 레벨) |
| `gc+heap=debug` | 힙 사용률 변화 detail |
| `gc+age=trace` | tenuring distribution (어느 age 가 얼마나) |
| `safepoint` | safepoint sync time |
| `:file=/var/log/gc.log` | 파일 출력 |
| `:time,uptime,level,tags` | 디코레이터 (timestamp, 부팅 후 경과, 레벨, 태그) |
| `:filecount=10,filesize=20M` | 로그 로테이션 (10 × 20MB = 200MB) |

### 기본 옵션 (간단)

```bash
-Xlog:gc:file=gc.log
```

이거만 해도 핵심 정보 다 잡힘.

### 추가 운영 옵션

```bash
-XX:+HeapDumpOnOutOfMemoryError                  # OOM 시 자동 덤프
-XX:HeapDumpPath=/var/log/heapdump-%t.hprof      # %t = timestamp
-XX:+ExitOnOutOfMemoryError                      # OOM 시 즉시 종료 → K8s 재시작
-XX:+UnlockDiagnosticVMOptions                   # 진단 옵션 활성
-XX:+LogVMOutput -XX:LogFile=/var/log/jvm.log    # JVM 부가 로그
```

### JDK 8 호환 (참고만)

```bash
-Xloggc:gc.log -XX:+PrintGCDetails -XX:+PrintGCDateStamps -XX:+PrintGCTimeStamps -XX:+UseGCLogFileRotation -XX:NumberOfGCLogFiles=10 -XX:GCLogFileSize=20M
```

JDK 9+ 에서 deprecated. 통합 로그로 대체.

---

## 2. G1 GC 로그 읽기

### 전형적 Young GC 로그

```
[2026-05-01T10:23:45.123+0000][12.345s][info][gc,start    ] GC(42) Pause Young (Normal) (G1 Evacuation Pause)
[2026-05-01T10:23:45.123+0000][12.345s][info][gc,task     ] GC(42) Using 4 workers of 4 for evacuation
[2026-05-01T10:23:45.148+0000][12.370s][info][gc,phases   ] GC(42)   Pre Evacuate Collection Set: 0.2ms
[2026-05-01T10:23:45.148+0000][12.370s][info][gc,phases   ] GC(42)   Merge Heap Roots: 0.1ms
[2026-05-01T10:23:45.148+0000][12.370s][info][gc,phases   ] GC(42)   Evacuate Collection Set: 23.0ms
[2026-05-01T10:23:45.148+0000][12.370s][info][gc,phases   ] GC(42)   Post Evacuate Collection Set: 1.5ms
[2026-05-01T10:23:45.148+0000][12.370s][info][gc,phases   ] GC(42)   Other: 0.5ms
[2026-05-01T10:23:45.148+0000][12.370s][info][gc,heap     ] GC(42) Eden regions: 100->0(95)
[2026-05-01T10:23:45.148+0000][12.370s][info][gc,heap     ] GC(42) Survivor regions: 5->10(15)
[2026-05-01T10:23:45.148+0000][12.370s][info][gc,heap     ] GC(42) Old regions: 50->55
[2026-05-01T10:23:45.148+0000][12.370s][info][gc,heap     ] GC(42) Humongous regions: 2->2
[2026-05-01T10:23:45.148+0000][12.370s][info][gc,metaspace] GC(42) Metaspace: 80M(82M)->80M(82M) NonClass: 70M(72M)->70M(72M) Class: 10M(10M)->10M(10M)
[2026-05-01T10:23:45.148+0000][12.370s][info][gc          ] GC(42) Pause Young (Normal) (G1 Evacuation Pause) 800M->100M(1024M) 25.3ms
[2026-05-01T10:23:45.148+0000][12.370s][info][gc,cpu      ] GC(42) User=0.10s Sys=0.00s Real=0.03s
```

### 핵심 라인 해석

```
Pause Young (Normal) (G1 Evacuation Pause) 800M->100M(1024M) 25.3ms
                                            ↑     ↑    ↑     ↑
                                         GC전  GC후 힙max  pause 시간
```

- **800M → 100M**: 거의 전부 죽음 (Eden 99% 가비지). 정상.
- **(1024M)**: 최대 힙
- **25.3ms**: pause 시간. 200ms 목표 안

### Eden / Survivor / Old 변화

```
Eden regions:      100->0(95)         ← Eden 비워짐, 다음엔 95개 region 사용
Survivor regions:    5->10(15)        ← 5개에서 10개로 증가 (Eden 살아남음)
Old regions:        50->55            ← 5개 promotion (Survivor 에서 진급)
Humongous regions:   2->2             ← 변화 없음
```

**Promotion Rate** = Old 증가량 / 시간 = (55-50) × region_size / GC interval. 이게 너무 높으면 Old 가 빨리 차서 Mixed GC 빈발.

### Concurrent Mark 로그

```
[gc] GC(43) Concurrent Mark Cycle
[gc] GC(43) Concurrent Mark From Roots
[gc] GC(43) Concurrent Mark From Roots 50.234ms      ← 앱 병행, mutator 영향 적음
[gc] GC(43) Pause Remark 1024M->1024M(2048M) 5.123ms ← STW. 이 짧으면 정상
[gc] GC(43) Concurrent Mark
[gc] GC(43) Pause Cleanup 1024M->980M(2048M) 1.234ms ← STW. 100% garbage region 회수
```

### Mixed GC 로그

```
[gc] GC(44) Pause Young (Mixed) (G1 Evacuation Pause) 1024M->600M(2048M) 50.3ms
                            ↑↑↑↑↑                       ↑    ↑
                            Mixed!                       400MB 회수
```

Mixed 라는 표시 + Old 가 줄어드는 게 정상.

### Full GC (위험 신호)

```
[gc] GC(45) Pause Full (G1 Evacuation Pause) 2048M->1500M(2048M) 850.5ms
                       ↑↑↑↑                                       ↑
                       경고                                       너무 김
```

Full GC = 튜닝 실패. 원인:
- Old 가 가득 + Mixed GC 못 따라잡음 → Concurrent Mark 임계 낮춰야
- Humongous 단편화 → region size 늘려야
- Metaspace 부족 → MaxMetaspaceSize 늘려야

---

## 3. ZGC 로그 읽기

### 전형적 사이클

```
[100.5s][info][gc,start ] GC(42) Garbage Collection (Allocation Rate)
[100.5s][info][gc       ] GC(42) Pause Mark Start 0.234ms
[100.55s][info][gc      ] GC(42) Concurrent Mark 50.234ms
[100.55s][info][gc      ] GC(42) Pause Mark End 0.198ms
[100.55s][info][gc      ] GC(42) Concurrent Process Non-Strong References 5ms
[100.55s][info][gc      ] GC(42) Pause Relocate Start 0.154ms
[100.6s][info][gc       ] GC(42) Concurrent Relocate 45ms
[100.6s][info][gc       ] GC(42) Garbage Collection (Allocation Rate) 800M(45%)->100M(15%)
                                                                       ↑ before(점유율)  ↑ after
```

핵심: **Pause 들이 0.2ms ~ 0.5ms 수준**. Concurrent phase 가 길어도 mutator 영향 적음.

### Allocation Stall (위험)

```
[120.5s][warning][gc] Allocation Stall (Thread-12) 25.3ms
```

mutator 가 ZGC 를 못 기다림. 자주 보이면 ConcGCThreads 증가 또는 Xmx 증가.

---

## 4. 핵심 지표 5가지

### 4.1 Pause Time

> 각 GC의 STW 시간

```
P50 / P90 / P99 / max
G1 정상: P99 < MaxGCPauseMillis (예: 200ms)
ZGC 정상: P99 < 1ms
```

GCEasy 의 "Pause Time Statistics" 섹션이 자동 집계.

### 4.2 Throughput

> 1 - (GC 시간 / 전체 시간)

```
정상: > 99% (즉 GC 가 1% 미만)
경고: 95~99%
위험: < 95%
```

GCEasy 가 자동 계산해서 색깔로 표시.

### 4.3 Allocation Rate

> 시간당 객체 할당량 (MB/s)

```
일반 API: 100 ~ 500 MB/s
처리 워크로드: 1 GB/s+
스트림: 5 GB/s+
```

급증하면 → 트래픽 증가 또는 비효율 코드 (DTO 폭증).

### 4.4 Promotion Rate

> Old 로 옮겨지는 객체 양

```
정상: Allocation Rate 의 1~5%
경고: 10%+
위험: 30%+ (premature promotion)
```

Promotion 이 높으면 Old 빠르게 차고 Mixed GC 빈발.

### 4.5 Heap Occupancy 추이

GC 직후 힙 점유율 (Old 영역).

```
정상: 일정 범위에서 톱니파 (Mixed GC 가 정리)
누수 의심: 우상향 (계속 증가)
```

Old 가 시간이 지나도 안 줄면 → 메모리 누수 시작 신호.

---

## 5. GCViewer (로컬 GUI)

### 설치

```bash
brew install gcviewer
# 또는 jar 다운로드: https://github.com/chewiebug/GCViewer/releases
java -jar gcviewer-*.jar
```

### 핵심 화면

- **타임라인 그래프**: 힙 사용량, GC 발생 지점
- **Summary**: 평균 pause, throughput, allocation rate
- **Histogram**: pause time 분포

### 장점

- 오프라인, 회사 보안 환경에서 사용 가능
- 라이브 분석 가능

### 단점

- UI 가 옛스러움
- 자동 진단 기능 약함

---

## 6. GCEasy.io (웹 서비스)

### 사용

1. https://gceasy.io 접속
2. gc.log 업로드
3. 자동 리포트 생성 (1~2초)

### 자동 리포트 항목

- **JVM Memory Size** — Young/Old/Metaspace 변화
- **Pause Time** — P50/P90/P99/max 분포
- **Throughput** — % 와 시간대별 차트
- **GC Cause** — Allocation/Metadata/Humongous/etc 분류
- **GC Statistics** — Young/Mixed/Full 횟수/평균
- **GC KPI** — 자동 평가 (PASS/FAIL/WARN)

### 자동 진단 예시

```
✅ Throughput is good (99.5%)
⚠️ G1 Humongous regions detected (12 occurrences)
   → Consider increasing G1HeapRegionSize
❌ 2 Full GC detected during 1 hour run
   → Likely Old generation pressure or Metaspace
```

### 단점

- 외부 서비스 (개인정보 포함된 GC 로그라면 보안 검토)
- 무료는 일일 제한
- API 사용은 유료

### 사내 프록시

GC 로그는 객체 클래스명/스택은 안 보이고 통계만 있어서 보통 안전. 단 회사 정책 확인 필요.

---

## 7. gceasy CLI (배치 자동화)

API 키 발급 후:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  --data-binary @gc.log \
  "https://api.gceasy.io/analyzeGC?apiKey=YOUR_KEY"
```

JSON 응답으로 KPI 집계. CI 에서 회귀 감지 가능 (이전 빌드 대비 GC throughput 0.5% 떨어지면 alert 등).

---

## 8. 면접 답변 템플릿

> Q: GC 로그 어떻게 분석하시나요?

A:
1. **G1 면 `-Xlog:gc*:file=gc.log` 로 수집** 합니다 — JDK 9 통합 로그.
2. **GCEasy 에 업로드** 해 자동 리포트로 1차 진단합니다.
3. 5가지 지표를 봅니다:
   - **Pause time**: P99 가 MaxGCPauseMillis 안인지
   - **Throughput**: 99% 이상인지
   - **Allocation rate**: 정상 범위 (보통 < 1GB/s)
   - **Promotion rate**: allocation 의 5% 이하
   - **Old 점유율 추이**: 우상향이면 누수 의심
4. **이상 시 detail 로그** (`gc+heap=debug`, `gc+age=trace`) 켜고 jstat 로 라이브 추적.
5. 누수 의심이면 **MAT 으로 heap dump 분석**.

Full GC 가 보이면 십중팔구 튜닝이 필요한 신호 — IHOP, region size, 또는 누수.

---

## 9. msa 적용 패턴

### Jib 옵션 추가 권장

```kotlin
// commerce.jib-convention.gradle.kts 개선안
jvmFlags = listOf(
    "-XX:+UseContainerSupport",
    "-XX:MaxRAMPercentage=75.0",
    "-Xlog:gc*,gc+heap=info,gc+age=info,safepoint=warning:file=/var/log/jvm/gc.log:time,uptime,level,tags:filecount=5,filesize=10M",
    "-XX:+HeapDumpOnOutOfMemoryError",
    "-XX:HeapDumpPath=/var/log/jvm/heapdump-%t.hprof",
    "-XX:+ExitOnOutOfMemoryError",
)
```

### K8s 영구 볼륨 (선택)

GC 로그를 PVC 에 마운트 — 컨테이너 재시작 후에도 로그 보존 (장애 forensic 용).

```yaml
volumeMounts:
  - name: jvm-logs
    mountPath: /var/log/jvm
volumes:
  - name: jvm-logs
    persistentVolumeClaim:
      claimName: gc-log-pvc
```

대안: stdout 으로 보내고 Loki/ELK 가 수집. 로그 회전 로직이 단순해짐.

```kotlin
"-Xlog:gc*::time,uptime"   // file 옵션 빼면 stdout
```

---

## 10. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "Full GC 가 GC 로그에 안 보이면 정상" | Full GC 표시는 명시적이라 안 보이는 것일 수도 있음. JDK 8 형식인지 9+ 형식인지 확인 |
| "Pause 만 짧으면 OK" | Throughput 도 같이 봐야. 너무 잦은 GC 도 문제 |
| "Allocation Rate 가 높으면 무조건 나쁨" | 살아남는 비율이 더 중요. 1GB/s 할당해도 99% 가 죽으면 OK |
| "GC 로그가 부담스럽다" | 프로덕션에서 실측 < 1% 오버헤드. 무조건 켜야 함 |
| "GCEasy 가 자동 진단해주니 직접 안 봐도 됨" | 자동 진단은 시작점. 직접 5지표 확인 필수 |
| "ZGC 는 로그 분석 필요 없음" | Allocation Stall 같은 위험 신호는 ZGC 도 로그 필수 |

---

## 다음 학습

- [10-jit-compilation.md](10-jit-compilation.md) — JIT 컴파일 동작
- [12-oom-five-types.md](12-oom-five-types.md) — GC 로그에서 OOM 전조 보기
- [14-lab-gc-log.md](14-lab-gc-log.md) — 직접 GC 로그 분석 실습
