package com.kgd.search.domain.attraction.model

import io.kotest.assertions.assertSoftly
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainAll
import io.kotest.matchers.shouldBe
import java.time.DayOfWeek

class AttractionAttributeParserTest : BehaviorSpec({

    val fixtures = loadFixtures()

    fun rowsOf(vararg fields: String) = fixtures.filter { row -> fields.any { row.field.startsWith(it) } }

    given("운영 원문 픽스처를 읽을 때") {
        `when`("파일을 열면") {
            then("속성마다 국·영 표본이 있어야 한다 — 비어 있으면 아래 표 검사가 아무것도 재지 않는다") {
                fixtures.size shouldBe 145
                fixtures.map { it.field to it.lang }.toSet() shouldContainAll listOf(
                    "restDate" to "ko", "restDate" to "en",
                    "parking" to "ko", "parking" to "en",
                    "useFee" to "ko", "useFee" to "en",
                    "petAcmpyType" to "ko",
                )
                rowsOf("chkcreditcard").size shouldBe 12
                rowsOf("chkbabycarriage").size shouldBe 6
            }
        }
    }

    given("정기휴무 원문을 해석할 때") {
        `when`("국·영 운영 원문이 주어지면") {
            then("연중무휴 · 매주 요일 · 명절만(빈 집합) · 조건부(UNKNOWN) 로 갈린다") {
                assertSoftly {
                    rowsOf("restDate").forEach { row ->
                        withClue("[${row.lang}] ${row.raw}") {
                            parse(restDate = row.raw).regularClosure.encode() shouldBe row.expected
                        }
                    }
                }
            }
        }
        `when`("명절만 쉬는 곳과 원문이 없는 곳을 비교하면") {
            then("앞은 요일 집합을 아는 빈 집합이고 뒤는 UNKNOWN 이다 — 둘을 섞으면 모르는 곳이 「오늘 쉼 아님」에 들어간다") {
                parse(restDate = "명절").regularClosure shouldBe RegularClosure.Weekly(emptySet())
                parse(restDate = null).regularClosure shouldBe RegularClosure.Unknown
                parse(restDate = "매주 월요일").regularClosure shouldBe RegularClosure.Weekly(setOf(DayOfWeek.MONDAY))
            }
        }
    }

    given("주차 원문을 해석할 때") {
        `when`("HTML 줄바꿈·영문 표기가 섞인 원문이 주어지면") {
            then("가능/있음/Available 은 YES, 불가/없음/Not available 은 NO, 나머지는 UNKNOWN") {
                assertSoftly {
                    rowsOf("parking").forEach { row ->
                        withClue("[${row.lang}] ${row.raw}") {
                            parse(parking = row.raw).parking.name shouldBe row.expected
                        }
                    }
                }
            }
        }
    }

    given("반려동물 원문(petAcmpyType)을 해석할 때") {
        `when`("운영에 있는 두 값과 빈 값이 주어지면") {
            then("전구역은 ALLOWED, 일부구역은 PARTIAL, 빈 값은 UNKNOWN 이다") {
                assertSoftly {
                    rowsOf("petAcmpyType").forEach { row ->
                        withClue("[${row.lang}] '${row.raw}'") {
                            parse(petAcmpyType = row.raw).petPolicy.name shouldBe row.expected
                        }
                    }
                }
            }
        }
        `when`("영문 문서처럼 원천이 값을 주지 않으면") {
            then("불가가 아니라 UNKNOWN 이다") {
                parse(petAcmpyType = null).petPolicy shouldBe PetPolicy.UNKNOWN
            }
        }
    }

    given("신용카드·유모차 대여를 introRaw 에서 읽을 때") {
        `when`("유형별 접미사가 붙은 키가 주어지면") {
            then("있는 키를 찾아 가능/모든 카드는 YES, 불가/없음은 NO, 조건이 붙은 값은 UNKNOWN") {
                assertSoftly {
                    rowsOf("chkcreditcard").forEach { row ->
                        withClue("${row.field}=${row.raw}") {
                            parse(intro = mapOf(row.field to row.raw)).creditCard.name shouldBe row.expected
                        }
                    }
                    rowsOf("chkbabycarriage").forEach { row ->
                        withClue("${row.field}=${row.raw}") {
                            parse(intro = mapOf(row.field to row.raw)).strollerRental.name shouldBe row.expected
                        }
                    }
                }
            }
        }
        `when`("영문 문서처럼 chk 키가 하나도 없으면") {
            then("둘 다 UNKNOWN 이다") {
                val attributes = parse(intro = mapOf("parkingfood" to "Available", "restdatefood" to "Mondays"))
                attributes.creditCard shouldBe Availability.UNKNOWN
                attributes.strollerRental shouldBe Availability.UNKNOWN
            }
        }
    }

    given("입장 무료를 해석할 때") {
        `when`("국·영 요금 원문이 주어지면") {
            then("금액 없는 무료/Free 는 FREE, 금액이 있으면 PAID, 무료와 금액이 섞이거나 상이하면 UNKNOWN") {
                assertSoftly {
                    rowsOf("useFee").forEach { row ->
                        withClue("[${row.lang}] ${row.raw}") {
                            parse(useFee = row.raw).freeAdmission.name shouldBe row.expected
                        }
                    }
                }
            }
        }
        `when`("레포츠(28)처럼 접힌 요금 컬럼이 비고 introRaw 에만 usefeeleports 가 있으면") {
            then("UNKNOWN 이다 — 요금은 접힌 컬럼만 읽는다") {
                parse(useFee = null, intro = mapOf("usefeeleports" to "무료")).freeAdmission shouldBe Admission.UNKNOWN
            }
        }
    }

    given("파생 결과를 만들 때") {
        `when`("아무 원문이 없으면") {
            then("모든 속성이 UNKNOWN 이고 파서 버전이 실린다") {
                val attributes = parse()
                attributes.regularClosure shouldBe RegularClosure.Unknown
                attributes.parking shouldBe Availability.UNKNOWN
                attributes.petPolicy shouldBe PetPolicy.UNKNOWN
                attributes.creditCard shouldBe Availability.UNKNOWN
                attributes.strollerRental shouldBe Availability.UNKNOWN
                attributes.freeAdmission shouldBe Admission.UNKNOWN
                attributes.parserVersion shouldBe AttractionAttributeParser.VERSION
            }
        }
    }
})

private data class FixtureRow(val field: String, val lang: String, val expected: String, val raw: String)

private fun loadFixtures(): List<FixtureRow> =
    AttractionAttributeParserTest::class.java.getResourceAsStream("/attributes/raw-fixtures.tsv")!!
        .bufferedReader()
        .readLines()
        .filter { it.isNotEmpty() && !it.startsWith("#") }
        .map { line ->
            val cols = line.split('\t', limit = 4)
            FixtureRow(cols[0], cols[1], cols[2], cols.getOrElse(3) { "" })
        }

private fun parse(
    restDate: String? = null,
    parking: String? = null,
    useFee: String? = null,
    petAcmpyType: String? = null,
    intro: Map<String, String?> = emptyMap(),
) = AttractionAttributeParser.parse(
    AttractionAttributeSource(
        restDate = restDate,
        parking = parking,
        useFee = useFee,
        petAcmpyType = petAcmpyType,
        intro = intro,
    ),
)

private fun RegularClosure.encode(): String = when (this) {
    RegularClosure.AlwaysOpen -> "ALWAYS_OPEN"
    RegularClosure.Unknown -> "UNKNOWN"
    is RegularClosure.Weekly -> "WEEKLY:" + closedDays.sorted().joinToString(",") { it.name.take(3) }
}
