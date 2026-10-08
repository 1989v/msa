package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class AttractionFeeTest : BehaviorSpec({

    // 재색인이 infoRaw 를 Jackson 으로 푼 모양 그대로 — 행은 Map, serialnum 은 문자열로 온다
    fun row(name: String, text: String, serial: Any? = "0") =
        mapOf("fldgubun" to "1", "infoname" to name, "infotext" to text, "serialnum" to serial, "contenttypeid" to "12")

    given("place use_fee 에 값이 있을 때") {
        `when`("반복정보가 없으면") {
            then("use_fee 를 정규화한 값이다") {
                AttractionFee.text("어른 3,000원<br>어린이 1,000원", null) shouldBe "어른 3,000원\n어린이 1,000원"
            }
        }
        `when`("use_fee 가 「무료」이고 반복정보에 「입장료 3,000원」이 있으면") {
            val fee = AttractionFee.text("무료", listOf(row("입장료", "3,000원")))
            then("use_fee 만 쓰고 반복정보는 보지 않는다 — 입장 판정도 FREE") {
                fee shouldBe "무료"
                AttractionAttributeParser.parse(
                    AttractionAttributeSource(restDate = null, parking = null, feeText = fee, petAcmpyType = null),
                ).freeAdmission shouldBe Admission.FREE
            }
        }
    }

    given("place use_fee 가 공백뿐일 때") {
        `when`("반복정보에 입장료 행이 있으면") {
            then("반복정보 값이다") {
                AttractionFee.text(" \n ", listOf(row("입장료", "무료"))) shouldBe "무료"
            }
        }
    }

    given("반복정보에 요금 행이 둘(관람료 serialnum 3 · 입장료 serialnum 1)일 때") {
        `when`("원천 순서가 serialnum 과 반대면") {
            then("serialnum 순으로 「 / 」로 잇는다") {
                AttractionFee.text(null, listOf(row("관람료", "특별전 5,000원", "3"), row("입장료", "1,000원", "1"))) shouldBe
                    "1,000원 / 특별전 5,000원"
            }
        }
    }

    given("행 이름에 공백이 끼어 있을 때(운영 77 운현궁 「입 장 료」)") {
        `when`("공백을 지우고 보면 「입장료」이므로") {
            then("요금 행으로 고른다") {
                AttractionFee.text(null, listOf(row("입 장 료", "무료"))) shouldBe "무료"
            }
        }
    }

    given("요금 이름이 아닌 행(「주차요금」)만 있을 때") {
        `when`("고르면") {
            then("요금 행이 없으므로 null 이다") {
                AttractionFee.text(null, listOf(row("주차요금", "소형 2,000원"), row("화장실", "있음"))) shouldBe null
            }
        }
    }

    given("반복정보가 배열이 아니라 객체 하나일 때(원천이 1건이면 객체를 준다)") {
        `when`("고르면") {
            then("한 행짜리 목록으로 읽는다") {
                AttractionFee.text(null, row("이용요금", "2,000원")) shouldBe "2,000원"
            }
        }
    }

    given("serialnum 이 수가 아닌 행이 섞여 있을 때") {
        `when`("원천 위치 0 의 행은 serialnum 「가」, 위치 1 의 행은 serialnum 「-1」이면") {
            then("앞 행은 원천 위치 0 을 순서값으로 써서 -1 행 뒤에 온다") {
                AttractionFee.text(null, listOf(row("입장료", "A", "가"), row("관람료", "B", "-1"))) shouldBe "B / A"
            }
        }
    }

    given("infoRaw 가 깨진 JSON 이라 태스클릿이 null 을 넘길 때") {
        `when`("use_fee 도 없으면") {
            then("null 이다") {
                AttractionFee.text(null, null) shouldBe null
            }
        }
    }

    given("요금 원문에 엔티티로 적힌 꺾쇠가 있을 때") {
        `when`("「&lt;어린이&gt; 무료」를 읽으면") {
            then("정규화는 한 번만 — 「<어린이> 무료」가 남는다") {
                AttractionFee.text(null, listOf(row("입장료", "&lt;어린이&gt; 무료"))) shouldBe "<어린이> 무료"
                AttractionFee.text("&lt;어린이&gt; 무료", null) shouldBe "<어린이> 무료"
            }
        }
    }

    given("use_fee 도 요금 행도 없을 때") {
        `when`("반복정보가 빈 목록이거나 문자열이면") {
            then("null 이다") {
                AttractionFee.text("", emptyList<Any>()) shouldBe null
                AttractionFee.text(null, "입장료 무료") shouldBe null
                AttractionFee.text(null, listOf(row("입장료", "  "))) shouldBe null
            }
        }
    }
})
