package com.kgd.codedictionary.domain.concept

import com.kgd.codedictionary.domain.concept.model.ConceptEdge
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import com.kgd.codedictionary.domain.concept.model.ConceptHierarchy
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.collections.shouldContainExactlyInAnyOrder
import io.kotest.matchers.maps.shouldNotContainKey
import io.kotest.matchers.shouldBe

class ConceptHierarchyTest : BehaviorSpec({

    fun contains(from: String, to: String, ordinal: Int = 0) =
        ConceptEdge(fromConceptId = from, toConceptId = to, kind = ConceptEdgeKind.CONTAINS, ordinal = ordinal)

    fun flows(from: String, to: String) =
        ConceptEdge(fromConceptId = from, toConceptId = to, kind = ConceptEdgeKind.FLOWS_TO)

    given("간선을 만들 때") {
        `when`("양 끝이 같은 개념이면") {
            then("거부한다") {
                shouldThrow<IllegalArgumentException> { contains("bm25", "bm25") }
            }
        }
    }

    given("검색 시스템 → 인제스트·검색어, 두 축이 모두 임베딩을 담는 DAG") {
        val edges = listOf(
            contains("search-system", "search-query", ordinal = 2),
            contains("search-system", "search-ingest", ordinal = 1),
            contains("search-ingest", "document-embedding"),
            contains("search-query", "query-embedding"),
            contains("document-embedding", "embedding-model"),
            contains("query-embedding", "embedding-model"),
            contains("search-query", "bm25"),
            contains("search-query", "rrf"),
            flows("bm25", "rrf"),
            flows("rrf", "reranking"),
        )

        `when`("root 없이 층을 세면") {
            val hierarchy = ConceptHierarchy.build(edges)

            then("부모 없는 개념 하나가 진입점이고 깊이는 가장 짧은 경로다") {
                hierarchy.roots shouldContainExactly listOf("search-system")
                hierarchy.depthOf["search-system"] shouldBe 0
                hierarchy.depthOf["search-ingest"] shouldBe 1
                hierarchy.depthOf["embedding-model"] shouldBe 3
            }

            then("두 부모를 가진 개념은 한 노드로 한 번만 세고 CONTAINS 간선은 둘 다 남는다") {
                hierarchy.conceptIds.count { it == "embedding-model" } shouldBe 1
                hierarchy.edges.filter { it.toConceptId == "embedding-model" }.map { it.fromConceptId }
                    .shouldContainExactlyInAnyOrder("document-embedding", "query-embedding")
            }

            then("CONTAINS 형제는 ordinal 순서로 나온다") {
                hierarchy.edges.filter { it.fromConceptId == "search-system" }.map { it.toConceptId }
                    .shouldContainExactly("search-ingest", "search-query")
            }

            then("FLOWS_TO 는 양 끝이 층 안에 있을 때만 남는다") {
                hierarchy.depthOf shouldNotContainKey "reranking"
                hierarchy.edges.filter { it.kind == ConceptEdgeKind.FLOWS_TO }.map { it.toConceptId }
                    .shouldContainExactly("rrf")
            }
        }

        `when`("중간 개념을 root 로 지정하면") {
            val hierarchy = ConceptHierarchy.build(edges, root = "search-query")

            then("그 아래만 남고 깊이는 root 기준으로 다시 센다") {
                hierarchy.roots shouldContainExactly listOf("search-query")
                hierarchy.depthOf["search-query"] shouldBe 0
                hierarchy.depthOf["embedding-model"] shouldBe 2
                hierarchy.depthOf shouldNotContainKey "search-ingest"
            }
        }

        `when`("간선에 없는 개념을 root 로 지정하면") {
            then("빈 계층이다") {
                val hierarchy = ConceptHierarchy.build(edges, root = "nowhere")
                hierarchy.roots shouldBe emptyList()
                hierarchy.depthOf shouldBe emptyMap()
            }
        }
    }

    given("순환이 있는 간선") {
        `when`("층을 세면") {
            then("한 번 방문한 개념은 다시 세지 않는다") {
                val hierarchy = ConceptHierarchy.build(
                    listOf(contains("a", "b"), contains("b", "c"), contains("c", "a")),
                    root = "a",
                )
                hierarchy.depthOf shouldBe mapOf("a" to 0, "b" to 1, "c" to 2)
            }
        }
    }
})
