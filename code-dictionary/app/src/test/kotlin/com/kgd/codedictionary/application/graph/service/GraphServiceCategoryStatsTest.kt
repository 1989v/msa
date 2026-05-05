package com.kgd.codedictionary.application.graph.service

import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.graph.dto.CategoryStatsFilter
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import com.kgd.codedictionary.fixture.ConceptFixture
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldNotContain
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk

/**
 * GraphService.getCategoryStats() 단위 테스트.
 *
 * - test-quality.md §Unit Tests 시나리오 + spec.md §6.8 빈 상태 처리 정책 검증.
 * - Outbound port 는 MockK Mock (test-rules.md `Application 테스트`).
 * - ConceptFixture 활용.
 */
class GraphServiceCategoryStatsTest : BehaviorSpec({

    val conceptRepository = mockk<ConceptRepositoryPort>()
    val indexRepository = mockk<ConceptIndexRepositoryPort>()
    val service = GraphService(conceptRepository, indexRepository)

    beforeEach { clearMocks(conceptRepository, indexRepository) }

    given("Concept 가 0 개일 때") {
        `when`("getCategoryStats(빈 필터) 호출하면") {
            then("categories 는 비어있고 totals 는 모두 0 이어야 한다") {
                every { conceptRepository.findAllList() } returns emptyList()
                every { indexRepository.findAll() } returns emptyList()

                val result = service.getCategoryStats(CategoryStatsFilter())

                result.categories shouldBe emptyList()
                result.totals.totalConcepts shouldBe 0
                result.totals.totalIndexCount shouldBe 0
                result.totals.byLevel shouldBe emptyMap()
                result.totals.byCategory shouldBe emptyMap()
            }
        }
    }

    given("ARCHITECTURE/BEGINNER 카테고리에 5 개 concept 가 있고 각각 indexCount=2") {
        `when`("getCategoryStats(빈 필터) 호출하면") {
            then("카테고리 1 개 + concept 5 개 + totalIndexCount = 합계(10) 가 정확해야 한다") {
                val concepts = (1..5).map {
                    ConceptFixture.create(
                        id = it.toLong(),
                        conceptId = "arch-$it",
                        name = "Arch $it",
                        category = ConceptCategory.ARCHITECTURE,
                        level = ConceptLevel.BEGINNER,
                    )
                }
                val indexes = ConceptFixture.indexesFromMap(
                    concepts.associate { it.conceptId to 2 },
                )
                every { conceptRepository.findAllList() } returns concepts
                every { indexRepository.findAll() } returns indexes

                val result = service.getCategoryStats(CategoryStatsFilter())

                result.categories.size shouldBe 1
                val arch = result.categories.first()
                arch.name shouldBe "ARCHITECTURE"
                arch.totalConcepts shouldBe 5
                arch.totalIndexCount shouldBe 10
                arch.concepts.all { it.indexCount == 2 } shouldBe true

                result.totals.totalConcepts shouldBe 5
                result.totals.totalIndexCount shouldBe 10
                result.totals.byLevel["BEGINNER"] shouldBe 5
                result.totals.byCategory["ARCHITECTURE"] shouldBe 5
            }
        }
    }

    given("ARCHITECTURE/DATABASE/NETWORK 3 카테고리에 분산된 concept 들") {
        val concepts = listOf(
            ConceptFixture.create(id = 1L, conceptId = "arch-1", category = ConceptCategory.ARCHITECTURE),
            ConceptFixture.create(id = 2L, conceptId = "db-1", category = ConceptCategory.DATA),
            ConceptFixture.create(id = 3L, conceptId = "net-1", category = ConceptCategory.NETWORK),
        )
        val indexes = ConceptFixture.indexesFromMap(
            mapOf("arch-1" to 3, "db-1" to 1, "net-1" to 2),
        )

        `when`("filter.categories = {ARCHITECTURE} 로 필터링하면") {
            then("ARCHITECTURE 카테고리만 응답에 포함되어야 한다") {
                every { conceptRepository.findAllList() } returns concepts
                every { indexRepository.findAll() } returns indexes

                val result = service.getCategoryStats(
                    CategoryStatsFilter(categories = setOf("ARCHITECTURE")),
                )

                result.categories.map { it.name } shouldContainExactly listOf("ARCHITECTURE")
                result.categories.first().concepts.map { it.conceptId } shouldContain "arch-1"
                result.totals.byCategory.keys shouldContainExactly setOf("ARCHITECTURE")
            }
        }
    }

    given("ARCHITECTURE 에 indexCount > 0 concept 와 indexCount=0 concept 혼재") {
        val concepts = listOf(
            ConceptFixture.create(id = 1L, conceptId = "with-index", category = ConceptCategory.ARCHITECTURE),
            ConceptFixture.create(id = 2L, conceptId = "zero-index", category = ConceptCategory.ARCHITECTURE),
        )
        val indexes = ConceptFixture.indexesFor("with-index", 3)

        `when`("filter.includeZeroIndex = false 이면") {
            then("indexCount=0 concept 는 응답에서 제외되어야 한다 (Q4)") {
                every { conceptRepository.findAllList() } returns concepts
                every { indexRepository.findAll() } returns indexes

                val result = service.getCategoryStats(
                    CategoryStatsFilter(includeZeroIndex = false),
                )

                val arch = result.categories.first { it.name == "ARCHITECTURE" }
                arch.concepts.map { it.conceptId } shouldContain "with-index"
                arch.concepts.map { it.conceptId } shouldNotContain "zero-index"
                arch.totalConcepts shouldBe 1
                arch.totalIndexCount shouldBe 3
            }
        }
    }

    given("ARCHITECTURE 의 모든 concept 가 indexCount=0") {
        val concepts = listOf(
            ConceptFixture.create(id = 1L, conceptId = "zero-a", category = ConceptCategory.ARCHITECTURE),
            ConceptFixture.create(id = 2L, conceptId = "zero-b", category = ConceptCategory.ARCHITECTURE),
        )

        `when`("filter.includeZeroIndex = false 이면") {
            then("placeholder 1 개를 보존하여 카테고리 자체는 시각화되어야 한다 (Q4)") {
                every { conceptRepository.findAllList() } returns concepts
                every { indexRepository.findAll() } returns emptyList()

                val result = service.getCategoryStats(
                    CategoryStatsFilter(includeZeroIndex = false),
                )

                val arch = result.categories.firstOrNull { it.name == "ARCHITECTURE" }
                arch shouldBe arch // 존재 확인
                arch?.concepts?.size shouldBe 1
                arch?.totalConcepts shouldBe 1
                arch?.totalIndexCount shouldBe 0
            }
        }

        `when`("filter.includeZeroIndex = true 이면") {
            then("indexCount=0 concept 도 모두 응답에 포함되어야 한다") {
                every { conceptRepository.findAllList() } returns concepts
                every { indexRepository.findAll() } returns emptyList()

                val result = service.getCategoryStats(
                    CategoryStatsFilter(includeZeroIndex = true),
                )

                val arch = result.categories.first { it.name == "ARCHITECTURE" }
                arch.concepts.size shouldBe 2
                arch.concepts.map { it.conceptId } shouldContainExactly listOf("zero-a", "zero-b")
                arch.totalIndexCount shouldBe 0
            }
        }
    }

    given("level 분포가 BEGINNER 2 / INTERMEDIATE 3 / ADVANCED 1 인 concept 6 개") {
        val concepts = listOf(
            ConceptFixture.create(id = 1L, conceptId = "b1", level = ConceptLevel.BEGINNER, category = ConceptCategory.BASICS),
            ConceptFixture.create(id = 2L, conceptId = "b2", level = ConceptLevel.BEGINNER, category = ConceptCategory.BASICS),
            ConceptFixture.create(id = 3L, conceptId = "i1", level = ConceptLevel.INTERMEDIATE, category = ConceptCategory.BASICS),
            ConceptFixture.create(id = 4L, conceptId = "i2", level = ConceptLevel.INTERMEDIATE, category = ConceptCategory.BASICS),
            ConceptFixture.create(id = 5L, conceptId = "i3", level = ConceptLevel.INTERMEDIATE, category = ConceptCategory.BASICS),
            ConceptFixture.create(id = 6L, conceptId = "a1", level = ConceptLevel.ADVANCED, category = ConceptCategory.BASICS),
        )
        val indexes = ConceptFixture.indexesFromMap(
            concepts.associate { it.conceptId to 1 },
        )

        `when`("getCategoryStats(includeZeroIndex=true) 호출하면") {
            then("totals.byLevel 합산이 정확해야 한다 (B=2 / I=3 / A=1)") {
                every { conceptRepository.findAllList() } returns concepts
                every { indexRepository.findAll() } returns indexes

                val result = service.getCategoryStats(
                    CategoryStatsFilter(includeZeroIndex = true),
                )

                result.totals.byLevel["BEGINNER"] shouldBe 2
                result.totals.byLevel["INTERMEDIATE"] shouldBe 3
                result.totals.byLevel["ADVANCED"] shouldBe 1
                result.totals.totalConcepts shouldBe 6
                result.totals.totalIndexCount shouldBe 6
            }
        }
    }
})
