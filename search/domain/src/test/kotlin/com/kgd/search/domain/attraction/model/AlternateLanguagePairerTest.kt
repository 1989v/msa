package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.maps.shouldBeEmpty
import io.kotest.matchers.shouldBe
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper

/**
 * 국문 문서 ↔ 영문 문서의 언어 대체 짝 판정.
 * 오라클은 운영 표본 30쌍(57개 문서)이고, 표본으로 못 가르는 조건(일대일·거리·개요)은 합성 사례로 본다.
 */
class AlternateLanguagePairerTest : BehaviorSpec({

    fun ko(
        id: String,
        title: String,
        placeId: String? = "P1",
        type: String = ContentTypeLang.ATTRACTION.ko,
        lat: Double = 37.5,
        lon: Double = 127.0,
        hasOverview: Boolean = true,
    ) = RegionProjection(
        id = id, contentId = "c$id", lang = "ko", ldongRegnCd = null, ldongSignguCd = null, contentTypeId = type,
        lclsSystm3 = null, latitude = lat, longitude = lon, title = title, eventPeriod = null,
        googlePlaceId = placeId, titleLocal = null, hasOverview = hasOverview,
    )

    fun en(
        id: String,
        titleLocal: String?,
        placeId: String? = "P1",
        type: String? = ContentTypeLang.ATTRACTION.en,
        lat: Double = 37.5,
        lon: Double = 127.0,
        hasOverview: Boolean = true,
    ) = RegionProjection(
        id = id, contentId = "c$id", lang = "en", ldongRegnCd = null, ldongSignguCd = null, contentTypeId = type,
        lclsSystm3 = null, latitude = lat, longitude = lon, title = "English $id", eventPeriod = null,
        googlePlaceId = placeId, titleLocal = titleLocal, hasOverview = hasOverview,
    )

    /** Jackson 3 의 `JsonNode.map` 은 컬렉션 map 이 아니다 — 원소 목록으로 바꿔 쓴다. */
    fun JsonNode.items(): List<JsonNode> = (this as Iterable<JsonNode>).toList()

    /** 정북으로 [meters] 만큼 옮긴 위도 — 판정과 같은 거리 함수로 다시 재서 전제를 확인한다. */
    fun northOf(lat: Double, meters: Int) = lat + Math.toDegrees(meters / 6_371_000.0)

    given("운영 표본 30쌍 — 57개 문서를 한 번에 넣으면") {
        val oracle: JsonNode = ObjectMapper().readTree(
            AlternateLanguagePairerTest::class.java.getResource("/attraction/alternate-pairs-oracle.json")!!.readText(),
        )
        val projections = oracle.path("documents").items().map { d ->
            fun text(field: String) = d.path(field).takeIf { it.isString }?.asString()
            RegionProjection(
                id = text("id")!!, contentId = "c${text("id")}", lang = text("lang")!!, ldongRegnCd = null, ldongSignguCd = null,
                contentTypeId = text("contentTypeId"), lclsSystm3 = null,
                latitude = d.path("latitude").asDouble(), longitude = d.path("longitude").asDouble(),
                title = text("title")!!, eventPeriod = null,
                googlePlaceId = text("googlePlaceId"), titleLocal = text("titleLocal"), hasOverview = true,
            )
        }
        val result = AlternateLanguagePairer.pair(projections)

        then("문서 57개 · 쌍 30개가 실려 있다") {
            projections.size shouldBe 57
            oracle.path("pairs").size() shouldBe 30
        }

        then("쌍마다 판정이 기대값과 같다 — 짝 16 · 없음 14") {
            val actual = oracle.path("pairs").items().map { p ->
                val en = p.path("en").asString()
                val ko = p.path("ko").asString()
                val paired = result.pairs[en] == ko && result.pairs[ko] == en
                p.path("no").asInt() to (if (paired) "pair" else "none")
            }
            val expected = oracle.path("pairs").items().map { p -> p.path("no").asInt() to p.path("expected").asString() }
            actual shouldBe expected
            expected.count { it.second == "pair" } shouldBe 16
        }

        then("결과는 양방향이고, 짝이 아닌 문서는 키가 없다") {
            result.pairs.forEach { (id, other) -> (id to result.pairs[other]) shouldBe (id to id) }
            result.pairs.size shouldBe 32
            result.pairCount shouldBe 16
        }

        then("placeId 가 둘 다 있지만 다른 같은 범위 쌍(#27 하동야생차박물관)은 짝이 아니다") {
            result.pairs.containsKey("18066") shouldBe false
            result.pairs.containsKey("16043") shouldBe false
        }
    }

    given("조건 ① placeId") {
        then("한쪽이 비었거나 둘이 다르면 짝이 아니고, 같으면 짝이다") {
            AlternateLanguagePairer.pair(listOf(ko("1", "경복궁", placeId = ""), en("2", "경복궁"))).pairs.shouldBeEmpty()
            AlternateLanguagePairer.pair(listOf(ko("1", "경복궁"), en("2", "경복궁", placeId = null))).pairs.shouldBeEmpty()
            AlternateLanguagePairer.pair(listOf(ko("1", "경복궁", placeId = "A"), en("2", "경복궁", placeId = "B"))).pairs.shouldBeEmpty()
            AlternateLanguagePairer.pair(listOf(ko("1", "경복궁"), en("2", "경복궁"))).pairs shouldBe mapOf("1" to "2", "2" to "1")
        }
    }

    given("조건 ② 거리 — 정북 50m 와 51m") {
        val base = ko("1", "경복궁")
        val at50 = en("2", "경복궁", lat = northOf(base.latitude, 50))
        val at51 = en("3", "경복궁", lat = northOf(base.latitude, 51))
        then("50m 는 짝, 51m 는 짝이 아니다") {
            RegionAggregator.distanceMeters(base, at50) shouldBe 50
            RegionAggregator.distanceMeters(base, at51) shouldBe 51
            AlternateLanguagePairer.pair(listOf(base, at50)).pairs shouldBe mapOf("1" to "2", "2" to "1")
            AlternateLanguagePairer.pair(listOf(base, at51)).pairs.shouldBeEmpty()
        }
    }

    given("조건 ③ 유형 — 코드 문자열이 아니라 대응표의 언어 중립 유형으로 비교한다") {
        then("국 12 ↔ 영 76 은 짝, 국 12 ↔ 영 75 는 아니다") {
            AlternateLanguagePairer.pair(listOf(ko("1", "남산", type = "12"), en("2", "남산", type = "76"))).pairs.size shouldBe 2
            AlternateLanguagePairer.pair(listOf(ko("1", "남산", type = "12"), en("2", "남산", type = "75"))).pairs.shouldBeEmpty()
        }
        then("국 28 ↔ 영 75(레포츠)는 짝이다 — 코드가 달라도 같은 유형") {
            AlternateLanguagePairer.pair(listOf(ko("1", "강원랜드 카지노", type = "28"), en("2", "강원랜드 카지노", type = "75"))).pairs.size shouldBe 2
        }
        then("코스(국 25)·행사(15/85)는 짝 판정에서 빠진다") {
            AlternateLanguagePairer.pair(listOf(ko("1", "남산 코스", type = "25"), en("2", "남산 코스", type = "76"))).pairs.shouldBeEmpty()
            AlternateLanguagePairer.pair(listOf(ko("1", "남산 축제", type = "15"), en("2", "남산 축제", type = "85"))).pairs.shouldBeEmpty()
        }
        then("표에 없는 코드·유형 없음은 짝이 아니다") {
            AlternateLanguagePairer.pair(listOf(ko("1", "남산", type = "99"), en("2", "남산", type = "99"))).pairs.shouldBeEmpty()
            AlternateLanguagePairer.pair(listOf(ko("1", "남산"), en("2", "남산", type = null))).pairs.shouldBeEmpty()
        }
    }

    given("조건 ④ 제목 — 영문 문서의 로컬명과 국문 표시명") {
        then("NFKC·공백·대소문자만 다르면 짝이다") {
            // 전각 영숫자(NFKC)·줄 바꿈·NBSP·대소문자
            AlternateLanguagePairer.pair(
                listOf(ko("1", "문화역 서울 284 ABC"), en("2", "문화역\n서울 ２８４ abc")),
            ).pairs.size shouldBe 2
        }
        then("제목이 다르면 짝이 아니다") {
            AlternateLanguagePairer.pair(listOf(ko("1", "월미 관광특구"), en("2", "월미짱랜드"))).pairs.shouldBeEmpty()
        }
        then("영문 문서에 로컬명이 없으면 짝이 아니다") {
            AlternateLanguagePairer.pair(listOf(ko("1", "남산"), en("2", null))).pairs.shouldBeEmpty()
            AlternateLanguagePairer.pair(listOf(ko("1", "남산"), en("2", " "))).pairs.shouldBeEmpty()
        }
    }

    given("일대일 — 국문 둘이 영문 하나와 ①~④ 를 모두 만족하면") {
        val result = AlternateLanguagePairer.pair(listOf(ko("1", "남산"), ko("3", "남산"), en("2", "남산")))
        then("어느 쪽도 짝이 아니다") {
            result.pairs.shouldBeEmpty()
            result.edges shouldBe 2
            result.droppedByUniqueness shouldBe 2
        }
    }

    given("한쪽에 개요가 없으면") {
        then("짝이 아니다 — 개요 없는 상세는 noindex 라 hreflang 상대가 될 수 없다") {
            AlternateLanguagePairer.pair(listOf(ko("1", "남산", hasOverview = false), en("2", "남산"))).pairs.shouldBeEmpty()
            AlternateLanguagePairer.pair(listOf(ko("1", "남산"), en("2", "남산", hasOverview = false))).pairs.shouldBeEmpty()
        }
    }

    given("통계") {
        val result = AlternateLanguagePairer.pair(
            listOf(
                ko("1", "경복궁", placeId = "A"), en("2", "경복궁", placeId = "A"), // 짝
                ko("3", "남산", placeId = "B"), ko("4", "남산", placeId = "B"), en("5", "남산", placeId = "B"), // 일대다
                ko("6", "북촌", placeId = "C", hasOverview = false), en("7", "북촌", placeId = "C"), // 개요 없음
                ko("8", "덕수궁", placeId = "D"), en("9", "Deoksugung", placeId = "D"), // 제목 불일치 — 간선 아님
            ),
        )
        then("간선 · 일대일 탈락 · 개요 탈락 · 짝 수를 센다") {
            result.edges shouldBe 4
            result.droppedByUniqueness shouldBe 2
            result.droppedByOverview shouldBe 1
            result.pairCount shouldBe 1
            result.pairs shouldBe mapOf("1" to "2", "2" to "1")
        }
    }
})
