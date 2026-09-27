package com.kgd.codedictionary.tools

import com.kgd.codedictionary.domain.concept.model.ConceptEdgeKind
import com.kgd.codedictionary.domain.concept.ontology.ConceptOntology
import com.kgd.codedictionary.infrastructure.ontology.YamlOntologyReader

/**
 * 온톨로지 파일에서 mermaid flowchart 를 뽑는다 — 문서의 온톨로지 도식은 손으로 그리지 않는다(ADR-0100).
 * 로더와 같은 리더로 읽으므로 도식이 파일과 어긋날 수 없다.
 *
 *   ./gradlew :code-dictionary:feature:ontologyMermaid -PontoRoot=search-query -PontoKinds=CONTAINS,FLOWS_TO -PontoDepth=2
 *   (Project.getDepth 와 겹치지 않게 onto 접두어)
 *   -PontoCaption="…" 은 캡션만 바꾼다 — 블로그처럼 캡션이 그림의 내용 설명이어야 하는 곳에 쓴다
 *   -PontoConnected=true 는 그린 간선에 닿는 노드만 남긴다 — 순서 없는 형제가 많은 가지에서 흐름만 보일 때
 */
fun main(args: Array<String>) {
    val opts = args.mapNotNull { a -> a.split("=", limit = 2).takeIf { it.size == 2 }?.let { it[0] to it[1] } }.toMap()
    val ontology = YamlOntologyReader(opts["location"] ?: "classpath:ontology/").load().ontology
    println(render(ontology, opts["root"], opts["kinds"]?.split(",")?.map { ConceptEdgeKind.valueOf(it.trim()) }?.toSet(), opts["depth"]?.toInt(), opts["caption"], opts["connected"] == "true"))
}

fun render(ontology: ConceptOntology, root: String?, kinds: Set<ConceptEdgeKind>?, maxDepth: Int?, caption: String? = null, connectedOnly: Boolean = false): String {
    val byId = ontology.concepts.associateBy { it.id }
    val edges = ontology.relations.filter { kinds == null || it.kind in kinds }
    val children = ontology.relations.filter { it.kind == ConceptEdgeKind.CONTAINS }.sortedBy { it.ordinal }.groupBy({ it.from }, { it.to })

    val start = root ?: ontology.domains.first().root
    val depth = linkedMapOf(start to 0)
    val queue = ArrayDeque(listOf(start))
    while (queue.isNotEmpty()) {
        val n = queue.removeFirst()
        val d = depth.getValue(n)
        if (maxDepth != null && d >= maxDepth) continue
        for (c in children[n].orEmpty()) if (c !in depth) { depth[c] = d + 1; queue.addLast(c) }
    }
    val reached = depth.keys
    val drawn = edges.filter { it.from in reached && it.to in reached }
    val inside = if (connectedOnly) reached.filter { id -> drawn.any { it.from == id || it.to == id } }.toSet() else reached
    val key = inside.withIndex().associate { (i, id) -> id to "n$i" }

    val out = StringBuilder()
    out.appendLine("%% caption: ${caption ?: "${byId[start]?.name ?: start} — 온톨로지 파일에서 생성 (revision ${ontology.manifest.revision})"}")
    out.appendLine("flowchart LR")
    for (id in inside) out.appendLine("  ${key[id]}[\"${byId[id]?.name ?: id}\"]")
    for (e in drawn) {
        if (e.from !in inside || e.to !in inside) continue
        val arrow = when (e.kind) {
            ConceptEdgeKind.CONTAINS -> "-->"
            ConceptEdgeKind.FLOWS_TO -> "==>"
            else -> "-.->|${e.kind.name.lowercase()}|"
        }
        out.appendLine("  ${key[e.from]} $arrow ${key[e.to]}")
    }
    return out.toString().trimEnd()
}
