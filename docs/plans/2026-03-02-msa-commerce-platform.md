# MSA Commerce Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 실서비스 배포 가능 수준의 MSA 커머스 플랫폼 구축 (Gateway, Product, Order, Search, Common)

**Architecture:** Clean Architecture 기반 멀티모듈 Gradle 구조. 서비스 간 DB 완전 분리, Kafka 이벤트 기반 비동기 통신, Spring Cloud Gateway + Eureka 서비스 디스커버리.

**Tech Stack:** Java 25 LTS, Kotlin 2.2.21, Spring Boot 4.0.3, Spring Cloud 2025.1.0, MySQL 8.0 (Read/Write 분리), Redis Cluster 7.x (6노드), Elasticsearch 8.x, Kafka 3.x, Resilience4j, Kotest (BDD)

---

## 확정된 아키텍처 결정사항

- **Gateway**: Spring Cloud Gateway (WebFlux 허용 — Gateway 한정)
- **Service Discovery**: Spring Cloud Eureka
- **Auth**: JWT (HS256, Access 30m + Refresh 7d) + Redis Cluster (JWT 블랙리스트/세션)
- **Redis 로컬**: Redis Cluster 6노드 (3 masters + 3 replicas)
- **DB**: 서비스별 분리 MySQL (product, order 각 master+replica)

---

## 포트 설계

| 서비스 | 내부 포트 | 외부 포트 |
|--------|-----------|-----------|
| Gateway | 8080 | 8080 |
| Eureka (Discovery) | 8761 | 8761 |
| Product | 8081 | 8081 |
| Order | 8082 | 8082 |
| Search | 8083 | 8083 |
| MySQL Product Master | 3306 | 3316 |
| MySQL Product Replica | 3306 | 3317 |
| MySQL Order Master | 3306 | 3326 |
| MySQL Order Replica | 3306 | 3327 |
| Redis Cluster (6 nodes) | 6379-6384 | 6379-6384 |
| Elasticsearch | 9200, 9300 | 9200, 9300 |
| Kafka | 9092 | 9092 |
| Zookeeper | 2181 | 2181 |

---

## 멀티모듈 구조

```
msa/ (root project: commerce-platform)
├── settings.gradle.kts
├── build.gradle.kts
├── gradle/
│   └── libs.versions.toml
├── common/          # 공통 라이브러리 (JAR, no main)
├── discovery/       # Eureka Server
├── gateway/         # Spring Cloud Gateway
├── product/         # Product 서비스
├── order/           # Order 서비스
└── search/          # Search 서비스 (기존 재구성)
```

---

## Task 1: ADR 작성

**Files:**
- Create: `docs/adr/ADR-0001-multi-module-gradle.md`
- Create: `docs/adr/ADR-0002-language-framework.md`
- Create: `docs/adr/ADR-0003-service-communication.md`
- Create: `docs/adr/ADR-0004-authentication.md`
- Create: `docs/adr/ADR-0005-service-discovery.md`
- Create: `docs/adr/ADR-0006-database-strategy.md`
- Create: `docs/adr/ADR-0007-cache-strategy.md`
- Create: `docs/adr/ADR-0008-search-strategy.md`

**Step 1: ADR-0001 멀티모듈 Gradle 구조**

```markdown
# ADR-0001: 멀티모듈 Gradle 프로젝트 구조

## Status
Accepted

## Context
5개 독립 서비스(common, discovery, gateway, product, order, search)를 하나의 레포지토리에서 관리.
서비스 간 공통 라이브러리(common) 공유 필요. 독립 빌드/배포 지원 필요.

## Decision
Gradle 멀티모듈 + Version Catalog(libs.versions.toml) 적용.
root build.gradle.kts는 공통 플러그인/의존성만 선언.
각 서비스 모듈은 독립적으로 bootJar 생성.
common 모듈은 jar만 생성(bootJar 비활성화).

## Alternatives Considered
- 별도 레포(폴리레포): 서비스 간 공통 라이브러리 관리 복잡
- Maven 멀티모듈: Gradle 대비 빌드 성능 저하

## Consequences
- 단일 Gradle 빌드 캐시 공유로 빌드 속도 향상
- common 모듈 변경 시 모든 서비스 재빌드 필요
- libs.versions.toml로 의존성 버전 중앙 관리
```

**Step 2: ADR-0002 언어 및 프레임워크**

```markdown
# ADR-0002: 언어 및 프레임워크 선택

## Status
Accepted

## Context
JVM 기반 MSA 서비스 개발. 생산성, 타입 안정성, Spring 생태계 통합 필요.

## Decision
- Java 25 LTS (JVM 런타임)
- Kotlin 2.2.21 (주 개발 언어)
- Spring Boot 4.0.3
- Spring Cloud 2025.1.0
- WebFlux 전면 도입 금지 (Gateway 제외)
- 코루틴은 외부 IO에만 사용

## Alternatives Considered
- Java only: Kotlin 대비 보일러플레이트 증가
- Spring Boot 3.x: Java 25 LTS 최적 지원 부족

## Consequences
- Spring Boot 4.0 = Spring Framework 7.x 기반
- all-open 플러그인 필수 (Kotlin final class 문제)
- JPA Entity는 kotlin-jpa 플러그인 필수
```

**Step 3: ADR-0003 ~ ADR-0008 순서대로 생성** (ADR-0003: Kafka+WebClient 통신, ADR-0004: JWT+Redis 인증, ADR-0005: Eureka 디스커버리, ADR-0006: MySQL R/W 분리, ADR-0007: Redis Cluster 캐시/락/세션, ADR-0008: Elasticsearch 검색 전략)

**Step 4: Commit**
```bash
git add docs/adr/
git commit -m "docs: add ADR-0001 through ADR-0008 for MSA commerce platform"
```

---

## Task 2: CLAUDE.md 업데이트

**Files:**
- Modify: `CLAUDE.md`

**Step 1: 상세 규칙 추가**

기존 CLAUDE.md에 아래 섹션 추가:

```markdown
## 6. Module & Build Rules
- common 모듈은 bootJar 없이 jar만 생성
- 서비스 모듈은 common을 implementation 의존
- libs.versions.toml에서 버전 중앙 관리
- Java 25 toolchain 통일

## 7. Package Naming Convention
- Base package: com.kgd.{service}
- Domain: com.kgd.{service}.domain.{entity}.{model|policy|event|exception}
- Application: com.kgd.{service}.application.{entity}.{usecase|service|port|dto}
- Infrastructure: com.kgd.{service}.infrastructure.{persistence|client|messaging|config}
- Presentation: com.kgd.{service}.presentation.{entity}.{controller|dto}

## 8. Test Rules
- 테스트 프레임워크: Kotest BehaviorSpec (BDD)
- Domain: Mock 금지, 순수 단위 테스트
- Application: Port는 MockK로 Mock
- 테스트 더블: MockK 사용 (Mockito 금지)

## 9. Kafka Topic Convention
- 형식: {domain}.{entity}.{event}
- 예: product.item.created, order.order.placed

## 10. API Response Format
- 모든 응답은 ApiResponse<T> 래핑
- 성공: {"success": true, "data": {...}}
- 실패: {"success": false, "error": {"code": "...", "message": "..."}}
```

**Step 2: Commit**
```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with detailed conventions"
```

---

## Task 3: 멀티모듈 Gradle 구조 설정

**Files:**
- Create: `settings.gradle.kts`
- Create: `build.gradle.kts`
- Create: `gradle/libs.versions.toml`
- Create: `common/build.gradle.kts`
- Create: `discovery/build.gradle.kts`
- Create: `gateway/build.gradle.kts`
- Create: `product/build.gradle.kts`
- Create: `order/build.gradle.kts`
- Modify: `search/build.gradle.kts`
- Create: 각 서비스 `src/main/kotlin/.../Application.kt` (빈 껍데기)
- Create: 각 서비스 `src/main/resources/application.yml`

**Step 1: settings.gradle.kts 생성**

```kotlin
rootProject.name = "commerce-platform"

include(
    "common",
    "discovery",
    "gateway",
    "product",
    "order",
    "search"
)
```

**Step 2: gradle/libs.versions.toml 생성**

```toml
[versions]
kotlin = "2.2.21"
springBoot = "4.0.3"
springCloud = "2025.1.0"
springDependencyManagement = "1.1.7"
querydsl = "6.10.1"
kotest = "5.9.1"
kotestSpring = "1.3.0"
mockk = "1.13.16"
resilience4j = "2.3.0"
jjwt = "0.12.6"
kafka = "3.9.0"
elasticsearch = "8.17.0"
mysql = "8.0.33"
redis = "3.4.1"

[libraries]
# Spring Boot
spring-boot-starter-web = { module = "org.springframework.boot:spring-boot-starter-web" }
spring-boot-starter-data-jpa = { module = "org.springframework.boot:spring-boot-starter-data-jpa" }
spring-boot-starter-data-redis = { module = "org.springframework.boot:spring-boot-starter-data-redis" }
spring-boot-starter-validation = { module = "org.springframework.boot:spring-boot-starter-validation" }
spring-boot-starter-actuator = { module = "org.springframework.boot:spring-boot-starter-actuator" }
spring-boot-starter-test = { module = "org.springframework.boot:spring-boot-starter-test" }

# Spring Cloud
spring-cloud-gateway = { module = "org.springframework.cloud:spring-cloud-starter-gateway" }
spring-cloud-eureka-server = { module = "org.springframework.cloud:spring-cloud-starter-netflix-eureka-server" }
spring-cloud-eureka-client = { module = "org.springframework.cloud:spring-cloud-starter-netflix-eureka-client" }
spring-cloud-loadbalancer = { module = "org.springframework.cloud:spring-cloud-starter-loadbalancer" }
spring-cloud-circuitbreaker-resilience4j = { module = "org.springframework.cloud:spring-cloud-starter-circuitbreaker-resilience4j" }
spring-cloud-circuitbreaker-reactor-resilience4j = { module = "org.springframework.cloud:spring-cloud-starter-circuitbreaker-reactor-resilience4j" }

# Kotlin
kotlin-reflect = { module = "org.jetbrains.kotlin:kotlin-reflect" }
kotlin-coroutines-core = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-core" }
kotlin-coroutines-reactor = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-reactor" }

# Kafka
spring-kafka = { module = "org.springframework.kafka:spring-kafka" }

# QueryDSL
querydsl-jpa = { module = "com.querydsl:querydsl-jpa", version.ref = "querydsl" }
querydsl-apt = { module = "com.querydsl:querydsl-apt", version.ref = "querydsl" }

# JWT
jjwt-api = { module = "io.jsonwebtoken:jjwt-api", version.ref = "jjwt" }
jjwt-impl = { module = "io.jsonwebtoken:jjwt-impl", version.ref = "jjwt" }
jjwt-jackson = { module = "io.jsonwebtoken:jjwt-jackson", version.ref = "jjwt" }

# DB
mysql-connector = { module = "com.mysql:mysql-connector-j", version.ref = "mysql" }

# Elasticsearch
spring-data-elasticsearch = { module = "org.springframework.data:spring-data-elasticsearch" }

# Test
kotest-runner-junit5 = { module = "io.kotest:kotest-runner-junit5", version.ref = "kotest" }
kotest-assertions-core = { module = "io.kotest:kotest-assertions-core", version.ref = "kotest" }
kotest-spring = { module = "io.kotest.extensions:kotest-extensions-spring", version.ref = "kotestSpring" }
mockk = { module = "io.mockk:mockk", version.ref = "mockk" }

[plugins]
kotlin-jvm = { id = "org.jetbrains.kotlin.jvm", version.ref = "kotlin" }
kotlin-spring = { id = "org.jetbrains.kotlin.plugin.spring", version.ref = "kotlin" }
kotlin-jpa = { id = "org.jetbrains.kotlin.plugin.jpa", version.ref = "kotlin" }
kotlin-kapt = { id = "org.jetbrains.kotlin.kapt", version.ref = "kotlin" }
spring-boot = { id = "org.springframework.boot", version.ref = "springBoot" }
spring-dependency-management = { id = "io.spring.dependency-management", version.ref = "springDependencyManagement" }
```

**Step 3: root build.gradle.kts 생성**

```kotlin
plugins {
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.spring) apply false
    alias(libs.plugins.kotlin.jpa) apply false
    alias(libs.plugins.spring.boot) apply false
    alias(libs.plugins.spring.dependency.management) apply false
}

subprojects {
    apply(plugin = "org.jetbrains.kotlin.jvm")
    apply(plugin = "io.spring.dependency-management")

    group = "com.kgd"
    version = "0.0.1-SNAPSHOT"

    java {
        toolchain {
            languageVersion = JavaLanguageVersion.of(25)
        }
    }

    repositories {
        mavenCentral()
    }

    the<io.spring.gradle.dependencymanagement.dsl.DependencyManagementExtension>().apply {
        imports {
            mavenBom("org.springframework.boot:spring-boot-dependencies:${libs.versions.springBoot.get()}")
            mavenBom("org.springframework.cloud:spring-cloud-dependencies:${libs.versions.springCloud.get()}")
        }
    }

    dependencies {
        implementation(rootProject.libs.kotlin.reflect)
        testImplementation(rootProject.libs.kotest.runner.junit5)
        testImplementation(rootProject.libs.kotest.assertions.core)
        testImplementation(rootProject.libs.mockk)
    }

    kotlin {
        compilerOptions {
            freeCompilerArgs.addAll("-Xjsr305=strict", "-Xannotation-default-target=param-property")
        }
    }

    tasks.withType<Test> {
        useJUnitPlatform()
    }
}
```

**Step 4: common/build.gradle.kts 생성**

```kotlin
plugins {
    alias(libs.plugins.kotlin.spring)
}

dependencies {
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.redis)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.jjwt.api)
    runtimeOnly(libs.jjwt.impl)
    runtimeOnly(libs.jjwt.jackson)
    implementation(libs.spring.cloud.circuitbreaker.resilience4j)
    implementation(libs.kotlin.coroutines.core)
    implementation(libs.spring.boot.starter.actuator)
}

// common은 실행 가능 JAR 아님
tasks.getByName<org.springframework.boot.gradle.tasks.bundling.BootJar>("bootJar") {
    enabled = false
}
tasks.getByName<Jar>("jar") {
    enabled = true
}
```

**Step 5: discovery/build.gradle.kts 생성**

```kotlin
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(libs.spring.cloud.eureka.server)
    implementation(libs.spring.boot.starter.actuator)
}
```

**Step 6: gateway/build.gradle.kts 생성**

```kotlin
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":common"))
    implementation(libs.spring.cloud.gateway)
    implementation(libs.spring.cloud.eureka.client)
    implementation(libs.spring.cloud.loadbalancer)
    implementation(libs.spring.cloud.circuitbreaker.reactor.resilience4j)
    implementation(libs.spring.boot.starter.data.redis)
    implementation(libs.kotlin.coroutines.reactor)
    testImplementation(libs.kotest.spring)
}
```

**Step 7: product/build.gradle.kts 생성**

```kotlin
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.data.redis)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.cloud.eureka.client)
    implementation(libs.spring.kafka)
    implementation(libs.querydsl.jpa)
    kapt(libs.querydsl.apt)
    runtimeOnly(libs.mysql.connector)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.spring)
}
```

**Step 8: order/build.gradle.kts** (product와 동일 구조)

**Step 9: search/build.gradle.kts 재구성**

```kotlin
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.data.elasticsearch)
    implementation(libs.spring.cloud.eureka.client)
    implementation(libs.spring.kafka)
    implementation(libs.kotlin.coroutines.core)
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.spring)
}
```

**Step 10: 각 서비스 Application.kt + application.yml 껍데기 생성**

각 서비스별 메인 클래스:
```kotlin
// discovery/src/main/kotlin/com/kgd/discovery/DiscoveryApplication.kt
@SpringBootApplication
@EnableEurekaServer
fun main(args: Array<String>) { runApplication<DiscoveryApplication>(*args) }

// gateway/src/main/kotlin/com/kgd/gateway/GatewayApplication.kt
@SpringBootApplication
fun main(args: Array<String>) { runApplication<GatewayApplication>(*args) }

// product/src/main/kotlin/com/kgd/product/ProductApplication.kt
@SpringBootApplication
@EnableEurekaClient
fun main(args: Array<String>) { runApplication<ProductApplication>(*args) }

// order, search: 동일 패턴
```

**Step 11: Commit**
```bash
git add settings.gradle.kts build.gradle.kts gradle/ common/build.gradle.kts \
    discovery/ gateway/build.gradle.kts product/build.gradle.kts \
    order/build.gradle.kts search/build.gradle.kts
git commit -m "build: setup multi-module Gradle structure with version catalog"
```

---

## Task 4: Docker 인프라 설계

**Files:**
- Create: `docker/docker-compose.yml`
- Create: `docker/docker-compose.infra.yml`
- Create: `docker/mysql/product-master/my.cnf`
- Create: `docker/mysql/product-replica/my.cnf`
- Create: `docker/mysql/order-master/my.cnf`
- Create: `docker/mysql/order-replica/my.cnf`
- Create: `docker/mysql/init/product-init.sql`
- Create: `docker/mysql/init/order-init.sql`
- Create: `docker/redis/redis-cluster.sh`
- Create: `docker/redis/node.conf` (템플릿)
- Create: `docker/elasticsearch/elasticsearch.yml`
- Create: `docker/kafka/server.properties`
- Create: `docker/.env`

**Step 1: docker/.env 생성**

```env
# MySQL
MYSQL_ROOT_PASSWORD=commerce_root_pw
MYSQL_PASSWORD=commerce_pw
MYSQL_USER=commerce

# Redis
REDIS_PASSWORD=redis_pw

# Kafka
KAFKA_BROKER_ID=1

# Service versions
MYSQL_VERSION=8.0
REDIS_VERSION=7.2
ELASTICSEARCH_VERSION=8.17.0
KAFKA_VERSION=3.9.0
```

**Step 2: docker/docker-compose.infra.yml 생성**

```yaml
version: '3.8'

networks:
  commerce-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  product-mysql-master-data:
  product-mysql-replica-data:
  order-mysql-master-data:
  order-mysql-replica-data:
  redis-cluster-1-data:
  redis-cluster-2-data:
  redis-cluster-3-data:
  redis-cluster-4-data:
  redis-cluster-5-data:
  redis-cluster-6-data:
  elasticsearch-data:
  kafka-data:
  zookeeper-data:

services:
  # ===== MySQL - Product =====
  mysql-product-master:
    image: mysql:${MYSQL_VERSION}
    container_name: mysql-product-master
    ports:
      - "3316:3306"
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: product_db
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - product-mysql-master-data:/var/lib/mysql
      - ./mysql/product-master/my.cnf:/etc/mysql/conf.d/my.cnf
      - ./mysql/init/product-init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      commerce-network:
        ipv4_address: 172.20.1.10
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  mysql-product-replica:
    image: mysql:${MYSQL_VERSION}
    container_name: mysql-product-replica
    ports:
      - "3317:3306"
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: product_db
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - product-mysql-replica-data:/var/lib/mysql
      - ./mysql/product-replica/my.cnf:/etc/mysql/conf.d/my.cnf
    depends_on:
      mysql-product-master:
        condition: service_healthy
    networks:
      commerce-network:
        ipv4_address: 172.20.1.11

  # ===== MySQL - Order =====
  mysql-order-master:
    image: mysql:${MYSQL_VERSION}
    container_name: mysql-order-master
    ports:
      - "3326:3306"
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: order_db
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - order-mysql-master-data:/var/lib/mysql
      - ./mysql/order-master/my.cnf:/etc/mysql/conf.d/my.cnf
      - ./mysql/init/order-init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      commerce-network:
        ipv4_address: 172.20.1.20
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  mysql-order-replica:
    image: mysql:${MYSQL_VERSION}
    container_name: mysql-order-replica
    ports:
      - "3327:3306"
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: order_db
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - order-mysql-replica-data:/var/lib/mysql
      - ./mysql/order-replica/my.cnf:/etc/mysql/conf.d/my.cnf
    depends_on:
      mysql-order-master:
        condition: service_healthy
    networks:
      commerce-network:
        ipv4_address: 172.20.1.21

  # ===== Redis Cluster (6 nodes) =====
  redis-1:
    image: redis:${REDIS_VERSION}
    container_name: redis-1
    ports:
      - "6379:6379"
    command: >
      redis-server
      --port 6379
      --cluster-enabled yes
      --cluster-config-file nodes.conf
      --cluster-node-timeout 5000
      --appendonly yes
      --requirepass ${REDIS_PASSWORD}
      --masterauth ${REDIS_PASSWORD}
    volumes:
      - redis-cluster-1-data:/data
    networks:
      commerce-network:
        ipv4_address: 172.20.2.1

  redis-2:
    image: redis:${REDIS_VERSION}
    container_name: redis-2
    ports:
      - "6380:6380"
    command: >
      redis-server
      --port 6380
      --cluster-enabled yes
      --cluster-config-file nodes.conf
      --cluster-node-timeout 5000
      --appendonly yes
      --requirepass ${REDIS_PASSWORD}
      --masterauth ${REDIS_PASSWORD}
    volumes:
      - redis-cluster-2-data:/data
    networks:
      commerce-network:
        ipv4_address: 172.20.2.2

  redis-3:
    image: redis:${REDIS_VERSION}
    container_name: redis-3
    ports:
      - "6381:6381"
    command: >
      redis-server
      --port 6381
      --cluster-enabled yes
      --cluster-config-file nodes.conf
      --cluster-node-timeout 5000
      --appendonly yes
      --requirepass ${REDIS_PASSWORD}
      --masterauth ${REDIS_PASSWORD}
    volumes:
      - redis-cluster-3-data:/data
    networks:
      commerce-network:
        ipv4_address: 172.20.2.3

  redis-4:
    image: redis:${REDIS_VERSION}
    container_name: redis-4
    ports:
      - "6382:6382"
    command: >
      redis-server
      --port 6382
      --cluster-enabled yes
      --cluster-config-file nodes.conf
      --cluster-node-timeout 5000
      --appendonly yes
      --requirepass ${REDIS_PASSWORD}
      --masterauth ${REDIS_PASSWORD}
    volumes:
      - redis-cluster-4-data:/data
    networks:
      commerce-network:
        ipv4_address: 172.20.2.4

  redis-5:
    image: redis:${REDIS_VERSION}
    container_name: redis-5
    ports:
      - "6383:6383"
    command: >
      redis-server
      --port 6383
      --cluster-enabled yes
      --cluster-config-file nodes.conf
      --cluster-node-timeout 5000
      --appendonly yes
      --requirepass ${REDIS_PASSWORD}
      --masterauth ${REDIS_PASSWORD}
    volumes:
      - redis-cluster-5-data:/data
    networks:
      commerce-network:
        ipv4_address: 172.20.2.5

  redis-6:
    image: redis:${REDIS_VERSION}
    container_name: redis-6
    ports:
      - "6384:6384"
    command: >
      redis-server
      --port 6384
      --cluster-enabled yes
      --cluster-config-file nodes.conf
      --cluster-node-timeout 5000
      --appendonly yes
      --requirepass ${REDIS_PASSWORD}
      --masterauth ${REDIS_PASSWORD}
    volumes:
      - redis-cluster-6-data:/data
    networks:
      commerce-network:
        ipv4_address: 172.20.2.6

  redis-cluster-init:
    image: redis:${REDIS_VERSION}
    container_name: redis-cluster-init
    depends_on:
      - redis-1
      - redis-2
      - redis-3
      - redis-4
      - redis-5
      - redis-6
    networks:
      - commerce-network
    entrypoint: >
      sh -c "sleep 5 &&
      redis-cli -a ${REDIS_PASSWORD} --cluster create
      172.20.2.1:6379 172.20.2.2:6380 172.20.2.3:6381
      172.20.2.4:6382 172.20.2.5:6383 172.20.2.6:6384
      --cluster-replicas 1 --cluster-yes"
    restart: on-failure

  # ===== Elasticsearch =====
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:${ELASTICSEARCH_VERSION}
    container_name: elasticsearch
    ports:
      - "9200:9200"
      - "9300:9300"
    environment:
      - discovery.type=single-node
      - ES_JAVA_OPTS=-Xms512m -Xmx512m
      - xpack.security.enabled=false
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    networks:
      commerce-network:
        ipv4_address: 172.20.3.1
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:9200/_cluster/health | grep -q 'green\\|yellow'"]
      interval: 10s
      timeout: 10s
      retries: 5

  # ===== Zookeeper =====
  zookeeper:
    image: confluentinc/cp-zookeeper:7.7.0
    container_name: zookeeper
    ports:
      - "2181:2181"
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    volumes:
      - zookeeper-data:/var/lib/zookeeper/data
    networks:
      commerce-network:
        ipv4_address: 172.20.4.1

  # ===== Kafka =====
  kafka:
    image: confluentinc/cp-kafka:7.7.0
    container_name: kafka
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'
    volumes:
      - kafka-data:/var/lib/kafka/data
    depends_on:
      - zookeeper
    networks:
      commerce-network:
        ipv4_address: 172.20.4.2
    healthcheck:
      test: ["CMD", "kafka-broker-api-versions", "--bootstrap-server", "localhost:9092"]
      interval: 10s
      timeout: 10s
      retries: 5
```

**Step 3: docker/docker-compose.yml (전체 서비스 포함)**

```yaml
version: '3.8'

include:
  - docker-compose.infra.yml

services:
  discovery:
    build:
      context: ..
      dockerfile: docker/Dockerfile
      args:
        MODULE: discovery
    container_name: discovery
    ports:
      - "8761:8761"
    environment:
      SPRING_PROFILES_ACTIVE: docker
    networks:
      commerce-network:
        ipv4_address: 172.20.0.10
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8761/actuator/health"]
      interval: 10s
      timeout: 5s
      retries: 10

  gateway:
    build:
      context: ..
      dockerfile: docker/Dockerfile
      args:
        MODULE: gateway
    container_name: gateway
    ports:
      - "8080:8080"
    environment:
      SPRING_PROFILES_ACTIVE: docker
    depends_on:
      discovery:
        condition: service_healthy
    networks:
      commerce-network:
        ipv4_address: 172.20.0.20

  product:
    build:
      context: ..
      dockerfile: docker/Dockerfile
      args:
        MODULE: product
    container_name: product
    ports:
      - "8081:8081"
    environment:
      SPRING_PROFILES_ACTIVE: docker
    depends_on:
      discovery:
        condition: service_healthy
      mysql-product-master:
        condition: service_healthy
    networks:
      commerce-network:
        ipv4_address: 172.20.0.30

  order:
    build:
      context: ..
      dockerfile: docker/Dockerfile
      args:
        MODULE: order
    container_name: order
    ports:
      - "8082:8082"
    environment:
      SPRING_PROFILES_ACTIVE: docker
    depends_on:
      discovery:
        condition: service_healthy
      mysql-order-master:
        condition: service_healthy
    networks:
      commerce-network:
        ipv4_address: 172.20.0.40

  search:
    build:
      context: ..
      dockerfile: docker/Dockerfile
      args:
        MODULE: search
    container_name: search
    ports:
      - "8083:8083"
    environment:
      SPRING_PROFILES_ACTIVE: docker
    depends_on:
      discovery:
        condition: service_healthy
      elasticsearch:
        condition: service_healthy
      kafka:
        condition: service_healthy
    networks:
      commerce-network:
        ipv4_address: 172.20.0.50
```

**Step 4: docker/Dockerfile (멀티모듈 공통)**

```dockerfile
FROM eclipse-temurin:25-jre-alpine
ARG MODULE
WORKDIR /app
COPY ${MODULE}/build/libs/${MODULE}-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Step 5: MySQL 설정 파일 생성**

`docker/mysql/product-master/my.cnf`:
```ini
[mysqld]
server-id = 1
log-bin = mysql-bin
binlog_format = ROW
gtid_mode = ON
enforce_gtid_consistency = ON
max_connections = 500
innodb_buffer_pool_size = 256M
```

`docker/mysql/product-replica/my.cnf`:
```ini
[mysqld]
server-id = 2
relay-log = relay-bin
read_only = ON
gtid_mode = ON
enforce_gtid_consistency = ON
```

Order용도 server-id 3, 4로 동일 패턴 생성.

**Step 6: Commit**
```bash
git add docker/
git commit -m "infra: add docker-compose infrastructure with MySQL master/replica, Redis Cluster, Elasticsearch, Kafka"
```

---

## Task 5: Common 모듈 구현

**패키지 구조:**
```
common/src/main/kotlin/com/kgd/common/
├── exception/
│   ├── BusinessException.kt
│   ├── ErrorCode.kt
│   └── GlobalExceptionHandler.kt
├── response/
│   └── ApiResponse.kt
├── security/
│   ├── JwtProperties.kt
│   ├── JwtUtil.kt
│   └── AesUtil.kt
├── webclient/
│   ├── WebClientConfig.kt
│   ├── WebClientBuilderFactory.kt
│   └── CircuitBreakerProperties.kt
└── redis/
    └── RedisConfig.kt
```

**Step 1: ApiResponse 작성 실패 테스트**

```
Test: common/src/test/kotlin/com/kgd/common/response/ApiResponseTest.kt
```

```kotlin
class ApiResponseTest : BehaviorSpec({
    given("성공 응답 생성 시") {
        `when`("데이터가 있으면") {
            then("success=true, data에 값이 담겨야 한다") {
                val response = ApiResponse.success("hello")
                response.success shouldBe true
                response.data shouldBe "hello"
                response.error shouldBe null
            }
        }
    }
    given("에러 응답 생성 시") {
        `when`("에러코드가 주어지면") {
            then("success=false, error에 코드와 메시지가 담겨야 한다") {
                val response = ApiResponse.error(ErrorCode.INVALID_INPUT)
                response.success shouldBe false
                response.error?.code shouldBe "INVALID_INPUT"
                response.data shouldBe null
            }
        }
    }
})
```

Run: `./gradlew :common:test` → FAIL

**Step 2: ApiResponse 구현**

```kotlin
data class ApiResponse<T>(
    val success: Boolean,
    val data: T? = null,
    val error: ErrorResponse? = null
) {
    data class ErrorResponse(val code: String, val message: String)

    companion object {
        fun <T> success(data: T): ApiResponse<T> = ApiResponse(success = true, data = data)
        fun <T> error(errorCode: ErrorCode): ApiResponse<T> =
            ApiResponse(success = false, error = ErrorResponse(errorCode.name, errorCode.message))
    }
}
```

**Step 3: ErrorCode 구현**

```kotlin
enum class ErrorCode(val message: String) {
    INVALID_INPUT("입력값이 올바르지 않습니다"),
    NOT_FOUND("리소스를 찾을 수 없습니다"),
    UNAUTHORIZED("인증이 필요합니다"),
    FORBIDDEN("권한이 없습니다"),
    INTERNAL_ERROR("내부 서버 오류가 발생했습니다"),
    CIRCUIT_BREAKER_OPEN("서비스가 일시적으로 사용 불가능합니다"),
    EXTERNAL_API_ERROR("외부 API 호출에 실패했습니다"),
    DUPLICATE_RESOURCE("이미 존재하는 리소스입니다")
}
```

**Step 4: BusinessException 구현**

```kotlin
open class BusinessException(
    val errorCode: ErrorCode,
    message: String = errorCode.message,
    cause: Throwable? = null
) : RuntimeException(message, cause)

class NotFoundException(resource: String) :
    BusinessException(ErrorCode.NOT_FOUND, "$resource 을(를) 찾을 수 없습니다")

class UnauthorizedException :
    BusinessException(ErrorCode.UNAUTHORIZED)

class ForbiddenException :
    BusinessException(ErrorCode.FORBIDDEN)
```

**Step 5: GlobalExceptionHandler 구현**

```kotlin
@RestControllerAdvice
class GlobalExceptionHandler {

    private val log = LoggerFactory.getLogger(this::class.java)

    @ExceptionHandler(BusinessException::class)
    fun handleBusinessException(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> {
        log.warn("Business exception: ${e.errorCode} - ${e.message}")
        val status = when (e.errorCode) {
            ErrorCode.NOT_FOUND -> HttpStatus.NOT_FOUND
            ErrorCode.UNAUTHORIZED -> HttpStatus.UNAUTHORIZED
            ErrorCode.FORBIDDEN -> HttpStatus.FORBIDDEN
            ErrorCode.INVALID_INPUT -> HttpStatus.BAD_REQUEST
            else -> HttpStatus.INTERNAL_SERVER_ERROR
        }
        return ResponseEntity.status(status).body(ApiResponse.error(e.errorCode))
    }

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidationException(e: MethodArgumentNotValidException): ResponseEntity<ApiResponse<Nothing>> {
        val message = e.bindingResult.fieldErrors.firstOrNull()?.defaultMessage ?: "Validation failed"
        return ResponseEntity.badRequest().body(
            ApiResponse(success = false, error = ApiResponse.ErrorResponse("INVALID_INPUT", message))
        )
    }

    @ExceptionHandler(Exception::class)
    fun handleGenericException(e: Exception): ResponseEntity<ApiResponse<Nothing>> {
        log.error("Unhandled exception", e)
        return ResponseEntity.internalServerError().body(ApiResponse.error(ErrorCode.INTERNAL_ERROR))
    }
}
```

**Step 6: JwtUtil 테스트 및 구현**

Test:
```kotlin
class JwtUtilTest : BehaviorSpec({
    val props = JwtProperties(secret = "test-secret-key-must-be-at-least-32chars!!", accessExpiry = 1800L, refreshExpiry = 604800L)
    val jwtUtil = JwtUtil(props)

    given("JWT 생성 시") {
        `when`("유효한 사용자 ID로 생성하면") {
            then("토큰 검증에 성공해야 한다") {
                val token = jwtUtil.generateAccessToken(userId = "user-1", roles = listOf("USER"))
                val claims = jwtUtil.parseToken(token)
                claims["userId"] shouldBe "user-1"
            }
        }
    }
})
```

Implementation:
```kotlin
@ConfigurationProperties(prefix = "jwt")
data class JwtProperties(
    val secret: String,
    val accessExpiry: Long = 1800L,   // 30분 (초)
    val refreshExpiry: Long = 604800L  // 7일 (초)
)

@Component
class JwtUtil(private val props: JwtProperties) {
    private val key: SecretKey by lazy {
        Keys.hmacShaKeyFor(props.secret.toByteArray())
    }

    fun generateAccessToken(userId: String, roles: List<String>): String =
        Jwts.builder()
            .claim("userId", userId)
            .claim("roles", roles)
            .claim("type", "access")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + props.accessExpiry * 1000))
            .signWith(key)
            .compact()

    fun generateRefreshToken(userId: String): String =
        Jwts.builder()
            .claim("userId", userId)
            .claim("type", "refresh")
            .issuedAt(Date())
            .expiration(Date(System.currentTimeMillis() + props.refreshExpiry * 1000))
            .signWith(key)
            .compact()

    fun parseToken(token: String): Claims =
        Jwts.parser().verifyWith(key).build().parseSignedClaims(token).payload

    fun isValid(token: String): Boolean = runCatching { parseToken(token); true }.getOrDefault(false)
}
```

**Step 7: AesUtil 구현**

```kotlin
@Component
class AesUtil(
    @Value("\${encryption.aes-key}") private val aesKey: String
) {
    private val key: SecretKeySpec by lazy {
        SecretKeySpec(aesKey.toByteArray().copyOf(32), "AES")
    }

    fun encrypt(plainText: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val iv = ByteArray(12).also { SecureRandom().nextBytes(it) }
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv))
        val encrypted = cipher.doFinal(plainText.toByteArray())
        return Base64.getEncoder().encodeToString(iv + encrypted)
    }

    fun decrypt(encryptedText: String): String {
        val decoded = Base64.getDecoder().decode(encryptedText)
        val iv = decoded.copyOf(12)
        val cipherText = decoded.copyOfRange(12, decoded.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
        return String(cipher.doFinal(cipherText))
    }
}
```

**Step 8: WebClientBuilderFactory + CircuitBreaker 설정**

```kotlin
@Configuration
class WebClientConfig {
    @Bean
    fun webClientBuilder(): WebClient.Builder =
        WebClient.builder()
            .codecs { it.defaultCodecs().maxInMemorySize(2 * 1024 * 1024) }
}

@Component
class WebClientBuilderFactory(
    private val webClientBuilder: WebClient.Builder,
    private val circuitBreakerFactory: ReactiveCircuitBreakerFactory<*, *>
) {
    fun create(baseUrl: String, circuitBreakerName: String): WebClient =
        webClientBuilder.baseUrl(baseUrl).build()

    // CircuitBreaker 래핑 헬퍼
    fun <T> withCircuitBreaker(
        mono: Mono<T>,
        circuitBreakerName: String,
        fallback: (Throwable) -> Mono<T>
    ): Mono<T> = circuitBreakerFactory.create(circuitBreakerName).run(mono, fallback)
}
```

**Step 9: Redis 공통 설정**

```kotlin
@Configuration
@EnableRedisRepositories
class RedisConfig {
    @Bean
    fun redisClusterConfiguration(
        @Value("\${spring.data.redis.cluster.nodes}") nodes: List<String>
    ): RedisClusterConfiguration = RedisClusterConfiguration(nodes)

    @Bean
    fun redisConnectionFactory(config: RedisClusterConfiguration): LettuceConnectionFactory =
        LettuceConnectionFactory(config, LettuceClientConfiguration.builder()
            .commandTimeout(Duration.ofSeconds(2))
            .build())

    @Bean
    fun redisTemplate(factory: RedisConnectionFactory): RedisTemplate<String, Any> =
        RedisTemplate<String, Any>().apply {
            connectionFactory = factory
            keySerializer = StringRedisSerializer()
            valueSerializer = GenericJackson2JsonRedisSerializer()
        }
}
```

**Step 10: 테스트 실행 후 Commit**

```bash
./gradlew :common:test
git add common/
git commit -m "feat(common): implement shared exception, response, JWT, AES, WebClient modules"
```

---

## Task 6: Discovery 서비스 구현

**Files:**
- Create: `discovery/src/main/kotlin/com/kgd/discovery/DiscoveryApplication.kt`
- Create: `discovery/src/main/resources/application.yml`
- Create: `discovery/src/main/resources/application-docker.yml`

**Step 1: DiscoveryApplication.kt**

```kotlin
package com.kgd.discovery

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer

@SpringBootApplication
@EnableEurekaServer
class DiscoveryApplication

fun main(args: Array<String>) {
    runApplication<DiscoveryApplication>(*args)
}
```

**Step 2: application.yml**

```yaml
spring:
  application:
    name: discovery-service

server:
  port: 8761

eureka:
  instance:
    hostname: localhost
  client:
    register-with-eureka: false
    fetch-registry: false
    service-url:
      defaultZone: http://${eureka.instance.hostname}:${server.port}/eureka/
  server:
    enable-self-preservation: false
    eviction-interval-timer-in-ms: 5000

management:
  endpoints:
    web:
      exposure:
        include: health,info
```

**Step 3: application-docker.yml**

```yaml
eureka:
  instance:
    hostname: discovery
  client:
    service-url:
      defaultZone: http://discovery:8761/eureka/
```

**Step 4: Commit**
```bash
git add discovery/
git commit -m "feat(discovery): add Eureka server for service discovery"
```

---

## Task 7: Gateway 서비스 구현

**패키지 구조:**
```
gateway/src/main/kotlin/com/kgd/gateway/
├── GatewayApplication.kt
├── config/
│   ├── RouteConfig.kt
│   └── SecurityConfig.kt
├── filter/
│   ├── AuthenticationFilter.kt
│   └── RequestLoggingFilter.kt
└── security/
    └── JwtAuthenticationManager.kt
```

**Step 1: application.yml (Gateway 라우팅 설정)**

```yaml
spring:
  application:
    name: gateway-service
  cloud:
    gateway:
      routes:
        - id: product-service
          uri: lb://product-service
          predicates:
            - Path=/api/products/**
          filters:
            - AuthenticationFilter
        - id: order-service
          uri: lb://order-service
          predicates:
            - Path=/api/orders/**
          filters:
            - AuthenticationFilter
        - id: search-service
          uri: lb://search-service
          predicates:
            - Path=/api/search/**
          filters:
            - AuthenticationFilter
        - id: auth-service
          uri: lb://product-service
          predicates:
            - Path=/api/auth/**
          # 인증 필터 없음 (로그인/회원가입)
      default-filters:
        - RequestLoggingFilter
  data:
    redis:
      cluster:
        nodes:
          - localhost:6379
          - localhost:6380
          - localhost:6381
          - localhost:6382
          - localhost:6383
          - localhost:6384
        password: ${REDIS_PASSWORD}

server:
  port: 8080

eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka/

jwt:
  secret: ${JWT_SECRET}
  access-expiry: 1800
  refresh-expiry: 604800
```

**Step 2: AuthenticationFilter 구현**

```kotlin
@Component
class AuthenticationFilter(
    private val jwtUtil: JwtUtil,
    private val redisTemplate: RedisTemplate<String, Any>
) : AbstractGatewayFilterFactory<AuthenticationFilter.Config>(Config::class.java) {

    data class Config(val roles: List<String> = emptyList())

    override fun apply(config: Config): GatewayFilter = GatewayFilter { exchange, chain ->
        val token = extractToken(exchange.request)
            ?: return@GatewayFilter exchange.response.let {
                it.statusCode = HttpStatus.UNAUTHORIZED
                it.setComplete()
            }

        // JWT 블랙리스트 체크 (Redis)
        val isBlacklisted = redisTemplate.hasKey("blacklist:$token")
        if (isBlacklisted) {
            exchange.response.statusCode = HttpStatus.UNAUTHORIZED
            return@GatewayFilter exchange.response.setComplete()
        }

        runCatching { jwtUtil.parseToken(token) }
            .fold(
                onSuccess = { claims ->
                    val userId = claims["userId"] as String
                    val roles = claims["roles"] as List<*>
                    val mutatedRequest = exchange.request.mutate()
                        .header("X-User-Id", userId)
                        .header("X-User-Roles", roles.joinToString(","))
                        .build()
                    chain.filter(exchange.mutate().request(mutatedRequest).build())
                },
                onFailure = {
                    exchange.response.statusCode = HttpStatus.UNAUTHORIZED
                    exchange.response.setComplete()
                }
            )
    }

    private fun extractToken(request: ServerHttpRequest): String? =
        request.headers.getFirst(HttpHeaders.AUTHORIZATION)
            ?.takeIf { it.startsWith("Bearer ") }
            ?.substring(7)
}
```

**Step 3: Commit**
```bash
git add gateway/
git commit -m "feat(gateway): implement Spring Cloud Gateway with JWT auth filter and Eureka routing"
```

---

## Task 8: Product 서비스 구현

**패키지 구조 (Clean Architecture):**
```
product/src/main/kotlin/com/kgd/product/
├── domain/
│   └── product/
│       ├── model/
│       │   ├── Product.kt
│       │   ├── ProductStatus.kt
│       │   └── Money.kt
│       ├── policy/
│       │   └── ProductPolicy.kt
│       └── exception/
│           └── ProductException.kt
├── application/
│   └── product/
│       ├── usecase/
│       │   ├── CreateProductUseCase.kt
│       │   ├── GetProductUseCase.kt
│       │   └── UpdateProductUseCase.kt
│       ├── service/
│       │   └── ProductService.kt
│       ├── port/
│       │   ├── ProductRepositoryPort.kt
│       │   └── ProductEventPort.kt
│       └── dto/
│           ├── CreateProductCommand.kt
│           └── ProductResult.kt
├── infrastructure/
│   ├── persistence/
│   │   └── product/
│   │       ├── entity/ProductJpaEntity.kt
│   │       ├── repository/ProductJpaRepository.kt
│   │       ├── repository/ProductQueryRepository.kt
│   │       └── adapter/ProductRepositoryAdapter.kt
│   ├── messaging/
│   │   └── ProductEventAdapter.kt
│   └── config/
│       ├── DataSourceConfig.kt
│       ├── KafkaConfig.kt
│       └── RedisConfig.kt
└── presentation/
    └── product/
        ├── controller/ProductController.kt
        └── dto/
            ├── CreateProductRequest.kt
            └── ProductResponse.kt
```

**Step 1: Domain 모델 테스트 작성**

```
Test: product/src/test/kotlin/com/kgd/product/domain/product/model/ProductTest.kt
```

```kotlin
class ProductTest : BehaviorSpec({
    given("상품 생성 시") {
        `when`("유효한 이름과 가격이 주어지면") {
            then("ACTIVE 상태의 상품이 생성되어야 한다") {
                val product = Product.create(
                    name = "테스트 상품",
                    price = Money(10000.toBigDecimal()),
                    stock = 100
                )
                product.status shouldBe ProductStatus.ACTIVE
                product.name shouldBe "테스트 상품"
            }
        }
        `when`("가격이 0 이하이면") {
            then("IllegalArgumentException이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Product.create("상품", Money(0.toBigDecimal()), 10)
                }
            }
        }
    }
    given("상품 비활성화 시") {
        `when`("ACTIVE 상태이면") {
            then("INACTIVE로 전환되어야 한다") {
                val product = Product.create("상품", Money(1000.toBigDecimal()), 10)
                product.deactivate()
                product.status shouldBe ProductStatus.INACTIVE
            }
        }
    }
})
```

**Step 2: Domain 모델 구현**

```kotlin
// domain/product/model/Money.kt
@JvmInline
value class Money(val amount: BigDecimal) {
    init { require(amount > BigDecimal.ZERO) { "금액은 0보다 커야 합니다" } }
    operator fun plus(other: Money) = Money(amount + other.amount)
}

// domain/product/model/Product.kt
class Product private constructor(
    val id: Long? = null,
    var name: String,
    var price: Money,
    var stock: Int,
    var status: ProductStatus,
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    companion object {
        fun create(name: String, price: Money, stock: Int): Product {
            require(name.isNotBlank()) { "상품명은 비어있을 수 없습니다" }
            require(stock >= 0) { "재고는 0 이상이어야 합니다" }
            return Product(name = name, price = price, stock = stock, status = ProductStatus.ACTIVE)
        }
    }

    fun deactivate() {
        check(status == ProductStatus.ACTIVE) { "활성 상품만 비활성화할 수 있습니다" }
        status = ProductStatus.INACTIVE
    }

    fun decreaseStock(quantity: Int) {
        require(quantity > 0) { "수량은 0보다 커야 합니다" }
        check(stock >= quantity) { "재고가 부족합니다" }
        stock -= quantity
    }
}

// domain/product/model/ProductStatus.kt
enum class ProductStatus { ACTIVE, INACTIVE, DELETED }
```

**Step 3: UseCase 인터페이스 정의**

```kotlin
// application/product/usecase/CreateProductUseCase.kt
interface CreateProductUseCase {
    fun execute(command: Command): Result

    data class Command(val name: String, val price: BigDecimal, val stock: Int)
    data class Result(val id: Long, val name: String, val status: String)
}
```

**Step 4: Port 인터페이스 정의**

```kotlin
interface ProductRepositoryPort {
    fun save(product: Product): Product
    fun findById(id: Long): Product?
    fun findAll(pageable: Pageable): Page<Product>
}

interface ProductEventPort {
    fun publishProductCreated(product: Product)
    fun publishProductUpdated(product: Product)
}
```

**Step 5: Application Service (UseCase 구현) 테스트**

```kotlin
class CreateProductServiceTest : BehaviorSpec({
    val repositoryPort = mockk<ProductRepositoryPort>()
    val eventPort = mockk<ProductEventPort>(relaxed = true)
    val service = ProductService(repositoryPort, eventPort)

    given("상품 생성 명령이 들어오면") {
        `when`("유효한 커맨드이면") {
            then("상품이 저장되고 이벤트가 발행되어야 한다") {
                val savedProduct = Product.create("테스트", Money(1000.toBigDecimal()), 10)
                every { repositoryPort.save(any()) } returns savedProduct

                val result = service.execute(CreateProductUseCase.Command("테스트", 1000.toBigDecimal(), 10))

                result.name shouldBe "테스트"
                verify(exactly = 1) { eventPort.publishProductCreated(any()) }
            }
        }
    }
})
```

**Step 6: ProductService 구현**

```kotlin
@Service
@Transactional
class ProductService(
    private val repositoryPort: ProductRepositoryPort,
    private val eventPort: ProductEventPort
) : CreateProductUseCase, GetProductUseCase, UpdateProductUseCase {

    override fun execute(command: CreateProductUseCase.Command): CreateProductUseCase.Result {
        val product = Product.create(
            name = command.name,
            price = Money(command.price),
            stock = command.stock
        )
        val saved = repositoryPort.save(product)
        eventPort.publishProductCreated(saved)
        return CreateProductUseCase.Result(
            id = saved.id!!,
            name = saved.name,
            status = saved.status.name
        )
    }
}
```

**Step 7: Infrastructure - JPA Entity 및 Adapter**

```kotlin
// infrastructure/persistence/product/entity/ProductJpaEntity.kt
@Entity
@Table(name = "products")
class ProductJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @Column(nullable = false)
    var name: String,
    @Column(nullable = false)
    var price: BigDecimal,
    var stock: Int,
    @Enumerated(EnumType.STRING)
    var status: ProductStatus,
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    fun toDomain() = Product.restore(id, name, Money(price), stock, status, createdAt)

    companion object {
        fun fromDomain(product: Product) = ProductJpaEntity(
            id = product.id,
            name = product.name,
            price = product.price.amount,
            stock = product.stock,
            status = product.status,
            createdAt = product.createdAt
        )
    }
}
```

**Step 8: DataSource 설정 (Read/Write 분리)**

```kotlin
@Configuration
class DataSourceConfig {
    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.master")
    fun masterDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.replica")
    fun replicaDataSource(): DataSource = DataSourceBuilder.create().build()

    @Bean
    @Primary
    fun routingDataSource(
        @Qualifier("masterDataSource") master: DataSource,
        @Qualifier("replicaDataSource") replica: DataSource
    ): DataSource = RoutingDataSource().apply {
        setTargetDataSources(mapOf(
            DataSourceType.MASTER to master,
            DataSourceType.REPLICA to replica
        ))
        setDefaultTargetDataSource(master)
    }
}

class RoutingDataSource : AbstractRoutingDataSource() {
    override fun determineCurrentLookupKey(): DataSourceType =
        if (TransactionSynchronizationManager.isCurrentTransactionReadOnly())
            DataSourceType.REPLICA else DataSourceType.MASTER
}

enum class DataSourceType { MASTER, REPLICA }
```

**Step 9: application.yml (Product)**

```yaml
spring:
  application:
    name: product-service
  datasource:
    master:
      url: jdbc:mysql://mysql-product-master:3306/product_db
      username: ${MYSQL_USER}
      password: ${MYSQL_PASSWORD}
      driver-class-name: com.mysql.cj.jdbc.Driver
    replica:
      url: jdbc:mysql://mysql-product-replica:3306/product_db
      username: ${MYSQL_USER}
      password: ${MYSQL_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
  kafka:
    bootstrap-servers: kafka:29092
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
  data:
    redis:
      cluster:
        nodes: ${REDIS_NODES}

server:
  port: 8081

eureka:
  client:
    service-url:
      defaultZone: http://discovery:8761/eureka/

kafka:
  topics:
    product-created: product.item.created
    product-updated: product.item.updated
```

**Step 10: Kafka 이벤트 발행 Adapter**

```kotlin
@Component
class ProductEventAdapter(
    private val kafkaTemplate: KafkaTemplate<String, Any>,
    @Value("\${kafka.topics.product-created}") private val createdTopic: String,
    @Value("\${kafka.topics.product-updated}") private val updatedTopic: String
) : ProductEventPort {

    override fun publishProductCreated(product: Product) {
        kafkaTemplate.send(createdTopic, product.id.toString(), ProductCreatedEvent(
            productId = product.id!!,
            name = product.name,
            price = product.price.amount,
            status = product.status.name
        ))
    }
}

data class ProductCreatedEvent(
    val productId: Long,
    val name: String,
    val price: BigDecimal,
    val status: String,
    val eventTime: LocalDateTime = LocalDateTime.now()
)
```

**Step 11: ProductController 구현**

```kotlin
@RestController
@RequestMapping("/api/products")
class ProductController(
    private val createProductUseCase: CreateProductUseCase,
    private val getProductUseCase: GetProductUseCase
) {
    @PostMapping
    fun createProduct(@Valid @RequestBody request: CreateProductRequest): ResponseEntity<ApiResponse<ProductResponse>> {
        val result = createProductUseCase.execute(request.toCommand())
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(ProductResponse.from(result)))
    }

    @GetMapping("/{id}")
    fun getProduct(@PathVariable id: Long): ResponseEntity<ApiResponse<ProductResponse>> {
        val result = getProductUseCase.execute(id)
        return ResponseEntity.ok(ApiResponse.success(ProductResponse.from(result)))
    }
}
```

**Step 12: 테스트 실행 후 Commit**
```bash
./gradlew :product:test
git add product/
git commit -m "feat(product): implement product service with clean architecture, JPA read/write separation, Kafka events"
```

---

## Task 9: Order 서비스 구현

Product와 동일한 Clean Architecture 패턴 적용.

**핵심 도메인: Order, OrderItem**

**Step 1: Order 도메인 모델 테스트**

```kotlin
class OrderTest : BehaviorSpec({
    given("주문 생성 시") {
        `when`("상품 ID와 수량이 유효하면") {
            then("PENDING 상태의 주문이 생성되어야 한다") {
                val order = Order.create(
                    userId = "user-1",
                    items = listOf(OrderItem.of(productId = 1L, quantity = 2, unitPrice = Money(5000.toBigDecimal())))
                )
                order.status shouldBe OrderStatus.PENDING
                order.totalAmount.amount shouldBe 10000.toBigDecimal()
            }
        }
    }
    given("주문 완료 처리 시") {
        `when`("PENDING 상태이면") {
            then("COMPLETED로 전환되어야 한다") {
                val order = Order.create("user-1", listOf(OrderItem.of(1L, 1, Money(1000.toBigDecimal()))))
                order.complete()
                order.status shouldBe OrderStatus.COMPLETED
            }
        }
    }
})
```

**Step 2: Order Domain 구현**

```kotlin
class Order private constructor(
    val id: Long? = null,
    val userId: String,
    val items: List<OrderItem>,
    var status: OrderStatus,
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    val totalAmount: Money get() = items.fold(Money(BigDecimal.ZERO)) { acc, item -> acc + item.subtotal }

    companion object {
        fun create(userId: String, items: List<OrderItem>): Order {
            require(items.isNotEmpty()) { "주문 항목이 없습니다" }
            return Order(userId = userId, items = items, status = OrderStatus.PENDING)
        }
    }

    fun complete() {
        check(status == OrderStatus.PENDING) { "PENDING 상태만 완료 처리할 수 있습니다" }
        status = OrderStatus.COMPLETED
    }

    fun cancel() {
        check(status == OrderStatus.PENDING) { "PENDING 상태만 취소할 수 있습니다" }
        status = OrderStatus.CANCELLED
    }
}

data class OrderItem private constructor(
    val productId: Long,
    val quantity: Int,
    val unitPrice: Money
) {
    val subtotal: Money get() = Money(unitPrice.amount * quantity.toBigDecimal())

    companion object {
        fun of(productId: Long, quantity: Int, unitPrice: Money): OrderItem {
            require(quantity > 0) { "수량은 0보다 커야 합니다" }
            return OrderItem(productId, quantity, unitPrice)
        }
    }
}

enum class OrderStatus { PENDING, COMPLETED, CANCELLED }
```

**Step 3: PlaceOrderUseCase + Service 구현 (Product 패턴 동일)**

외부 API(결제) 호출은 `PaymentPort` (WebClient + CircuitBreaker):

```kotlin
interface PaymentPort {
    suspend fun requestPayment(orderId: Long, amount: BigDecimal): PaymentResult
}

// infrastructure/client/PaymentAdapter.kt
@Component
class PaymentAdapter(
    private val webClient: WebClient,
    private val circuitBreakerFactory: ReactiveCircuitBreakerFactory<*, *>
) : PaymentPort {
    override suspend fun requestPayment(orderId: Long, amount: BigDecimal): PaymentResult {
        val mono = webClient.post()
            .uri("/payments")
            .bodyValue(mapOf("orderId" to orderId, "amount" to amount))
            .retrieve()
            .bodyToMono(PaymentResult::class.java)

        return circuitBreakerFactory.create("payment-service")
            .run(mono) { ex -> Mono.error(ExternalApiException("결제 서비스 연결 실패", ex)) }
            .awaitSingle()
    }
}
```

**Step 4: Commit**
```bash
./gradlew :order:test
git add order/
git commit -m "feat(order): implement order service with clean architecture, payment circuit breaker"
```

---

## Task 10: Search 서비스 구현

**패키지 구조:**
```
search/src/main/kotlin/com/kgd/search/
├── domain/
│   └── product/
│       ├── model/ProductDocument.kt
│       └── port/ProductSearchPort.kt
├── application/
│   └── product/
│       ├── usecase/SearchProductUseCase.kt
│       ├── service/SearchProductService.kt
│       └── port/ProductIndexPort.kt
├── infrastructure/
│   ├── elasticsearch/
│   │   ├── ProductElasticsearchRepository.kt
│   │   └── ProductSearchAdapter.kt
│   ├── messaging/
│   │   └── ProductIndexingConsumer.kt
│   └── config/
│       └── ElasticsearchConfig.kt
└── presentation/
    └── search/
        └── controller/SearchController.kt
```

**Step 1: ProductDocument 정의**

```kotlin
@Document(indexName = "products")
data class ProductDocument(
    @Id val id: String,
    @Field(type = FieldType.Text, analyzer = "nori")
    val name: String,
    @Field(type = FieldType.Double)
    val price: BigDecimal,
    @Field(type = FieldType.Keyword)
    val status: String,
    @Field(type = FieldType.Date)
    val createdAt: LocalDateTime = LocalDateTime.now()
)
```

**Step 2: Kafka Consumer (증분 색인)**

```kotlin
@Component
class ProductIndexingConsumer(
    private val productIndexPort: ProductIndexPort
) {
    private val log = LoggerFactory.getLogger(this::class.java)

    @KafkaListener(topics = ["product.item.created", "product.item.updated"], groupId = "search-indexer")
    fun consume(event: ProductCreatedEvent) {
        log.info("Received product index event: ${event.productId}")
        productIndexPort.indexProduct(
            ProductDocument(
                id = event.productId.toString(),
                name = event.name,
                price = event.price,
                status = event.status
            )
        )
    }
}
```

**Step 3: BulkProcessor 전체 색인 (배치 작업)**

```kotlin
@Component
class ProductBulkIndexer(
    private val elasticsearchOperations: ElasticsearchOperations
) {
    fun bulkIndex(documents: List<ProductDocument>) {
        val queries = documents.map { doc ->
            IndexQuery().apply {
                id = doc.id
                `object` = doc
            }
        }
        elasticsearchOperations.bulkIndex(queries, ProductDocument::class.java)
    }
}
```

**Step 4: SearchController**

```kotlin
@RestController
@RequestMapping("/api/search")
class SearchController(private val searchProductUseCase: SearchProductUseCase) {

    @GetMapping("/products")
    fun searchProducts(
        @RequestParam keyword: String,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<ApiResponse<Page<ProductSearchResult>>> {
        val result = searchProductUseCase.execute(SearchProductUseCase.Query(keyword, page, size))
        return ResponseEntity.ok(ApiResponse.success(result))
    }
}
```

**Step 5: application.yml (Search)**

```yaml
spring:
  application:
    name: search-service
  elasticsearch:
    uris: http://elasticsearch:9200
  kafka:
    bootstrap-servers: kafka:29092
    consumer:
      group-id: search-indexer
      auto-offset-reset: earliest
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      properties:
        spring.json.trusted.packages: "com.kgd.*"

server:
  port: 8083

eureka:
  client:
    service-url:
      defaultZone: http://discovery:8761/eureka/
```

**Step 6: 테스트 및 Commit**
```bash
./gradlew :search:test
git add search/
git commit -m "feat(search): implement search service with Elasticsearch, Kafka consumer, bulk indexing"
```

---

## 최종 검증 체크리스트

```bash
# 1. 전체 빌드
./gradlew build

# 2. 전체 테스트
./gradlew test

# 3. 인프라 기동
cd docker && docker compose -f docker-compose.infra.yml up -d

# 4. 서비스 기동 (Docker)
./gradlew build -x test
docker compose up -d

# 5. Eureka 확인
curl http://localhost:8761

# 6. Gateway를 통한 Product 조회
curl http://localhost:8080/api/products/1

# 7. Search 확인
curl "http://localhost:8080/api/search/products?keyword=테스트"
```

---

## 실행 순서 요약

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10
  ADR    CLAUDE.md  Gradle   Docker   Common  Discovery  Gateway  Product   Order    Search
```

각 Task는 반드시 이전 Task 완료 후 실행.
Task 5(Common) 이후 Task 6-10은 서로 독립적으로 병렬 진행 가능.
