# Code Dictionary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** IT개념 코드 위치 추적 서비스 — 코드베이스를 IT 개념 단위로 색인하고, 키워드/동의어 검색으로 코드 위치(파일+라인+git permalink)를 반환하는 웹 서비스 구축

**Architecture:** Clean Architecture (domain + app 2-모듈). RDB(MySQL)를 source of truth, OpenSearch(Nori + synonym)를 검색 엔진으로 사용. React 웹 UI에서 검색.

**Tech Stack:** Kotlin, Spring Boot 4.0.x, Spring Data JPA, OpenSearch Java Client, Flyway, React/TypeScript, Docker

**Spec:** `docs/superpowers/specs/2026-04-05-code-dictionary-design.md`
**PRD:** `ideabank/docs/3-code-dictionary.md`

---

## File Map

### New Files — domain module (`code-dictionary/domain/`)

| File | Responsibility |
|------|---------------|
| `build.gradle.kts` | Domain module build (common only) |
| `src/main/kotlin/com/kgd/codedictionary/domain/concept/model/Concept.kt` | IT 개념 도메인 모델 |
| `src/main/kotlin/com/kgd/codedictionary/domain/concept/model/ConceptLevel.kt` | 난이도 enum |
| `src/main/kotlin/com/kgd/codedictionary/domain/concept/model/ConceptCategory.kt` | 카테고리 enum |
| `src/main/kotlin/com/kgd/codedictionary/domain/index/model/ConceptIndex.kt` | 개념-코드 매핑 도메인 모델 |
| `src/main/kotlin/com/kgd/codedictionary/domain/index/model/CodeLocation.kt` | 코드 위치 value object |
| `src/main/kotlin/com/kgd/codedictionary/domain/concept/exception/ConceptException.kt` | 도메인 예외 |
| `src/test/kotlin/com/kgd/codedictionary/domain/concept/model/ConceptTest.kt` | 도메인 테스트 |
| `src/test/kotlin/com/kgd/codedictionary/domain/index/model/ConceptIndexTest.kt` | 도메인 테스트 |

### New Files — app module (`code-dictionary/app/`)

| File | Responsibility |
|------|---------------|
| `build.gradle.kts` | App module build (Spring Boot + OpenSearch) |
| `src/main/kotlin/com/kgd/codedictionary/CodeDictionaryApplication.kt` | Spring Boot main |
| **Application — ports** | |
| `src/main/kotlin/com/kgd/codedictionary/application/concept/port/ConceptRepositoryPort.kt` | 사전 RDB 포트 |
| `src/main/kotlin/com/kgd/codedictionary/application/index/port/ConceptIndexRepositoryPort.kt` | 색인 RDB 포트 |
| `src/main/kotlin/com/kgd/codedictionary/application/search/port/ConceptSearchPort.kt` | OpenSearch 검색 포트 |
| `src/main/kotlin/com/kgd/codedictionary/application/search/port/ConceptIndexingPort.kt` | OpenSearch 색인 포트 |
| **Application — use cases** | |
| `src/main/kotlin/com/kgd/codedictionary/application/search/usecase/SearchConceptUseCase.kt` | 검색 유스케이스 인터페이스 |
| `src/main/kotlin/com/kgd/codedictionary/application/concept/usecase/ManageConceptUseCase.kt` | 사전 CRUD 유스케이스 |
| `src/main/kotlin/com/kgd/codedictionary/application/index/usecase/ManageIndexUseCase.kt` | 색인 관리 유스케이스 |
| **Application — services** | |
| `src/main/kotlin/com/kgd/codedictionary/application/search/service/SearchService.kt` | 검색 서비스 구현 |
| `src/main/kotlin/com/kgd/codedictionary/application/concept/service/ConceptService.kt` | 사전 서비스 구현 |
| `src/main/kotlin/com/kgd/codedictionary/application/index/service/IndexService.kt` | 색인 서비스 구현 |
| `src/main/kotlin/com/kgd/codedictionary/application/sync/service/SyncService.kt` | RDB → OpenSearch 동기화 |
| **Application — DTOs** | |
| `src/main/kotlin/com/kgd/codedictionary/application/search/dto/SearchDtos.kt` | 검색 커맨드/결과 |
| `src/main/kotlin/com/kgd/codedictionary/application/concept/dto/ConceptDtos.kt` | 사전 커맨드/결과 |
| `src/main/kotlin/com/kgd/codedictionary/application/index/dto/IndexDtos.kt` | 색인 커맨드/결과 |
| **Infrastructure — persistence** | |
| `src/main/kotlin/com/kgd/codedictionary/infrastructure/persistence/concept/entity/ConceptJpaEntity.kt` | 사전 JPA 엔티티 |
| `src/main/kotlin/com/kgd/codedictionary/infrastructure/persistence/concept/entity/ConceptSynonymJpaEntity.kt` | 동의어 JPA 엔티티 |
| `src/main/kotlin/com/kgd/codedictionary/infrastructure/persistence/concept/repository/ConceptJpaRepository.kt` | Spring Data JPA |
| `src/main/kotlin/com/kgd/codedictionary/infrastructure/persistence/concept/adapter/ConceptRepositoryAdapter.kt` | 포트 구현 |
| `src/main/kotlin/com/kgd/codedictionary/infrastructure/persistence/index/entity/ConceptIndexJpaEntity.kt` | 색인 JPA 엔티티 |
| `src/main/kotlin/com/kgd/codedictionary/infrastructure/persistence/index/repository/ConceptIndexJpaRepository.kt` | Spring Data JPA |
| `src/main/kotlin/com/kgd/codedictionary/infrastructure/persistence/index/adapter/ConceptIndexRepositoryAdapter.kt` | 포트 구현 |
| **Infrastructure — OpenSearch** | |
| `src/main/kotlin/com/kgd/codedictionary/infrastructure/opensearch/config/OpenSearchConfig.kt` | 클라이언트 설정 |
| `src/main/kotlin/com/kgd/codedictionary/infrastructure/opensearch/adapter/ConceptSearchAdapter.kt` | 검색 포트 구현 |
| `src/main/kotlin/com/kgd/codedictionary/infrastructure/opensearch/adapter/ConceptIndexingAdapter.kt` | 색인 포트 구현 |
| **Infrastructure — config** | |
| `src/main/kotlin/com/kgd/codedictionary/infrastructure/config/DataSourceConfig.kt` | Master/Replica DB |
| `src/main/kotlin/com/kgd/codedictionary/infrastructure/config/OpenApiConfig.kt` | Swagger UI |
| **Presentation** | |
| `src/main/kotlin/com/kgd/codedictionary/presentation/search/controller/SearchController.kt` | 검색 API |
| `src/main/kotlin/com/kgd/codedictionary/presentation/concept/controller/ConceptController.kt` | 사전 CRUD API |
| `src/main/kotlin/com/kgd/codedictionary/presentation/index/controller/IndexController.kt` | 색인 관리 API |
| `src/main/kotlin/com/kgd/codedictionary/presentation/search/dto/SearchResponseDto.kt` | 검색 응답 DTO |
| `src/main/kotlin/com/kgd/codedictionary/presentation/concept/dto/ConceptRequestDto.kt` | 사전 요청 DTO |
| `src/main/kotlin/com/kgd/codedictionary/presentation/concept/dto/ConceptResponseDto.kt` | 사전 응답 DTO |
| **Resources** | |
| `src/main/resources/application.yml` | 로컬 설정 |
| `src/main/resources/application-docker.yml` | Docker 설정 |
| `src/main/resources/db/migration/V1__init_schema.sql` | Flyway 스키마 |
| `src/main/resources/db/migration/V2__seed_concepts.sql` | 초기 사전 데이터 |
| **Tests** | |
| `src/test/kotlin/com/kgd/codedictionary/application/search/service/SearchServiceTest.kt` | |
| `src/test/kotlin/com/kgd/codedictionary/application/concept/service/ConceptServiceTest.kt` | |
| `src/test/kotlin/com/kgd/codedictionary/application/index/service/IndexServiceTest.kt` | |

### New Files — React frontend (`code-dictionary/frontend/`)

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies |
| `vite.config.ts` | Vite config |
| `tsconfig.json` | TypeScript config |
| `index.html` | Entry HTML |
| `src/main.tsx` | React entry |
| `src/App.tsx` | Main app with router |
| `src/pages/SearchPage.tsx` | 검색 메인 페이지 |
| `src/components/SearchBar.tsx` | 검색 입력 컴포넌트 |
| `src/components/SearchResults.tsx` | 결과 리스트 컴포넌트 |
| `src/components/CodeSnippet.tsx` | 코드 스니펫 미리보기 |
| `src/api/searchApi.ts` | API 클라이언트 |
| `src/types/index.ts` | TypeScript 타입 정의 |

### Modified Files — project root

| File | Change |
|------|--------|
| `settings.gradle.kts` | `"code-dictionary:domain"`, `"code-dictionary:app"` 추가 |
| `docker/Dockerfile` | code-dictionary build.gradle.kts COPY 추가 |
| `docker/docker-compose.infra.yml` | MySQL master/replica + OpenSearch 추가 |
| `docker/docker-compose.yml` | code-dictionary 서비스 정의 추가 |

### New Files — Docker config

| File | Responsibility |
|------|---------------|
| `docker/mysql/code-dictionary-master/my.cnf` | MySQL master 설정 |
| `docker/mysql/code-dictionary-master/init/01-init.sh` | DB 초기화 스크립트 |
| `docker/mysql/code-dictionary-replica/my.cnf` | MySQL replica 설정 |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `code-dictionary/domain/build.gradle.kts`
- Create: `code-dictionary/app/build.gradle.kts`
- Modify: `settings.gradle.kts`
- Modify: `docker/Dockerfile`

- [ ] **Step 1: Create domain build.gradle.kts**

```kotlin
// code-dictionary/domain/build.gradle.kts
dependencies {
    implementation(project(":common"))
}
```

- [ ] **Step 2: Create app build.gradle.kts**

```kotlin
// code-dictionary/app/build.gradle.kts
plugins {
    alias(libs.plugins.kotlin.spring)
    alias(libs.plugins.kotlin.jpa)
    alias(libs.plugins.kotlin.kapt)
    alias(libs.plugins.spring.boot)
}

dependencies {
    implementation(project(":code-dictionary:domain"))
    implementation(project(":common"))
    implementation(libs.spring.boot.starter.web)
    implementation(libs.spring.boot.starter.data.jpa)
    implementation(libs.spring.boot.starter.validation)
    implementation(libs.spring.boot.starter.actuator)
    implementation(libs.spring.cloud.eureka.client)
    implementation(libs.querydsl.jpa) { artifact { classifier = "jakarta" } }
    kapt(libs.querydsl.apt) { artifact { classifier = "jakarta" } }
    implementation(libs.springdoc.openapi.starter.webmvc.ui)
    runtimeOnly(libs.mysql.connector)
    runtimeOnly("org.flywaydb:flyway-mysql")
    implementation("org.opensearch.client:opensearch-java:2.19.0")
    implementation("org.opensearch.client:opensearch-rest-client:2.19.0")
    testImplementation(libs.spring.boot.starter.test)
    testImplementation(libs.kotest.extensions.spring)
}

tasks.bootJar {
    archiveBaseName.set("code-dictionary")
}

kotlin.sourceSets.main { kotlin.srcDir("build/generated/source/kapt/main") }
```

- [ ] **Step 3: Add modules to settings.gradle.kts**

Add `"code-dictionary:domain"` and `"code-dictionary:app"` to the `include()` block.

- [ ] **Step 4: Add build file COPY to Dockerfile**

Add after the existing COPY lines in the builder stage:

```dockerfile
COPY code-dictionary/build.gradle.kts code-dictionary/
COPY code-dictionary/domain/build.gradle.kts code-dictionary/domain/
COPY code-dictionary/app/build.gradle.kts code-dictionary/app/
```

- [ ] **Step 5: Create empty directories**

```bash
mkdir -p code-dictionary/domain/src/main/kotlin/com/kgd/codedictionary
mkdir -p code-dictionary/domain/src/test/kotlin/com/kgd/codedictionary
mkdir -p code-dictionary/app/src/main/kotlin/com/kgd/codedictionary
mkdir -p code-dictionary/app/src/main/resources/db/migration
mkdir -p code-dictionary/app/src/test/kotlin/com/kgd/codedictionary
```

- [ ] **Step 6: Verify Gradle sync**

Run: `./gradlew :code-dictionary:domain:dependencies --no-daemon`
Expected: BUILD SUCCESSFUL

Run: `./gradlew :code-dictionary:app:dependencies --no-daemon`
Expected: BUILD SUCCESSFUL

- [ ] **Step 7: Commit**

```bash
git add code-dictionary/ settings.gradle.kts docker/Dockerfile
git commit -m "feat(code-dictionary): scaffold domain + app Gradle modules"
```

---

## Task 2: Domain Models

**Files:**
- Create: `code-dictionary/domain/src/main/kotlin/com/kgd/codedictionary/domain/concept/model/ConceptLevel.kt`
- Create: `code-dictionary/domain/src/main/kotlin/com/kgd/codedictionary/domain/concept/model/ConceptCategory.kt`
- Create: `code-dictionary/domain/src/main/kotlin/com/kgd/codedictionary/domain/concept/model/Concept.kt`
- Create: `code-dictionary/domain/src/main/kotlin/com/kgd/codedictionary/domain/index/model/CodeLocation.kt`
- Create: `code-dictionary/domain/src/main/kotlin/com/kgd/codedictionary/domain/index/model/ConceptIndex.kt`
- Create: `code-dictionary/domain/src/main/kotlin/com/kgd/codedictionary/domain/concept/exception/ConceptException.kt`
- Create: `code-dictionary/domain/src/test/kotlin/com/kgd/codedictionary/domain/concept/model/ConceptTest.kt`
- Create: `code-dictionary/domain/src/test/kotlin/com/kgd/codedictionary/domain/index/model/ConceptIndexTest.kt`

- [ ] **Step 1: Write ConceptLevel enum**

```kotlin
// domain/src/main/kotlin/com/kgd/codedictionary/domain/concept/model/ConceptLevel.kt
package com.kgd.codedictionary.domain.concept.model

enum class ConceptLevel {
    BEGINNER,
    INTERMEDIATE,
    ADVANCED
}
```

- [ ] **Step 2: Write ConceptCategory enum**

```kotlin
// domain/src/main/kotlin/com/kgd/codedictionary/domain/concept/model/ConceptCategory.kt
package com.kgd.codedictionary.domain.concept.model

enum class ConceptCategory {
    BASICS,
    DATA_STRUCTURE,
    ALGORITHM,
    DESIGN_PATTERN,
    CONCURRENCY,
    DISTRIBUTED_SYSTEM,
    ARCHITECTURE,
    INFRASTRUCTURE,
    DATA,
    SECURITY,
    NETWORK,
    TESTING,
    LANGUAGE_FEATURE
}
```

- [ ] **Step 3: Write Concept test**

```kotlin
// domain/src/test/kotlin/com/kgd/codedictionary/domain/concept/model/ConceptTest.kt
package com.kgd.codedictionary.domain.concept.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.assertions.throwables.shouldThrow

class ConceptTest : BehaviorSpec({
    given("Concept 생성 시") {
        `when`("유효한 정보가 주어지면") {
            then("개념이 정상 생성되어야 한다") {
                val concept = Concept.create(
                    conceptId = "singleton-pattern",
                    name = "싱글톤 패턴",
                    category = ConceptCategory.DESIGN_PATTERN,
                    level = ConceptLevel.BEGINNER,
                    description = "인스턴스가 하나만 생성되는 패턴",
                    synonyms = listOf("singleton", "싱글턴")
                )
                concept.conceptId shouldBe "singleton-pattern"
                concept.name shouldBe "싱글톤 패턴"
                concept.category shouldBe ConceptCategory.DESIGN_PATTERN
                concept.level shouldBe ConceptLevel.BEGINNER
                concept.synonyms shouldContainExactly listOf("singleton", "싱글턴")
            }
        }

        `when`("conceptId가 빈 문자열이면") {
            then("예외가 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Concept.create(
                        conceptId = "",
                        name = "테스트",
                        category = ConceptCategory.BASICS,
                        level = ConceptLevel.BEGINNER,
                        description = "테스트"
                    )
                }
            }
        }

        `when`("name이 빈 문자열이면") {
            then("예외가 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Concept.create(
                        conceptId = "test",
                        name = "",
                        category = ConceptCategory.BASICS,
                        level = ConceptLevel.BEGINNER,
                        description = "테스트"
                    )
                }
            }
        }
    }

    given("Concept 수정 시") {
        val concept = Concept.create(
            conceptId = "singleton-pattern",
            name = "싱글톤 패턴",
            category = ConceptCategory.DESIGN_PATTERN,
            level = ConceptLevel.BEGINNER,
            description = "인스턴스가 하나만 생성되는 패턴",
            synonyms = listOf("singleton")
        )

        `when`("동의어를 추가하면") {
            then("동의어 목록이 갱신되어야 한다") {
                val updated = concept.updateSynonyms(listOf("singleton", "싱글턴", "single instance"))
                updated.synonyms shouldContainExactly listOf("singleton", "싱글턴", "single instance")
            }
        }

        `when`("설명을 변경하면") {
            then("설명이 갱신되어야 한다") {
                val updated = concept.updateDescription("GoF 디자인 패턴 중 하나")
                updated.description shouldBe "GoF 디자인 패턴 중 하나"
            }
        }
    }
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `./gradlew :code-dictionary:domain:test --no-daemon`
Expected: FAIL — `Concept` class not found

- [ ] **Step 5: Write Concept domain model**

```kotlin
// domain/src/main/kotlin/com/kgd/codedictionary/domain/concept/model/Concept.kt
package com.kgd.codedictionary.domain.concept.model

class Concept private constructor(
    val id: Long? = null,
    val conceptId: String,
    val name: String,
    val category: ConceptCategory,
    val level: ConceptLevel,
    val description: String,
    val synonyms: List<String> = emptyList(),
    val relatedConceptIds: List<String> = emptyList()
) {
    fun updateSynonyms(synonyms: List<String>): Concept =
        Concept(id, conceptId, name, category, level, description, synonyms, relatedConceptIds)

    fun updateDescription(description: String): Concept =
        Concept(id, conceptId, name, category, level, description, synonyms, relatedConceptIds)

    fun update(
        name: String? = null,
        category: ConceptCategory? = null,
        level: ConceptLevel? = null,
        description: String? = null,
        synonyms: List<String>? = null,
        relatedConceptIds: List<String>? = null
    ): Concept = Concept(
        id = this.id,
        conceptId = this.conceptId,
        name = name ?: this.name,
        category = category ?: this.category,
        level = level ?: this.level,
        description = description ?: this.description,
        synonyms = synonyms ?: this.synonyms,
        relatedConceptIds = relatedConceptIds ?: this.relatedConceptIds
    )

    companion object {
        fun create(
            conceptId: String,
            name: String,
            category: ConceptCategory,
            level: ConceptLevel,
            description: String,
            synonyms: List<String> = emptyList(),
            relatedConceptIds: List<String> = emptyList()
        ): Concept {
            require(conceptId.isNotBlank()) { "conceptId는 비어있을 수 없습니다" }
            require(name.isNotBlank()) { "name은 비어있을 수 없습니다" }
            return Concept(
                conceptId = conceptId,
                name = name,
                category = category,
                level = level,
                description = description,
                synonyms = synonyms,
                relatedConceptIds = relatedConceptIds
            )
        }

        fun restore(
            id: Long,
            conceptId: String,
            name: String,
            category: ConceptCategory,
            level: ConceptLevel,
            description: String,
            synonyms: List<String> = emptyList(),
            relatedConceptIds: List<String> = emptyList()
        ): Concept = Concept(id, conceptId, name, category, level, description, synonyms, relatedConceptIds)
    }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `./gradlew :code-dictionary:domain:test --no-daemon`
Expected: PASS

- [ ] **Step 7: Write CodeLocation value object**

```kotlin
// domain/src/main/kotlin/com/kgd/codedictionary/domain/index/model/CodeLocation.kt
package com.kgd.codedictionary.domain.index.model

data class CodeLocation(
    val filePath: String,
    val lineStart: Int,
    val lineEnd: Int,
    val gitUrl: String? = null
) {
    init {
        require(filePath.isNotBlank()) { "filePath는 비어있을 수 없습니다" }
        require(lineStart > 0) { "lineStart는 양수여야 합니다" }
        require(lineEnd >= lineStart) { "lineEnd는 lineStart 이상이어야 합니다" }
    }
}
```

- [ ] **Step 8: Write ConceptIndex test**

```kotlin
// domain/src/test/kotlin/com/kgd/codedictionary/domain/index/model/ConceptIndexTest.kt
package com.kgd.codedictionary.domain.index.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.assertions.throwables.shouldThrow

class ConceptIndexTest : BehaviorSpec({
    given("ConceptIndex 생성 시") {
        `when`("유효한 정보가 주어지면") {
            then("색인 항목이 정상 생성되어야 한다") {
                val index = ConceptIndex.create(
                    conceptId = "singleton-pattern",
                    location = CodeLocation(
                        filePath = "product/app/src/main/kotlin/com/kgd/product/config/AppConfig.kt",
                        lineStart = 10,
                        lineEnd = 25,
                        gitUrl = "https://github.com/user/msa/blob/main/product/app/src/.../AppConfig.kt#L10-L25"
                    ),
                    codeSnippet = "object AppConfig { ... }",
                    description = "애플리케이션 설정 싱글톤 객체",
                    gitCommitHash = "abc123"
                )
                index.conceptId shouldBe "singleton-pattern"
                index.location.filePath shouldBe "product/app/src/main/kotlin/com/kgd/product/config/AppConfig.kt"
                index.indexedAt shouldNotBe null
            }
        }

        `when`("conceptId가 빈 문자열이면") {
            then("예외가 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    ConceptIndex.create(
                        conceptId = "",
                        location = CodeLocation("test.kt", 1, 10),
                        codeSnippet = "test",
                        description = "test"
                    )
                }
            }
        }
    }
})
```

- [ ] **Step 9: Run test to verify it fails**

Run: `./gradlew :code-dictionary:domain:test --no-daemon`
Expected: FAIL — `ConceptIndex` class not found

- [ ] **Step 10: Write ConceptIndex domain model**

```kotlin
// domain/src/main/kotlin/com/kgd/codedictionary/domain/index/model/ConceptIndex.kt
package com.kgd.codedictionary.domain.index.model

import java.time.LocalDateTime

class ConceptIndex private constructor(
    val id: Long? = null,
    val conceptId: String,
    val location: CodeLocation,
    val codeSnippet: String?,
    val description: String?,
    val gitCommitHash: String? = null,
    val indexedAt: LocalDateTime
) {
    companion object {
        fun create(
            conceptId: String,
            location: CodeLocation,
            codeSnippet: String? = null,
            description: String? = null,
            gitCommitHash: String? = null
        ): ConceptIndex {
            require(conceptId.isNotBlank()) { "conceptId는 비어있을 수 없습니다" }
            return ConceptIndex(
                conceptId = conceptId,
                location = location,
                codeSnippet = codeSnippet,
                description = description,
                gitCommitHash = gitCommitHash,
                indexedAt = LocalDateTime.now()
            )
        }

        fun restore(
            id: Long,
            conceptId: String,
            location: CodeLocation,
            codeSnippet: String?,
            description: String?,
            gitCommitHash: String?,
            indexedAt: LocalDateTime
        ): ConceptIndex = ConceptIndex(id, conceptId, location, codeSnippet, description, gitCommitHash, indexedAt)
    }
}
```

- [ ] **Step 11: Write domain exceptions**

```kotlin
// domain/src/main/kotlin/com/kgd/codedictionary/domain/concept/exception/ConceptException.kt
package com.kgd.codedictionary.domain.concept.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class ConceptNotFoundException(conceptId: String) :
    BusinessException(ErrorCode.NOT_FOUND, "개념(conceptId=$conceptId)을 찾을 수 없습니다")

class ConceptAlreadyExistsException(conceptId: String) :
    BusinessException(ErrorCode.INVALID_INPUT, "이미 존재하는 개념입니다: $conceptId")

class ConceptIndexNotFoundException(id: Long) :
    BusinessException(ErrorCode.NOT_FOUND, "색인(id=$id)을 찾을 수 없습니다")
```

- [ ] **Step 12: Run all domain tests**

Run: `./gradlew :code-dictionary:domain:test --no-daemon`
Expected: ALL PASS

- [ ] **Step 13: Commit**

```bash
git add code-dictionary/domain/
git commit -m "feat(code-dictionary): add domain models — Concept, ConceptIndex, CodeLocation"
```

---

## Task 3: Flyway Schema + Seed Data

**Files:**
- Create: `code-dictionary/app/src/main/resources/db/migration/V1__init_schema.sql`
- Create: `code-dictionary/app/src/main/resources/db/migration/V2__seed_concepts.sql`

- [ ] **Step 1: Write V1 schema migration**

```sql
-- V1__init_schema.sql
CREATE TABLE concept (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    concept_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    level VARCHAR(20) NOT NULL,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_concept_category (category),
    INDEX idx_concept_level (level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE concept_synonym (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    concept_id BIGINT NOT NULL,
    synonym VARCHAR(200) NOT NULL,
    FOREIGN KEY (concept_id) REFERENCES concept(id) ON DELETE CASCADE,
    INDEX idx_synonym_concept (concept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE concept_relation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    source_concept_id BIGINT NOT NULL,
    target_concept_id BIGINT NOT NULL,
    FOREIGN KEY (source_concept_id) REFERENCES concept(id) ON DELETE CASCADE,
    FOREIGN KEY (target_concept_id) REFERENCES concept(id) ON DELETE CASCADE,
    UNIQUE KEY uk_relation (source_concept_id, target_concept_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE concept_index (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    concept_id BIGINT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    line_start INT NOT NULL,
    line_end INT NOT NULL,
    code_snippet TEXT,
    git_url VARCHAR(1000),
    description TEXT,
    git_commit_hash VARCHAR(40),
    indexed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (concept_id) REFERENCES concept(id) ON DELETE CASCADE,
    INDEX idx_concept_index_concept (concept_id),
    INDEX idx_concept_index_file (file_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Write V2 seed data migration**

범용 IT개념 사전 — 초보~고급 전 레벨. 카테고리별 핵심 개념 시딩. 동의어 포함.

```sql
-- V2__seed_concepts.sql

-- ===== BASICS (기초) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('variable', '변수', 'BASICS', 'BEGINNER', '데이터를 저장하는 메모리 공간의 이름'),
('function', '함수', 'BASICS', 'BEGINNER', '특정 작업을 수행하는 코드 블록'),
('class', '클래스', 'BASICS', 'BEGINNER', '객체를 생성하기 위한 설계도'),
('interface', '인터페이스', 'BASICS', 'BEGINNER', '구현 없이 메서드 시그니처만 정의하는 계약'),
('inheritance', '상속', 'BASICS', 'BEGINNER', '부모 클래스의 속성과 메서드를 자식 클래스가 물려받는 것'),
('polymorphism', '다형성', 'BASICS', 'INTERMEDIATE', '같은 인터페이스로 다른 구현을 호출하는 것'),
('encapsulation', '캡슐화', 'BASICS', 'BEGINNER', '데이터와 메서드를 하나로 묶고 외부 접근을 제한하는 것'),
('abstraction', '추상화', 'BASICS', 'INTERMEDIATE', '복잡한 시스템에서 핵심만 추출하여 단순화하는 것'),
('generic', '제네릭', 'BASICS', 'INTERMEDIATE', '타입을 파라미터로 받아 재사용 가능한 코드를 작성하는 기법'),
('exception-handling', '예외 처리', 'BASICS', 'BEGINNER', '런타임 오류를 감지하고 처리하는 메커니즘'),
('lambda', '람다', 'BASICS', 'INTERMEDIATE', '이름 없는 익명 함수를 간결하게 표현하는 문법'),
('closure', '클로저', 'BASICS', 'INTERMEDIATE', '외부 스코프 변수를 캡처하여 참조하는 함수'),
('recursion', '재귀', 'BASICS', 'INTERMEDIATE', '함수가 자기 자신을 호출하는 기법'),
('enum', '열거형', 'BASICS', 'BEGINNER', '관련된 상수를 그룹화하는 타입'),
('annotation', '어노테이션', 'BASICS', 'INTERMEDIATE', '코드에 메타데이터를 부여하는 표기법'),
('reflection', '리플렉션', 'BASICS', 'ADVANCED', '런타임에 클래스/메서드/필드 정보를 조회하고 조작하는 기능'),
('serialization', '직렬화', 'BASICS', 'INTERMEDIATE', '객체를 바이트 스트림이나 문자열로 변환하는 과정'),
('immutability', '불변성', 'BASICS', 'INTERMEDIATE', '생성 후 상태를 변경할 수 없는 객체의 특성'),
('null-safety', '널 안전성', 'BASICS', 'INTERMEDIATE', '널 참조로 인한 오류를 컴파일 타임에 방지하는 기능'),
('type-inference', '타입 추론', 'BASICS', 'BEGINNER', '컴파일러가 표현식으로부터 타입을 자동으로 결정하는 기능');

-- BASICS 동의어
INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'variable'), 'var'),
((SELECT id FROM concept WHERE concept_id = 'function'), 'method'),
((SELECT id FROM concept WHERE concept_id = 'function'), '메서드'),
((SELECT id FROM concept WHERE concept_id = 'class'), '클래스'),
((SELECT id FROM concept WHERE concept_id = 'interface'), 'interface'),
((SELECT id FROM concept WHERE concept_id = 'inheritance'), 'extends'),
((SELECT id FROM concept WHERE concept_id = 'inheritance'), '상속'),
((SELECT id FROM concept WHERE concept_id = 'polymorphism'), 'overriding'),
((SELECT id FROM concept WHERE concept_id = 'polymorphism'), 'overloading'),
((SELECT id FROM concept WHERE concept_id = 'generic'), 'generics'),
((SELECT id FROM concept WHERE concept_id = 'generic'), '제네릭스'),
((SELECT id FROM concept WHERE concept_id = 'lambda'), 'lambda expression'),
((SELECT id FROM concept WHERE concept_id = 'lambda'), '익명 함수'),
((SELECT id FROM concept WHERE concept_id = 'reflection'), 'reflect'),
((SELECT id FROM concept WHERE concept_id = 'serialization'), 'deserialization'),
((SELECT id FROM concept WHERE concept_id = 'serialization'), '역직렬화'),
((SELECT id FROM concept WHERE concept_id = 'immutability'), 'immutable'),
((SELECT id FROM concept WHERE concept_id = 'immutability'), 'val'),
((SELECT id FROM concept WHERE concept_id = 'null-safety'), 'nullable'),
((SELECT id FROM concept WHERE concept_id = 'null-safety'), 'non-null');

-- ===== DATA_STRUCTURE (자료구조) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('array', '배열', 'DATA_STRUCTURE', 'BEGINNER', '같은 타입의 원소를 연속 메모리에 저장하는 고정 크기 자료구조'),
('linked-list', '연결 리스트', 'DATA_STRUCTURE', 'BEGINNER', '노드가 데이터와 다음 노드 포인터를 가지는 선형 자료구조'),
('stack', '스택', 'DATA_STRUCTURE', 'BEGINNER', 'LIFO(후입선출) 방식의 자료구조'),
('queue', '큐', 'DATA_STRUCTURE', 'BEGINNER', 'FIFO(선입선출) 방식의 자료구조'),
('hash-map', '해시맵', 'DATA_STRUCTURE', 'INTERMEDIATE', '키-값 쌍을 해시 함수로 저장하여 O(1) 조회를 제공하는 자료구조'),
('tree', '트리', 'DATA_STRUCTURE', 'INTERMEDIATE', '계층적 부모-자식 관계를 가지는 비선형 자료구조'),
('binary-tree', '이진 트리', 'DATA_STRUCTURE', 'INTERMEDIATE', '각 노드가 최대 2개의 자식을 가지는 트리'),
('bst', '이진 탐색 트리', 'DATA_STRUCTURE', 'INTERMEDIATE', '왼쪽 자식 < 부모 < 오른쪽 자식 규칙을 따르는 이진 트리'),
('heap', '힙', 'DATA_STRUCTURE', 'INTERMEDIATE', '최대/최소값을 O(1)에 접근 가능한 완전 이진 트리 기반 자료구조'),
('graph', '그래프', 'DATA_STRUCTURE', 'INTERMEDIATE', '노드(정점)와 간선으로 이루어진 비선형 자료구조'),
('trie', '트라이', 'DATA_STRUCTURE', 'ADVANCED', '문자열 검색에 특화된 트리 기반 자료구조'),
('b-tree', 'B-트리', 'DATA_STRUCTURE', 'ADVANCED', '디스크 기반 DB 인덱스에 사용되는 자기 균형 탐색 트리'),
('bloom-filter', '블룸 필터', 'DATA_STRUCTURE', 'ADVANCED', '집합 멤버십을 확률적으로 판단하는 공간 효율적 자료구조'),
('skip-list', '스킵 리스트', 'DATA_STRUCTURE', 'ADVANCED', '다층 연결 리스트로 O(log n) 탐색을 제공하는 자료구조');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'hash-map'), 'HashMap'),
((SELECT id FROM concept WHERE concept_id = 'hash-map'), 'hash table'),
((SELECT id FROM concept WHERE concept_id = 'hash-map'), '해시 테이블'),
((SELECT id FROM concept WHERE concept_id = 'hash-map'), 'dictionary'),
((SELECT id FROM concept WHERE concept_id = 'hash-map'), 'Map'),
((SELECT id FROM concept WHERE concept_id = 'bst'), 'binary search tree'),
((SELECT id FROM concept WHERE concept_id = 'bst'), 'BST'),
((SELECT id FROM concept WHERE concept_id = 'graph'), 'vertex'),
((SELECT id FROM concept WHERE concept_id = 'graph'), 'edge'),
((SELECT id FROM concept WHERE concept_id = 'trie'), 'prefix tree'),
((SELECT id FROM concept WHERE concept_id = 'bloom-filter'), 'Bloom filter');

-- ===== ALGORITHM (알고리즘) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('sorting', '정렬', 'ALGORITHM', 'BEGINNER', '원소를 특정 기준에 따라 순서대로 나열하는 알고리즘'),
('binary-search', '이진 탐색', 'ALGORITHM', 'BEGINNER', '정렬된 배열에서 반씩 나누어 O(log n)으로 탐색하는 알고리즘'),
('bfs', '너비 우선 탐색', 'ALGORITHM', 'INTERMEDIATE', '그래프에서 인접 노드를 먼저 방문하는 탐색 알고리즘'),
('dfs', '깊이 우선 탐색', 'ALGORITHM', 'INTERMEDIATE', '그래프에서 깊이 방향으로 먼저 탐색하는 알고리즘'),
('dynamic-programming', '동적 프로그래밍', 'ALGORITHM', 'INTERMEDIATE', '부분 문제의 결과를 캐싱하여 중복 계산을 피하는 최적화 기법'),
('greedy', '탐욕 알고리즘', 'ALGORITHM', 'INTERMEDIATE', '매 순간 최적의 선택을 하는 알고리즘 설계 기법'),
('divide-and-conquer', '분할 정복', 'ALGORITHM', 'INTERMEDIATE', '문제를 작은 부분으로 나누어 해결한 뒤 합치는 기법'),
('backtracking', '백트래킹', 'ALGORITHM', 'INTERMEDIATE', '해를 찾다가 막히면 되돌아가서 다른 경로를 탐색하는 기법'),
('topological-sort', '위상 정렬', 'ALGORITHM', 'ADVANCED', 'DAG에서 의존성 순서대로 노드를 정렬하는 알고리즘'),
('consistent-hashing', '일관 해싱', 'ALGORITHM', 'ADVANCED', '노드 추가/제거 시 최소한의 키만 재배치하는 해싱 기법');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'bfs'), 'BFS'),
((SELECT id FROM concept WHERE concept_id = 'bfs'), 'breadth first search'),
((SELECT id FROM concept WHERE concept_id = 'dfs'), 'DFS'),
((SELECT id FROM concept WHERE concept_id = 'dfs'), 'depth first search'),
((SELECT id FROM concept WHERE concept_id = 'dynamic-programming'), 'DP'),
((SELECT id FROM concept WHERE concept_id = 'dynamic-programming'), '다이나믹 프로그래밍'),
((SELECT id FROM concept WHERE concept_id = 'dynamic-programming'), 'memoization'),
((SELECT id FROM concept WHERE concept_id = 'consistent-hashing'), 'consistent hash');

-- ===== DESIGN_PATTERN (디자인 패턴) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('singleton-pattern', '싱글톤 패턴', 'DESIGN_PATTERN', 'BEGINNER', '인스턴스가 하나만 생성되도록 보장하는 패턴'),
('factory-pattern', '팩토리 패턴', 'DESIGN_PATTERN', 'BEGINNER', '객체 생성 로직을 별도 팩토리에 위임하는 패턴'),
('abstract-factory', '추상 팩토리', 'DESIGN_PATTERN', 'INTERMEDIATE', '관련 객체군을 생성하는 인터페이스를 제공하는 패턴'),
('builder-pattern', '빌더 패턴', 'DESIGN_PATTERN', 'BEGINNER', '복잡한 객체를 단계적으로 생성하는 패턴'),
('strategy-pattern', '전략 패턴', 'DESIGN_PATTERN', 'INTERMEDIATE', '알고리즘을 캡슐화하여 런타임에 교체 가능하게 하는 패턴'),
('observer-pattern', '옵저버 패턴', 'DESIGN_PATTERN', 'INTERMEDIATE', '상태 변경을 구독자에게 자동 알리는 패턴'),
('decorator-pattern', '데코레이터 패턴', 'DESIGN_PATTERN', 'INTERMEDIATE', '객체에 동적으로 기능을 추가하는 패턴'),
('adapter-pattern', '어댑터 패턴', 'DESIGN_PATTERN', 'INTERMEDIATE', '호환되지 않는 인터페이스를 변환하여 함께 작동하게 하는 패턴'),
('proxy-pattern', '프록시 패턴', 'DESIGN_PATTERN', 'INTERMEDIATE', '다른 객체에 대한 접근을 제어하는 대리 객체 패턴'),
('template-method', '템플릿 메서드', 'DESIGN_PATTERN', 'INTERMEDIATE', '알고리즘 골격을 정의하고 세부 단계를 하위 클래스에 위임하는 패턴'),
('command-pattern', '커맨드 패턴', 'DESIGN_PATTERN', 'INTERMEDIATE', '요청을 객체로 캡슐화하여 실행/취소/큐잉을 가능하게 하는 패턴'),
('chain-of-responsibility', '책임 연쇄', 'DESIGN_PATTERN', 'ADVANCED', '요청을 처리할 수 있는 핸들러 체인을 순회하는 패턴'),
('mediator-pattern', '중재자 패턴', 'DESIGN_PATTERN', 'ADVANCED', '객체 간 직접 통신 대신 중재자를 통해 소통하는 패턴'),
('specification-pattern', '스펙 패턴', 'DESIGN_PATTERN', 'ADVANCED', '비즈니스 규칙을 재사용 가능한 객체로 캡슐화하는 패턴');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'singleton-pattern'), 'singleton'),
((SELECT id FROM concept WHERE concept_id = 'singleton-pattern'), '싱글턴'),
((SELECT id FROM concept WHERE concept_id = 'factory-pattern'), 'factory method'),
((SELECT id FROM concept WHERE concept_id = 'factory-pattern'), '팩토리 메서드'),
((SELECT id FROM concept WHERE concept_id = 'builder-pattern'), 'builder'),
((SELECT id FROM concept WHERE concept_id = 'builder-pattern'), '빌더'),
((SELECT id FROM concept WHERE concept_id = 'strategy-pattern'), 'strategy'),
((SELECT id FROM concept WHERE concept_id = 'observer-pattern'), 'pub-sub'),
((SELECT id FROM concept WHERE concept_id = 'observer-pattern'), 'publish-subscribe'),
((SELECT id FROM concept WHERE concept_id = 'adapter-pattern'), 'adapter'),
((SELECT id FROM concept WHERE concept_id = 'adapter-pattern'), 'wrapper'),
((SELECT id FROM concept WHERE concept_id = 'proxy-pattern'), 'proxy'),
((SELECT id FROM concept WHERE concept_id = 'proxy-pattern'), 'AOP'),
((SELECT id FROM concept WHERE concept_id = 'proxy-pattern'), 'aspect oriented programming');

-- ===== CONCURRENCY (동시성) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('thread', '스레드', 'CONCURRENCY', 'BEGINNER', '프로세스 내에서 독립적으로 실행되는 작업 단위'),
('mutex', '뮤텍스', 'CONCURRENCY', 'INTERMEDIATE', '상호 배제를 보장하는 동기화 기법'),
('semaphore', '세마포어', 'CONCURRENCY', 'INTERMEDIATE', '동시 접근 가능한 스레드 수를 제한하는 동기화 기법'),
('deadlock', '데드락', 'CONCURRENCY', 'INTERMEDIATE', '둘 이상의 프로세스가 서로의 자원을 기다리며 영원히 블록되는 상태'),
('race-condition', '레이스 컨디션', 'CONCURRENCY', 'INTERMEDIATE', '여러 스레드가 공유 자원에 동시 접근하여 결과가 비결정적이 되는 상황'),
('thread-pool', '스레드 풀', 'CONCURRENCY', 'INTERMEDIATE', '미리 생성된 스레드를 재사용하여 작업을 처리하는 기법'),
('atomic-operation', '원자 연산', 'CONCURRENCY', 'INTERMEDIATE', '중간에 인터럽트 되지 않는 단일 연산'),
('coroutine', '코루틴', 'CONCURRENCY', 'INTERMEDIATE', '비선점적 멀티태스킹을 위한 경량 동시성 단위'),
('async-await', 'async/await', 'CONCURRENCY', 'INTERMEDIATE', '비동기 작업을 동기 코드처럼 작성하는 패턴'),
('distributed-lock', '분산락', 'CONCURRENCY', 'ADVANCED', '분산 환경에서 공유 자원에 대한 동시 접근을 제어하는 잠금 메커니즘'),
('optimistic-lock', '낙관적 락', 'CONCURRENCY', 'INTERMEDIATE', '충돌이 적다는 가정 하에 버전 비교로 동시성을 제어하는 기법'),
('pessimistic-lock', '비관적 락', 'CONCURRENCY', 'INTERMEDIATE', '충돌을 예방하기 위해 자원에 미리 잠금을 거는 기법'),
('compare-and-swap', 'CAS', 'CONCURRENCY', 'ADVANCED', '메모리 값을 원자적으로 비교하고 교체하는 락-프리 동시성 기법'),
('reactive-streams', '리액티브 스트림', 'CONCURRENCY', 'ADVANCED', '비동기 데이터 스트림의 논블로킹 백프레셔 처리 표준');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'mutex'), 'mutual exclusion'),
((SELECT id FROM concept WHERE concept_id = 'mutex'), '상호 배제'),
((SELECT id FROM concept WHERE concept_id = 'semaphore'), 'semaphore'),
((SELECT id FROM concept WHERE concept_id = 'deadlock'), 'dead lock'),
((SELECT id FROM concept WHERE concept_id = 'deadlock'), '교착 상태'),
((SELECT id FROM concept WHERE concept_id = 'coroutine'), 'coroutines'),
((SELECT id FROM concept WHERE concept_id = 'coroutine'), 'suspend function'),
((SELECT id FROM concept WHERE concept_id = 'distributed-lock'), 'distributed lock'),
((SELECT id FROM concept WHERE concept_id = 'distributed-lock'), 'redis lock'),
((SELECT id FROM concept WHERE concept_id = 'distributed-lock'), 'redisson lock'),
((SELECT id FROM concept WHERE concept_id = 'optimistic-lock'), 'optimistic locking'),
((SELECT id FROM concept WHERE concept_id = 'optimistic-lock'), '@Version'),
((SELECT id FROM concept WHERE concept_id = 'pessimistic-lock'), 'pessimistic locking'),
((SELECT id FROM concept WHERE concept_id = 'pessimistic-lock'), 'SELECT FOR UPDATE'),
((SELECT id FROM concept WHERE concept_id = 'compare-and-swap'), 'compare and swap'),
((SELECT id FROM concept WHERE concept_id = 'compare-and-swap'), 'AtomicReference'),
((SELECT id FROM concept WHERE concept_id = 'reactive-streams'), 'Reactor'),
((SELECT id FROM concept WHERE concept_id = 'reactive-streams'), 'WebFlux'),
((SELECT id FROM concept WHERE concept_id = 'reactive-streams'), 'Mono'),
((SELECT id FROM concept WHERE concept_id = 'reactive-streams'), 'Flux');

-- ===== DISTRIBUTED_SYSTEM (분산시스템) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('saga-pattern', '사가 패턴', 'DISTRIBUTED_SYSTEM', 'ADVANCED', '분산 트랜잭션을 로컬 트랜잭션 체인으로 대체하고 보상 트랜잭션으로 롤백하는 패턴'),
('cqrs', 'CQRS', 'DISTRIBUTED_SYSTEM', 'ADVANCED', '명령(쓰기)과 조회(읽기) 모델을 분리하는 아키텍처 패턴'),
('event-sourcing', '이벤트 소싱', 'DISTRIBUTED_SYSTEM', 'ADVANCED', '상태 변경을 이벤트 시퀀스로 저장하여 상태를 재구축하는 패턴'),
('circuit-breaker', '서킷 브레이커', 'DISTRIBUTED_SYSTEM', 'INTERMEDIATE', '장애가 전파되지 않도록 호출을 차단하는 장애 격리 패턴'),
('fan-out', '팬아웃', 'DISTRIBUTED_SYSTEM', 'INTERMEDIATE', '하나의 메시지를 여러 수신자에게 동시 전달하는 메시징 패턴'),
('two-phase-commit', '2PC', 'DISTRIBUTED_SYSTEM', 'ADVANCED', '분산 트랜잭션에서 모든 참여자의 동의 후 커밋하는 프로토콜'),
('eventual-consistency', '최종 일관성', 'DISTRIBUTED_SYSTEM', 'INTERMEDIATE', '즉각 일관성 대신 시간이 지나면 일관성이 보장되는 모델'),
('idempotency', '멱등성', 'DISTRIBUTED_SYSTEM', 'INTERMEDIATE', '같은 연산을 여러 번 수행해도 결과가 동일한 성질'),
('leader-election', '리더 선출', 'DISTRIBUTED_SYSTEM', 'ADVANCED', '분산 시스템에서 하나의 노드를 조정자로 선출하는 알고리즘'),
('service-mesh', '서비스 메시', 'DISTRIBUTED_SYSTEM', 'ADVANCED', '서비스 간 통신을 사이드카 프록시로 관리하는 인프라 레이어'),
('outbox-pattern', '아웃박스 패턴', 'DISTRIBUTED_SYSTEM', 'ADVANCED', 'DB 변경과 이벤트 발행의 원자성을 보장하는 패턴'),
('bulkhead-pattern', '벌크헤드 패턴', 'DISTRIBUTED_SYSTEM', 'INTERMEDIATE', '장애가 시스템 전체로 확산되지 않도록 자원을 격리하는 패턴'),
('retry-pattern', '재시도 패턴', 'DISTRIBUTED_SYSTEM', 'BEGINNER', '일시적 장애에 대해 자동으로 요청을 재시도하는 패턴'),
('backpressure', '백프레셔', 'DISTRIBUTED_SYSTEM', 'ADVANCED', '소비자가 처리할 수 있는 속도로 생산자를 제어하는 흐름 제어 메커니즘');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'saga-pattern'), 'saga'),
((SELECT id FROM concept WHERE concept_id = 'saga-pattern'), '사가'),
((SELECT id FROM concept WHERE concept_id = 'saga-pattern'), 'choreography saga'),
((SELECT id FROM concept WHERE concept_id = 'saga-pattern'), 'orchestration saga'),
((SELECT id FROM concept WHERE concept_id = 'cqrs'), 'command query responsibility segregation'),
((SELECT id FROM concept WHERE concept_id = 'cqrs'), '커맨드 쿼리 분리'),
((SELECT id FROM concept WHERE concept_id = 'event-sourcing'), 'event store'),
((SELECT id FROM concept WHERE concept_id = 'circuit-breaker'), 'circuit breaker'),
((SELECT id FROM concept WHERE concept_id = 'circuit-breaker'), 'resilience4j'),
((SELECT id FROM concept WHERE concept_id = 'fan-out'), 'fan out'),
((SELECT id FROM concept WHERE concept_id = 'fan-out'), '팬 아웃'),
((SELECT id FROM concept WHERE concept_id = 'two-phase-commit'), 'two phase commit'),
((SELECT id FROM concept WHERE concept_id = 'two-phase-commit'), '2PC'),
((SELECT id FROM concept WHERE concept_id = 'idempotency'), 'idempotent'),
((SELECT id FROM concept WHERE concept_id = 'idempotency'), '멱등'),
((SELECT id FROM concept WHERE concept_id = 'outbox-pattern'), 'transactional outbox'),
((SELECT id FROM concept WHERE concept_id = 'backpressure'), 'back pressure');

-- ===== ARCHITECTURE (아키텍처) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('clean-architecture', '클린 아키텍처', 'ARCHITECTURE', 'INTERMEDIATE', '의존성이 안쪽(도메인)으로만 향하도록 계층을 분리하는 아키텍처'),
('hexagonal-architecture', '헥사고날 아키텍처', 'ARCHITECTURE', 'INTERMEDIATE', '포트와 어댑터로 외부 의존성을 격리하는 아키텍처'),
('ddd', '도메인 주도 설계', 'ARCHITECTURE', 'ADVANCED', '비즈니스 도메인을 중심으로 소프트웨어를 설계하는 방법론'),
('msa', '마이크로서비스', 'ARCHITECTURE', 'INTERMEDIATE', '서비스를 독립 배포 가능한 작은 단위로 분리하는 아키텍처'),
('monolith', '모놀리스', 'ARCHITECTURE', 'BEGINNER', '모든 기능이 하나의 배포 단위에 포함된 아키텍처'),
('port-adapter', '포트-어댑터', 'ARCHITECTURE', 'INTERMEDIATE', '비즈니스 로직과 외부 시스템 사이에 인터페이스(포트)와 구현(어댑터)을 두는 패턴'),
('aggregate', '애그리거트', 'ARCHITECTURE', 'ADVANCED', 'DDD에서 일관성 경계를 형성하는 엔티티와 값 객체의 군집'),
('bounded-context', '바운디드 컨텍스트', 'ARCHITECTURE', 'ADVANCED', 'DDD에서 특정 도메인 모델이 적용되는 명확한 경계'),
('layered-architecture', '레이어드 아키텍처', 'ARCHITECTURE', 'BEGINNER', '표현-비즈니스-데이터 접근 계층으로 분리하는 전통적 아키텍처'),
('event-driven-architecture', '이벤트 기반 아키텍처', 'ARCHITECTURE', 'INTERMEDIATE', '이벤트 발행/구독으로 서비스 간 느슨한 결합을 구현하는 아키텍처'),
('soa', '서비스 지향 아키텍처', 'ARCHITECTURE', 'INTERMEDIATE', '재사용 가능한 서비스 단위로 시스템을 구성하는 아키텍처'),
('value-object', '값 객체', 'ARCHITECTURE', 'INTERMEDIATE', '식별자 없이 속성 값으로만 동등성이 결정되는 불변 객체');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'clean-architecture'), 'Clean Architecture'),
((SELECT id FROM concept WHERE concept_id = 'clean-architecture'), 'Uncle Bob'),
((SELECT id FROM concept WHERE concept_id = 'hexagonal-architecture'), 'ports and adapters'),
((SELECT id FROM concept WHERE concept_id = 'hexagonal-architecture'), '포트와 어댑터'),
((SELECT id FROM concept WHERE concept_id = 'ddd'), 'Domain Driven Design'),
((SELECT id FROM concept WHERE concept_id = 'ddd'), 'DDD'),
((SELECT id FROM concept WHERE concept_id = 'msa'), 'microservice'),
((SELECT id FROM concept WHERE concept_id = 'msa'), 'MSA'),
((SELECT id FROM concept WHERE concept_id = 'msa'), '마이크로서비스 아키텍처'),
((SELECT id FROM concept WHERE concept_id = 'aggregate'), 'aggregate root'),
((SELECT id FROM concept WHERE concept_id = 'aggregate'), '애그리거트 루트'),
((SELECT id FROM concept WHERE concept_id = 'bounded-context'), 'BC'),
((SELECT id FROM concept WHERE concept_id = 'value-object'), 'VO'),
((SELECT id FROM concept WHERE concept_id = 'event-driven-architecture'), 'EDA');

-- ===== INFRASTRUCTURE (인프라/DevOps) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('container', '컨테이너', 'INFRASTRUCTURE', 'BEGINNER', '애플리케이션과 의존성을 격리된 환경으로 패키징하는 기술'),
('docker', '도커', 'INFRASTRUCTURE', 'BEGINNER', '컨테이너 기반 애플리케이션 패키징/실행 플랫폼'),
('kubernetes', '쿠버네티스', 'INFRASTRUCTURE', 'INTERMEDIATE', '컨테이너 오케스트레이션 플랫폼'),
('ci-cd', 'CI/CD', 'INFRASTRUCTURE', 'BEGINNER', '지속적 통합(CI)과 지속적 배포(CD) 파이프라인'),
('service-discovery', '서비스 디스커버리', 'INFRASTRUCTURE', 'INTERMEDIATE', '서비스 인스턴스의 위치를 동적으로 탐색하는 메커니즘'),
('api-gateway', 'API 게이트웨이', 'INFRASTRUCTURE', 'INTERMEDIATE', '클라이언트 요청을 적절한 서비스로 라우팅하는 단일 진입점'),
('load-balancer', '로드 밸런서', 'INFRASTRUCTURE', 'BEGINNER', '트래픽을 여러 서버에 분산하는 장치/소프트웨어'),
('reverse-proxy', '리버스 프록시', 'INFRASTRUCTURE', 'INTERMEDIATE', '클라이언트 요청을 대신 받아 백엔드 서버로 전달하는 서버'),
('auto-scaler', '오토 스케일러', 'INFRASTRUCTURE', 'INTERMEDIATE', '부하에 따라 자동으로 인스턴스 수를 조절하는 메커니즘'),
('infrastructure-as-code', 'IaC', 'INFRASTRUCTURE', 'INTERMEDIATE', '인프라를 코드로 정의하고 버전 관리하는 방식'),
('blue-green-deployment', '블루-그린 배포', 'INFRASTRUCTURE', 'INTERMEDIATE', '두 환경을 번갈아 사용하여 무중단 배포하는 전략'),
('canary-deployment', '카나리 배포', 'INFRASTRUCTURE', 'INTERMEDIATE', '일부 트래픽만 새 버전으로 보내어 점진적으로 배포하는 전략'),
('health-check', '헬스 체크', 'INFRASTRUCTURE', 'BEGINNER', '서비스 정상 동작 여부를 주기적으로 확인하는 메커니즘');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'docker'), 'Docker'),
((SELECT id FROM concept WHERE concept_id = 'docker'), 'docker-compose'),
((SELECT id FROM concept WHERE concept_id = 'docker'), 'Dockerfile'),
((SELECT id FROM concept WHERE concept_id = 'kubernetes'), 'k8s'),
((SELECT id FROM concept WHERE concept_id = 'kubernetes'), 'K8s'),
((SELECT id FROM concept WHERE concept_id = 'ci-cd'), 'continuous integration'),
((SELECT id FROM concept WHERE concept_id = 'ci-cd'), 'continuous deployment'),
((SELECT id FROM concept WHERE concept_id = 'ci-cd'), 'GitHub Actions'),
((SELECT id FROM concept WHERE concept_id = 'ci-cd'), 'Jenkins'),
((SELECT id FROM concept WHERE concept_id = 'service-discovery'), 'Eureka'),
((SELECT id FROM concept WHERE concept_id = 'service-discovery'), 'Consul'),
((SELECT id FROM concept WHERE concept_id = 'api-gateway'), 'Spring Cloud Gateway'),
((SELECT id FROM concept WHERE concept_id = 'api-gateway'), 'gateway'),
((SELECT id FROM concept WHERE concept_id = 'load-balancer'), 'LB'),
((SELECT id FROM concept WHERE concept_id = 'load-balancer'), 'round robin'),
((SELECT id FROM concept WHERE concept_id = 'infrastructure-as-code'), 'Terraform'),
((SELECT id FROM concept WHERE concept_id = 'infrastructure-as-code'), 'Infrastructure as Code');

-- ===== DATA (데이터) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('inverse-index', '역인덱싱', 'DATA', 'INTERMEDIATE', '단어→문서 매핑으로 전문 검색을 가능하게 하는 인덱스 구조'),
('sharding', '샤딩', 'DATA', 'ADVANCED', '데이터를 여러 DB 인스턴스에 수평 분할하여 저장하는 기법'),
('replication', '레플리케이션', 'DATA', 'INTERMEDIATE', '데이터를 복제하여 가용성과 읽기 성능을 높이는 기법'),
('cap-theorem', 'CAP 정리', 'DATA', 'ADVANCED', '분산 시스템에서 일관성/가용성/분할내성 중 2개만 보장 가능하다는 정리'),
('acid', 'ACID', 'DATA', 'INTERMEDIATE', '트랜잭션의 원자성/일관성/격리성/지속성 보장'),
('base', 'BASE', 'DATA', 'ADVANCED', 'NoSQL에서의 Basically Available, Soft state, Eventually consistent 모델'),
('connection-pool', '커넥션 풀', 'DATA', 'INTERMEDIATE', 'DB 연결을 미리 생성해두고 재사용하는 기법'),
('orm', 'ORM', 'DATA', 'BEGINNER', '객체와 관계형 DB 테이블을 매핑하는 기술'),
('n-plus-one', 'N+1 문제', 'DATA', 'INTERMEDIATE', 'ORM에서 연관 엔티티 조회 시 쿼리가 N+1번 실행되는 성능 문제'),
('bulk-indexing', '벌크 인덱싱', 'DATA', 'INTERMEDIATE', '대량 데이터를 한 번에 색인하는 기법'),
('alias-swap', '별칭 스왑', 'DATA', 'INTERMEDIATE', 'ES에서 새 인덱스를 미리 빌드하고 별칭을 전환하여 무중단 재색인하는 기법'),
('caching', '캐싱', 'DATA', 'BEGINNER', '자주 사용하는 데이터를 빠른 저장소에 임시 보관하는 기법'),
('write-ahead-log', 'WAL', 'DATA', 'ADVANCED', '변경 사항을 먼저 로그에 기록한 뒤 실제 데이터를 변경하는 복구 기법');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'inverse-index'), 'inverted index'),
((SELECT id FROM concept WHERE concept_id = 'inverse-index'), '역색인'),
((SELECT id FROM concept WHERE concept_id = 'sharding'), 'shard'),
((SELECT id FROM concept WHERE concept_id = 'sharding'), '샤드'),
((SELECT id FROM concept WHERE concept_id = 'sharding'), 'horizontal partitioning'),
((SELECT id FROM concept WHERE concept_id = 'replication'), 'replica'),
((SELECT id FROM concept WHERE concept_id = 'replication'), 'master-slave'),
((SELECT id FROM concept WHERE concept_id = 'replication'), '복제'),
((SELECT id FROM concept WHERE concept_id = 'acid'), 'atomicity'),
((SELECT id FROM concept WHERE concept_id = 'acid'), 'transaction'),
((SELECT id FROM concept WHERE concept_id = 'acid'), '트랜잭션'),
((SELECT id FROM concept WHERE concept_id = 'orm'), 'JPA'),
((SELECT id FROM concept WHERE concept_id = 'orm'), 'Hibernate'),
((SELECT id FROM concept WHERE concept_id = 'orm'), 'object relational mapping'),
((SELECT id FROM concept WHERE concept_id = 'n-plus-one'), 'N+1 query'),
((SELECT id FROM concept WHERE concept_id = 'n-plus-one'), 'lazy loading'),
((SELECT id FROM concept WHERE concept_id = 'n-plus-one'), 'fetch join'),
((SELECT id FROM concept WHERE concept_id = 'caching'), 'cache'),
((SELECT id FROM concept WHERE concept_id = 'caching'), 'Redis'),
((SELECT id FROM concept WHERE concept_id = 'caching'), 'Memcached'),
((SELECT id FROM concept WHERE concept_id = 'write-ahead-log'), 'write ahead log'),
((SELECT id FROM concept WHERE concept_id = 'write-ahead-log'), 'redo log');

-- ===== SECURITY (보안) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('xss', 'XSS', 'SECURITY', 'INTERMEDIATE', '웹 페이지에 악성 스크립트를 삽입하는 공격'),
('csrf', 'CSRF', 'SECURITY', 'INTERMEDIATE', '인증된 사용자의 브라우저를 이용하여 의도하지 않은 요청을 보내는 공격'),
('sql-injection', 'SQL 인젝션', 'SECURITY', 'BEGINNER', '악의적인 SQL을 입력값에 삽입하여 DB를 조작하는 공격'),
('oauth', 'OAuth', 'SECURITY', 'INTERMEDIATE', '제3자 앱에 제한된 접근 권한을 부여하는 인가 프레임워크'),
('jwt', 'JWT', 'SECURITY', 'INTERMEDIATE', '자체 검증 가능한 JSON 기반 토큰으로 상태 없는 인증을 구현하는 표준'),
('cors', 'CORS', 'SECURITY', 'BEGINNER', '다른 출처의 리소스 접근을 제어하는 브라우저 보안 정책'),
('hashing', '해싱', 'SECURITY', 'INTERMEDIATE', '데이터를 고정 길이 해시값으로 변환하는 단방향 함수'),
('encryption', '암호화', 'SECURITY', 'INTERMEDIATE', '데이터를 키를 사용하여 읽을 수 없는 형태로 변환하는 기법'),
('rate-limiting', '레이트 리미팅', 'SECURITY', 'INTERMEDIATE', '일정 시간 내 요청 수를 제한하여 서비스를 보호하는 기법'),
('rbac', 'RBAC', 'SECURITY', 'INTERMEDIATE', '역할 기반으로 리소스 접근 권한을 제어하는 모델');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'xss'), 'cross site scripting'),
((SELECT id FROM concept WHERE concept_id = 'csrf'), 'cross site request forgery'),
((SELECT id FROM concept WHERE concept_id = 'sql-injection'), 'SQL injection'),
((SELECT id FROM concept WHERE concept_id = 'sql-injection'), 'prepared statement'),
((SELECT id FROM concept WHERE concept_id = 'oauth'), 'OAuth2'),
((SELECT id FROM concept WHERE concept_id = 'oauth'), 'OAuth 2.0'),
((SELECT id FROM concept WHERE concept_id = 'jwt'), 'JSON Web Token'),
((SELECT id FROM concept WHERE concept_id = 'jwt'), 'access token'),
((SELECT id FROM concept WHERE concept_id = 'jwt'), 'refresh token'),
((SELECT id FROM concept WHERE concept_id = 'cors'), 'cross origin resource sharing'),
((SELECT id FROM concept WHERE concept_id = 'hashing'), 'bcrypt'),
((SELECT id FROM concept WHERE concept_id = 'hashing'), 'SHA-256'),
((SELECT id FROM concept WHERE concept_id = 'encryption'), 'AES'),
((SELECT id FROM concept WHERE concept_id = 'encryption'), 'RSA'),
((SELECT id FROM concept WHERE concept_id = 'rate-limiting'), 'rate limit'),
((SELECT id FROM concept WHERE concept_id = 'rate-limiting'), 'throttling'),
((SELECT id FROM concept WHERE concept_id = 'rbac'), 'role based access control');

-- ===== NETWORK (네트워크) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('tcp', 'TCP', 'NETWORK', 'BEGINNER', '신뢰성 있는 연결 기반 전송 프로토콜'),
('udp', 'UDP', 'NETWORK', 'BEGINNER', '비연결형 경량 전송 프로토콜'),
('http', 'HTTP', 'NETWORK', 'BEGINNER', '웹에서 리소스를 전송하는 애플리케이션 계층 프로토콜'),
('grpc', 'gRPC', 'NETWORK', 'INTERMEDIATE', 'Protocol Buffers 기반의 고성능 RPC 프레임워크'),
('websocket', 'WebSocket', 'NETWORK', 'INTERMEDIATE', '서버-클라이언트 간 양방향 실시간 통신 프로토콜'),
('rest', 'REST', 'NETWORK', 'BEGINNER', 'HTTP 기반의 리소스 중심 API 설계 아키텍처 스타일'),
('graphql', 'GraphQL', 'NETWORK', 'INTERMEDIATE', '클라이언트가 필요한 데이터 구조를 직접 지정하는 쿼리 언어'),
('dns', 'DNS', 'NETWORK', 'BEGINNER', '도메인 이름을 IP 주소로 변환하는 시스템'),
('ssl-tls', 'SSL/TLS', 'NETWORK', 'INTERMEDIATE', '네트워크 통신을 암호화하는 보안 프로토콜'),
('sse', 'SSE', 'NETWORK', 'INTERMEDIATE', '서버에서 클라이언트로 단방향 실시간 데이터를 전송하는 기술');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'http'), 'HTTPS'),
((SELECT id FROM concept WHERE concept_id = 'http'), 'HTTP/2'),
((SELECT id FROM concept WHERE concept_id = 'http'), 'HTTP/3'),
((SELECT id FROM concept WHERE concept_id = 'grpc'), 'protobuf'),
((SELECT id FROM concept WHERE concept_id = 'grpc'), 'Protocol Buffers'),
((SELECT id FROM concept WHERE concept_id = 'rest'), 'RESTful'),
((SELECT id FROM concept WHERE concept_id = 'rest'), 'REST API'),
((SELECT id FROM concept WHERE concept_id = 'ssl-tls'), 'SSL'),
((SELECT id FROM concept WHERE concept_id = 'ssl-tls'), 'TLS'),
((SELECT id FROM concept WHERE concept_id = 'ssl-tls'), 'HTTPS'),
((SELECT id FROM concept WHERE concept_id = 'sse'), 'Server-Sent Events'),
((SELECT id FROM concept WHERE concept_id = 'sse'), 'EventSource');

-- ===== TESTING (테스팅) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('unit-test', '단위 테스트', 'TESTING', 'BEGINNER', '개별 함수/클래스를 격리하여 검증하는 테스트'),
('integration-test', '통합 테스트', 'TESTING', 'INTERMEDIATE', '여러 컴포넌트가 함께 작동하는지 검증하는 테스트'),
('e2e-test', 'E2E 테스트', 'TESTING', 'INTERMEDIATE', '사용자 시나리오 전체를 시뮬레이션하는 테스트'),
('mock', '목', 'TESTING', 'BEGINNER', '실제 객체를 모방하여 동작을 검증하는 테스트 더블'),
('stub', '스텁', 'TESTING', 'INTERMEDIATE', '미리 준비된 응답을 반환하는 테스트 더블'),
('tdd', 'TDD', 'TESTING', 'INTERMEDIATE', '테스트를 먼저 작성하고 구현하는 개발 방법론'),
('bdd', 'BDD', 'TESTING', 'INTERMEDIATE', '행동 명세를 기반으로 테스트를 작성하는 개발 방법론'),
('fixture', '픽스처', 'TESTING', 'INTERMEDIATE', '테스트에 필요한 사전 조건/데이터를 준비하는 것'),
('test-coverage', '테스트 커버리지', 'TESTING', 'BEGINNER', '코드 중 테스트로 검증된 비율');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'unit-test'), 'unit testing'),
((SELECT id FROM concept WHERE concept_id = 'mock'), 'mocking'),
((SELECT id FROM concept WHERE concept_id = 'mock'), 'MockK'),
((SELECT id FROM concept WHERE concept_id = 'mock'), 'Mockito'),
((SELECT id FROM concept WHERE concept_id = 'tdd'), 'test driven development'),
((SELECT id FROM concept WHERE concept_id = 'tdd'), '테스트 주도 개발'),
((SELECT id FROM concept WHERE concept_id = 'bdd'), 'behavior driven development'),
((SELECT id FROM concept WHERE concept_id = 'bdd'), 'BehaviorSpec'),
((SELECT id FROM concept WHERE concept_id = 'bdd'), 'given-when-then');

-- ===== LANGUAGE_FEATURE (언어 특성) =====
INSERT INTO concept (concept_id, name, category, level, description) VALUES
('extension-function', '확장 함수', 'LANGUAGE_FEATURE', 'INTERMEDIATE', '기존 클래스에 새 함수를 추가하는 Kotlin 기능'),
('data-class', '데이터 클래스', 'LANGUAGE_FEATURE', 'BEGINNER', '데이터 보관 목적으로 equals/hashCode/toString을 자동 생성하는 클래스'),
('sealed-class', '봉인 클래스', 'LANGUAGE_FEATURE', 'INTERMEDIATE', '상속 가능한 타입을 제한하여 when 절 완전성을 보장하는 클래스'),
('companion-object', '동반 객체', 'LANGUAGE_FEATURE', 'INTERMEDIATE', '클래스에 속하는 정적 메서드/필드 역할의 싱글톤 객체'),
('delegation', '위임', 'LANGUAGE_FEATURE', 'INTERMEDIATE', '인터페이스 구현을 다른 객체에 위임하는 패턴 (by 키워드)'),
('scope-function', '스코프 함수', 'LANGUAGE_FEATURE', 'BEGINNER', 'let, run, with, apply, also 등 객체 컨텍스트에서 코드를 실행하는 함수'),
('dsl', 'DSL', 'LANGUAGE_FEATURE', 'ADVANCED', '특정 도메인에 특화된 미니 언어를 코드 내에서 구축하는 기법'),
('type-alias', '타입 별칭', 'LANGUAGE_FEATURE', 'BEGINNER', '기존 타입에 새 이름을 부여하여 가독성을 높이는 기능');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'extension-function'), 'extension'),
((SELECT id FROM concept WHERE concept_id = 'data-class'), 'data class'),
((SELECT id FROM concept WHERE concept_id = 'sealed-class'), 'sealed class'),
((SELECT id FROM concept WHERE concept_id = 'sealed-class'), 'sealed interface'),
((SELECT id FROM concept WHERE concept_id = 'companion-object'), 'companion object'),
((SELECT id FROM concept WHERE concept_id = 'companion-object'), 'static'),
((SELECT id FROM concept WHERE concept_id = 'scope-function'), 'let'),
((SELECT id FROM concept WHERE concept_id = 'scope-function'), 'apply'),
((SELECT id FROM concept WHERE concept_id = 'scope-function'), 'also'),
((SELECT id FROM concept WHERE concept_id = 'dsl'), 'domain specific language'),
((SELECT id FROM concept WHERE concept_id = 'dsl'), 'type-safe builder');
```

- [ ] **Step 3: Commit**

```bash
git add code-dictionary/app/src/main/resources/db/migration/
git commit -m "feat(code-dictionary): add Flyway schema + seed 120+ IT concepts with synonyms"
```

---

## Task 4: Docker Infrastructure

**Files:**
- Create: `docker/mysql/code-dictionary-master/my.cnf`
- Create: `docker/mysql/code-dictionary-master/init/01-init.sh`
- Create: `docker/mysql/code-dictionary-replica/my.cnf`
- Modify: `docker/docker-compose.infra.yml`
- Modify: `docker/docker-compose.yml`

- [ ] **Step 1: Create MySQL master my.cnf**

```ini
# docker/mysql/code-dictionary-master/my.cnf
[mysqld]
server-id                   = 7
log-bin                     = mysql-bin
binlog-format               = ROW
binlog-do-db                = code_dictionary_db
binlog-expire-logs-seconds  = 604800

gtid-mode                   = ON
enforce-gtid-consistency    = ON

max-connections             = 300
innodb-buffer-pool-size     = 256M
innodb-redo-log-capacity    = 134217728
innodb-flush-log-at-trx-commit = 1
sync-binlog                 = 1

character-set-server        = utf8mb4
collation-server            = utf8mb4_unicode_ci
```

- [ ] **Step 2: Create MySQL init script**

```bash
#!/bin/bash
# docker/mysql/code-dictionary-master/init/01-init.sh
set -e

mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" << EOF
CREATE USER IF NOT EXISTS 'replicator'@'%' IDENTIFIED BY '${REPLICATION_PASSWORD}';
GRANT REPLICATION SLAVE ON *.* TO 'replicator'@'%';
FLUSH PRIVILEGES;
ALTER DATABASE code_dictionary_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EOF
```

- [ ] **Step 3: Create MySQL replica my.cnf**

```ini
# docker/mysql/code-dictionary-replica/my.cnf
[mysqld]
server-id                   = 8
relay-log                   = relay-bin
read-only                   = ON

gtid-mode                   = ON
enforce-gtid-consistency    = ON

max-connections             = 300
innodb-buffer-pool-size     = 256M

character-set-server        = utf8mb4
collation-server            = utf8mb4_unicode_ci
```

- [ ] **Step 4: Add MySQL containers to docker-compose.infra.yml**

Add after the existing MySQL replica definitions:

```yaml
  mysql-code-dictionary-master:
    image: mysql:${MYSQL_VERSION:-8.0}
    container_name: mysql-code-dictionary-master
    ports:
      - "3338:3306"
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: code_dictionary_db
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - mysql-code-dictionary-master-data:/var/lib/mysql
      - ./mysql/code-dictionary-master/my.cnf:/etc/mysql/conf.d/commerce.cnf:ro
      - ./mysql/code-dictionary-master/init:/docker-entrypoint-initdb.d:ro
    networks:
      commerce-network:
        ipv4_address: 172.20.1.40
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h localhost -uroot -p$$MYSQL_ROOT_PASSWORD --silent"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
    restart: unless-stopped

  mysql-code-dictionary-replica:
    image: mysql:${MYSQL_VERSION:-8.0}
    container_name: mysql-code-dictionary-replica
    ports:
      - "3339:3306"
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: code_dictionary_db
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - mysql-code-dictionary-replica-data:/var/lib/mysql
      - ./mysql/code-dictionary-replica/my.cnf:/etc/mysql/conf.d/commerce.cnf:ro
    depends_on:
      mysql-code-dictionary-master:
        condition: service_healthy
    networks:
      commerce-network:
        ipv4_address: 172.20.1.41
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h localhost -uroot -p$$MYSQL_ROOT_PASSWORD --silent"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
    restart: unless-stopped
```

Add OpenSearch container:

```yaml
  opensearch:
    image: opensearchproject/opensearch:2.19.1
    container_name: opensearch
    ports:
      - "9210:9200"
      - "9310:9300"
    environment:
      - discovery.type=single-node
      - DISABLE_SECURITY_PLUGIN=true
      - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
      - cluster.name=code-dictionary-cluster
      - node.name=code-dictionary-node-1
      - plugins.query.datasources.encryption.masterkey=0000000000000000
    volumes:
      - opensearch-data:/usr/share/opensearch/data
    networks:
      commerce-network:
        ipv4_address: 172.20.3.10
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:9200/_cluster/health | grep -qE '\"status\":\"(green|yellow)\"'"]
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 60s
    restart: unless-stopped
```

Add volumes to the volumes section:

```yaml
  mysql-code-dictionary-master-data:
  mysql-code-dictionary-replica-data:
  opensearch-data:
```

- [ ] **Step 5: Add code-dictionary service to docker-compose.yml**

```yaml
  code-dictionary:
    build:
      context: ..
      dockerfile: docker/Dockerfile
      args:
        MODULE_GRADLE: code-dictionary:app
        MODULE_PATH: code-dictionary/app
    image: commerce/code-dictionary:latest
    container_name: code-dictionary
    ports:
      - "8089:8080"
    environment:
      SPRING_PROFILES_ACTIVE: ${SPRING_PROFILES_ACTIVE:-docker}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
      OPENSEARCH_HOST: opensearch
      OPENSEARCH_PORT: 9200
    depends_on:
      discovery:
        condition: service_healthy
      mysql-code-dictionary-master:
        condition: service_healthy
      opensearch:
        condition: service_healthy
    networks:
      commerce-network:
        ipv4_address: 172.20.0.80
    restart: unless-stopped
```

- [ ] **Step 6: Commit**

```bash
git add docker/
git commit -m "feat(code-dictionary): add MySQL master/replica + OpenSearch Docker infrastructure"
```

---

## Task 5: Application Configuration + Spring Boot Main

**Files:**
- Create: `code-dictionary/app/src/main/resources/application.yml`
- Create: `code-dictionary/app/src/main/resources/application-docker.yml`
- Create: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/CodeDictionaryApplication.kt`
- Create: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/infrastructure/config/DataSourceConfig.kt`
- Create: `code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/infrastructure/config/OpenApiConfig.kt`

- [ ] **Step 1: Write application.yml**

```yaml
spring:
  application:
    name: code-dictionary-service
  datasource:
    master:
      jdbc-url: jdbc:mysql://localhost:3338/code_dictionary_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
      username: ${MYSQL_USER:code_dictionary_user}
      password: ${MYSQL_PASSWORD:code_dictionary_password}
      driver-class-name: com.mysql.cj.jdbc.Driver
      hikari:
        maximum-pool-size: 10
        minimum-idle: 2
    replica:
      jdbc-url: jdbc:mysql://localhost:3339/code_dictionary_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
      username: ${MYSQL_USER:code_dictionary_user}
      password: ${MYSQL_PASSWORD:code_dictionary_password}
      driver-class-name: com.mysql.cj.jdbc.Driver
      hikari:
        maximum-pool-size: 10
        minimum-idle: 2
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
    properties:
      hibernate:
        dialect: org.hibernate.dialect.MySQLDialect
        format_sql: false
  flyway:
    enabled: true
    locations: classpath:db/migration

server:
  port: 8089

eureka:
  client:
    service-url:
      defaultZone: ${EUREKA_DEFAULT_ZONE:http://localhost:8761/eureka/}
  instance:
    prefer-ip-address: true

opensearch:
  host: ${OPENSEARCH_HOST:localhost}
  port: ${OPENSEARCH_PORT:9210}
  scheme: http
  index-name: concept-index

management:
  endpoints:
    web:
      exposure:
        include: health,info
```

- [ ] **Step 2: Write application-docker.yml**

```yaml
spring:
  datasource:
    master:
      jdbc-url: jdbc:mysql://mysql-code-dictionary-master:3306/code_dictionary_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
    replica:
      jdbc-url: jdbc:mysql://mysql-code-dictionary-master:3306/code_dictionary_db?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
  jpa:
    hibernate:
      ddl-auto: validate

eureka:
  client:
    service-url:
      defaultZone: http://discovery:8080/eureka/

opensearch:
  host: opensearch
  port: 9200
```

- [ ] **Step 3: Write CodeDictionaryApplication.kt**

```kotlin
package com.kgd.codedictionary

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

@SpringBootApplication(scanBasePackages = ["com.kgd.codedictionary", "com.kgd.common"])
class CodeDictionaryApplication

fun main(args: Array<String>) {
    runApplication<CodeDictionaryApplication>(*args)
}
```

- [ ] **Step 4: Write DataSourceConfig.kt**

Follow the existing gifticon pattern for master/replica DataSource configuration. Create `DataSourceConfig` class with `@Configuration` that defines master and replica `DataSource` beans using `@ConfigurationProperties`.

- [ ] **Step 5: Write OpenApiConfig.kt**

```kotlin
package com.kgd.codedictionary.infrastructure.config

import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.info.Info
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class OpenApiConfig {
    @Bean
    fun openAPI(): OpenAPI = OpenAPI()
        .info(
            Info()
                .title("Code Dictionary API")
                .description("IT개념 코드 위치 추적 서비스")
                .version("1.0.0")
        )
}
```

- [ ] **Step 6: Verify application starts**

Run: `./gradlew :code-dictionary:app:bootRun --no-daemon` (with local MySQL running)
Expected: Application starts on port 8089, Flyway runs migrations

- [ ] **Step 7: Commit**

```bash
git add code-dictionary/app/src/main/
git commit -m "feat(code-dictionary): add Spring Boot app config, DataSource, Flyway"
```

---

## Task 6: Application Ports + DTOs

**Files:**
- Create: All port interfaces and DTO classes listed in the File Map (application layer)

- [ ] **Step 1: Write ConceptRepositoryPort**

```kotlin
package com.kgd.codedictionary.application.concept.port

import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface ConceptRepositoryPort {
    fun save(concept: Concept): Concept
    fun findById(id: Long): Concept?
    fun findByConceptId(conceptId: String): Concept?
    fun findAll(pageable: Pageable): Page<Concept>
    fun findByCategory(category: ConceptCategory, pageable: Pageable): Page<Concept>
    fun findByLevel(level: ConceptLevel, pageable: Pageable): Page<Concept>
    fun findAllWithSynonyms(): List<Concept>
    fun delete(id: Long)
    fun existsByConceptId(conceptId: String): Boolean
}
```

- [ ] **Step 2: Write ConceptIndexRepositoryPort**

```kotlin
package com.kgd.codedictionary.application.index.port

import com.kgd.codedictionary.domain.index.model.ConceptIndex
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable

interface ConceptIndexRepositoryPort {
    fun save(conceptIndex: ConceptIndex): ConceptIndex
    fun saveAll(indices: List<ConceptIndex>): List<ConceptIndex>
    fun findById(id: Long): ConceptIndex?
    fun findByConceptId(conceptId: String, pageable: Pageable): Page<ConceptIndex>
    fun findAll(pageable: Pageable): Page<ConceptIndex>
    fun deleteByConceptId(conceptId: String)
    fun deleteByFilePath(filePath: String)
    fun count(): Long
}
```

- [ ] **Step 3: Write ConceptSearchPort**

```kotlin
package com.kgd.codedictionary.application.search.port

data class SearchHit(
    val conceptId: String,
    val conceptName: String,
    val category: String,
    val level: String,
    val filePath: String,
    val lineStart: Int,
    val lineEnd: Int,
    val codeSnippet: String?,
    val gitUrl: String?,
    val description: String?,
    val score: Float
)

data class SearchResponse(
    val hits: List<SearchHit>,
    val totalHits: Long,
    val maxScore: Float?
)

interface ConceptSearchPort {
    fun search(query: String, category: String?, level: String?, from: Int, size: Int): SearchResponse
}
```

- [ ] **Step 4: Write ConceptIndexingPort**

```kotlin
package com.kgd.codedictionary.application.search.port

import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.index.model.ConceptIndex

interface ConceptIndexingPort {
    fun indexConceptIndex(concept: Concept, conceptIndex: ConceptIndex)
    fun bulkIndex(entries: List<Pair<Concept, ConceptIndex>>)
    fun deleteByConceptId(conceptId: String)
    fun createOrUpdateIndex()
    fun updateSynonyms(synonymMap: Map<String, List<String>>)
}
```

- [ ] **Step 5: Write application DTOs**

Create `SearchDtos.kt`, `ConceptDtos.kt`, `IndexDtos.kt` with command/result data classes for each use case.

- [ ] **Step 6: Write use case interfaces**

Create `SearchConceptUseCase`, `ManageConceptUseCase`, `ManageIndexUseCase` interfaces defining execute methods with command/result types.

- [ ] **Step 7: Commit**

```bash
git add code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/
git commit -m "feat(code-dictionary): add application ports, DTOs, use case interfaces"
```

---

## Task 7: Persistence Layer (JPA Entities + Adapters)

**Files:**
- Create: All infrastructure/persistence files listed in the File Map

- [ ] **Step 1: Write ConceptJpaEntity + ConceptSynonymJpaEntity**

Follow gifticon's GifticonJpaEntity pattern: `@Entity`, `toDomain()`, `fromDomain()` companion factory. ConceptSynonymJpaEntity uses `@ManyToOne` + `@OneToMany(cascade=ALL, orphanRemoval=true)` on ConceptJpaEntity.

- [ ] **Step 2: Write ConceptIndexJpaEntity**

Map all concept_index table columns. Include `@ManyToOne` FK to ConceptJpaEntity. Provide `toDomain()` and `fromDomain()` methods using CodeLocation value object.

- [ ] **Step 3: Write JPA repositories**

```kotlin
interface ConceptJpaRepository : JpaRepository<ConceptJpaEntity, Long> {
    fun findByConceptId(conceptId: String): ConceptJpaEntity?
    fun findByCategory(category: String, pageable: Pageable): Page<ConceptJpaEntity>
    fun findByLevel(level: String, pageable: Pageable): Page<ConceptJpaEntity>
    fun existsByConceptId(conceptId: String): Boolean
}

interface ConceptIndexJpaRepository : JpaRepository<ConceptIndexJpaEntity, Long> {
    fun findByConceptEntityConceptId(conceptId: String, pageable: Pageable): Page<ConceptIndexJpaEntity>
    fun deleteByConceptEntityConceptId(conceptId: String)
    fun deleteByFilePath(filePath: String)
}
```

- [ ] **Step 4: Write ConceptRepositoryAdapter**

Follow gifticon's GifticonRepositoryAdapter pattern: implement `ConceptRepositoryPort`, translate between JPA entities and domain models. Handle insert/update in `save()`.

- [ ] **Step 5: Write ConceptIndexRepositoryAdapter**

Same pattern: implement `ConceptIndexRepositoryPort`.

- [ ] **Step 6: Write adapter tests**

Test `ConceptRepositoryAdapter` and `ConceptIndexRepositoryAdapter` with MockK, verifying domain ↔ entity mapping.

- [ ] **Step 7: Compile and run tests**

Run: `./gradlew :code-dictionary:app:test --no-daemon`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/infrastructure/persistence/
git commit -m "feat(code-dictionary): add JPA entities, repositories, and port adapters"
```

---

## Task 8: OpenSearch Infrastructure

**Files:**
- Create: `infrastructure/opensearch/config/OpenSearchConfig.kt`
- Create: `infrastructure/opensearch/adapter/ConceptSearchAdapter.kt`
- Create: `infrastructure/opensearch/adapter/ConceptIndexingAdapter.kt`

- [ ] **Step 1: Write OpenSearchConfig**

```kotlin
package com.kgd.codedictionary.infrastructure.opensearch.config

import org.apache.hc.client5.http.impl.nio.PoolingAsyncClientConnectionManagerBuilder
import org.apache.hc.core5.http.HttpHost
import org.opensearch.client.json.jackson.JacksonJsonpMapper
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class OpenSearchConfig(
    @Value("\${opensearch.host}") private val host: String,
    @Value("\${opensearch.port}") private val port: Int,
    @Value("\${opensearch.scheme}") private val scheme: String
) {
    @Bean
    fun openSearchClient(): OpenSearchClient {
        val httpHost = HttpHost(scheme, host, port)
        val transport = ApacheHttpClient5TransportBuilder
            .builder(httpHost)
            .setMapper(JacksonJsonpMapper())
            .build()
        return OpenSearchClient(transport)
    }
}
```

- [ ] **Step 2: Write ConceptIndexingAdapter**

Implement `ConceptIndexingPort`:
- `createOrUpdateIndex()`: Create OpenSearch index with Nori analyzer, synonym filter, field mappings
- `indexConceptIndex()`: Index a single document
- `bulkIndex()`: Bulk index multiple documents
- `updateSynonyms()`: Close index → update synonym filter → reopen
- `deleteByConceptId()`: Delete by query

- [ ] **Step 3: Write ConceptSearchAdapter**

Implement `ConceptSearchPort`:
- `search()`: Build multi_match query on `concept_name`, `synonyms`, `description`, `code_snippet` fields
- Apply category/level filters as term queries
- Return results sorted by `_score` descending

- [ ] **Step 4: Write integration tests with MockK**

Test ConceptSearchAdapter and ConceptIndexingAdapter with mocked OpenSearchClient.

- [ ] **Step 5: Commit**

```bash
git add code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/infrastructure/opensearch/
git commit -m "feat(code-dictionary): add OpenSearch config, search and indexing adapters"
```

---

## Task 9: Application Services

**Files:**
- Create: `SearchService.kt`, `ConceptService.kt`, `IndexService.kt`, `SyncService.kt`
- Create: Corresponding test files

- [ ] **Step 1: Write SearchService test**

```kotlin
class SearchServiceTest : BehaviorSpec({
    val searchPort = mockk<ConceptSearchPort>()
    val service = SearchService(searchPort)

    given("검색 시") {
        `when`("키워드가 주어지면") {
            then("OpenSearch 결과를 반환해야 한다") {
                every { searchPort.search("싱글톤", null, null, 0, 20) } returns SearchResponse(
                    hits = listOf(/* test hit */),
                    totalHits = 1,
                    maxScore = 5.0f
                )
                val result = service.search(SearchCommand(query = "싱글톤", page = 0, size = 20))
                result.totalHits shouldBe 1
            }
        }
    }
})
```

- [ ] **Step 2: Implement SearchService**

- [ ] **Step 3: Write ConceptService test + implementation**

CRUD operations on concepts via ConceptRepositoryPort. Validate uniqueness on create (existsByConceptId check).

- [ ] **Step 4: Write IndexService test + implementation**

Manage concept_index records via ConceptIndexRepositoryPort.

- [ ] **Step 5: Write SyncService**

```kotlin
@Service
class SyncService(
    private val conceptRepository: ConceptRepositoryPort,
    private val indexRepository: ConceptIndexRepositoryPort,
    private val indexingPort: ConceptIndexingPort,
    private val searchPort: ConceptSearchPort
) {
    fun syncAllToOpenSearch() {
        // 1. Create/update index with current synonym map
        indexingPort.createOrUpdateIndex()

        // 2. Build synonym map from concepts
        val concepts = conceptRepository.findAllWithSynonyms()
        val synonymMap = concepts.associate { it.conceptId to it.synonyms }
        indexingPort.updateSynonyms(synonymMap)

        // 3. Bulk index all concept_index records
        val allIndices = indexRepository.findAll(Pageable.unpaged())
        val entries = allIndices.content.mapNotNull { idx ->
            val concept = conceptRepository.findByConceptId(idx.conceptId)
            concept?.let { it to idx }
        }
        indexingPort.bulkIndex(entries)
    }
}
```

- [ ] **Step 6: Run all tests**

Run: `./gradlew :code-dictionary:app:test --no-daemon`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/application/
git add code-dictionary/app/src/test/
git commit -m "feat(code-dictionary): add search, concept, index, sync services with tests"
```

---

## Task 10: REST Controllers

**Files:**
- Create: `SearchController.kt`, `ConceptController.kt`, `IndexController.kt`
- Create: Presentation DTOs

- [ ] **Step 1: Write SearchController**

```kotlin
@RestController
@RequestMapping("/api/v1/search")
class SearchController(
    private val searchService: SearchService
) {
    @GetMapping
    fun search(
        @RequestParam q: String,
        @RequestParam(required = false) category: String?,
        @RequestParam(required = false) level: String?,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int
    ): ResponseEntity<ApiResponse<SearchResponseDto>> {
        val result = searchService.search(
            SearchCommand(query = q, category = category, level = level, page = page, size = size)
        )
        return ResponseEntity.ok(ApiResponse.success(SearchResponseDto.from(result)))
    }
}
```

- [ ] **Step 2: Write ConceptController**

Standard CRUD: GET list (paginated with category/level filter), GET by id, POST create, PUT update, DELETE.

- [ ] **Step 3: Write IndexController**

```kotlin
@RestController
@RequestMapping("/api/v1/index")
class IndexController(
    private val syncService: SyncService,
    private val indexService: IndexService
) {
    @PostMapping("/sync")
    fun syncToOpenSearch(): ResponseEntity<ApiResponse<String>> {
        syncService.syncAllToOpenSearch()
        return ResponseEntity.ok(ApiResponse.success("동기화 완료"))
    }

    @GetMapping("/status")
    fun getStatus(): ResponseEntity<ApiResponse<IndexStatusDto>> {
        val count = indexService.count()
        return ResponseEntity.ok(ApiResponse.success(IndexStatusDto(totalIndexed = count)))
    }
}
```

- [ ] **Step 4: Write presentation DTOs**

`SearchResponseDto`, `ConceptRequestDto`, `ConceptResponseDto`, `IndexStatusDto`

- [ ] **Step 5: Verify build**

Run: `./gradlew :code-dictionary:app:build --no-daemon`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: Commit**

```bash
git add code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/presentation/
git commit -m "feat(code-dictionary): add REST controllers — search, concept CRUD, index sync"
```

---

## Task 11: React Frontend

**Files:**
- Create: All frontend files listed in the File Map under `code-dictionary/frontend/`

- [ ] **Step 1: Initialize React project**

```bash
cd code-dictionary
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install axios
```

- [ ] **Step 2: Write API client**

```typescript
// src/api/searchApi.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8089',
});

export interface SearchHit {
  conceptId: string;
  conceptName: string;
  category: string;
  level: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  codeSnippet: string | null;
  gitUrl: string | null;
  description: string | null;
  score: number;
}

export interface SearchResponse {
  hits: SearchHit[];
  totalHits: number;
  maxScore: number | null;
}

export const searchConcepts = async (
  query: string,
  category?: string,
  level?: string,
  page = 0,
  size = 20
): Promise<SearchResponse> => {
  const params = new URLSearchParams({ q: query, page: String(page), size: String(size) });
  if (category) params.set('category', category);
  if (level) params.set('level', level);
  const res = await api.get(`/api/v1/search?${params}`);
  return res.data.data;
};
```

- [ ] **Step 3: Write SearchBar component**

Search input + category/level filter dropdowns. Submit triggers search API call.

- [ ] **Step 4: Write SearchResults component**

Render list of hits: concept name, score badge, file path with git link, code snippet preview, line range.

- [ ] **Step 5: Write CodeSnippet component**

Syntax-highlighted code block with line numbers. Git link button.

- [ ] **Step 6: Write SearchPage**

Compose SearchBar + SearchResults. Manage search state (query, results, loading, pagination).

- [ ] **Step 7: Write App.tsx with routing**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SearchPage from './pages/SearchPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SearchPage />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;
```

- [ ] **Step 8: Verify dev server runs**

```bash
cd code-dictionary/frontend
npm run dev
```
Expected: Vite dev server starts, search UI renders

- [ ] **Step 9: Build production**

```bash
npm run build
```
Expected: `dist/` created

- [ ] **Step 10: Commit**

```bash
git add code-dictionary/frontend/
git commit -m "feat(code-dictionary): add React search UI with keyword search + git links"
```

---

## Task 12: Integration Verification

- [ ] **Step 1: Start infrastructure**

```bash
docker compose -f docker/docker-compose.infra.yml up -d mysql-code-dictionary-master opensearch
```

Wait for health checks to pass.

- [ ] **Step 2: Run application locally**

```bash
./gradlew :code-dictionary:app:bootRun --no-daemon
```

Expected: Flyway runs V1 + V2 migrations, app starts on port 8089.

- [ ] **Step 3: Verify seed data via API**

```bash
curl http://localhost:8089/api/v1/concepts?page=0&size=5
```
Expected: Returns paginated concept list with 120+ concepts.

- [ ] **Step 4: Trigger OpenSearch sync**

```bash
curl -X POST http://localhost:8089/api/v1/index/sync
```
Expected: 200 OK, "동기화 완료"

- [ ] **Step 5: Test search**

```bash
curl "http://localhost:8089/api/v1/search?q=싱글톤"
curl "http://localhost:8089/api/v1/search?q=distributed+lock"
curl "http://localhost:8089/api/v1/search?q=saga&category=DISTRIBUTED_SYSTEM"
```
Expected: Returns matching concepts with scores. (Note: concept_index records don't exist yet so hits will be concept-level matches only.)

- [ ] **Step 6: Verify Swagger UI**

Open: `http://localhost:8089/swagger-ui.html`
Expected: All endpoints documented.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat(code-dictionary): complete MVP — search API, concept dictionary, OpenSearch integration"
```
