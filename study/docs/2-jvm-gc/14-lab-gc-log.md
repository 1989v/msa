---
parent: 2-jvm-gc
seq: 14
title: Lab 1 — GC 로그 수집 + 분석 (product 서비스)
type: lab
created: 2026-05-01
---

# Lab 1. GC 로그 수집 + 분석

## 목표

msa 의 **product 서비스**를 로컬 K8s (Kubernetes)(k3d)에 띄우고 G1 (Garbage-First Collector) / ZGC (Z Garbage Collector) / Parallel GC (Garbage Collection, 가비지 컬렉션) 로그를 수집해 GCEasy / GCViewer 로 비교 분석한다. 면접에서 "직접 GC 튜닝 해봤냐" 의 실무 스토리 자산화.

## 소요 시간

3-4h (환경 준비 30m + 부하 60m + 분석 90m + 정리 30m)

---

## 준비물

- 로컬 k3d 클러스터 (CLAUDE.md 의 `k8s/overlays/k3s-lite` 기준)
- Eclipse Temurin 25 (host 에서 분석 도구 실행)
- GCViewer (`brew install gcviewer`)
- GCEasy 계정 (gceasy.io, 무료 일일 5건)
- k6 / wrk / ab (부하 도구) — 본 lab 은 k6 사용

---

## 단계 1. GC 로그 활성화 패치

### 옵션: Jib 빌드 시 GC 옵션 주입

`commerce.jib-convention.gradle.kts` 에 lab 용 옵션 추가 (실습 후 원복 권장):

```kotlin
container {
    jvmFlags = listOf(
        "-XX:+UseContainerSupport",
        "-XX:MaxRAMPercentage=75.0",
        "-Xlog:gc*,gc+heap=info,gc+age=info,safepoint=warning:file=/var/log/jvm/gc.log:time,uptime,level,tags:filecount=5,filesize=10M",
        "-XX:+HeapDumpOnOutOfMemoryError",
        "-XX:HeapDumpPath=/var/log/jvm/",
    )
}
```

또는 K8s deployment 의 env 로 `JAVA_TOOL_OPTIONS` 사용 — Jib 옵션과 합쳐짐:

```yaml
env:
  - name: JAVA_TOOL_OPTIONS
    value: >-
      -Xlog:gc*:file=/var/log/jvm/gc.log:time,uptime:filecount=5,filesize=10M
      -XX:+HeapDumpOnOutOfMemoryError
      -XX:HeapDumpPath=/var/log/jvm/
```

env 방식이 빌드 재실행 안 해도 되어 lab 용으로 편함.

### emptyDir 마운트

```yaml
volumeMounts:
  - name: jvm-logs
    mountPath: /var/log/jvm
volumes:
  - name: jvm-logs
    emptyDir: {}
```

### 빌드 + 적용

```bash
./gradlew :product:app:jibBuildTar
scripts/image-import.sh --service product
kubectl rollout restart -n commerce deployment/product
```

---

## 단계 2. 부하 스크립트

### k6 시나리오 (`load-product.js`)

```javascript
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
    stages: [
        { duration: '2m', target: 50 },   // ramp-up
        { duration: '10m', target: 50 },  // steady
        { duration: '1m', target: 0 },    // ramp-down
    ],
};

const BASE = __ENV.BASE_URL || 'http://localhost:30081';

export default function () {
    const id = Math.floor(Math.random() * 10000) + 1;
    http.get(`${BASE}/products/${id}`);
    http.get(`${BASE}/products/search?q=test&size=20`);
    sleep(0.1);
}
```

실행:
```bash
k6 run load-product.js
```

13분 부하 → 충분한 GC 사이클 확보.

---

## 단계 3. 시나리오별 실험

### 시나리오 A — G1 GC (default)

위 옵션 그대로. 부하 13분 → 로그 추출:

```bash
kubectl cp commerce/product-xxx:/var/log/jvm/gc.log ./gc-g1.log
```

### 시나리오 B — ZGC Generational

JAVA_TOOL_OPTIONS 에 추가:
```
-XX:+UseZGC
```

(JDK 21+ 에선 generational 이 default. JDK 21 만 쓰는 경우 `-XX:+ZGenerational`)

배포:
```bash
kubectl set env -n commerce deployment/product JAVA_TOOL_OPTIONS="-XX:+UseZGC -Xlog:gc*:file=/var/log/jvm/gc.log:time,uptime:filecount=5,filesize=10M"
kubectl rollout status -n commerce deployment/product
```

부하 동일하게 13분. 로그 추출:
```bash
kubectl cp commerce/product-xxx:/var/log/jvm/gc.log ./gc-zgc.log
```

### 시나리오 C — Parallel GC

```
-XX:+UseParallelGC
```

부하 + 로그 추출 → `gc-parallel.log`.

### 시나리오 D — MaxGCPauseMillis 변경 (G1)

```
-XX:+UseG1GC -XX:MaxGCPauseMillis=50    # 공격적 (기본 200)
```

→ `gc-g1-50ms.log`.

---

## 단계 4. 분석

### A. GCEasy.io 업로드

각 로그를 GCEasy 에 업로드해 자동 리포트 받기. 주요 KPI:

| 항목 | G1 default | ZGC | Parallel | G1 50ms |
|---|---|---|---|---|
| Throughput | 99.5% | 98.7% | 99.7% | 99.2% |
| Pause max | 180ms | 0.8ms | 850ms | 60ms |
| Pause P99 | 150ms | 0.5ms | 600ms | 45ms |
| Allocation rate | 250 MB/s | 230 MB/s | 280 MB/s | 240 MB/s |
| Promotion rate | 12 MB/s | n/a | 15 MB/s | 14 MB/s |
| Full GC | 0 | 0 | 2 | 0 |

(예상 값. 실제 환경에서 측정 필요)

### B. GCViewer 로컬 분석

```bash
java -jar gcviewer-*.jar gc-g1.log
```

Pause time histogram, throughput timeline, heap usage 차트.

### C. P99 응답 latency 비교

k6 결과의 `http_req_duration{p(99)}`:

| GC | P50 | P99 |
|---|---|---|
| G1 default | 25ms | 220ms |
| ZGC | 25ms | 35ms ← 큰 폭 감소 |
| Parallel | 22ms | 750ms ← 큰 STW 노출 |
| G1 50ms | 26ms | 80ms |

**ZGC 가 latency 측면에서 압도적**, Parallel 은 throughput 작은 우위 + latency 폭망, MaxGCPauseMillis 조정은 부분 효과.

---

## 단계 5. 면접 답변용 정리

### 스토리

> "msa 의 product 서비스에 부하를 주고 G1, ZGC, Parallel 을 비교했습니다.
>
> - **Throughput** 은 Parallel > G1 > ZGC 순서로 0.5%p 차이.
> - **Pause time P99** 는 ZGC < 1ms, G1 default 150ms, Parallel 600ms 로 ZGC 가 압도.
> - **응답 P99** 는 ZGC 가 G1 대비 1/6 수준.
>
> 결론: 일반 웹 API 는 G1 의 200ms 가 충분하지만, 트레이딩 서비스(quant) 같이 latency 민감한 곳은 ZGC 를 검토해야 한다고 판단했습니다."

### 차트 (Grafana 캡처) 첨부 권장

- Pause time over time
- Heap usage over time
- HTTP P99 over time

면접에서 차트 한 장이 1000 단어 가치.

---

## 단계 6. 정리 및 원복

```bash
# JAVA_TOOL_OPTIONS 제거
kubectl set env -n commerce deployment/product JAVA_TOOL_OPTIONS-

# emptyDir 의 로그는 pod 재시작 시 사라짐 (의도적)
# PVC 사용 시 별도 정리
```

Jib 옵션 변경했으면 원복 (운영 옵션이 아닌 lab 옵션은 빼기).

---

## 함정 / 흔한 실수

| 함정 | 대응 |
|---|---|
| Warm-up 부족 — 처음 1분 데이터 포함하면 인터프리터 실행 시간 섞임 | 첫 2분 ramp-up 결과는 분석에서 제외 |
| 부하가 너무 작아 GC 가 거의 안 일어남 | allocation rate 가 100MB/s 이상 되도록 부하 늘리기 |
| GC 로그가 컨테이너 재시작 시 사라짐 | PVC 또는 stdout + Loki |
| GCEasy 가 일부 JDK 21 형식 못 읽음 | 최신 GCEasy 또는 gceasy CLI 사용 |
| ZGC Generational 미지원 JDK | JDK 21+ 확인 |

---

## 다음 학습

- [09-gc-log-analysis.md](09-gc-log-analysis.md) — 로그 형식 / 지표 복습
- [15-lab-heap-dump-mat.md](15-lab-heap-dump-mat.md) — 같은 부하 환경에서 누수 시뮬레이션
- [21-improvements.md](21-improvements.md) — Lab 결과를 ADR 후보로
