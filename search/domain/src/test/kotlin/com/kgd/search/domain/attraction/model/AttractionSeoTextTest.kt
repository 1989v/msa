package com.kgd.search.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class AttractionSeoTextTest : BehaviorSpec({

    val tongHttp = "http://tong.visitkorea.or.kr/cms/resource/33/2678633_image2_1.jpg"
    val tongHttps = "https://tong.visitkorea.or.kr/cms/resource/33/2678633_image2_1.jpg"

    given("사진 주소 https 규칙 — tong 주소로 시작할 때만") {
        `when`("http tong 주소면") {
            then("앞의 http: 만 https: 로 바꾼다") {
                AttractionSeoText.secureImageUrl(tongHttp) shouldBe tongHttps
            }
        }
        `when`("이미 https tong 주소면") {
            then("그대로") {
                AttractionSeoText.secureImageUrl(tongHttps) shouldBe tongHttps
            }
        }
        `when`("다른 호스트면") {
            then("http 여도 그대로") {
                AttractionSeoText.secureImageUrl("http://example.com/a.jpg") shouldBe "http://example.com/a.jpg"
            }
        }
        `when`("tong 주소가 다른 호스트 주소 안에 들어 있으면") {
            then("그대로 — 포함이 아니라 시작으로 본다") {
                val evil = "http://evil/?u=http://tong.visitkorea.or.kr/"
                AttractionSeoText.secureImageUrl(evil) shouldBe evil
            }
        }
        `when`("호스트 대소문자가 다르거나 tong 이름으로 시작하는 다른 호스트면") {
            then("그대로") {
                AttractionSeoText.secureImageUrl("http://TONG.VISITKOREA.OR.KR/cms/1.jpg") shouldBe
                    "http://TONG.VISITKOREA.OR.KR/cms/1.jpg"
                AttractionSeoText.secureImageUrl("http://tong.visitkorea.or.kr.evil.com/1.jpg") shouldBe
                    "http://tong.visitkorea.or.kr.evil.com/1.jpg"
            }
        }
        `when`("null 이나 빈 값이면") {
            then("그대로") {
                AttractionSeoText.secureImageUrl(null) shouldBe null
                AttractionSeoText.secureImageUrl("") shouldBe ""
            }
        }
    }
})
