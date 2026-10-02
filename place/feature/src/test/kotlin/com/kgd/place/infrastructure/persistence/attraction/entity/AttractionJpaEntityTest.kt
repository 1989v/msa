package com.kgd.place.infrastructure.persistence.attraction.entity

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * 엔티티 ↔ 도메인 왕복. 구글 보강의 `saveAll` 은 `syncFrom` 을 타지 않고 엔티티 `fromDomain` 으로 행 전체를 쓴다 —
 * 매핑 한쪽에서 컬럼이 빠지면 보강 한 번에 그 컬럼이 null 로 덮인다.
 */
class AttractionJpaEntityTest : BehaviorSpec({

    Given("행사 날짜와 목록 행 원문이 있는 행사 행 (searchFestival2 운영 표본 2026-10-02)") {
        val raw = """{"contentid":"4116982","contenttypeid":"15","eventstartdate":"20261107","eventenddate":"20261108"}"""
        val entity = AttractionJpaEntity(
            id = 41L,
            contentId = "4116982",
            lang = "ko",
            title = "산북AI김장문화축제",
            titleDisplay = "산북AI김장문화축제",
            contentTypeId = "15",
            latitude = 37.4008741346,
            longitude = 127.4451502631,
            eventStartDate = LocalDate.of(2026, 11, 7),
            eventEndDate = LocalDate.of(2026, 11, 8),
            listRaw = raw,
            googlePlaceId = "ChIJod7tSseifDUR9hXHLFNGMIs",
            status = "ACTIVE",
            createdAt = LocalDateTime.of(2026, 10, 2, 3, 10),
        )

        When("도메인으로 읽었다가 다시 엔티티로 쓰면") {
            val back = AttractionJpaEntity.fromDomain(entity.toDomain())

            Then("새 세 컬럼이 그대로 남는다") {
                back.eventStartDate shouldBe LocalDate.of(2026, 11, 7)
                back.eventEndDate shouldBe LocalDate.of(2026, 11, 8)
                back.listRaw shouldBe raw
                // 대조 — 기존 보강 컬럼도 같은 왕복을 지난다
                back.googlePlaceId shouldBe "ChIJod7tSseifDUR9hXHLFNGMIs"
            }
        }
    }
})
