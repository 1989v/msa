package com.kgd.codedictionary.application.graph.service

import com.kgd.codedictionary.application.concept.port.ConceptEdgeRepositoryPort
import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import com.kgd.codedictionary.domain.concept.model.ConceptEdge
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import com.kgd.codedictionary.fixture.ConceptFixture
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk

/**
 * GraphService.getHierarchy() — 층 계산은 도메인(ConceptHierarchy)이 하고,
 * 여기서는 개념 행이 없는 간선을 응답에서 빼는 것과 DTO 매핑을 본다.
 */
class GraphServiceHierarchyTest : BehaviorSpec({

    val conceptRepository = mockk<ConceptRepositoryPort>()
    val indexRepository = mockk<ConceptIndexRepositoryPort>()
    val edgeRepository = mockk<ConceptEdgeRepositoryPort>()
    val service = GraphService(conceptRepository, indexRepository, edgeRepository)

    beforeEach { clearMocks(conceptRepository, indexRepository, edgeRepository) }

    fun edge(from: String, to: String, kind: ConceptEdgeKind = ConceptEdgeKind.CONTAINS, ordinal: Int = 0) =
        ConceptEdge(fromConceptId = from, toConceptId = to, kind = kind, ordinal = ordinal)

    given("search-system 아래 두 축이 있고 간선 하나는 개념 행이 없는 곳을 가리킨다") {
        val edges = listOf(
            edge("search-system", "search-query", ordinal = 2),
            edge("search-system", "search-ingest", ordinal = 1),
            edge("search-query", "bm25"),
            edge("search-query", "ghost"),
            edge("bm25", "ghost", ConceptEdgeKind.FLOWS_TO),
        )
        val concepts = listOf("search-system", "search-ingest", "search-query", "bm25", "unrelated")
            .mapIndexed { i, id -> ConceptFixture.create(id = i.toLong(), conceptId = id, name = id.uppercase()) }

        `when`("root 없이 조회하면") {
            every { edgeRepository.findAll() } returns edges
            every { conceptRepository.findAllList() } returns concepts
            val result = service.getHierarchy(null)

            then("층 안의 개념만 깊이와 함께 나오고 층 밖 개념은 빠진다") {
                result.roots shouldContainExactly listOf("search-system")
                result.nodes.map { it.id to it.depth }.shouldContainExactlyInAnyOrder(
                    "search-system" to 0, "search-ingest" to 1, "search-query" to 1, "bm25" to 2,
                )
                result.nodes.first { it.id == "bm25" }.name shouldBe "BM25"
            }

            then("개념 행이 없는 노드와 그 간선은 응답에 없다") {
                result.nodes.none { it.id == "ghost" } shouldBe true
                result.edges.none { it.from == "ghost" || it.to == "ghost" } shouldBe true
            }

            then("형제는 ordinal 순서로 나온다") {
                result.edges.filter { it.from == "search-system" }.map { it.to }
                    .shouldContainExactly("search-ingest", "search-query")
            }
        }

        `when`("root 를 search-query 로 주면") {
            every { edgeRepository.findAll() } returns edges
            every { conceptRepository.findAllList() } returns concepts
            val result = service.getHierarchy("search-query")

            then("그 아래만 깊이 0 부터 다시 센다") {
                result.roots shouldContainExactly listOf("search-query")
                result.nodes.map { it.id to it.depth }.shouldContainExactlyInAnyOrder(
                    "search-query" to 0, "bm25" to 1,
                )
            }
        }
    }

    given("간선이 하나도 없을 때") {
        `when`("조회하면") {
            then("빈 계층이다") {
                every { edgeRepository.findAll() } returns emptyList()
                every { conceptRepository.findAllList() } returns emptyList()
                val result = service.getHierarchy(null)
                result.roots shouldBe emptyList()
                result.nodes shouldBe emptyList()
                result.edges shouldBe emptyList()
            }
        }
    }
    given("온톨로지가 적용된 개념과 reason 이 있는 간선") {
        `when`("계층을 조회하면") {
            then("노드에 kind, 간선에 reason·근거가 실린다") {
                every { edgeRepository.findAll() } returns listOf(
                    edge("sys", "fusion"),
                    ConceptEdge(fromConceptId = "fusion", toConceptId = "ndcg", kind = ConceptEdgeKind.MEASURED_BY, reason = "상위 10", evidenceRef = "ADR-0090"),
                    edge("fusion", "ndcg"),
                )
                every { conceptRepository.findAllList() } returns listOf("sys", "fusion", "ndcg").mapIndexed { i, id ->
                    com.kgd.codedictionary.domain.concept.model.Concept.restore(
                        id = i.toLong(), conceptId = id, name = id, category = com.kgd.codedictionary.domain.concept.model.ConceptCategory.BASICS,
                        level = com.kgd.codedictionary.domain.concept.model.ConceptLevel.BEGINNER, description = "d",
                        synonyms = emptyList(), relatedConceptIds = emptyList(),
                        kind = com.kgd.codedictionary.domain.concept.model.ConceptKind.STAGE, managedBy = "search",
                    )
                }
                val result = service.getHierarchy(null)
                result.nodes.first { it.id == "fusion" }.kind shouldBe "STAGE"
                result.edges.single { it.kind == "MEASURED_BY" }.let {
                    it.reason shouldBe "상위 10"
                    it.evidenceRef shouldBe "ADR-0090"
                }
            }
        }
    }
})
