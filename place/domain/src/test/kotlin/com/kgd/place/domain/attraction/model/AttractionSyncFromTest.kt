package com.kgd.place.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 갱신 경로는 전부 [Attraction.syncFrom] 을 지난다 — **여기 한 줄이 없으면 값이 조용히 사라진다.**
 * 반려동물 필드가 DTO·커맨드·엔티티에 다 있는데 이 함수에만 없어서, 로그가 「갱신 9,583건」을
 * 찍는데 컬럼은 0건이었다 (2026-09-08).
 */
class AttractionSyncFromTest : BehaviorSpec({

    fun base(petType: String? = null, overview: String? = null) = Attraction.create(
        contentId = "126508", lang = "ko", title = "경복궁",
        latitude = 37.5788, longitude = 126.977,
        overview = overview, petAcmpyType = petType,
    )

    Given("실내·실외 파생 값을 가진 기존 레코드") {
        When("그 값이 없는 목록 동기화가 덮으려 하면") {
            val existing = base().apply { setting = "indoor" }
            existing.syncFrom(base())

            Then("백필이 채운 값은 지워지지 않는다") {
                existing.setting shouldBe "indoor"
            }
        }
    }

    Given("보강 필드를 가진 기존 레코드") {
        When("보강 필드가 빈 목록 동기화가 덮으려 하면") {
            val existing = base(petType = "전구역 동반가능", overview = "조선의 법궁")
            existing.syncFrom(base())

            Then("보강 필드는 지워지지 않는다") {
                existing.petAcmpyType shouldBe "전구역 동반가능"
                existing.overview shouldBe "조선의 법궁"
            }
        }

        When("반려동물 수집이 값을 들고 오면") {
            val existing = base()
            val incoming = Attraction.create(
                contentId = "126508", lang = "ko", title = "경복궁",
                latitude = 37.5788, longitude = 126.977,
                petAcmpyType = "전구역 동반가능", petRaw = "{}",
                petSyncedAt = LocalDateTime.of(2026, 9, 8, 4, 0),
            )
            existing.syncFrom(incoming)

            Then("값이 실제로 건너온다") {
                existing.petAcmpyType shouldBe "전구역 동반가능"
                existing.petRaw shouldBe "{}"
                existing.petSyncedAt shouldBe LocalDateTime.of(2026, 9, 8, 4, 0)
            }
        }
    }
    /*
     * 행사 날짜·목록 행 원문은 행사·숙박·코스 목록 동기화만 싣는다. 개요·이용정보·부가 사진·반려동물
     * 수집기는 같은 bulk 를 쓰지만 이 셋을 모르는 레코드를 보내므로, 덮어쓰면 다음 보강 한 번에 지워진다.
     * 값은 searchFestival2 운영 표본(2026-10-02) 첫 행에서 가져왔다.
     */
    val festivalListRaw = """{"addr1":"경기도 여주시 산북면 금품1로 36","contentid":"4116982","contenttypeid":"15",""" +
        """"eventstartdate":"20261107","eventenddate":"20261108","title":"산북AI김장문화축제","lclsSystm1":"EV"}"""

    fun festival(
        eventStartDate: LocalDate? = null,
        eventEndDate: LocalDate? = null,
        listRaw: String? = null,
        overview: String? = null,
        introRaw: String? = null,
        imagesRaw: String? = null,
        infoRaw: String? = null,
        petRaw: String? = null,
    ) = Attraction.create(
        contentId = "4116982", lang = "ko", title = "산북AI김장문화축제",
        latitude = 37.4008741346, longitude = 127.4451502631,
        contentTypeId = "15", lclsSystm1 = "EV", lclsSystm2 = "EV01", lclsSystm3 = "EV010300",
        eventStartDate = eventStartDate, eventEndDate = eventEndDate, listRaw = listRaw,
        overview = overview, introRaw = introRaw, imagesRaw = imagesRaw, infoRaw = infoRaw, petRaw = petRaw,
    )

    Given("행사 날짜와 목록 행 원문을 가진 행사 행") {
        val start = LocalDate.of(2026, 11, 7)
        val end = LocalDate.of(2026, 11, 8)
        fun stored() = festival(eventStartDate = start, eventEndDate = end, listRaw = festivalListRaw)

        listOf(
            "개요" to festival(overview = "김장 문화 축제"),
            "이용정보" to festival(introRaw = "{\"eventplace\":\"산북체육공원\"}"),
            "부가 사진·반복정보" to festival(imagesRaw = "[]", infoRaw = "[]"),
            "반려동물" to festival(petRaw = "{}"),
        ).forEach { (path, incoming) ->
            When("날짜·원문이 없는 $path 왕복 레코드가 덮으면") {
                val existing = stored()
                existing.syncFrom(incoming)

                Then("행사 날짜와 목록 원문은 지워지지 않는다") {
                    existing.eventStartDate shouldBe start
                    existing.eventEndDate shouldBe end
                    existing.listRaw shouldBe festivalListRaw
                }
            }
        }

        When("행사 목록 동기화가 새 날짜와 원문을 들고 오면") {
            val existing = stored()
            val movedRaw = festivalListRaw.replace("20261108", "20261109")
            existing.syncFrom(
                festival(eventStartDate = start, eventEndDate = LocalDate.of(2026, 11, 9), listRaw = movedRaw),
            )

            Then("들어온 값으로 갱신된다") {
                existing.eventEndDate shouldBe LocalDate.of(2026, 11, 9)
                existing.listRaw shouldBe movedRaw
            }
        }
    }

    Given("보강 필드를 모두 가진 관광지(유형 12) 행") {
        When("보강 필드가 빈 목록 동기화가 덮으면") {
            val existing = Attraction.create(
                contentId = "126508", lang = "ko", title = "경복궁",
                latitude = 37.5788, longitude = 126.977, contentTypeId = "12",
                overview = "조선의 법궁", introRaw = "{\"usetime\":\"09:00~18:00\"}",
                petRaw = "{}", infoRaw = "[]",
            ).apply { setting = "outdoor" }
            existing.syncFrom(
                Attraction.create(
                    contentId = "126508", lang = "ko", title = "경복궁",
                    latitude = 37.5788, longitude = 126.977, contentTypeId = "12",
                ),
            )

            Then("개요·이용정보 원문·반려동물 원문·실내외·반복정보가 남는다") {
                existing.overview shouldBe "조선의 법궁"
                existing.introRaw shouldBe "{\"usetime\":\"09:00~18:00\"}"
                existing.petRaw shouldBe "{}"
                existing.setting shouldBe "outdoor"
                existing.infoRaw shouldBe "[]"
            }
        }
    }
})
