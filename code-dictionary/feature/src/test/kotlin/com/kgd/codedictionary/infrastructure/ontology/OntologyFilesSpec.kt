package com.kgd.codedictionary.infrastructure.ontology

import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe

/**
 * CI 게이트 — 레포에 실린 온톨로지 파일 묶음이 공리를 지킨다. 실패하면 테스트 게이트가 이미지를 만들지 않아
 * 잘못된 온톨로지는 main 에 있어도 운영에 못 간다. 로더가 읽는 것과 같은 리더·같은 위치를 쓴다.
 */
class OntologyFilesSpec : BehaviorSpec({

    val loaded = YamlOntologyReader("classpath:ontology/").load()
    val ontology = loaded.ontology

    given("resources/ontology 의 파일 묶음") {
        then("공리 ①~⑧ 위반이 없다") {
            ontology.validate().map { it.toString() }.shouldBeEmpty()
        }
        then("규칙 ⑨ — 모든 관계 kind 가 실제 파일에서 한 번 이상 쓰인다(정의만 있는 어휘 금지)") {
            (ConceptEdgeKind.entries.toSet() - ontology.relations.map { it.kind }.toSet()).shouldBeEmpty()
        }
        then("코드 참조의 path 가 레포에 있고 그 파일에 symbol 이 있다 — 심볼을 지우거나 파일을 옮기면 여기서 깨진다") {
            // 테스트 작업 디렉토리는 모듈(code-dictionary/feature) — 레포 루트는 두 단계 위
            val repo = java.io.File("../..").canonicalFile
            val broken = ontology.concepts.flatMap { c ->
                c.code.mapNotNull { ref ->
                    val file = java.io.File(repo, ref.path)
                    when {
                        !file.isFile -> "${c.id}: 파일 없음 ${ref.path}"
                        ref.symbol !in file.readText() -> "${c.id}: ${ref.path} 에 '${ref.symbol}' 없음"
                        else -> null
                    }
                }
            }
            broken.shouldBeEmpty()
        }
        then("manifest 의 도메인 목록이 파일 집합과 같다") {
            ontology.manifest.domains.toSet() shouldBe ontology.domains.map { it.fileDomain }.toSet()
        }
    }
})
