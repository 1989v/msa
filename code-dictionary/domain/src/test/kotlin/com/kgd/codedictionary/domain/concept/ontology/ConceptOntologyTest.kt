package com.kgd.codedictionary.domain.concept.ontology

import com.kgd.codedictionary.domain.concept.model.ConceptCategory
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind.ALTERNATIVE_TO
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind.CONTAINS
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind.FLOWS_TO
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind.MITIGATES
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind.USES
import com.kgd.codedictionary.domain.concept.model.ConceptKind
import com.kgd.codedictionary.domain.concept.model.ConceptKind.DOMAIN
import com.kgd.codedictionary.domain.concept.model.ConceptKind.MECHANISM
import com.kgd.codedictionary.domain.concept.model.ConceptKind.METRIC
import com.kgd.codedictionary.domain.concept.model.ConceptKind.PROBLEM
import com.kgd.codedictionary.domain.concept.model.ConceptKind.STAGE
import com.kgd.codedictionary.domain.concept.model.ConceptKind.TECHNOLOGY
import com.kgd.codedictionary.domain.concept.model.ConceptKind.TERM
import com.kgd.codedictionary.domain.concept.model.ConceptLevel
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.shouldBe

/**
 * 공리 검사 — 정상 온톨로지 하나를 기준으로 규칙마다 위반 하나를 주입해 그 규칙 번호가 나오는지 본다.
 * 기준이 통과한다는 것과 주입마다 빨간불이 난다는 것이 함께 있어야 「검사한다」고 말할 수 있다.
 */
class ConceptOntologyTest : BehaviorSpec({

    fun c(id: String, kind: ConceptKind?) = OntologyConcept(
        id = id, kind = kind, name = id, category = ConceptCategory.BASICS,
        level = ConceptLevel.BEGINNER, description = "$id 설명",
    )
    fun r(from: String, to: String, kind: ConceptEdgeKind, ordinal: Int = 0) = OntologyRelation(from, to, kind, ordinal)

    val baseConcepts = listOf(
        c("sys", DOMAIN), c("ingest", DOMAIN),
        c("collect", STAGE), c("normalize", STAGE),
        c("bm25", MECHANISM), c("ann", MECHANISM),
        c("glossary", TERM), c("lattice", TERM),
        c("opensearch", TECHNOLOGY), c("empty-index", PROBLEM), c("ndcg", METRIC),
    )
    val baseRelations = listOf(
        r("sys", "ingest", CONTAINS, 1), r("sys", "glossary", CONTAINS, 2),
        r("ingest", "collect", CONTAINS, 1), r("ingest", "normalize", CONTAINS, 2),
        r("collect", "normalize", FLOWS_TO),
        r("collect", "bm25", CONTAINS), r("collect", "ann", CONTAINS),
        r("collect", "opensearch", CONTAINS), r("collect", "empty-index", CONTAINS), r("collect", "ndcg", CONTAINS),
        r("glossary", "lattice", CONTAINS),
        r("bm25", "lattice", USES),
        r("bm25", "ann", ALTERNATIVE_TO),
        r("ann", "empty-index", MITIGATES),
    )

    fun ontology(
        concepts: List<OntologyConcept> = baseConcepts,
        relations: List<OntologyRelation> = baseRelations,
        manifestDomains: List<String> = listOf("search"),
        fileDomain: String = "search",
        root: String = "sys",
    ) = ConceptOntology(
        manifest = OntologyManifest(revision = 1, domains = manifestDomains),
        domains = listOf(OntologyDomain(fileDomain, "search", root, concepts, relations)),
    )

    fun rulesOf(o: ConceptOntology) = o.validate().map { it.rule }

    given("모든 공리를 지키는 온톨로지") {
        then("위반이 없다") { ontology().validate().shouldBeEmpty() }
    }

    given("규칙 ① — 유일성·존재·manifest") {
        `when`("개념 id 가 두 번 나오면") {
            then("1") { rulesOf(ontology(concepts = baseConcepts + c("bm25", MECHANISM))) shouldContain 1 }
        }
        `when`("간선이 없는 개념을 가리키면") {
            then("1") { rulesOf(ontology(relations = baseRelations + r("bm25", "ghost", USES))) shouldContain 1 }
        }
        `when`("manifest 목록과 파일 집합이 다르면") {
            then("1") { rulesOf(ontology(manifestDomains = listOf("search", "messaging"))) shouldContain 1 }
        }
        `when`("파일 이름과 domain 값이 다르면") {
            then("1") { rulesOf(ontology(fileDomain = "serch", manifestDomains = listOf("serch"))) shouldContain 1 }
        }
    }

    given("규칙 ② — kind 필수") {
        then("kind 가 빠진 개념은 2") {
            rulesOf(ontology(concepts = baseConcepts.map { if (it.id == "ann") it.copy(kind = null) else it })) shouldContain 2
        }
    }

    given("규칙 ③ — 허용 범위") {
        then("TERM 이 장치를 CONTAINS 하면 3") {
            rulesOf(ontology(relations = baseRelations + r("glossary", "bm25", CONTAINS))) shouldContain 3
        }
        then("TECHNOLOGY 가 문제를 MITIGATES 하면 3") {
            rulesOf(ontology(relations = baseRelations + r("opensearch", "empty-index", MITIGATES))) shouldContain 3
        }
    }

    given("규칙 ④ — CONTAINS 비순환") {
        then("4") { rulesOf(ontology(relations = baseRelations + r("collect", "ingest", CONTAINS))) shouldContain 4 }
    }

    given("규칙 ⑤ — 루트와 부모") {
        then("부모 없는 개념이 있으면 5") {
            rulesOf(ontology(relations = baseRelations.filterNot { it.to == "normalize" && it.kind == CONTAINS })) shouldContain 5
        }
        then("TERM 에 CONTAINS 부모가 둘이면 5") {
            rulesOf(ontology(relations = baseRelations.filterNot { it.from == "bm25" && it.kind == USES } +
                r("collect", "glossary", CONTAINS))) shouldContain 5
        }
        then("루트가 DOMAIN 이 아니면 5") { rulesOf(ontology(root = "collect")) shouldContain 5 }
    }

    given("규칙 ⑥ — FLOWS_TO 형제") {
        then("부모를 공유하지 않는 FLOWS_TO 는 6") {
            rulesOf(ontology(relations = baseRelations + r("normalize", "bm25", FLOWS_TO))) shouldContain 6
        }
    }

    given("규칙 ⑦ — 대칭·중복") {
        then("ALTERNATIVE_TO 를 양쪽에 적으면 7") {
            rulesOf(ontology(relations = baseRelations + r("ann", "bm25", ALTERNATIVE_TO))) shouldContain 7
        }
        then("같은 간선을 두 번 적으면 7") {
            rulesOf(ontology(relations = baseRelations + r("bm25", "lattice", USES))) shouldContain 7
        }
    }

    given("규칙 ⑧ — 두 부모 위장") {
        then("같은 쌍에 CONTAINS 와 USES 가 함께 있으면 8") {
            rulesOf(ontology(relations = baseRelations + r("collect", "bm25", USES))) shouldContain 8
        }
    }

    given("위반이 여럿이면") {
        then("첫 하나에서 멈추지 않고 전부 모아 던진다") {
            val broken = ontology(
                concepts = baseConcepts.map { if (it.id == "ann") it.copy(kind = null) else it },
                relations = baseRelations + r("glossary", "bm25", CONTAINS),
            )
            val e = shouldThrow<OntologyValidationException> { broken.validateOrThrow() }
            e.violations.map { it.rule }.toSet() shouldBe setOf(2, 3)
        }
    }
})
