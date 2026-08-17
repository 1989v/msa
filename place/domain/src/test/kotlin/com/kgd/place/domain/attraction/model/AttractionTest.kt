package com.kgd.place.domain.attraction.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class AttractionTest : BehaviorSpec({
    fun gyeongbokgung(lang: String = "ko") = Attraction.create(
        contentId = "126508",
        lang = lang,
        title = if (lang == "ko") "경복궁" else "Gyeongbokgung Palace",
        latitude = 37.5788,
        longitude = 126.9770,
        areaCode = "1",
        category = "역사",
    )

    given("Attraction 생성 시") {
        `when`("유효한 국문 관광지 정보가 주어지면") {
            then("ACTIVE 상태로 생성되어야 한다") {
                val attraction = gyeongbokgung()
                attraction.contentId shouldBe "126508"
                attraction.lang shouldBe "ko"
                attraction.status shouldBe "ACTIVE"
            }
        }
        `when`("지원하지 않는 언어면") {
            then("IllegalArgumentException 이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> { gyeongbokgung(lang = "jp") }
            }
        }
        `when`("위도가 범위를 벗어나면") {
            then("IllegalArgumentException 이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    Attraction.create(
                        contentId = "1", lang = "ko", title = "Bad",
                        latitude = 100.0, longitude = 126.0,
                    )
                }
            }
        }
        `when`("빈 값 옵션 필드가 주어지면") {
            then("null 로 정규화되어야 한다") {
                val attraction = Attraction.create(
                    contentId = "1", lang = "en", title = "Test",
                    latitude = 37.0, longitude = 127.0, overview = " ", tel = "",
                )
                attraction.overview shouldBe null
                attraction.tel shouldBe null
            }
        }
    }

    given("Attraction 동기화(syncFrom) 시") {
        `when`("같은 자연키의 최신 원천이 주어지면") {
            then("가변 필드가 전체 동기화되어야 한다") {
                val existing = gyeongbokgung()
                val latest = Attraction.create(
                    contentId = "126508", lang = "ko", title = "경복궁(고궁)",
                    latitude = 37.5789, longitude = 126.9771, overview = "조선의 법궁",
                )
                existing.syncFrom(latest)
                existing.title shouldBe "경복궁(고궁)"
                existing.overview shouldBe "조선의 법궁"
                existing.latitude shouldBe 37.5789
            }
        }
        `when`("개요 없는 목록 원천이 주어지면") {
            then("이미 채워둔 개요는 지워지지 않아야 한다") {
                // 개요는 건당 1콜인 상세 조회로만 채운다. 목록 재동기화가 덮어쓰면
                // 며칠 걸려 모은 값이 한 번에 날아간다.
                val existing = gyeongbokgung().apply { syncFrom(
                    Attraction.create(
                        contentId = "126508", lang = "ko", title = "경복궁",
                        latitude = 37.5788, longitude = 126.977,
                        overview = "조선 왕조 제일의 법궁",
                    )
                ) }
                existing.overview shouldBe "조선 왕조 제일의 법궁"

                existing.syncFrom(
                    Attraction.create(
                        contentId = "126508", lang = "ko", title = "경복궁",
                        latitude = 37.5788, longitude = 126.977,
                    )
                )
                existing.overview shouldBe "조선 왕조 제일의 법궁"
            }
        }
        `when`("자연키가 다른 원천이 주어지면") {
            then("IllegalArgumentException 이 발생해야 한다") {
                shouldThrow<IllegalArgumentException> {
                    gyeongbokgung().syncFrom(gyeongbokgung(lang = "en"))
                }
            }
        }
    }
})
