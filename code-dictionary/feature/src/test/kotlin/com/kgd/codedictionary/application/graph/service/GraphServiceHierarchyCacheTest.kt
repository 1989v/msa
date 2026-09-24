package com.kgd.codedictionary.application.graph.service

import com.kgd.codedictionary.application.concept.port.ConceptEdgeRepositoryPort
import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.graph.usecase.ConceptGraphUseCase
import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptEdge
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import com.kgd.codedictionary.domain.concept.model.ConceptKind
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import com.kgd.testsupport.ConceptCacheTestContext
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.verify
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.cache.CacheManager
import org.springframework.test.annotation.DirtiesContext

/**
 * 계층 응답 캐시 — 개념 수천 개 위에서 간선 전량을 매 요청 읽지 않는다.
 * 계층은 온톨로지 적용(배포) 때만 바뀌어, 같은 루트의 두 번째 요청은 저장소를 부르지 않아야 한다.
 */
@SpringBootTest(classes = [ConceptCacheTestContext::class], properties = ["spring.main.web-application-type=none"])
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class GraphServiceHierarchyCacheTest(
    @Autowired private val graphService: ConceptGraphUseCase,
    @Autowired private val conceptRepository: ConceptRepositoryPort,
    @Autowired private val edgeRepository: ConceptEdgeRepositoryPort,
    @Autowired private val cacheManager: CacheManager,
) : BehaviorSpec({

    fun c(id: String) = Concept.restore(
        id = null, conceptId = id, name = id, category = ConceptCategory.BASICS, level = ConceptLevel.BEGINNER,
        description = "", synonyms = emptyList(), relatedConceptIds = emptyList(), kind = ConceptKind.MECHANISM,
    )

    beforeContainer {
        clearMocks(conceptRepository, edgeRepository)
        cacheManager.getCache("conceptHierarchy")?.clear()
        every { edgeRepository.findAll() } returns listOf(ConceptEdge(fromConceptId = "sys", toConceptId = "leaf", kind = ConceptEdgeKind.CONTAINS))
        every { conceptRepository.findAllSummaries() } returns listOf(c("sys"), c("leaf"))
    }

    given("같은 루트로 계층을 두 번 부르면") {
        val first = graphService.getHierarchy("sys")
        val second = graphService.getHierarchy("sys")
        then("두 번째는 캐시에서 나온다 — 간선 · 개념 저장소는 한 번만 읽힌다") {
            second shouldBe first
            verify(exactly = 1) { edgeRepository.findAll() }
            verify(exactly = 1) { conceptRepository.findAllSummaries() }
        }
    }

    given("캐시를 비우면") {
        graphService.getHierarchy("sys")
        cacheManager.getCache("conceptHierarchy")?.clear()
        graphService.getHierarchy("sys")
        then("다시 읽는다 — 온톨로지 적용 뒤 파생물 갱신이 이 캐시를 비운다") {
            verify(exactly = 2) { edgeRepository.findAll() }
        }
    }
}) {
    override fun extensions() = listOf(SpringExtension)
}
