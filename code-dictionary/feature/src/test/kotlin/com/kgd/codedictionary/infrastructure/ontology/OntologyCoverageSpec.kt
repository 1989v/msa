package com.kgd.codedictionary.infrastructure.ontology

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import java.io.File

/**
 * 커버리지 게이트 — 도메인마다 「그 분야를 망라하는 개념 목록」(체크리스트)이 레포에 있고,
 * 목록의 항목은 전부 온톨로지에 놓였거나 제외 이유가 적혀 있다.
 *
 * 온톨로지 파일만 검증하면 「빠진 개념」은 영영 안 보인다 — 공리는 있는 것끼리의 관계만 잰다.
 * 원천(study 카탈로그 · 개념 지도 · 분야 표준 목차)에서 뽑은 목록을 기준으로 두어야 누락이 빨간불이 된다.
 *
 * 체크리스트 형식 — `docs/specs/2026-09-24-concept-atlas/coverage/<domain>.md` 의 표:
 * `| id | 개념 | 출처 | 배치 |` · 배치는 `placed` 또는 `excluded — <이유>`.
 */
class OntologyCoverageSpec : BehaviorSpec({

    val ontology = YamlOntologyReader("classpath:ontology/").load().ontology
    // 테스트 작업 디렉토리는 모듈(code-dictionary/feature) — 레포 루트는 두 단계 위
    val dir = File(File("../..").canonicalFile, "docs/specs/2026-09-24-concept-atlas/coverage")
    val ids = ontology.concepts.map { it.id }.toSet()

    data class Row(val file: String, val id: String, val placement: String)

    fun rows(file: File): List<Row> = file.readLines()
        .filter { it.startsWith("|") && !it.startsWith("|---") && !it.startsWith("| ---") }
        .map { line -> line.trim().trim('|').split("|").map { it.trim() } }
        .filter { cells -> cells.size >= 4 && cells[0] != "id" }
        .map { cells -> Row(file.name, cells[0].trim('`'), cells.last()) }

    given("도메인별 커버리지 체크리스트") {
        then("manifest 의 도메인마다 체크리스트가 있다 — 새 도메인은 목록과 함께 들어온다") {
            ontology.manifest.domains.filterNot { File(dir, "$it.md").isFile }.shouldBeEmpty()
        }
        then("placed 항목은 온톨로지에 있고, excluded 항목은 이유를 적었다") {
            val broken = ontology.manifest.domains.flatMap { d ->
                val f = File(dir, "$d.md")
                if (!f.isFile) emptyList() else rows(f).mapNotNull { r ->
                    when {
                        !Regex("^[a-z0-9-]{1,100}$").matches(r.id) -> "${r.file}: id 형식 '${r.id}'"
                        r.placement == "placed" && r.id !in ids -> "${r.file}: ${r.id} 가 placed 인데 온톨로지에 없다"
                        r.placement.startsWith("excluded") &&
                            r.placement.substringAfter("excluded").trim(' ', '—', '-', ':').length < 4 ->
                            "${r.file}: ${r.id} 제외 이유가 없다"
                        r.placement != "placed" && !r.placement.startsWith("excluded") -> "${r.file}: ${r.id} 배치 값 '${r.placement}'"
                        else -> null
                    }
                }
            }
            broken.shouldBeEmpty()
        }
        then("한 체크리스트 안에 같은 id 가 두 번 없다") {
            ontology.manifest.domains.flatMap { d ->
                val f = File(dir, "$d.md")
                if (!f.isFile) emptyList() else rows(f).groupBy { it.id }.filter { it.value.size > 1 }.keys.map { "$d: $it" }
            }.shouldBeEmpty()
        }
    }
})
