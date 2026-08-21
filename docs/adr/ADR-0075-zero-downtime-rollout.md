<!-- source: k8s/overlays/oci-arm/patches/rolling-surge-first.yaml, k8s/overlays/oci-arm/patches/boot-db-retry.yaml, k8s/argocd/stuck-sync-watchdog.yaml -->

# ADR-0075: 무중단 롤아웃 — surge-first 전환

- **Status**: Accepted (2026-08-22)
- **관련**: ADR-0019(K8s 전환), ADR-0068(콜드스타트 워밍업), ADR-0073(배포 가드레일)

## 배경 — "짧은 순단 허용" 결정의 폐기

oci-arm 은 지금까지 전 Deployment 에 `maxSurge:0 / maxUnavailable:1` 을 걸어
**구 파드를 먼저 내리고 그 자리에 새 파드를 올렸다.** 당시 근거는 "단일 노드(4 OCPU)라
서지 여유가 없어 새 파드가 Pending 으로 굳는다"였고, 대가로 배포마다 JVM 부팅 시간만큼
순단(503)을 허용했다.

2026-08-21 8-서비스 동시 범프에서 이 대가가 커졌다: 웨이브 중 MySQL 이 순간적으로
응답을 못 주자 Flyway fail-fast 로 컨테이너가 **종료**됐고(commerce 2회·code-dictionary
3회), 크래시 백오프(10s→20s→40s…)가 겹쳐 순단이 수 분으로 늘었다. 구 파드는 이미
죽어 있어 사용자는 그 시간 내내 503 을 봤다.

## 결정

1. **`maxSurge:1 / maxUnavailable:0`** (`patches/rolling-surge-first.yaml`, 전 Deployment)
   — 새 파드가 Ready 되기 전까지 구 파드를 내리지 않는다. 새 파드가 크래시루프에
   빠져도 사용자 트래픽은 구 파드가 계속 받는다.
2. **부팅 DB 재시도** (`patches/boot-db-retry.yaml`, JVM 계열 labelSelector)
   — `SPRING_FLYWAY_CONNECT_RETRIES=24 / _INTERVAL=5` (최대 2분 대기).
   fail-fast 종료→백오프 대신 그 자리에서 기다렸다 이어간다. startupProbe 예산(5분) 내.
3. **워치독 임계 1200s→1800s** (`k8s/argocd/stuck-sync-watchdog.yaml`)
   — surge-first 는 웨이브마다 Ready 대기가 겹쳐 전 서비스 범프의 정상 동기화가
   길어진다. 30분은 느린 정상 케이스를 오살하지 않으면서 진짜 정지는 자른다.
   **워치독은 Argo 가 배포하지 않는다** — 반영은 `k8s/argocd/install.sh` 재실행(또는
   해당 yaml 직접 apply).

## 왜 지금은 서지가 안전한가 (과거 결정이 틀렸던 게 아니라 전제가 바뀌었다)

서지 불가 판정 이후 세 겹의 방어가 추가됐다:

| 방어 | 효과 |
|---|---|
| sync-wave (웨이브당 JVM 2개) | 동시 기동 수가 변경 규모와 무관하게 상수로 묶임 |
| cpu-cap (파드당 1코어) | 콜드스타트 JIT/GC 폭주가 노드를 점유하지 못함 |
| startupProbe (5분 예산) | 부팅 중 liveness 오살 방지 |

이 상태에서 서지 파드는 **웨이브당 최대 2개**만 뜬다. 2026-08-22 실측: CPU 요청 여유
1670m vs 서지 2파드 요청 ~400m, 메모리 여유 ~13Gi vs 최대 오버랩 ~3.5Gi(limits 기준)
— 스케줄 실패 여지가 없다. 과거의 "Pending 으로 굳는다"는 웨이브·캡이 없어 20개가
동시에 서지하던 시절의 관측이다.

## 전제 (깨면 이 ADR 도 깨진다)

- **마이그레이션은 가산적(additive-only)**: surge 동안 구 파드(구 스키마 코드)와 새
  파드(신 스키마)가 같은 DB 를 본다. 컬럼 삭제/개명은 2단계(추가·병행→후속 제거)로.
  지금까지의 컨벤션(flyway-immutable, 파생 컬럼)과 동일 — 새 제약이 아니라 명문화다.
- **Kafka 컨슈머는 멱등**(ADR-0012/0029): surge 오버랩 중 리밸런스로 중복 소비 가능.
- Deployment 는 전부 무상태다. 상태가 있는 것(MySQL/Kafka/OpenSearch/Redis)은
  StatefulSet 이라 이 패치의 대상이 아니다. **RWO PVC 를 마운트하는 Deployment 를
  새로 만들면 surge 가 데드락된다** — 그 경우 해당 Deployment 만 Recreate 로 제외한다.

## 검증 계획

이 변경 자체가 파드 템플릿을 바꿔 전 Deployment 를 롤아웃시킨다 — 그 롤아웃을
외부 curl 루프(1s 간격, 전 호스트)로 관측해 503 0건을 확인한다.
