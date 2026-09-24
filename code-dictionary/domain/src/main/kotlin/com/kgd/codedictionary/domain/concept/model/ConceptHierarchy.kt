package com.kgd.codedictionary.domain.concept.model

/**
 * `CONTAINS` 간선만으로 층을 센 결과. 진입점(부모 없는 노드)이 깊이 0 이다.
 *
 * 트리가 아니라 DAG 다 — 한 개념이 두 부모를 가질 수 있고(임베딩은 인제스트와 검색어 양쪽에
 * 걸린다), 그때 깊이는 **가장 짧은 경로**로 잰다. 순환은 방문 표시로 끊는다.
 * `CONTAINS` 가 아닌 간선은 양 끝이 모두 층 안에 있을 때만 남긴다.
 */
class ConceptHierarchy private constructor(
    val roots: List<String>,
    /** 층 안에 있는 개념 → 깊이 */
    val depthOf: Map<String, Int>,
    /** 층 안에서 살아남은 간선 (CONTAINS 는 ordinal 순, 나머지는 원래 순서) */
    val edges: List<ConceptEdge>,
) {
    val conceptIds: Set<String> get() = depthOf.keys

    companion object {
        /**
         * @param root 시작 개념. null 이면 `CONTAINS` 의 부모가 없는 모든 개념이 진입점이다.
         */
        fun build(edges: List<ConceptEdge>, root: String? = null): ConceptHierarchy {
            val contains = edges.filter { it.kind == ConceptEdgeKind.CONTAINS }.sortedBy { it.ordinal }
            val childrenOf = contains.groupBy({ it.fromConceptId }, { it.toConceptId })
            val hasParent = contains.map { it.toConceptId }.toSet()

            val roots = when (root) {
                null -> contains.map { it.fromConceptId }.distinct().filter { it !in hasParent }
                else -> if (contains.any { it.fromConceptId == root || it.toConceptId == root }) listOf(root) else emptyList()
            }

            val depthOf = linkedMapOf<String, Int>()
            val queue = ArrayDeque<String>()
            roots.forEach { depthOf[it] = 0; queue.add(it) }
            while (queue.isNotEmpty()) {
                val current = queue.removeFirst()
                val nextDepth = depthOf.getValue(current) + 1
                childrenOf[current].orEmpty().forEach { child ->
                    if (child !in depthOf) {
                        depthOf[child] = nextDepth
                        queue.add(child)
                    }
                }
            }

            val inside = depthOf.keys
            val kept = contains.filter { it.fromConceptId in inside && it.toConceptId in inside } +
                edges.filter { it.kind != ConceptEdgeKind.CONTAINS && it.fromConceptId in inside && it.toConceptId in inside }
            return ConceptHierarchy(roots = roots, depthOf = depthOf, edges = kept)
        }
    }
}
