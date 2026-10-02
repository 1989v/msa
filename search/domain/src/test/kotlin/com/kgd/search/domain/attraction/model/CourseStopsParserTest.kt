package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import tools.jackson.databind.ObjectMapper

class CourseStopsParserTest : BehaviorSpec({

    // 재색인이 하듯 infoRaw 문자열을 Jackson 으로 푼 값을 넘긴다
    val mapper = ObjectMapper()
    fun decode(json: String): Any? = mapper.readValue(json, Any::class.java)
    fun row(subnum: Any?, contentId: String, name: String) =
        mapOf("contentid" to "1", "contenttypeid" to "25", "subnum" to subnum, "subcontentid" to contentId, "subname" to name)

    given("운영 표본 코스(1965837, detailInfo2 원문 8건)") {
        val raw = CourseStopsParserTest::class.java.getResource("/course/info-raw-1965837-ko.json")!!.readText()
        val ids = mapOf(
            AttractionKey("ko", "128138") to 11L,
            AttractionKey("ko", "128168") to 14L,
            AttractionKey("ko", "1870538") to 15L,
        )
        val result = CourseStopsParser.parse(decode(raw), "ko", ids)

        `when`("풀면") {
            then("8개 지점이 subnum 순서로 나오고 같은 subnum(3·4)은 원천 순서를 지킨다") {
                result.warning shouldBe null
                result.stops.map { it.contentId } shouldContainExactly
                    listOf("128138", "125551", "129195", "128168", "1870538", "128168", "129196", "129196")
                result.stops.map { it.order } shouldContainExactly listOf(0, 1, 2, 3, 3, 4, 4, 5)
            }
            then("이름 끝 공백은 지우고, 같은 언어 관광지가 있는 지점만 id 가 붙는다") {
                result.stops[4].name shouldBe "점심(파머스테이블)"
                result.stops.map { it.attractionId } shouldContainExactly listOf(11L, null, null, 14L, 15L, 14L, null, null)
            }
        }
    }

    given("subnum 이 문자열로 1 · 10 · 2 순서로 올 때") {
        val info = listOf(row("10", "c10", "열"), row("1", "c1", "하나"), row("2", "c2", "둘"))
        `when`("풀면") {
            then("수 값 오름차순 1, 2, 10 — 문자열 정렬이면 10 이 2 앞에 온다") {
                CourseStopsParser.parse(info, "ko", emptyMap()).stops.map { it.order } shouldContainExactly listOf(1, 2, 10)
            }
        }
    }

    given("구성 지점이 1건이라 원천이 배열 대신 객체 하나를 줄 때") {
        `when`("풀면") {
            then("지점 하나로 읽는다") {
                val result = CourseStopsParser.parse(decode("""{"subnum":"0","subcontentid":"125551","subname":"서삼릉"}"""), "ko", emptyMap())
                result.warning shouldBe null
                result.stops shouldContainExactly listOf(CourseStop(0, "125551", "서삼릉", null))
            }
        }
    }

    given("infoRaw 가 비어 있을 때") {
        `when`("null · 빈 배열이면") {
            then("필드 없음 — 경고도 없다") {
                listOf(null, decode("[]")).forEach {
                    val result = CourseStopsParser.parse(it, "ko", emptyMap())
                    result.stops shouldBe emptyList()
                    result.warning shouldBe null
                }
            }
        }
    }

    given("언어가 다른 관광지만 같은 contentId 를 가질 때") {
        val info = listOf(row("1", "125551", "서삼릉"), row("2", "128138", "원당종마목장"))
        val ids = mapOf(AttractionKey("en", "128138") to 99L, AttractionKey("ko", "125551") to 7L)
        `when`("국문 코스로 풀면") {
            then("영문 관광지와 매칭하지 않는다 — 같은 실행의 국문 지점은 매칭된다(양성 대조)") {
                CourseStopsParser.parse(info, "ko", ids).stops.map { it.attractionId } shouldContainExactly listOf(7L, null)
            }
        }
    }

    given("해석할 수 없는 원문") {
        `when`("subnum 이 수가 아니거나 · 이름이 비었거나 · 행이 객체가 아니면") {
            then("구성 전체를 비우고 경고 사유를 남긴다") {
                listOf<Any?>(
                    listOf(row("1", "a", "하나"), row("둘", "b", "둘")),
                    listOf(row("1", "a", " ")),
                    listOf("x"),
                    "문자열",
                ).forEach {
                    val result = CourseStopsParser.parse(it, "ko", emptyMap())
                    result.stops shouldBe emptyList()
                    result.warning shouldNotBe null
                }
            }
        }
    }
})
