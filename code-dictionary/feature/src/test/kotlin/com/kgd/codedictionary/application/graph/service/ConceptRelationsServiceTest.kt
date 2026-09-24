package com.kgd.codedictionary.application.graph.service

import com.kgd.codedictionary.application.concept.port.ConceptEdgeRepositoryPort
import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.graph.dto.EvidenceDto
import com.kgd.codedictionary.application.graph.port.ConceptEvidenceQueryPort
import com.kgd.codedictionary.domain.concept.model.Concept
import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptEdge
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import com.kgd.codedictionary.domain.concept.model.ConceptKind
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk

class ConceptRelationsServiceTest : BehaviorSpec({

    fun c(id: String, kind: ConceptKind) = Concept.restore(
        id = id.hashCode().toLong(), conceptId = id, name = id.uppercase(), category = ConceptCategory.BASICS,
        level = ConceptLevel.BEGINNER, description = "d", synonyms = emptyList(), relatedConceptIds = emptyList(),
        kind = kind, managedBy = "search",
    )
    val concepts = listOf(c("lattice-viterbi", ConceptKind.MECHANISM), c("lattice", ConceptKind.TERM),
        c("nori", ConceptKind.TECHNOLOGY), c("analyzer", ConceptKind.MECHANISM), c("unrelated", ConceptKind.METRIC))
    val edges = listOf(
        ConceptEdge(fromConceptId = "analyzer", toConceptId = "lattice-viterbi", kind = ConceptEdgeKind.CONTAINS),
        ConceptEdge(fromConceptId = "lattice-viterbi", toConceptId = "lattice", kind = ConceptEdgeKind.USES),
        ConceptEdge(fromConceptId = "nori", toConceptId = "lattice-viterbi", kind = ConceptEdgeKind.IMPLEMENTS, reason = "mecab 비용"),
        ConceptEdge(fromConceptId = "lattice-viterbi", toConceptId = "ghost", kind = ConceptEdgeKind.USES),
    )
    val conceptRepo = mockk<ConceptRepositoryPort>()
    val edgeRepo = mockk<ConceptEdgeRepositoryPort>()
    val evidence = mockk<ConceptEvidenceQueryPort>()
    every { conceptRepo.findByConceptId("lattice-viterbi") } returns concepts[0]
    every { conceptRepo.findAllList() } returns concepts
    every { edgeRepo.findAll() } returns edges
    every { evidence.evidenceOf("lattice-viterbi") } returns listOf(EvidenceDto("RECORD", "r", null))
    every { evidence.questionsOf("lattice-viterbi") } returns listOf("왜 최소 비용인가")

    given("격자·비터비의 이웃") {
        val r = ConceptRelationsService(conceptRepo, edgeRepo, evidence).getRelations("lattice-viterbi")
        then("나가는 간선은 관계 이름, 개념 행이 없는 이웃은 빠진다") {
            r.outgoing.map { it.label to it.conceptId } shouldContainExactly listOf("USES" to "lattice")
        }
        then("들어오는 간선은 역방향 이름과 reason 을 싣는다") {
            r.incoming.map { it.label to it.conceptId } shouldContainExactly listOf("PART_OF" to "analyzer", "IMPLEMENTED_BY" to "nori")
            r.incoming.single { it.conceptId == "nori" }.reason shouldBe "mecab 비용"
        }
        then("근거·질문·kind 가 실린다") {
            r.concept.kind shouldBe "MECHANISM"
            r.evidence.single().ref shouldBe "r"
            r.questions shouldContainExactly listOf("왜 최소 비용인가")
        }
    }
})
