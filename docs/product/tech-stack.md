# Tech Stack

## Language & Framework
- Kotlin 2.2.21
- Spring Boot 4.0.4
- Spring Cloud 2025.1.0 (Eureka, Gateway, Resilience4j, LoadBalancer)

## Build Tool
- Gradle (Kotlin DSL)
- Java 25 LTS toolchain (JVM target 24)
- Version Catalog: `gradle/libs.versions.toml`

## Test Framework
- Kotest 5.9.1 (BehaviorSpec - BDD style)
- MockK 1.13.16
- Kotest Extensions Spring 1.3.0
- H2 (in-memory test DB)

## Module Structure
Multi-module MSA with nested submodules:
- `common` — shared utilities (jar only, no bootJar)
- `discovery` — Eureka server
- `gateway` — Spring Cloud Gateway
- `product:domain` / `product:app` — Product service
- `order:domain` / `order:app` — Order service
- `search:domain` / `search:app` / `search:consumer` / `search:batch` — Search service

## Infrastructure
- MySQL 8.0.33 (per-service DB ownership)
- Redis (cluster-scalable design)
- Kafka (event-driven communication)
- Elasticsearch (search indexing)
- QueryDSL 5.1.0 (complex queries)
- Docker Compose (local dev)

## Build Commands
```bash
./gradlew build                        # full build
./gradlew :{service}:{module}:build    # single module
./gradlew :{service}:domain:test       # domain unit tests
./gradlew :{service}:app:bootJar       # executable JAR
```

## Test Commands
```bash
./gradlew test                         # all tests
./gradlew :{service}:{module}:test     # single module tests
```
