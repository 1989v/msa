package com.kgd.codedictionary.application.concept.service

import com.kgd.codedictionary.application.concept.dto.CreateConceptCommand
import com.kgd.codedictionary.application.concept.dto.UpdateConceptCommand
import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.graph.dto.CategoryStatsFilter
import com.kgd.codedictionary.application.graph.service.GraphService
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import com.kgd.codedictionary.fixture.ConceptFixture
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.SpringBootConfiguration
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.cache.CacheManager
import org.springframework.cache.annotation.EnableCaching
import org.springframework.cache.caffeine.CaffeineCacheManager
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.ComponentScan
import org.springframework.test.annotation.DirtiesContext

/**
 * ConceptService.@CacheEvict 통합 테스트.
 *
 * - 목적: Spring `@CacheEvict` 프록시가 정상 동작하여 CUD 후 `conceptCategoryStats` 캐시가 초기화되는지 검증.
 * - 전략: 최소 Spring context + MockK 로 outbound port 격리.
 *   - `@EnableCaching` + Caffeine `CacheManager` 빈을 직접 등록 (실제 `CacheConfig` import 회피 — JPA/Flyway 차단).
 *   - `@SpringBootTest(classes = ...)` 로 ConceptService / GraphService 만 ComponentScan.
 * - 검증 방법:
 *   1. GraphService 호출 시 캐시 적재 (실제 cache.get)
 *   2. CUD 호출 후 캐시 비어있음 (`cache.get(key)` null)
 *   3. 두 번째 GraphService 호출 시 repository 가 재호출됨
 */
@SpringBootTest(
    classes = [ConceptServiceCacheEvictTest.Ctx::class],
    properties = [
        "spring.main.web-application-type=none",
    ],
)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ConceptServiceCacheEvictTest(
    @Autowired private val conceptService: ConceptService,
    @Autowired private val graphService: GraphService,
    @Autowired private val conceptRepository: ConceptRepositoryPort,
    @Autowired private val indexRepository: ConceptIndexRepositoryPort,
    @Autowired private val cacheManager: CacheManager,
) : BehaviorSpec({

    val cacheName = "conceptCategoryStats"

    fun resetMocks() {
        clearMocks(conceptRepository, indexRepository, answers = false)
        // baseline stub
        every { conceptRepository.findAllList() } returns emptyList()
        every { indexRepository.findAll() } returns emptyList()
        cacheManager.getCache(cacheName)?.clear()
    }

    given("CacheManager 와 ConceptService 가 Spring 으로 묶여 있는 상태") {

        `when`("getCategoryStats 가 한 번 호출되어 캐시가 적재된 후 ConceptService.create() 가 호출되면") {
            then("conceptCategoryStats 캐시가 비어 있어야 한다 (CacheEvict allEntries=true)") {
                resetMocks()
                val filter = CategoryStatsFilter()

                graphService.getCategoryStats(filter)
                cacheManager.getCache(cacheName)?.get(filter).shouldNotBeNull()

                val toCreate = ConceptFixture.create(
                    id = null,
                    conceptId = "new-concept",
                    name = "New Concept",
                    category = ConceptCategory.ARCHITECTURE,
                    level = ConceptLevel.BEGINNER,
                )
                every { conceptRepository.existsByConceptId("new-concept") } returns false
                every { conceptRepository.save(any()) } answers {
                    val arg = firstArg<Concept>()
                    Concept.restore(
                        id = 99L,
                        conceptId = arg.conceptId,
                        name = arg.name,
                        category = arg.category,
                        level = arg.level,
                        description = arg.description,
                        synonyms = arg.synonyms,
                        relatedConceptIds = arg.relatedConceptIds,
                    )
                }

                conceptService.create(
                    CreateConceptCommand(
                        conceptId = toCreate.conceptId,
                        name = toCreate.name,
                        category = toCreate.category,
                        level = toCreate.level,
                        description = toCreate.description,
                        synonyms = toCreate.synonyms,
                    ),
                )

                cacheManager.getCache(cacheName)?.get(filter) shouldBe null
            }
        }

        `when`("캐시가 적재된 후 ConceptService.update() 가 호출되면") {
            then("conceptCategoryStats 캐시가 비어 있어야 한다") {
                resetMocks()
                val filter = CategoryStatsFilter()

                graphService.getCategoryStats(filter)
                cacheManager.getCache(cacheName)?.get(filter).shouldNotBeNull()

                val existing = ConceptFixture.create(
                    id = 10L,
                    conceptId = "existing",
                    name = "Existing",
                )
                every { conceptRepository.findById(10L) } returns existing
                every { conceptRepository.save(any()) } returns existing

                conceptService.update(
                    id = 10L,
                    command = UpdateConceptCommand(name = "Updated"),
                )

                cacheManager.getCache(cacheName)?.get(filter) shouldBe null
            }
        }

        `when`("캐시가 적재된 후 ConceptService.delete() 가 호출되면") {
            then("conceptCategoryStats 캐시가 비어 있어야 한다") {
                resetMocks()
                val filter = CategoryStatsFilter()

                graphService.getCategoryStats(filter)
                cacheManager.getCache(cacheName)?.get(filter).shouldNotBeNull()

                val existing = ConceptFixture.create(
                    id = 11L,
                    conceptId = "to-delete",
                    name = "ToDelete",
                )
                every { conceptRepository.findById(11L) } returns existing
                every { conceptRepository.delete(11L) } returns Unit

                conceptService.delete(11L)

                cacheManager.getCache(cacheName)?.get(filter) shouldBe null
            }
        }

        `when`("캐시 evict 후 다음 getCategoryStats 호출하면") {
            then("repository 가 다시 호출되어 fresh 데이터를 적재해야 한다") {
                resetMocks()
                val filter = CategoryStatsFilter()

                graphService.getCategoryStats(filter) // 1st: cache miss → repo 1회
                graphService.getCategoryStats(filter) // 2nd: cache hit → repo 0회 추가

                // CUD 로 evict
                val existing = ConceptFixture.create(id = 22L, conceptId = "any", name = "Any")
                every { conceptRepository.findById(22L) } returns existing
                every { conceptRepository.delete(22L) } returns Unit
                conceptService.delete(22L)

                graphService.getCategoryStats(filter) // 3rd: cache miss 다시 → repo 1회 추가

                // findAllList 호출 횟수: 1(miss) + 0(hit) + 1(miss after evict) = 2
                verify(exactly = 2) { conceptRepository.findAllList() }
                verify(exactly = 2) { indexRepository.findAll() }
            }
        }
    }
}) {
    override fun extensions() = listOf(SpringExtension)

    /**
     * 최소 Spring context — 실제 production CacheConfig / 자동설정을 import 하지 않고
     * 캐시 + ComponentScan 만 활성화하여 JPA / Flyway / DataSource 부팅을 회피한다.
     *
     * - `ConceptService`, `GraphService` 만 ComponentScan 으로 등록
     * - `ConceptRepositoryPort`, `ConceptIndexRepositoryPort` 는 MockK 로 빈 등록
     */
    @SpringBootConfiguration
    @EnableCaching
    @ComponentScan(
        basePackageClasses = [
            ConceptService::class,
            GraphService::class,
        ],
    )
    open class Ctx {

        @Bean
        open fun cacheManager(): CacheManager =
            CaffeineCacheManager("conceptCategoryStats")

        @Bean
        open fun conceptRepositoryPort(): ConceptRepositoryPort = io.mockk.mockk(relaxed = false)

        @Bean
        open fun conceptIndexRepositoryPort(): ConceptIndexRepositoryPort = io.mockk.mockk(relaxed = false)
    }
}
