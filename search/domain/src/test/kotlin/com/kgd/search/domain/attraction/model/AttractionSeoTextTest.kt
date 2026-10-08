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

    given("문의 원문 → 전화 항목 (copy.mjs attractionPhone 과 같은 규칙, 전 사례 대조는 search:app PhoneParityTest)") {
        `when`("일반 번호가 둘 이어 붙어 있으면") {
            then("처음 번호 하나만 링크로, 원문은 그대로 보이는 글") {
                AttractionSeoText.attractionPhone("행사장 02-319-1220운영사 02-737-6444") shouldBe
                    AttractionSeoText.Phone("행사장 02-319-1220운영사 02-737-6444", "tel:023191220")
            }
        }
        `when`("국가번호가 붙으면") {
            then("+ 를 남긴다") {
                AttractionSeoText.attractionPhone("+82-2-123-4567")?.href shouldBe "tel:+8221234567"
            }
        }
        `when`("원문에 태그가 섞여 있으면") {
            then("평문화한 뒤 첫 번호를 고른다") {
                AttractionSeoText.attractionPhone("02-123-4567<br>010-1234-5678") shouldBe
                    AttractionSeoText.Phone("02-123-4567\n010-1234-5678", "tel:021234567")
            }
        }
        `when`("대표번호만 있고 한글 바로 뒤에 붙어 있으면") {
            then("대표번호를 링크로") {
                AttractionSeoText.attractionPhone("관광안내전화1330")?.href shouldBe "tel:1330"
                AttractionSeoText.attractionPhone("1588-1234")?.href shouldBe "tel:15881234"
            }
        }
        `when`("번호가 없으면") {
            then("원문만, 링크 없음") {
                AttractionSeoText.attractionPhone("문의: 없음") shouldBe AttractionSeoText.Phone("문의: 없음", null)
            }
        }
        `when`("원문이 비면") {
            then("항목 자체가 없다") {
                AttractionSeoText.attractionPhone(null) shouldBe null
                AttractionSeoText.attractionPhone("") shouldBe null
                AttractionSeoText.attractionPhone("<br>") shouldBe null
            }
        }
    }

    given("원천 출처 표시명 (copy.mjs attractionSourceName)") {
        then("TOURAPI · GOCAMPING 은 국·영 이름") {
            AttractionSeoText.attractionSourceName("TOURAPI", "ko") shouldBe "한국관광공사 TourAPI"
            AttractionSeoText.attractionSourceName("TOURAPI", "en") shouldBe "Korea Tourism Organization TourAPI"
            AttractionSeoText.attractionSourceName("GOCAMPING", "ko") shouldBe "한국관광공사 고캠핑"
            AttractionSeoText.attractionSourceName("GOCAMPING", "en") shouldBe "Korea Tourism Organization GoCamping"
        }
        then("null 과 표에 없는 값은 null — TourAPI 로 짐작하지 않는다") {
            AttractionSeoText.attractionSourceName(null, "ko") shouldBe null
            AttractionSeoText.attractionSourceName("KTO_ETC", "en") shouldBe null
            AttractionSeoText.attractionSourceName("tourapi", "ko") shouldBe null
        }
    }
})
