package com.kgd.search.application.attraction.ltr

import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * LightGBM 랭커 트리 평가기. 학습은 서버 밖(`scripts/search-eval/ltr-offline/export.py`)에서 하고,
 * 여기서는 내보낸 트리를 그대로 따라 내려가 잎 값을 더한다 — 점수는 LightGBM `predict(raw_score=True)` 와 같다.
 *
 * 분할은 수치형 `<=` 만 받는다. 범주형 분할이나 결측 규칙이 다른 모델이 오면 읽을 때 실패시킨다 —
 * 모르는 규칙을 `<=` 로 읽으면 점수가 조용히 틀린다.
 */
class LtrTreeModel private constructor(
    val featureNames: List<String>,
    private val trees: List<Node>,
) {
    fun score(features: DoubleArray): Double {
        require(features.size == featureNames.size) { "피처 ${features.size}개 — 모델은 ${featureNames.size}개를 받는다" }
        return trees.sumOf { it.value(features) }
    }

    private sealed interface Node {
        fun value(x: DoubleArray): Double
    }

    private class Leaf(private val leaf: Double) : Node {
        override fun value(x: DoubleArray) = leaf
    }

    private class Split(
        private val feature: Int,
        private val threshold: Double,
        private val left: Node,
        private val right: Node,
    ) : Node {
        // 결측 규칙이 None 이면 LightGBM 은 NaN 을 0 으로 읽는다
        override fun value(x: DoubleArray): Double {
            val v = x[feature].let { if (it.isNaN()) 0.0 else it }
            return if (v <= threshold) left.value(x) else right.value(x)
        }
    }

    companion object {
        fun parse(json: String, objectMapper: ObjectMapper): LtrTreeModel {
            val root = objectMapper.readTree(json)
            check(root.path("objective").asString().startsWith("lambdarank")) { "lambdarank 모델이 아니다: ${root.path("objective")}" }
            val names = root.path("feature_names").items().map { it.asString() }
            val trees = root.path("trees").items().map { node(it, names.size) }
            check(trees.isNotEmpty()) { "트리가 없다" }
            return LtrTreeModel(names, trees)
        }

        /** 배열 노드의 원소 — Jackson 3 의 JsonNode 는 코틀린 컬렉션 확장을 그대로 받지 않는다 */
        private fun JsonNode.items(): List<JsonNode> = (0 until size()).map { get(it) }

        private fun node(n: JsonNode, featureCount: Int): Node {
            if (n.has("leaf_value")) return Leaf(n.path("leaf_value").asDouble())
            check(n.path("decision_type").asString() == "<=") { "수치형 분할만 읽는다: ${n.path("decision_type")}" }
            check(n.path("missing_type").asString() == "None") { "결측 규칙 None 만 읽는다: ${n.path("missing_type")}" }
            val feature = n.path("split_feature").asInt()
            check(feature in 0 until featureCount) { "피처 번호 $feature 가 이름표 밖이다" }
            return Split(
                feature = feature,
                threshold = n.path("threshold").asDouble(),
                left = node(n.path("left_child"), featureCount),
                right = node(n.path("right_child"), featureCount),
            )
        }
    }
}
