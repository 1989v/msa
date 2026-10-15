package com.kgd.search.application.attraction.ltr

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.springframework.core.io.ClassPathResource
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper

class LtrTreeModelTest : BehaviorSpec({
    val mapper = JsonMapper.builder().build()
    fun JsonNode.items(): List<JsonNode> = (0 until size()).map { get(it) }
    fun resource(path: String) = ClassPathResource(path).inputStream.use { it.readAllBytes().decodeToString() }

    given("운영 모델 파일") {
        val model = LtrTreeModel.parse(resource("ltr/attractions-2026-10-15.json"), mapper)
        // 대조 파일은 export.py 가 학습 행 60개를 LightGBM predict(raw_score=True) 로 채점한 값이다
        val parity = mapper.readTree(resource("ltr/attractions-2026-10-15-parity.json"))

        `when`("LightGBM 이 채점한 학습 행을 같은 피처로 넣으면") {
            then("피처 이름표가 같고 점수가 같다") {
                model.featureNames shouldBe parity.path("feature_names").items().map { it.asString() }
                val cases = parity.path("cases").items()
                cases.size shouldBe 60
                cases.forEach { c ->
                    val x = c.path("x").items().map { it.asDouble() }.toDoubleArray()
                    model.score(x) shouldBe (c.path("score").asDouble() plusOrMinus 1e-9)
                }
            }
        }
        `when`("피처 수가 모델과 다르면") {
            then("채점하지 않는다") {
                shouldThrow<IllegalArgumentException> { model.score(DoubleArray(3)) }
            }
        }
    }

    given("평가기가 모르는 분할") {
        `when`("범주형 분할이 오면") {
            then("읽을 때 실패한다 — `<=` 로 읽으면 점수가 조용히 틀린다") {
                val json = """
                    {"objective":"lambdarank","feature_names":["a"],"trees":[
                      {"split_feature":0,"threshold":"1||2","decision_type":"==","default_left":true,"missing_type":"None",
                       "left_child":{"leaf_value":1.0},"right_child":{"leaf_value":0.0}}]}
                """.trimIndent()
                shouldThrow<IllegalStateException> { LtrTreeModel.parse(json, mapper) }.message shouldContain "수치형"
            }
        }
    }
})
