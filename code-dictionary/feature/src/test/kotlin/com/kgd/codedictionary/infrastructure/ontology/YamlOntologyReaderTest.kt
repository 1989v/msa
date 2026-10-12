package com.kgd.codedictionary.infrastructure.ontology

import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import com.kgd.codedictionary.domain.concept.model.ConceptKind
import io.kotest.assertions.throwables.shouldThrowAny
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.string.shouldContain
import java.nio.file.Files
import java.nio.file.Path

class YamlOntologyReaderTest : BehaviorSpec({

    val manifest = "revision: 3\ndomains: [search]\n"
    val search = """
        domain: search
        root: sys
        concepts:
          - id: sys
            kind: DOMAIN
            name: 검색 시스템
            category: ARCHITECTURE
            level: BEGINNER
            description: 루트
            contains: [fusion]
          - id: fusion
            kind: STAGE
            name: 융합
            category: ALGORITHM
            level: INTERMEDIATE
            description: 순위로 합친다
            synonyms: [rank fusion]
            contains: [rrf, ndcg]
            measured_by:
              - { to: ndcg, reason: 상위 10 등급 판정, evidence: ADR-0090 }
            evidence:
              - { kind: POST, ref: search-system-concept-map }
            questions: [왜 점수로 안 섞나]
          - { id: rrf, kind: MECHANISM, name: RRF, category: ALGORITHM, level: INTERMEDIATE, description: 순위 역수 합 }
          - { id: ndcg, kind: METRIC, name: nDCG, category: TESTING, level: INTERMEDIATE, description: 등급 지표 }
    """.trimIndent()

    /** 파일을 주어진 순서로 만든다 — 열거 순서가 해시에 새지 않는지 보려고 */
    fun dir(vararg files: Pair<String, String>): Path =
        Files.createTempDirectory("onto").also { d -> files.forEach { (n, c) -> Files.writeString(d.resolve(n), c) } }

    fun read(d: Path) = YamlOntologyReader("file:$d/").load()

    given("manifest 와 도메인 파일 하나") {
        val loaded = read(dir("manifest.yaml" to manifest, "search.yaml" to search))
        then("관계가 키 순서대로 ordinal 을 받고 reason·evidence 가 실린다") {
            val rel = loaded.ontology.relations
            rel.filter { it.from == "fusion" && it.kind == ConceptEdgeKind.CONTAINS }.map { it.to to it.ordinal } shouldBe listOf("rrf" to 1, "ndcg" to 2)
            rel.single { it.kind == ConceptEdgeKind.MEASURED_BY }.let { it.reason shouldBe "상위 10 등급 판정"; it.evidenceRef shouldBe "ADR-0090" }
        }
        then("manifest·kind·근거·질문이 읽힌다") {
            loaded.ontology.manifest.revision shouldBe 3
            val fusion = loaded.ontology.concepts.single { it.id == "fusion" }
            fusion.kind shouldBe ConceptKind.STAGE
            fusion.evidence.single().ref shouldBe "search-system-concept-map"
            fusion.questions shouldBe listOf("왜 점수로 안 섞나")
            loaded.ontology.validate() shouldBe emptyList()
        }
    }

    given("content_hash") {
        then("파일 생성 순서가 달라도 같다") {
            read(dir("manifest.yaml" to manifest, "search.yaml" to search)).contentHash shouldBe
                read(dir("search.yaml" to search, "manifest.yaml" to manifest)).contentHash
        }
        then("주석 한 줄만 바뀌어도 달라진다") {
            read(dir("manifest.yaml" to manifest, "search.yaml" to search)).contentHash shouldNotBe
                read(dir("manifest.yaml" to manifest, "search.yaml" to "# 주석\n$search")).contentHash
        }
    }

    given("적용 상태와 간선 글자") {
        val applied = """
            domain: search
            root: sys
            concepts:
              - id: sys
                kind: DOMAIN
                name: 검색 시스템
                category: ARCHITECTURE
                level: BEGINNER
                description: 루트
                contains: [fusion]
              - id: fusion
                kind: STAGE
                name: 융합
                category: ALGORITHM
                level: INTERMEDIATE
                description: 순위로 합친다
                contains: [rrf, rerank]
                applied:
                  status: LIVE
                  summary: 순위만 써서 합친다
                  facts:
                    - { label: rank_constant, value: 60, key: rrf-rank-constant }
                    - { label: 방식, value: rrf }
              - id: rrf
                kind: MECHANISM
                name: RRF
                category: ALGORITHM
                level: INTERMEDIATE
                description: 순위 역수 합
                flows_to:
                  - { to: rerank, label: 상위 100 }
              - { id: rerank, kind: MECHANISM, name: 리랭킹, category: ALGORITHM, level: INTERMEDIATE, description: 상위 재채점 }
        """.trimIndent()

        then("applied 의 상태 · 서술 · 사실(숫자 값 포함)이 읽힌다") {
            val fusion = read(dir("manifest.yaml" to manifest, "search.yaml" to applied)).ontology.concepts.single { it.id == "fusion" }
            fusion.applied?.status?.name shouldBe "LIVE"
            fusion.applied?.summary shouldBe "순위만 써서 합친다"
            fusion.applied?.facts?.map { Triple(it.label, it.value, it.key) } shouldBe
                listOf(Triple("rank_constant", "60", "rrf-rank-constant"), Triple("방식", "rrf", null))
        }
        then("흐름 관계의 label 이 실리고 공리를 지킨다") {
            val loaded = read(dir("manifest.yaml" to manifest, "search.yaml" to applied))
            loaded.ontology.relations.single { it.kind == ConceptEdgeKind.FLOWS_TO }.label shouldBe "상위 100"
            loaded.ontology.validate() shouldBe emptyList()
        }
        then("모르는 상태값은 파싱에서 멈춘다") {
            shouldThrowAny { read(dir("manifest.yaml" to manifest, "search.yaml" to applied.replace("status: LIVE", "status: ACTIVE"))) }
                .message shouldContain "ACTIVE"
        }
        then("따옴표 없는 OFF 는 YAML 이 참거짓으로 읽으므로 상태값으로 받지 않는다") {
            shouldThrowAny { read(dir("manifest.yaml" to manifest, "search.yaml" to applied.replace("status: LIVE", "status: OFF"))) }
                .message shouldContain "문자열"
        }
        then("applied 의 모르는 키는 파싱에서 멈춘다") {
            shouldThrowAny { read(dir("manifest.yaml" to manifest, "search.yaml" to applied.replace("summary:", "sumary:"))) }
                .message shouldContain "모르는 키"
        }
    }

    given("오타") {
        then("모르는 관계 키는 파싱에서 멈춘다") {
            shouldThrowAny { read(dir("manifest.yaml" to manifest, "search.yaml" to search.replace("measured_by:", "measure_by:"))) }
                .message shouldContain "모르는 키"
        }
        then("모르는 kind 는 파싱에서 멈춘다") {
            shouldThrowAny { read(dir("manifest.yaml" to manifest, "search.yaml" to search.replace("kind: STAGE", "kind: STEP"))) }
                .message shouldContain "STEP"
        }
    }
})
