---
parent: 2-jvm-gc
seq: 18
title: msa Jib JVM 옵션 점검
type: deep
created: 2026-05-01
---

# 18. msa Jib JVM 옵션 점검

## TL;DR

msa 의 모든 JVM (Java Virtual Machine, 자바 가상 머신) 서비스는 `buildSrc/src/main/kotlin/commerce.jib-convention.gradle.kts` 의 단일 convention 으로 컨테이너 이미지를 빌드한다. 현재 설정은 **컨테이너 인식 + 힙 75%** 의 기본만 박혀 있고, **GC (Garbage Collection, 가비지 컬렉션) 로그 / 자동 dump / Metaspace 한도 / Code Cache 한도 / NMT** 가 빠져있다. 운영 진단성 / OOM (Out Of Memory, 메모리 부족) 안전성 측면에서 보강 필요. 본 절은 현 설정의 분해 + 부족점 + 개선안을 정리한다.

---

## 1. 현재 설정 (확인)

### `buildSrc/src/main/kotlin/commerce.jib-convention.gradle.kts`

핵심 발췌:

```kotlin
configure<JibExtension> {
    from {
        image = "eclipse-temurin:25-jre-alpine"
    }
    to {
        image = "$jibRegistry/$serviceImageName"
        tags = if (jibCustomTag != null) {
            setOf("latest", jibCustomTag!!)
        } else {
            setOf("latest", project.version.toString())
        }
    }
    container {
        mainClass = resolvedMainClass
        jvmFlags = listOf(
            "-XX:+UseContainerSupport",
            "-XX:MaxRAMPercentage=75.0",
            "-Djava.security.egd=file:/dev/./urandom"
        )
        user = "1000:1000"
        creationTime.set("USE_CURRENT_TIMESTAMP")
        labels.set(
            mapOf(
                "org.opencontainers.image.source" to "https://github.com/1989v/msa",
                "org.opencontainers.image.vendor" to "kgd",
                "org.opencontainers.image.title" to serviceImageName
            )
        )
    }
}
```

이 convention 이 모든 Spring Boot 앱 모듈에 자동 적용 (root `build.gradle.kts` 의 `pluginManager.withPlugin("org.springframework.boot")` 블록).

---

## 2. 옵션별 분해

### `-XX:+UseContainerSupport`

- **JDK 10+** 부터 cgroup memory limit 인식
- **JDK 17+ 기본 활성**, 명시는 의도 명확화 / 폴백 안전
- 컨테이너 바깥에선 무시됨 → 비용 0

### `-XX:MaxRAMPercentage=75.0`

- 컨테이너 limit 의 **75% 를 힙 최대(`Xmx`) 로 자동 산정**
- 1Gi limit → ~768MB heap
- **Min/Initial/Max 모두 컨테이너 비례** 설정 가능:
  - `-XX:InitialRAMPercentage` (default=0 = 자동)
  - `-XX:MinRAMPercentage` (default=50% — 메모리 256MB 미만일 때만 적용)
  - `-XX:MaxRAMPercentage` (default=25% → msa 는 75% override)

### `-Djava.security.egd=file:/dev/./urandom`

- SecureRandom 의 entropy 소스를 `/dev/urandom` 으로 강제 (default 는 `/dev/random` — 컨테이너에서 entropy 부족으로 block 가능)
- `./` 는 옛 JDK 의 버그 워크라운드 (caching 회피). JDK 21+ 에서는 `/dev/urandom` 만 으로도 OK
- 부팅 시간 단축 효과

### `eclipse-temurin:25-jre-alpine`

- Alpine 기반 JRE only (~70MB)
- musl libc 사용 — glibc 대비 약간 다른 동작 (대부분 무시 가능)
- 일부 native 라이브러리 호환성 문제 가능 (JNA, native compression)
- 대안: `eclipse-temurin:25-jre` (Debian, glibc, ~200MB) — 호환성 보수적이라면

### `user = "1000:1000"`

- 컨테이너 안 비root 사용자
- K8s 의 `runAsNonRoot` 와 정합
- 보안 권장

---

## 3. 부족한 옵션 (운영 권장 보강)

### 3.1 GC 로그 (중요)

**부재**: 장애 시 GC 패턴 forensic 불가능.

```kotlin
"-Xlog:gc*,gc+heap=info,gc+age=info,safepoint=warning:file=/var/log/jvm/gc.log:time,uptime,level,tags:filecount=5,filesize=10M"
```

대안 (stdout 로):
```kotlin
"-Xlog:gc*::time,uptime,level,tags"
```

stdout 으로 보내면 K8s 의 컨테이너 로그 수집기 (Loki / Fluentd) 가 자동 처리.

### 3.2 자동 Heap Dump (중요)

**부재**: OOM 시 사후 분석 불가능.

```kotlin
"-XX:+HeapDumpOnOutOfMemoryError",
"-XX:HeapDumpPath=/var/log/jvm/heapdump-%t.hprof",
"-XX:+ExitOnOutOfMemoryError",   // 또는 +CrashOnOutOfMemoryError
```

`+ExitOnOutOfMemoryError` 의 효과: OOM 시 즉시 exit → K8s liveness probe 실패 → 재시작. 좀비 상태 회피.

### 3.3 Metaspace 한도 (안전)

**부재**: Metaspace 무한 증가 → OOMKilled 가능.

```kotlin
"-XX:MaxMetaspaceSize=256m",
```

Spring Boot 일반 서비스: 100~150MB 보통, 동적 클래스 사용 시 200MB 이상. 256MB 권장.

### 3.4 Code Cache 한도 (안전)

**부재**: default 240MB 가 1Gi limit 에선 과다.

```kotlin
"-XX:ReservedCodeCacheSize=128m",
```

작은 서비스(gateway 같이 라우팅 위주) 는 64MB 도 충분.

### 3.5 Direct Memory 한도 (안전)

**부재**: default = `Xmx` → 768MB 까지 잡을 수 있음. Netty 사용 서비스에서 폭주 가능.

```kotlin
"-XX:MaxDirectMemorySize=64m",
```

Spring WebMVC (Tomcat) 만 쓰면 작아도 OK. WebFlux (Reactor Netty) / Kafka 사용 서비스는 128MB 정도.

### 3.6 NMT (진단)

**부재**: native 메모리 누수 진단 어려움.

```kotlin
"-XX:NativeMemoryTracking=summary",
```

오버헤드 ~5%. 운영에서 켜두면 OOMKilled 발생 시 영역 분해 가능.

### 3.7 GC 명시 (의도)

**부재**: G1 이 default 라 동작은 같지만 의도 불명.

```kotlin
"-XX:+UseG1GC",
"-XX:MaxGCPauseMillis=200",   // default 명시
```

ZGC 검토하는 서비스 (quant) 는 `-XX:+UseZGC` 로 override.

---

## 4. 개선된 convention 안

### 안 1 — 보수적 (모든 서비스 동일)

```kotlin
container {
    mainClass = resolvedMainClass
    jvmFlags = listOf(
        // 기존
        "-XX:+UseContainerSupport",
        "-XX:MaxRAMPercentage=70.0",                   // 75 → 70 (native 여유)
        "-Djava.security.egd=file:/dev/./urandom",

        // GC 명시
        "-XX:+UseG1GC",
        "-XX:MaxGCPauseMillis=200",

        // GC 로그 (stdout)
        "-Xlog:gc*::time,uptime,level,tags",

        // 자동 dump
        "-XX:+HeapDumpOnOutOfMemoryError",
        "-XX:HeapDumpPath=/var/log/jvm/heapdump-%t.hprof",
        "-XX:+ExitOnOutOfMemoryError",

        // 영역 한도
        "-XX:MaxMetaspaceSize=256m",
        "-XX:ReservedCodeCacheSize=128m",
        "-XX:MaxDirectMemorySize=64m",

        // 진단
        "-XX:NativeMemoryTracking=summary",
    )
}
```

### 안 2 — 서비스별 override 패턴

```kotlin
// commerce.jib-convention 의 base flags
val baseJvmFlags = listOf(
    "-XX:+UseContainerSupport",
    "-XX:MaxRAMPercentage=70.0",
    "-Djava.security.egd=file:/dev/./urandom",
    "-Xlog:gc*::time,uptime,level,tags",
    "-XX:+HeapDumpOnOutOfMemoryError",
    "-XX:HeapDumpPath=/var/log/jvm/heapdump-%t.hprof",
    "-XX:+ExitOnOutOfMemoryError",
    "-XX:MaxMetaspaceSize=256m",
    "-XX:ReservedCodeCacheSize=128m",
    "-XX:NativeMemoryTracking=summary",
)

// 서비스별 추가 flags 매핑
val perServiceFlags: Map<String, List<String>> = mapOf(
    "gateway" to listOf("-XX:+UseG1GC", "-XX:ReservedCodeCacheSize=64m"),
    "quant" to listOf("-XX:+UseZGC", "-XX:+UseLargePages"),
    "analytics" to listOf("-XX:+UseG1GC", "-XX:MaxDirectMemorySize=128m"),
    // 미정 서비스는 default G1
)

container {
    jvmFlags = baseJvmFlags + (perServiceFlags[serviceImageName] ?: listOf("-XX:+UseG1GC"))
}
```

### 안 3 — env 기반 동적 (가장 유연)

base flags 만 박고, K8s env 의 `JAVA_TOOL_OPTIONS` 로 추가 옵션 주입. 환경별 / 운영 트러블슈팅 시 빌드 재실행 없이 변경 가능.

```yaml
# k8s/base/quant/deployment.yaml
env:
  - name: JAVA_TOOL_OPTIONS
    value: "-XX:+UseZGC -XX:+UseLargePages"
```

---

## 5. 검증 방법

### 빌드된 이미지의 옵션 확인

```bash
./gradlew :product:app:jibBuildTar
# build/jib-image.tar 에 entrypoint 가 박혀있음

docker load -i product/app/build/jib-image.tar
docker inspect commerce/product:latest | jq '.[0].Config.Entrypoint'
```

### 런타임에서 실제 적용된 옵션

```bash
kubectl exec -n commerce product-xxx -- jcmd 1 VM.flags
```

`-XX:MaxHeapSize=750000000` 등 실제 값 확인.

### 메모리 예산 검증

```bash
kubectl exec -n commerce product-xxx -- jcmd 1 VM.native_memory summary
```

각 영역 합이 limit 대비 적절한지.

---

## 6. 마이그레이션 전략

### 단계 1 — Lab 환경 검증

위 안을 lab overlay 에서 적용 → 부하 → 메모리 증감 / GC 로그 확인.

### 단계 2 — 한 서비스 점진 적용

`product` 같은 변동성 작은 서비스부터 운영 1주일 모니터링.

### 단계 3 — convention 으로 전체 적용

PR 로 `commerce.jib-convention.gradle.kts` 수정 → 다음 배포부터 모든 서비스에 자동 반영.

### 단계 4 — ADR 작성

`docs/adr/ADR-0028-jvm-tuning-convention.md` (가칭) — 21번 파일에서 초안.

---

## 7. 주의사항

### 7.1 Alpine 의 musl libc 와 NMT

NMT detail 모드는 stack trace 를 잡는데 Alpine musl 에서 일부 버그 보고. summary 모드는 안전.

### 7.2 GC 로그 stdout vs file

| 방식 | 장점 | 단점 |
|---|---|---|
| stdout | K8s 표준 로그 수집기로 수집 | 회전 직접 못 함 (kubelet 이 회전) |
| file (PVC) | 정밀 회전, 영구 보관 | 마운트 추가, 권한 |
| file (emptyDir) | 컨테이너 lifecycle 종속 | pod 재시작 시 사라짐 |

운영은 stdout + Loki 권장. 장애 진단용 임시 dump 는 emptyDir 로 충분.

### 7.3 Heap dump 경로의 권한

`-XX:HeapDumpPath=/var/log/jvm/` 디렉토리는 **user 1000 이 쓸 수 있어야** 한다. emptyDir 는 root 소유라 fsGroup 설정 필요:

```yaml
spec:
  template:
    spec:
      securityContext:
        fsGroup: 1000
```

### 7.4 ExitOnOutOfMemoryError vs CrashOnOutOfMemoryError

| 옵션 | 효과 |
|---|---|
| `+ExitOnOutOfMemoryError` | exit code 1 — 깔끔 |
| `+CrashOnOutOfMemoryError` | SIGABRT + core dump — 디버깅 자료 더 풍부 |

운영은 ExitOnOutOfMemoryError 권장 (디스크 부담 적음). 트러블슈팅 시 한 노드만 CrashOn 으로 임시 변경.

---

## 8. msa 의 비-JVM 서비스

- **charting**: Python/FastAPI — JVM 옵션 무관
- **agent-viewer-fe / admin-fe / charting-fe / code-dictionary-fe / search-fe / quant-fe / gifticon-fe**: Node.js / Vite — JVM 무관

이들은 본 토픽 범위 외.

---

## 9. 자주 헷갈리는 포인트

| 오해 | 실제 |
|---|---|
| "Jib 옵션은 빌드 시점만" | jvmFlags 는 ENTRYPOINT 의 기본 args 로 박힘 — 런타임 적용 |
| "JAVA_TOOL_OPTIONS 가 jvmFlags 를 덮어씀" | 둘 다 합쳐짐. env 가 후순위라 같은 옵션 충돌 시 env 가 이김 |
| "MaxRAMPercentage 75% 가 안전" | 250MB 가 native 예산 → Metaspace + Thread + Code Cache 합치면 빠듯. 70% 권장 |
| "GC 로그는 운영 부담" | < 1% 오버헤드. 무조건 켜야 함 |
| "Alpine 은 항상 좋다" | musl libc 호환성 이슈 가끔. 일반 서비스는 OK, native 라이브러리 무거우면 jre (Debian) |

---

## 다음 학습

- [19-k8s-memory-vs-heap.md](19-k8s-memory-vs-heap.md) — limit ↔ heap 정확한 산정
- [20-observability-prometheus.md](20-observability-prometheus.md) — 옵션 변경 후 메트릭 확인
- [21-improvements.md](21-improvements.md) — ADR 초안
