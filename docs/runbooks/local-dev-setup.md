# Local Development Setup

로컬에서 Commerce Platform을 개발할 때 쓰는 두 가지 경로. 목적에 따라
선택한다.

| 경로 | 언제 쓰나 | 인프라 | 부담 |
|------|-----------|--------|------|
| **Bare-metal** (Gradle `bootRun`) | 단일 서비스 집중 개발, TDD, 디버깅 | `docker run` 개별 기동 혹은 k3d 인프라만 공유 | 가볍다 |
| **k3d (k3s-lite)** | 전체 통합 플로우 검증, 라우팅/인그레스 확인 | k8s/infra/local 전부 | 무겁다 (~8 GiB) |

두 경로 모두 **레거시 `docker compose` 플로우는 지원하지 않는다**.
docker-compose 기반 과거 상태가 필요하면
[`docker-infra.md`](docker-infra.md) 참조.

---

## 0. 공통 전제

| 도구 | 버전 | 메모 |
|------|------|------|
| JDK | 25 (toolchain 자동) | Gradle이 다운로드 |
| Kotlin | 2.2.21 (Gradle 관리) | — |
| Docker Desktop / Colima / Rancher Desktop | 최신 | k3d 및 로컬 이미지 런타임용 |
| `kubectl` | 1.29+ | `brew install kubectl` |
| `helm` | 3.x | `brew install helm` (k3d 경로에서만 필요) |
| `k3d` | 5.x | `brew install k3d` (k3d 경로에서만 필요) |
| Python 3.11 | — | charting 서비스 전용 (별도) |
| Node.js 18+ | — | frontend 서비스 전용 (별도) |

---

## 1. Bare-metal 경로 — 단일 서비스 집중

특정 서비스를 IDE에서 돌리면서 디버깅하거나 TDD 루프를 돌릴 때 권장.
클러스터 전체를 띄울 필요는 없다.

### 1.1 인프라만 k3d로 띄우기 (권장)

과거엔 `docker compose -f docker/docker-compose.infra.yml up -d`로 했지만
지금은 k3d 클러스터에 `k8s/infra/local/`만 apply하고, 앱은 로컬 JVM으로 실행
한다.

```bash
# 클러스터 + ingress-nginx (한 번만)
k3d cluster create commerce-infra \
    --k3s-arg "--disable=traefik@server:*" \
    -p "3306:30006@loadbalancer" \
    -p "6379:30379@loadbalancer" \
    -p "9092:30092@loadbalancer" \
    -p "9200:30200@loadbalancer"

# 인프라만 apply (앱은 건드리지 않음)
kubectl apply -k k8s/infra/local
```

또는 k3d 대신 직접 `docker run`으로 단일 MySQL/Kafka/Redis만 띄워도 된다
(이건 개인 선호).

### 1.2 서비스 개별 기동

Eureka는 Phase 1b에서 제거됐으므로 discovery 서버 없이 바로 Spring Boot 앱을
실행한다.

```bash
# Spring profile 기본값으로 충분 (localhost:3316 등 base application.yml 값 사용)
./gradlew :gateway:bootRun
./gradlew :product:app:bootRun
./gradlew :order:app:bootRun
./gradlew :search:app:bootRun
./gradlew :search:consumer:bootRun
./gradlew :search:batch:bootRun
```

k3d 위의 인프라를 쓰는 경우 각 서비스의 `application.yml` 기본 hostname
(`localhost:3316` 등)을 k3d에 노출한 포트로 맞춰줘야 한다. 단순한 경우는
`localhost:3306` 하나로 통합하고 base yml을 임시 수정.

**대안**: 모든 Spring Boot 앱을 `kubernetes` 프로파일로 실행하고 DNS
hostname(`mysql-product-master` 등)을 `/etc/hosts`에 추가해 k3d LoadBalancer IP
로 resolving하는 방법도 있지만 번거로움 대비 이득이 크지 않아 권장하지 않는다.

### 1.3 개별 도메인 테스트 (인프라 불필요)

```bash
./gradlew :product:domain:test   # Spring context 없음, 가장 빠름
./gradlew :order:domain:test
```

---

## 2. k3d 경로 — 전체 스택 통합

Gateway → product → order 라우팅이나 Kafka 이벤트 플로우, Ingress TLS 같은
end-to-end 흐름을 재현하고 싶을 때.

전체 절차는 [`README.md`](README.md) §1 또는 [`k8s-deployment.md`](k8s-deployment.md) §1 참조. 요약:

```bash
# 0. 한 번만: 클러스터 + ingress
k3d cluster create commerce --k3s-arg "--disable=traefik@server:*" \
    -p "80:80@loadbalancer" -p "443:443@loadbalancer" --agents 0
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
    --namespace ingress-nginx --create-namespace \
    --set controller.ingressClassResource.default=true \
    --set controller.admissionWebhooks.enabled=false

# 1. 코드 수정 후
./gradlew jibBuildTar
scripts/image-import.sh --all
kubectl apply -k k8s/overlays/k3s-lite
kubectl -n commerce wait --for=condition=Ready pods \
    -l app.kubernetes.io/part-of=commerce-platform --timeout=600s

# 2. 엔드포인트 스모크
curl http://localhost/actuator/health/liveness
```

---

## 3. Port Map (로컬 기준)

### 3.1 Spring Boot 앱 (base `application.yml` 기준)

| Service | Port |
|---------|------|
| Gateway | 8080 |
| Product | 8081 |
| Order | 8082 |
| Search App | 8083 |
| Search Consumer | 8084 |
| Inventory | 8085 |
| Gifticon / Chatbot | 8086 |
| Auth | 8087 |
| Fulfillment | 8088 |
| Code Dictionary | 8089 |
| Warehouse / Analytics / Agent Viewer API | 8090 |
| Experiment | 8091 |
| Search Batch | 8092 |
| Member | 8093 |
| Wishlist | 8095 |

가용 시 Gateway(8080) 하나만 외부 노출하고 나머지는 내부 통신용.

### 3.2 k3d 경로 외부 노출

k3s-lite overlay는 기본적으로 gateway Ingress만 외부 노출한다. 클러스터 생성
시 `-p 80:80@loadbalancer`로 호스트 포트를 매핑했다면:

```
http://localhost/          ← gateway Ingress → gateway → downstream
```

인프라(MySQL, Redis, Kafka 등)에 로컬에서 직접 접근하려면 `kubectl port-forward`:

```bash
kubectl -n commerce port-forward svc/mysql-product-master 3316:3306
kubectl -n commerce port-forward svc/kafka 29092:29092
kubectl -n commerce port-forward svc/redis 6379:6379
```

---

## 4. Build Commands

```bash
./gradlew build                       # 전체 빌드 (테스트 포함)
./gradlew :product:app:build          # 단일 서비스
./gradlew :product:domain:test        # 도메인 테스트만 (가장 빠름)
./gradlew :product:app:bootJar        # bootJar 생성
./gradlew jibBuildTar                 # Jib 이미지 tar 일괄 생성
./gradlew :gateway:jibBuildTar        # 단일 서비스 Jib tar
```

---

## 5. Profile 요약

| Profile | 용도 | hostname |
|---------|------|----------|
| (none, base application.yml) | bare-metal 로컬 | `localhost:*` |
| `docker` (deprecated) | docker-compose 시절의 서비스명 | `mysql-product-master` 등 — 레거시 호환용으로 파일만 남음 |
| `kubernetes` | K8s 배포 (k3s-lite, prod-k8s 둘 다) | K8s Service 이름 (`mysql-product-master`, `redis-1..6`, `kafka:29092` 등) |

K8s Deployment에 `SPRING_PROFILES_ACTIVE=kubernetes`가 환경 변수로 주입된다.
로컬 bare-metal에서는 아무 profile도 active로 주지 않는 것이 기본값.

---

## 6. Charting Service (별도 스택)

`charting/`은 Python/FastAPI로 작성된 별도 서비스이며 git submodule이다.
현 시점 K8s 마이그레이션에서는 JVM 서비스만 다뤘고 charting은 자체 인프라
compose를 유지한다.

```bash
cd charting
pip install -e ".[dev]"
# 또는 기존 compose 경로
docker compose -f infra/docker-compose.yml up -d
```

charting의 K8s 이전은 Phase 7 비 JVM 확장 작업으로 미뤄져 있다
([ADR-0019](../adr/ADR-0019-k8s-migration.md) §후속 작업).

---

## 7. 참고

- [runbooks/README.md](README.md) — 핵심 명령 요약
- [runbooks/k8s-deployment.md](k8s-deployment.md) — 전체 배포 가이드
- [architecture/k8s-deployment-model.md](../architecture/k8s-deployment-model.md) — 마이그레이션 결과 아키텍처
- [ADR-0019](../adr/ADR-0019-k8s-migration.md) — K8s 전환 결정 기록
