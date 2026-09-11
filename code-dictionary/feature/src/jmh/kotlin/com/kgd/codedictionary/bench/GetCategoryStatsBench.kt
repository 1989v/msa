package com.kgd.codedictionary.bench

import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.graph.dto.CategoryStatsFilter
import com.kgd.codedictionary.application.graph.service.GraphService
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import com.kgd.codedictionary.domain.index.model.CodeLocation
import com.kgd.codedictionary.domain.index.model.ConceptIndex
import org.openjdk.jmh.annotations.Benchmark
import org.openjdk.jmh.annotations.BenchmarkMode
import org.openjdk.jmh.annotations.Fork
import org.openjdk.jmh.annotations.Measurement
import org.openjdk.jmh.annotations.Mode
import org.openjdk.jmh.annotations.OutputTimeUnit
import org.openjdk.jmh.annotations.Scope
import org.openjdk.jmh.annotations.Setup
import org.openjdk.jmh.annotations.State
import org.openjdk.jmh.annotations.Warmup
import java.util.concurrent.TimeUnit

/**
 * JMH micro-benchmark for [GraphService.getCategoryStats].
 *
 * - test-quality.md §Performance — Microbench (JMH)
 * - tasks.md T5.1
 *
 * Two scenarios:
 *  1. [benchGetCategoryStatsCold] — fresh GraphService 인스턴스 (캐시 없음, 매 호출 cold path)
 *  2. [benchGetCategoryStatsWarm] — 동일 인스턴스 재사용 (in-process repeat — JIT/branch predictor warm)
 *
 * 실제 `@Cacheable` 캐시 hit 측정은 Spring proxy 가 필요하므로 JMH 단독으로는 시뮬레이션 불가
 * → cache hit/miss 분리 측정은 k6 e2e (T5.2) 또는 별도 SpringBootTest 기반 perf 로 위임.
 *
 * 실행 (수동):
 *   ./gradlew :code-dictionary:app:jmh
 *
 * 결과는 ADR-0025 §3 P99 alerting 룰의 baseline 으로 활용.
 */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
@Warmup(iterations = 5, time = 1, timeUnit = TimeUnit.SECONDS)
@Measurement(iterations = 20, time = 1, timeUnit = TimeUnit.SECONDS)
@Fork(value = 1)
open class GetCategoryStatsBench {

    private lateinit var coldFilter: CategoryStatsFilter
    private lateinit var warmService: GraphService
    private lateinit var concepts: List<Concept>
    private lateinit var indexes: List<ConceptIndex>

    @Setup
    fun setup() {
        // ConceptFixture.large(500) 로직을 production source set 에 의존하지 않고 인라인.
        // (jmh source set 은 test source set 을 보지 못함 — fixture 코드 중복 허용)
        concepts = buildLargeConcepts(count = 500)
        indexes = buildIndexesAveraging5(concepts)
        coldFilter = CategoryStatsFilter(categories = null, includeZeroIndex = false)

        warmService = GraphService(
            conceptRepository = StubConceptRepository(concepts),
            indexRepository = StubIndexRepository(indexes),
        )
    }

    /**
     * Cold path: 매 호출마다 GraphService 신규 인스턴스 + 신규 stub 의 read.
     * Spring proxy (`@Cacheable`) 미적용 — pure 계산 + collection traversal 측정.
     */
    @Benchmark
    fun benchGetCategoryStatsCold(): Int {
        val service = GraphService(
            conceptRepository = StubConceptRepository(concepts),
            indexRepository = StubIndexRepository(indexes),
        )
        return service.getCategoryStats(coldFilter).categories.size
    }

    /**
     * Warm path: 동일 GraphService 인스턴스 재호출. JIT / inlining 효과 측정.
     */
    @Benchmark
    fun benchGetCategoryStatsWarm(): Int = warmService.getCategoryStats(coldFilter).categories.size

    // --- fixture inline (test fixture 와 의도적으로 중복 — JMH source set 격리) ---

    private fun buildLargeConcepts(count: Int): List<Concept> {
        val categories = ConceptCategory.entries
        val levels = listOf(
            ConceptLevel.BEGINNER, ConceptLevel.INTERMEDIATE, ConceptLevel.ADVANCED,
        )
        return (1..count).map { i ->
            val level = when (((i - 1) * 100 / count)) {
                in 0..29 -> levels[0]
                in 30..84 -> levels[1]
                else -> levels[2]
            }
            Concept.restore(
                id = i.toLong(),
                conceptId = "concept-$i",
                name = "Concept $i",
                category = categories[(i - 1) % categories.size],
                level = level,
                description = "auto-generated #$i",
                synonyms = emptyList(),
                relatedConceptIds = emptyList(),
            )
        }
    }

    private fun buildIndexesAveraging5(concepts: List<Concept>): List<ConceptIndex> =
        concepts.flatMap { c ->
            (1..5).map { idx ->
                ConceptIndex.create(
                    conceptId = c.conceptId,
                    location = CodeLocation(
                        filePath = "src/main/kotlin/Sample$idx.kt",
                        lineStart = idx,
                        lineEnd = idx + 1,
                    ),
                    codeSnippet = "fun sample$idx() {}",
                    description = "sample $idx",
                )
            }
        }

    private class StubConceptRepository(private val concepts: List<Concept>) : ConceptRepositoryPort {
        override fun save(concept: Concept): Concept = concept
        override fun findById(id: Long): Concept? = concepts.firstOrNull { it.id == id }
        override fun findByConceptId(conceptId: String): Concept? =
            concepts.firstOrNull { it.conceptId == conceptId }

        override fun findAll(pageable: org.springframework.data.domain.Pageable):
                org.springframework.data.domain.Page<Concept> =
            org.springframework.data.domain.PageImpl(concepts)

        override fun findByCategory(
            category: ConceptCategory,
            pageable: org.springframework.data.domain.Pageable,
        ): org.springframework.data.domain.Page<Concept> =
            org.springframework.data.domain.PageImpl(concepts.filter { it.category == category })

        override fun findByLevel(
            level: ConceptLevel,
            pageable: org.springframework.data.domain.Pageable,
        ): org.springframework.data.domain.Page<Concept> =
            org.springframework.data.domain.PageImpl(concepts.filter { it.level == level })

        override fun findAllWithSynonyms(): List<Concept> = concepts
        override fun delete(id: Long) = Unit
        override fun existsByConceptId(conceptId: String): Boolean =
            concepts.any { it.conceptId == conceptId }

        override fun findAllList(): List<Concept> = concepts
    }

    private class StubIndexRepository(private val indexes: List<ConceptIndex>) : ConceptIndexRepositoryPort {
        override fun save(conceptIndex: ConceptIndex): ConceptIndex = conceptIndex
        override fun saveAll(indices: List<ConceptIndex>): List<ConceptIndex> = indices
        override fun findById(id: Long): ConceptIndex? = null
        override fun findByConceptId(
            conceptId: String,
            pageable: org.springframework.data.domain.Pageable,
        ): org.springframework.data.domain.Page<ConceptIndex> =
            org.springframework.data.domain.PageImpl(indexes.filter { it.conceptId == conceptId })

        override fun findAll(pageable: org.springframework.data.domain.Pageable):
                org.springframework.data.domain.Page<ConceptIndex> =
            org.springframework.data.domain.PageImpl(indexes)

        override fun deleteByConceptId(conceptId: String) = Unit
        override fun deleteByFilePath(filePath: String) = Unit
        override fun count(): Long = indexes.size.toLong()
        override fun findByConceptId(conceptId: String): List<ConceptIndex> =
            indexes.filter { it.conceptId == conceptId }

        override fun findAll(): List<ConceptIndex> = indexes
    }
}
