package com.kgd.place.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
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
})
