package com.kgd.codedictionary.infrastructure.opensearch.adapter

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import jakarta.json.Json
import jakarta.json.JsonValue
import org.opensearch.client.json.JsonData
import org.opensearch.client.json.jsonb.JsonbJsonpMapper

/**
 * 검색 응답의 _source 를 Map 으로 바꾼 값 — 실제 클라이언트와 같은 JsonData.to(Map) 경로로 만든다.
 * 따옴표가 한 겹 더 붙던 개념 검색 응답(`"\"lattice-viterbi\""`)이 되돌아오면 여기서 막힌다.
 */
class JsonValueUnwrapTest : BehaviorSpec({
    val source = Json.createObjectBuilder()
        .add("concept_id", "lattice-viterbi")
        .add("line_start", 12)
        .addNull("code_snippet")
        .build()

    @Suppress("UNCHECKED_CAST")
    val map = JsonData.of(source).to(Map::class.java, JsonbJsonpMapper()) as Map<String, Any?>

    given("검색 _source 의 값") {
        then("문자열은 따옴표 없이, JSON null 은 null 로, 숫자는 숫자로 꺼낸다") {
            jsonText(map["concept_id"]) shouldBe "lattice-viterbi"
            jsonText(map["code_snippet"]) shouldBe null
            jsonInt(map["line_start"]) shouldBe 12
            jsonText(map["missing"]) shouldBe null
            jsonText(JsonValue.NULL) shouldBe null
        }
    }
})
