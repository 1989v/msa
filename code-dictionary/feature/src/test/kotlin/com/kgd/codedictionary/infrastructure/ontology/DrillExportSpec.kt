package com.kgd.codedictionary.infrastructure.ontology

import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import com.kgd.codedictionary.domain.concept.model.ConceptKind
import com.kgd.codedictionary.domain.concept.ontology.ConceptOntology
import com.kgd.codedictionary.domain.concept.ontology.OntologyConcept
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import java.io.File

/**
 * tech 드릴다운(`/tech/search` …)이 그리는 다이어그램 — 온톨로지에서 규칙으로 만든다 (ADR-0108).
 *
 * 그리는 규칙은 여기 한 곳에만 있다. 화면은 이 파일이 낸 노드 · 간선 · 묶음을 배치하고 그릴 뿐이다.
 * - 개념 X 의 그림 노드 = 자식 중 STAGE 이거나 형제와 FLOWS_TO 로 이어진 것. 나머지 자식은 관련 개념
 * - 간선 = 그림 안 노드끼리의 FLOWS_TO, 글자는 관계의 label
 * - 노드의 자식 중 STAGE 가 둘 이상이고 자식 사이에 흐름이 하나도 없으면 그 노드를 묶음으로 그리고 STAGE 자식을 나란히 펼친다
 * - 펼침은 3단계까지 — 3단계에서 연 개념은 그림 없이 설명만
 *
 * 그려지는 개념은 `applied.status` 가 있어야 한다. 없는 단계를 빼고 그리면 읽는 사람은 있다고 가정한다.
 * 코드 스니펫은 여기서 원본 파일을 읽어 싣는다 — portal-fe 이미지 빌드는 레포의 다른 디렉토리를 못 본다.
 *
 * 다시 내보내기:
 * `DRILL_EXPORT=write ./gradlew :code-dictionary:feature:test --tests '*DrillExportSpec' --rerun`
 */
class DrillExportSpec : BehaviorSpec({

    val ontology = YamlOntologyReader("classpath:ontology/").load().ontology
    // 테스트 작업 디렉토리는 모듈(code-dictionary/feature) — 레포 루트는 두 단계 위
    val repo = File("../..").canonicalFile
    val dir = File(repo, "portal-fe/src/content/drill")
    val problems = mutableListOf<String>()
    val expected = DRILLS.associate { (domain, root) -> "$domain.json" to render(ontology, root, repo, problems) }

    if (System.getenv("DRILL_EXPORT") == "write" && problems.isEmpty()) {
        dir.mkdirs()
        expected.forEach { (name, text) -> dir.resolve(name).writeText(text) }
    }

    given("tech 드릴다운 데이터") {
        then("그려지는 개념마다 적용 상태가 있고, 코드 위치가 실제 파일 · 심볼을 가리킨다") {
            withClue(problems.joinToString("\n")) { problems.shouldBeEmpty() }
        }
        then("portal-fe 의 파일이 온톨로지에서 다시 만든 것과 같다 — 다르면 위 주석의 명령으로 다시 내보낸다") {
            expected.mapNotNull { (name, text) ->
                val f = dir.resolve(name)
                when {
                    !f.isFile -> "$name 가 없다"
                    f.readText() != text -> "$name 가 온톨로지와 다르다"
                    else -> null
                }
            }.shouldBeEmpty()
        }
    }
})

/** (출력 이름, 루트 개념) — 드릴다운 페이지가 있는 도메인 */
private val DRILLS = listOf("search" to "search-query")

/** 펼칠 수 있는 단계 수. 루트 그림의 노드가 1단계다 */
private const val MAX_DEPTH = 3
private const val SNIPPET_LINES = 12
private val INTERNAL_DOC = Regex("""\bADR-\d+""")

private class Diagram(val nodes: List<Pair<String, List<String>>>, val edges: List<Triple<String, String, String?>>, val related: List<String>)

private fun render(o: ConceptOntology, root: String, repo: File, problems: MutableList<String>): String {
    val byId = o.concepts.associateBy { it.id }
    val childrenOf = o.relations.filter { it.kind == ConceptEdgeKind.CONTAINS }.groupBy({ it.from }, { it.to })
    val flows = o.relations.filter { it.kind == ConceptEdgeKind.FLOWS_TO }

    fun diagram(owner: String): Diagram? {
        val children = childrenOf[owner].orEmpty()
        if (children.isEmpty()) return null
        val inside = flows.filter { it.from in children && it.to in children }
        val linked = inside.flatMap { listOf(it.from, it.to) }.toSet()
        val drawn = children.filter { byId.getValue(it).kind == ConceptKind.STAGE || it in linked }
        val nodes = drawn.map { id ->
            val grand = childrenOf[id].orEmpty()
            val stages = grand.filter { byId.getValue(it).kind == ConceptKind.STAGE }
            // 자식 그림에 흐름이 하나도 없고 그려질 것이 STAGE 뿐일 때만 — 흐름이 있는 단계는 제 그림으로 연다
            val parallel = stages.size >= 2 && flows.none { it.from in grand && it.to in grand }
            id to (if (parallel) stages else emptyList())
        }
        return Diagram(nodes, inside.map { Triple(it.from, it.to, it.label) }, children - drawn.toSet())
    }

    // 펼침 단계별로 넓게 훑는다 — 같은 개념이 여러 그림에 나오면 가장 얕은 단계를 쓴다
    val diagrams = linkedMapOf<String, Diagram>()
    val exported = linkedSetOf(root)
    val drawnIds = mutableSetOf<String>()
    var frontier = listOf(root)
    for (depth in 0 until MAX_DEPTH) {
        val next = mutableListOf<String>()
        for (owner in frontier) {
            if (owner in diagrams) continue
            val d = diagram(owner) ?: continue
            diagrams[owner] = d
            val opened = d.nodes.flatMap { (id, lanes) -> listOf(id) + lanes } + d.related
            drawnIds += d.nodes.flatMap { (id, lanes) -> listOf(id) + lanes }
            opened.filter { exported.add(it) }.let { next += it }
        }
        frontier = next
    }

    for (id in drawnIds) if (byId.getValue(id).applied == null) problems += "$id 는 그려지는데 applied.status 가 없다"

    return buildString {
        append("{\n\"root\": ${q(root)},\n\"concepts\": {\n")
        append(exported.joinToString(",\n") { id -> "${q(id)}: ${concept(byId.getValue(id), repo, problems)}" })
        append("\n},\n\"diagrams\": {\n")
        append(diagrams.entries.joinToString(",\n") { (owner, d) ->
            val nodes = d.nodes.joinToString(", ") { (id, lanes) ->
                if (lanes.isEmpty()) "{\"id\": ${q(id)}}" else "{\"id\": ${q(id)}, \"lanes\": [${lanes.joinToString(", ") { q(it) }}]}"
            }
            val edges = d.edges.joinToString(", ") { (f, t, l) ->
                "{\"from\": ${q(f)}, \"to\": ${q(t)}" + (l?.let { ", \"label\": ${q(it)}" } ?: "") + "}"
            }
            "${q(owner)}: {\"nodes\": [$nodes], \"edges\": [$edges], \"related\": [${d.related.joinToString(", ") { q(it) }}]}"
        })
        append("\n}\n}\n")
    }
}

/** 개념 한 줄 — 내부 결정 문서(evidence)는 싣지 않는다 */
private fun concept(c: OntologyConcept, repo: File, problems: MutableList<String>): String {
    val parts = mutableListOf("\"name\": ${q(c.name)}", "\"kind\": ${q(c.kind?.name ?: "")}", "\"description\": ${q(c.description)}")
    c.applied?.let { a ->
        val facts = a.facts.joinToString(", ") { f ->
            "{\"label\": ${q(f.label)}, \"value\": ${q(f.value)}" + (f.key?.let { ", \"key\": ${q(it)}" } ?: "") + "}"
        }
        parts += "\"applied\": {\"status\": ${q(a.status.name)}" + (a.summary?.let { ", \"summary\": ${q(it)}" } ?: "") +
            (if (a.facts.isEmpty()) "" else ", \"facts\": [$facts]") + "}"
    }
    val code = c.code.mapNotNull { ref ->
        val file = File(repo, ref.path)
        if (!file.isFile) {
            problems += "${c.id} 코드 파일이 없다: ${ref.path}"
            return@mapNotNull null
        }
        val lines = file.readLines()
        val at = lines.indexOfFirst { ref.symbol in it }
        if (at < 0) {
            problems += "${c.id} 의 심볼을 ${ref.path} 에서 못 찾았다: ${ref.symbol}"
            return@mapNotNull null
        }
        val taken = mutableListOf<String>()
        for (line in lines.drop(at).take(SNIPPET_LINES)) {
            // 내부 결정 문서 번호가 든 줄 앞에서 끊는다 — 화면에 내지 않는다(ADR-0108 결정 6)
            if (INTERNAL_DOC.containsMatchIn(line)) break
            if (line.isBlank() && taken.size >= 4) break
            taken += line
        }
        while (taken.isNotEmpty() && taken.last().isBlank()) taken.removeLast()
        if (taken.size < 3) {
            problems += "${c.id} 의 스니펫이 ${ref.path}:${at + 1} 에서 3줄도 안 된다 — 내부 문서 번호 줄 뒤로 심볼을 옮긴다"
            return@mapNotNull null
        }
        val indent = taken.filter { it.isNotBlank() }.minOf { it.length - it.trimStart().length }
        val snippet = taken.joinToString("\n") { if (it.isBlank()) "" else it.substring(indent) }
        "{\"path\": ${q(ref.path)}, \"start\": ${at + 1}, \"end\": ${at + taken.size}" +
            (ref.note?.let { ", \"note\": ${q(it)}" } ?: "") + ", \"snippet\": ${q(snippet)}}"
    }
    if (code.isNotEmpty()) parts += "\"code\": [${code.joinToString(", ")}]"
    return parts.joinToString(", ", "{", "}")
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
