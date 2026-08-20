package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith

class JamoTest : BehaviorSpec({

    given("한글 자모 분해") {
        `when`("받침이 있는 음절이면") {
            then("초성·중성·종성 순으로 편다") {
                Jamo.decompose("경복궁") shouldBe "ㄱㅕㅇㅂㅗㄱㄱㅜㅇ"
            }
        }
        `when`("받침이 없으면") {
            then("종성 자리를 비운다") {
                Jamo.decompose("바다") shouldBe "ㅂㅏㄷㅏ"
            }
        }
        `when`("조합 중간 상태를 치면") {
            then("완성형의 접두가 되어야 한다 — 이게 자모 자동완성의 전부다") {
                Jamo.decompose("경복궁") shouldStartWith Jamo.decompose("경보")
                Jamo.decompose("해운대해수욕장") shouldStartWith Jamo.decompose("해운")
            }
        }
        `when`("영문·숫자가 섞이면") {
            then("소문자로 그대로 둔다 — 버리면 영문 자동완성이 죽는다") {
                Jamo.decompose("Gyeongbokgung Palace") shouldBe "gyeongbokgung palace"
                Jamo.decompose("N서울타워") shouldBe "nㅅㅓㅇㅜㄹㅌㅏㅇㅝ"
            }
        }
        `when`("이미 자모를 치면") {
            then("그대로 둔다") {
                Jamo.decompose("ㄱㅕㅇ") shouldBe "ㄱㅕㅇ"
            }
        }
        `when`("빈 문자열이면") {
            then("빈 문자열") {
                Jamo.decompose("") shouldBe ""
            }
        }
        `when`("겹받침이면") {
            then("한 글자로 둔다 — 색인과 질의가 같은 규칙이면 충분하다") {
                Jamo.decompose("닭") shouldBe "ㄷㅏㄺ"
            }
        }
    }
})
