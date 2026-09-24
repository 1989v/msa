package com.kgd.codedictionary.application.graph.service

import com.kgd.codedictionary.application.graph.dto.AtlasConceptRow
import com.kgd.codedictionary.application.graph.dto.AtlasEdgeRow
import com.kgd.codedictionary.application.graph.port.ConceptAtlasQueryPort
import com.kgd.codedictionary.application.ontology.dto.LoadedOntology
import com.kgd.codedictionary.application.ontology.port.OntologySourcePort
import com.kgd.codedictionary.domain.concept.ontology.ConceptOntology
import com.kgd.codedictionary.domain.concept.ontology.OntologyDomain
import com.kgd.codedictionary.domain.concept.ontology.OntologyManifest
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk

class ConceptAtlasServiceTest : BehaviorSpec({

    fun row(id: String, domain: String, kind: String, code: Int = 0) =
        AtlasConceptRow(id, domain, kind, "$id 이름", "$id 설명", code)

    val source = object : OntologySourcePort {
        override fun load() = LoadedOntology(
            ConceptOntology(
                // manifest 순서가 화면 순서다 — 파일 목록 순서(아래)와 일부러 다르게 둔다
                OntologyManifest(2, listOf("language", "search", "network")),
                listOf(
                    OntologyDomain("search", "search", "search-system", emptyList(), emptyList()),
                    OntologyDomain("language", "language", "language-root", emptyList(), emptyList()),
                    OntologyDomain("network", "network", "network-root", emptyList(), emptyList()),
                ),
            ),
            "h",
        )
    }

    given("세 도메인 중 둘만 적용된 DB") {
        val query = mockk<ConceptAtlasQueryPort>()
        every { query.managedConcepts() } returns listOf(
            row("search-system", "search", "DOMAIN"),
            row("bm25", "search", "MECHANISM", code = 2),
            row("hnsw", "search", "MECHANISM", code = 1),
            row("language-root", "language", "DOMAIN"),
            row("kotlin", "language", "TECHNOLOGY"),
        )
        every { query.managedEdges() } returns listOf(
            AtlasEdgeRow("search", "search", "CONTAINS"),
            AtlasEdgeRow("search", "language", "USES"),
            AtlasEdgeRow("language", "search", "IMPLEMENTS"),
            // 적용 안 된 도메인으로 가는 간선은 선이 그려질 곳이 없다
            AtlasEdgeRow("search", "network", "USES"),
        )
        val atlas = ConceptAtlasService(query, source).getAtlas()

        then("manifest 순서대로, 적용된 도메인만 싣는다") {
            atlas.domains.map { it.domain } shouldBe listOf("language", "search")
        }
        then("도메인별 개념 수·kind 분포·코드 참조 수를 센다") {
            val search = atlas.domains.single { it.domain == "search" }
            search.conceptCount shouldBe 3
            search.kindCounts shouldBe mapOf("DOMAIN" to 1, "MECHANISM" to 2)
            search.codeRefCount shouldBe 3
            search.name shouldBe "search-system 이름"
        }
        then("도메인 사이 간선은 방향 없이 한 줄로 모으고, 같은 도메인 안의 간선은 세지 않는다") {
            atlas.links.size shouldBe 1
            atlas.links.single().let { Triple(it.from, it.to, it.count) } shouldBe Triple("language", "search", 2)
        }
    }
})
