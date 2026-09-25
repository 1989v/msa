package com.kgd.codedictionary.infrastructure.ontology

import com.kgd.codedictionary.application.ontology.dto.LoadedOntology
import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import com.kgd.codedictionary.domain.concept.model.ConceptKind
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import java.io.File

/**
 * `/tech` 개념 아틀라스가 싣는 정적 그래프 — portal-fe 가 빌드에 넣어 Cloudflare 가장자리에서 받는다.
 *
 * 원본은 이 모듈의 온톨로지 YAML 이고, portal-fe 이미지 빌드는 이 디렉토리를 못 본다. 그래서 내보낸 파일을
 * `portal-fe/src/pages/atlas/generated/` 에 두고, 이 스펙이 **부팅 로더와 같은 [YamlOntologyReader]** 로 다시 만들어
 * 파일과 통째로 비교한다. YAML 을 고치고 다시 내보내지 않으면 여기서 막힌다.
 *
 * 다시 내보내기:
 * `ATLAS_EXPORT=write ./gradlew :code-dictionary:feature:test --tests '*AtlasGraphExportSpec' --rerun`
 */
class AtlasGraphExportSpec : BehaviorSpec({

    val loaded = YamlOntologyReader("classpath:ontology/").load()
    // 테스트 작업 디렉토리는 모듈(code-dictionary/feature) — 레포 루트는 두 단계 위
    val dir = File(File("../..").canonicalFile, "portal-fe/src/pages/atlas/generated")
    val expected = render(loaded)

    if (System.getenv("ATLAS_EXPORT") == "write") {
        dir.resolve("desc").listFiles()?.filter { "desc/${it.name}" !in expected }?.forEach { it.delete() }
        expected.forEach { (path, text) -> dir.resolve(path).apply { parentFile.mkdirs() }.writeText(text) }
    }

    given("portal-fe 의 아틀라스 그래프") {
        then("온톨로지 YAML 에서 다시 만든 것과 같다 — 다르면 위 주석의 명령으로 다시 내보낸다") {
            val stale = expected.mapNotNull { (path, text) ->
                val f = dir.resolve(path)
                when {
                    !f.isFile -> "$path 가 없다"
                    f.readText() != text -> "$path 가 온톨로지와 다르다"
                    else -> null
                }
            }
            val extra = dir.resolve("desc").listFiles()?.map { "desc/${it.name}" }?.filter { it !in expected }.orEmpty()
                .map { "$it 는 manifest 에 없는 도메인이다" }
            (stale + extra).shouldBeEmpty()
        }
    }
})

private val KINDS = ConceptKind.entries.map { it.name }
private val EDGE_KINDS = ConceptEdgeKind.entries.map { it.name }

/**
 * 파일 경로 → 내용. 구조(`graph.json`)는 한 번에, 설명은 도메인마다(`desc/<domain>.json`) 나눈다 —
 * 설명이 크기의 대부분이라 고른 도메인 것만 받는다. 한 줄에 한 항목이라 diff 가 개념 단위로 읽힌다.
 */
private fun render(loaded: LoadedOntology): Map<String, String> {
    val o = loaded.ontology
    val byDomain = o.domains.associateBy { it.fileDomain }
    val ordered = o.manifest.domains.map { byDomain.getValue(it) }
    val concepts = ordered.flatMapIndexed { di, d -> d.concepts.map { di to it } }
    val index = concepts.withIndex().associate { (i, p) -> p.second.id to i }

    val graph = buildString {
        append("{\n")
        append("\"revision\": ${o.manifest.revision},\n")
        append("\"source\": ${q(loaded.contentHash)},\n")
        append("\"kinds\": [${KINDS.joinToString(", ") { q(it) }}],\n")
        append("\"edgeKinds\": [${EDGE_KINDS.joinToString(", ") { q(it) }}],\n")
        append("\"domains\": [\n")
        append(ordered.joinToString(",\n") { d ->
            val root = d.concepts.first { it.id == d.root }
            "[${q(d.fileDomain)}, ${q(root.name)}, ${q(root.description)}, ${q(d.root)}, ${d.concepts.sumOf { it.code.size }}]"
        })
        append("\n],\n\"concepts\": [\n")
        append(concepts.joinToString(",\n") { (di, c) ->
            "[${q(c.id)}, ${q(c.name)}, ${KINDS.indexOf(c.kind?.name)}, $di]"
        })
        append("\n],\n\"edges\": [\n")
        // 파일 순서 그대로 — 포함 간선은 부모 목록 순서가 곧 자식 순서다
        append(o.relations.filter { it.from in index && it.to in index }.joinToString(",\n") { r ->
            "[${index.getValue(r.from)}, ${index.getValue(r.to)}, ${EDGE_KINDS.indexOf(r.kind.name)}]"
        })
        append("\n]\n}\n")
    }
    val desc = ordered.associate { d ->
        "desc/${d.fileDomain}.json" to d.concepts.joinToString(",\n", "{\n", "\n}\n") { "${q(it.id)}: ${q(it.description)}" }
    }
    return mapOf("graph.json" to graph) + desc
}

private fun q(s: String): String = buildString {
    append('"')
    for (ch in s) when {
        ch == '"' -> append("\\\"")
        ch == '\\' -> append("\\\\")
        ch == '\n' -> append("\\n")
        ch == '\r' -> append("\\r")
        ch == '\t' -> append("\\t")
        ch < ' ' -> append("\\u%04x".format(ch.code))
        else -> append(ch)
    }
    append('"')
}
