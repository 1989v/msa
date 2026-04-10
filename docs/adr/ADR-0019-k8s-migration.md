# ADR-0019: Kubernetes 전환 및 배포 모드 이원화

## Status

Accepted (2026-04-10)

Supersedes the Kubernetes-related notes in [ADR-0005](ADR-0005-service-discovery.md).

## Context

현재 본 플랫폼(`commerce-platform`)의 배포는 전적으로 Docker Compose 기반이다.

- `docker/docker-compose.yml` — 애플리케이션 서비스
- `docker/docker-compose.infra.yml` — MySQL · Kafka · Redis 등 로컬 인프라
- `docker/docker-compose.monitoring.yml` — Prometheus · Grafana
- `docker/docker-compose.nginx.yml` — 리버스 프록시
- `docker/backup/` — XtraBackup + binlog PITR 셸/Cron 기반 백업 스택

서비스 디스커버리는 Spring Cloud Netflix Eureka(`:discovery` 모듈, 포트 8761) + Spring
Cloud LoadBalancer(`lb://service-name`) 조합으로 운영된다. ADR-0005는 이미 "Kubernetes
전환 시 Eureka 제거 및 K8s DNS 기반 전환이 필요하며 별도 ADR을 작성해야 한다"고
예고했다.

Compose 기반 운영은 다음 한계를 가진다.

1. **스케일·가용성**: 롤링 업데이트, Pod 수준 헬스체크, 수평 확장, PDB(Pod Disruption
   Budget) 같은 원천적인 K8s 기능을 누릴 수 없다.
2. **디스커버리 이중화 리스크**: 앞으로 K8s로 이전하게 되면 Eureka와 K8s Service가 공존
   하면서 stale instance 문제가 발생할 수 있다.
3. **로컬과 운영 간 격차**: 개발자는 Compose로 기동하고 운영은 다른 스택을 쓰는 구조가
   되면 환경 격차가 커진다.
4. **경량 배포 환경 요구**: 에지/개발용 단일 노드 배포(k3s/k3d) 수요가 있으며, 이 경우
   Compose와 K8s를 동시에 유지할 이유가 약하다.

본 ADR은 전환 방향, 디스커버리 전략, 이미지 빌드 전략, 디렉토리 구조, 배포 모드 선택
방식을 확정한다.

### 사전 조사로 확인된 사실

- JVM 애플리케이션 모듈은 총 **19개** (`settings.gradle.kts:3-38`). `discovery` 제외 시
  18개가 이미지 빌드 대상이다.
- 서비스 간 내부 HTTP 호출은 `order` 서비스의 `WebClientConfig.kt:14-18` 한 지점뿐이다.
  이 코드는 이미 `${product.service.url:http://localhost:8081}` 형태로 **URL 주입** 방식
  을 쓰고 있으며 `@LoadBalanced`도, `lb://` 스킴도 사용하지 않는다.
- 즉 애플리케이션 레벨은 이미 DNS-ready이고, Eureka에 묶여 있는 유일한 지점은
  Gateway의 라우트 정의다:
  - `gateway/src/main/kotlin/com/kgd/gateway/config/GatewayRouteConfig.kt:37-134` — 11개
    `lb://` 라우트
  - `gateway/src/main/resources/application.yml:21-28` — 2개 `lb://` 라우트 (analytics,
    experiment)
- `docker/Dockerfile` 한 파일이 공용 JVM 이미지 빌드를 담당하며 Gradle 멀티모듈 빌드를
  수행하는 구조다.

## Decision

### 1. 서비스 디스커버리 — 전략 B: 순수 K8s Service DNS 채택

Spring Cloud Kubernetes LoadBalancer(전략 C)가 아닌 **순수 K8s DNS**로 전환한다.

- `:discovery` 모듈은 삭제한다.
- 모든 서비스에서 `spring-cloud-starter-netflix-eureka-client` 의존성과 `eureka.*` 설정
  블록, `@EnableDiscoveryClient` / `@EnableEurekaServer` 어노테이션을 제거한다.
- Gateway의 `lb://service-name` 13개(코드 11 + yml 2)를 `http://service-name:port`로
  치환한다. K8s Service 이름을 현재 Compose의 서비스 이름과 동일하게 맞춰 내부 hostname
  호환성을 확보한다.
- `order` 서비스는 이미 URL 주입 방식이므로 코드 변경이 없다. `application-kubernetes.yml`
  에 K8s Service 이름을 주입한다.
- Spring profile 이름은 Spring 관례를 따라 **`kubernetes`**로 통일한다(`k8s` 아님).
  기존 `application-docker.yml`과 병렬 존재하며, K8s에 배포되는 Pod는
  `SPRING_PROFILES_ACTIVE=kubernetes`로 기동한다.
- K8s `Service` 이름은 현재 Compose의 서비스 이름과 **동일하게 유지**한다
  (`mysql-product-master`, `kafka`, `redis-1` 등). 이렇게 두면 `application-docker.yml`
  과 `application-kubernetes.yml`의 hostname이 실질적으로 같아 비교 검토가 쉬워진다.
  향후 cloud-managed DB(RDS 등)를 도입하게 되면 overlay의 ConfigMap으로 덮어쓴다.
- Spring Cloud Kubernetes를 도입하지 않으므로 **Service/Endpoints 조회용 RBAC가
  불필요**하다.

### 2. 이미지 빌드 — Jib(JVM) + Dockerfile(비 JVM) 공존

"Docker 잔재 zero"를 **파일 삭제가 아닌 운영 의존성 제거**로 정의한다. 즉 빌드·배포
경로에서 dockerd 데몬과 docker-compose가 빠지는 것이 목표이며, 비 JVM 이미지에 필요한
Dockerfile은 의도적으로 유지한다.

- **JVM Spring Boot app 모듈**: Jib Gradle 플러그인으로 전환한다.
  - `buildSrc`에 `jib-convention.gradle.kts` 작성.
  - `subprojects { plugins.withId("org.springframework.boot") { apply } }` 패턴으로
    Spring Boot 플러그인이 적용된 app 모듈에만 한정한다. `:product:domain` 같은 순수
    도메인 모듈은 대상이 아니다.
  - 공통값(base image `eclipse-temurin:21-jre`, JVM 플래그, OCI labels)은 convention
    에 두고, 모듈별 차이(이미지 이름, 포트, env)만 각 `{service}/app/build.gradle.kts`
    에 둔다.
  - 로컬 클러스터 주입은 `./gradlew jibBuildTar` 산출물을 클러스터별 명령으로 분기한다:
    - k3d: `k3d image import <tar>`
    - kind: `kind load image-archive <tar>`
    - 순수 k3s: `/var/lib/rancher/k3s/agent/images/` 디렉토리에 tarball을 드롭
  - 위 분기 로직은 `scripts/image-import.sh`에 집약한다.
- **비 JVM 서비스**(`charting` Python/FastAPI, `charting/frontend`, 기타 frontend 앱):
  기존 Dockerfile을 유지한다. 본 ADR의 스코프 밖이며 후속 ADR/페이즈에서 처리한다.
- `docker/Dockerfile`은 Phase 6(docker-compose 제거) 단계에서도 **삭제하지 않는다**.
  비 JVM 서비스와 백업 스크립트 이미지 빌드 컨텍스트로 계속 쓰인다.

### 3. 구성 도구 — Kustomize 기반 base + overlays

Helm 차트보다 Kustomize를 선호한다. 이유는 (a) "base 매니페스트 재사용 + overlay로 환경
별 차이 주입"이라는 본 프로젝트 요구에 직접 부합하고, (b) 템플릿화 없이 순수 YAML로
diff/review가 쉽고, (c) `kubectl apply -k`로 별도 런타임 없이 적용 가능하기 때문이다.

디렉토리 구조는 다음과 같다.

```
k8s/
├── base/                       # 공통 리소스 (19개 JVM 서비스)
│   ├── gateway/
│   ├── product/
│   ├── order/
│   └── ...
├── overlays/
│   ├── prod-k8s/               # managed K8s (EKS/GKE/AKS)
│   └── k3s-lite/               # 단일 노드 k3s / k3d
├── infra/
│   ├── local/                  # 로컬 최소 세트 (plain StatefulSet 또는 Bitnami)
│   └── prod/                   # 운영 확장 세트 (Operator 기반)
└── bootstrap/                  # 설치 순서·전제 조건 문서
```

### 4. Ingress — ingress-nginx

클러스터 기본 Ingress Controller로 **ingress-nginx**(Kubernetes 공식)를 사용한다. k3s
기본 Traefik은 사용하지 않는다. k3s 기동 시 `--disable traefik` 또는 k3d 설정으로 비활성
화하고 ingress-nginx를 설치한다.

Gateway Deployment 앞단에 `Ingress` 리소스를 두고 `ingressClassName: nginx`를 지정한다.
TLS는 Phase 4에서 cert-manager로 발급한다.

### 5. 배포 모드 이원화 — prod-k8s / k3s-lite

두 overlay를 1급 시민으로 유지한다. 동일한 `k8s/base/`를 공유하며 overlay에서만 다음을
패치한다.

| 항목                     | prod-k8s                   | k3s-lite                      |
|--------------------------|----------------------------|-------------------------------|
| replicas                 | 2~3                        | 1                             |
| resources.requests/limits| 표준                       | 50% 축소                      |
| HPA                      | 활성                       | 비활성                        |
| PDB                      | `minAvailable: 1`          | 생성하지 않음                 |
| storageClassName         | `gp3`, `pd-ssd` 등         | `local-path`                  |
| ingressClassName         | `nginx`                    | `nginx` (Traefik 비활성 전제) |
| Kafka/MySQL/ES 노드 수   | 3 / HA / 3-master 2-data   | 1 / single / 1                |
| 인프라 스택              | Operator 기반 (Phase 4)    | plain StatefulSet (Phase 3a)  |

사용자는 `kubectl apply -k k8s/overlays/prod-k8s` 또는 `kubectl apply -k k8s/overlays/k3s-lite`
로 배포 모드를 선택한다.

### 6. 인프라 — 로컬 최소 세트와 운영 확장 세트의 분리

로컬(k3d/k3s-lite)과 운영(prod-k8s)에서 요구되는 안정성·스케일이 다르고, 특히 Operator
기반 스택은 단일 노드 k3d에서 리소스 부담이 크다. 따라서 두 인프라 묶음을 분리한다.

- `k8s/infra/local/`: ingress-nginx, MySQL/Redis/Kafka/Elasticsearch의 **plain
  StatefulSet 또는 Bitnami 스타일** 단일 인스턴스. Operator 미사용.
- `k8s/infra/prod/`: cert-manager, Sealed Secrets, Strimzi(Kafka), Percona Operator for
  MySQL, ECK(Elasticsearch), Altinity(ClickHouse), kube-prometheus-stack.

로컬 개발자는 `infra/local` + `overlays/k3s-lite` 조합만으로 end-to-end 통합 테스트가
가능하다.

### 7. 백업 — 기존 셸 스크립트의 CronJob 래핑

기존 `docker/backup/` 자산은 이미 운영 검증된 XtraBackup + binlog PITR 로직이다. 로직을
재작성하지 않고 다음 2단계로 이전한다.

1. **1차(Phase 5)**: 기존 셸 스크립트를 이미지로 빌드(Dockerfile 사용) → `CronJob` +
   PVC + Secret 마운트. `docker/backup/storage-providers/`는 그대로 재사용.
2. **2차(후속)**: 필요 시 Percona MySQL Operator의 `BackupSchedule` CR로 리팩터.

### 8. Compose 자산 백업

`main` 브랜치에서 `docker/docker-compose*.yml`과 Compose 전용 자산을 삭제하기 전에,
**현시점 스냅샷**을 별도 브랜치로 보존한다.

- 브랜치명: `backup/docker-compose-snapshot`
- 생성 시점 HEAD: `cdebf27` (2026-04-10, "docs: add monitoring to CLAUDE.md + clarify
  ExceptionHandler ResponseEntity exception")
- 용도: 장기 보관(삭제 금지), 필요 시 cherry-pick 참조.

## Alternatives Considered

### A-1. Spring Cloud Kubernetes LoadBalancer (전략 C)

`lb://service-name` 스킴을 유지하면서 뒤단 리졸빙만 K8s API로 바꾸는 방식. Gateway 코드
변경이 없다는 장점이 있었으나, 실제 코드를 조사한 결과 Gateway는 이미 `http://service:port`
로 치환 가능한 지점이 13곳으로 한정되며, 그 외 내부 HTTP 호출이 이미 URL 주입 방식이라
Spring Cloud Kubernetes의 이득이 사실상 없다. 반대로 다음 비용이 발생한다.

- 의존성 1개 추가(`spring-cloud-starter-kubernetes-client-loadbalancer`)
- 각 서비스에 Role/RoleBinding/ServiceAccount RBAC 설정 필요
- Spring Cloud Kubernetes와 Spring Cloud Gateway 간 버전 호환 관리 부담

→ 비용 > 이득. **기각**.

### A-2. Eureka를 K8s에 그대로 이식 (Lift & Shift)

Eureka Server를 Deployment로 띄우고 서비스 등록을 유지하는 방식. 코드 변경이 거의 없다
는 장점이 있으나, K8s Service와 Eureka가 동시에 디스커버리 역할을 하면서 stale
instance와 롤링 업데이트 중 503 리스크가 발생한다. Compose 백업 브랜치가 이미 롤백
경로를 제공하므로 lift & shift의 과도기적 가치가 크지 않다.

→ **기각**.

### A-3. 전면 Jib 적용 (비 JVM 포함)

charting(Python/FastAPI), frontend 앱을 모두 Jib 또는 Buildpacks로 처리하는 방식. Jib는
Java/Kotlin 전용이라 적용 불가이며, Buildpacks는 추가 도구 체인 학습 비용이 있다. 본
ADR 범위에서는 JVM만 Jib로 전환하고, 비 JVM은 기존 Dockerfile을 유지하는 점진 전략을
채택한다.

→ **부분 기각** (Buildpacks는 Phase 7 이후 재검토).

### A-4. Helm 차트 기반 구성

Helm values로 환경별 차이를 주입하는 방식. 템플릿화 유연성은 크지만, (a) 순수 YAML 대비
diff 리뷰가 어렵고, (b) values 파편화로 base 재사용 가치가 줄어들며, (c) 본 프로젝트는
이미 Gradle 멀티모듈 + 환경 분리 규칙이 정립되어 있어 Kustomize의 patch 모델이 더
자연스럽다.

→ **기각** (Operator 설치는 Helm 사용 가능, 앱 매니페스트는 Kustomize).

### A-5. Operator-first 로컬 인프라

k3d에도 Strimzi, Percona, ECK를 그대로 올리는 방식. 로컬과 운영의 일관성은 좋으나, 단일
노드 k3d에서 메모리 8GB 이상을 소비하고 디버깅 난도가 급격히 올라간다. 로컬에는 plain
StatefulSet, 운영에는 Operator로 **분리**한다.

→ **기각**.

### A-6. `build/Dockerfile` 재배치

"Docker 잔재 정리" 명분으로 `docker/Dockerfile`을 `build/`로 옮기자는 원안이 있었으나,
Gradle의 `build/`는 생성 산출물 디렉토리(`.gitignore` 대상)이므로 사람이 관리하는
Dockerfile 위치로 부적절하다. 현 위치(`docker/Dockerfile`)를 유지한다.

→ **기각**.

## Consequences

### 긍정적 영향

- Gateway 코드의 라우팅 문자열이 K8s Service 이름을 그대로 참조하므로 **읽기 쉬워진다**.
- Service/Endpoints RBAC 불필요 → **클러스터 권한 표면적 최소화**.
- Jib 도입으로 **데몬리스 빌드, 레이어 캐시 최적화, CI 재현성** 확보.
- base + overlays 구조로 **prod-k8s와 k3s-lite가 동일한 매니페스트를 공유**하므로 환경
  격차가 줄어든다.
- 로컬/운영 인프라 분리로 k3d에서 개발자가 **전체 스택을 띄울 수 있다**.
- `backup/docker-compose-snapshot` 브랜치로 **롤백 경로와 과거 자산 추적이 보존**된다.

### 부정적 영향 / 작업 비용

- 19개 JVM app 모듈의 `build.gradle.kts`, `application.yml`, `application-docker.yml`이
  수정된다. 테스트 회귀 가능성 존재 → Phase 1a와 1b의 분리로 완화.
- Gateway 라우트 13개의 정확한 치환이 필요하다. 오타 시 런타임 404 발생.
- Jib의 entrypoint는 shell 스크립트 우회가 어렵다. 현재 Dockerfile에서 쓰는 커스텀 시작
  스크립트가 있다면 convention에 `jvmFlags` 또는 `extraDirectories`로 흡수해야 한다.
- 로컬 이미지 주입 플로우(`jibBuildTar` → `k3d image import` 등)가 기존 `docker
  compose up`보다 단계 수가 많다. `scripts/image-import.sh`로 캡슐화 필요.
- 비 JVM 서비스(charting, frontend 앱)는 본 ADR 스코프 밖이라 과도기엔 두 가지 빌드
  방식이 공존한다. Phase 7에서 정리.
- `:discovery` 모듈 삭제 이후 되돌리려면 백업 브랜치 참조가 필요하다. 운영 장애 시
  즉시 Eureka를 재도입하는 루트는 제공하지 않는다.

### 후속 작업 (별도 ADR 또는 페이즈)

- `charting` Python/FastAPI의 컨테이너화 방식 확정 (Buildpacks vs 기존 Dockerfile).
- Frontend 앱(`agent-viewer/front`, `code-dictionary/frontend`, `gifticon/frontend`)의
  nginx 정적 서빙 Deployment 전환.
- GitOps 도구(ArgoCD 또는 Flux) 도입 여부.
- Secret 관리를 Sealed Secrets에서 External Secrets Operator(클라우드 KMS 연동)로
  업그레이드할 시점.
- `backup/docker-compose-snapshot` 브랜치의 장기 보존 정책(최소 12개월 권장).
