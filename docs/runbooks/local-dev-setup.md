# Local Development Setup

## Prerequisites

- JDK 25 (toolchain 자동 관리)
- Docker / Docker Compose
- Kotlin 2.2.21 (Gradle이 자동 다운로드)
- Python 3.11 (charting 서비스 전용)
- Node.js 18+ (charting frontend 전용)

## 1. Infrastructure 기동

```bash
docker compose -f docker/docker-compose.infra.yml up -d
```

기동되는 인프라:
- MySQL (product_db master/replica, order_db master/replica)
- Redis Cluster (6 nodes: 3 masters + 3 replicas)
- Kafka + Zookeeper
- Elasticsearch
- PostgreSQL + pgvector (charting 전용, port 5433)

## 2. Service Discovery 기동

```bash
./gradlew :discovery:bootRun
```

Eureka Dashboard: http://localhost:8761

## 3. 서비스 개별 기동

```bash
# 각 서비스는 Eureka + 해당 DB만 있으면 독립 실행 가능
./gradlew :gateway:bootRun
./gradlew :product:app:bootRun
./gradlew :order:app:bootRun
./gradlew :search:app:bootRun
./gradlew :search:consumer:bootRun
./gradlew :search:batch:bootRun
```

## 4. Port Map

| Service | Port |
|---------|------|
| Gateway | 8080 |
| Discovery (Eureka) | 8761 |
| Product | 8081 |
| Order | 8082 |
| Search App | 8083 |
| Search Consumer | 8084 |
| Search Batch | 8085 |
| Charting Backend | (FastAPI) |
| Charting Frontend | 3010 |

## 5. Build Commands

```bash
./gradlew build                       # 전체 빌드
./gradlew :product:app:build          # 단일 서비스
./gradlew :product:domain:test        # 도메인 테스트만
./gradlew :product:app:bootJar        # bootJar 생성
```

## 6. Environment Variables

- `.env` 파일 위치: `docker/.env` (git ignore 대상)
- 예시 파일: `docker/.env.example`
- Docker 프로파일: `SPRING_PROFILES_ACTIVE=docker`

## 7. Charting Service (별도 스택)

```bash
cd charting
pip install -e ".[dev]"
# 또는 Docker로 기동
docker compose -f infra/docker-compose.yml up -d
```
