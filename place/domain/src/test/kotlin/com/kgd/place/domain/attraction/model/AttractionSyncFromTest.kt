package com.kgd.place.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
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
            existing.syncFrom(base(), LocalDateTime.of(2026, 10, 9, 0, 0))

            Then("백필이 채운 값은 지워지지 않는다") {
                existing.setting shouldBe "indoor"
            }
        }
    }

    Given("보강 필드를 가진 기존 레코드") {
        When("보강 필드가 빈 목록 동기화가 덮으려 하면") {
            val existing = base(petType = "전구역 동반가능", overview = "조선의 법궁")
            existing.syncFrom(base(), LocalDateTime.of(2026, 10, 9, 0, 0))

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
            existing.syncFrom(incoming, LocalDateTime.of(2026, 10, 9, 0, 0))

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
                existing.syncFrom(incoming, LocalDateTime.of(2026, 10, 9, 0, 0))

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
                LocalDateTime.of(2026, 10, 9, 0, 0),
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
                LocalDateTime.of(2026, 10, 9, 0, 0),
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
    /*
     * 본문 변경 시각 — RSS·IndexNow 가 「실제로 바뀐 주소」를 고르는 기준이다. 수집은 전량 upsert 라
     * 행 갱신 시각(updated_at)은 전화·이미지만 바뀌어도 오르므로, 병합이 끝난 자기 필드의 해시로 가른다.
     */
    val now = LocalDateTime.of(2026, 10, 9, 7, 30)
    val earlier = LocalDateTime.of(2026, 9, 1, 12, 0)
    val modified = LocalDateTime.of(2026, 8, 20, 10, 15)

    fun listRecord(useFee: String? = null, sourceModifiedAt: LocalDateTime? = modified, overview: String? = null) =
        Attraction.create(
            contentId = "126508", lang = "ko", title = "경복궁",
            latitude = 37.5788, longitude = 126.977, useFee = useFee, overview = overview,
            sourceModifiedAt = sourceModifiedAt,
        )

    fun stored(
        contentHash: String?,
        contentUpdatedAt: LocalDateTime?,
        sourceModifiedAt: LocalDateTime? = modified,
        overview: String? = "조선의 법궁",
    ) = Attraction.restore(
        id = 7L, contentId = "126508", lang = "ko", title = "경복궁",
        address = null, areaCode = null, sigunguCode = null, ldongRegnCd = null, ldongSignguCd = null,
        category = null, cat1 = null, cat2 = null, cat3 = null,
        lclsSystm1 = null, lclsSystm2 = null, lclsSystm3 = null, contentTypeId = null, copyrightDivCd = null,
        thumbnailUrl = null, mapLevel = null, zipcode = null, sourceCreatedAt = null,
        latitude = 37.5788, longitude = 126.977, imageUrl = null, tel = null, overview = overview,
        introRaw = null, useTime = null, restDate = null, useFee = null, parking = null, parkingFee = null,
        infoCenter = null, introSyncedAt = null, petAcmpyType = null, petRaw = null, petSyncedAt = null,
        setting = null, imagesRaw = null, infoRaw = null, extraSyncedAt = null,
        eventStartDate = null, eventEndDate = null, listRaw = null, googlePlaceId = null,
        sourceModifiedAt = sourceModifiedAt, status = "ACTIVE", createdAt = earlier,
        contentHash = contentHash, contentUpdatedAt = contentUpdatedAt,
    )

    Given("새 행") {
        When("생성 경로가 stampNew(now) 를 부르면") {
            val created = listRecord().apply { stampNew(now) }

            Then("해시를 계산하고 시각은 now 다 — 새 주소는 변경으로 센다") {
                created.contentHash shouldBe AttractionContentHash.of(created)
                created.contentUpdatedAt shouldBe now
            }
        }
    }

    Given("해시가 아직 없는 기존 행 (첫 채움)") {
        When("목록 동기화가 들어오면") {
            val existing = stored(contentHash = null, contentUpdatedAt = null, sourceModifiedAt = earlier)
            existing.syncFrom(listRecord(sourceModifiedAt = modified), now)

            Then("해시를 계산하고 시각은 병합된 원천 수정일로 시작한다") {
                existing.contentHash shouldBe AttractionContentHash.of(existing)
                existing.contentUpdatedAt shouldBe modified
            }
        }
        When("원천 수정일도 없으면") {
            val existing = stored(contentHash = null, contentUpdatedAt = null, sourceModifiedAt = null)
            existing.syncFrom(listRecord(sourceModifiedAt = null), now)

            Then("시각은 null 로 남는다") {
                existing.contentHash shouldBe AttractionContentHash.of(existing)
                existing.contentUpdatedAt shouldBe null
            }
        }
    }

    Given("해시 규칙 버전이 다른 기존 행 (v0:)") {
        When("시각이 있으면") {
            val existing = stored(contentHash = "v0:abc", contentUpdatedAt = earlier)
            existing.syncFrom(listRecord(), now)

            Then("해시는 현재 버전으로 다시 계산하고 시각은 그대로다") {
                existing.contentHash shouldBe AttractionContentHash.of(existing)
                existing.contentUpdatedAt shouldBe earlier
            }
        }
        When("시각이 null 이면") {
            val existing = stored(contentHash = "v0:abc", contentUpdatedAt = null)
            existing.syncFrom(listRecord(), now)

            Then("원천 수정일로 시작한다") {
                existing.contentHash shouldBe AttractionContentHash.of(existing)
                existing.contentUpdatedAt shouldBe modified
            }
        }
    }

    Given("현재 버전 해시를 가진 기존 행") {
        fun stamped() = stored(contentHash = null, contentUpdatedAt = null).apply {
            syncFrom(listRecord(), earlier)
        }.let { first ->
            stored(contentHash = first.contentHash, contentUpdatedAt = earlier)
        }

        When("같은 본문이 다른 원천 수정일로 들어오면") {
            val existing = stamped()
            val before = existing.contentHash
            existing.syncFrom(listRecord(sourceModifiedAt = now), now)

            Then("해시도 시각도 그대로다") {
                existing.contentHash shouldBe before
                existing.contentUpdatedAt shouldBe earlier
            }
        }
        When("요금이 바뀐 본문이 들어오면") {
            val existing = stamped()
            val before = existing.contentHash
            existing.syncFrom(listRecord(useFee = "성인 3,000원"), now)

            Then("새 해시와 now") {
                existing.contentHash shouldNotBe before
                existing.contentHash shouldBe AttractionContentHash.of(existing)
                existing.contentUpdatedAt shouldBe now
            }
        }
        When("개요 없는 목록 레코드가 들어오면") {
            val existing = stamped()
            val before = existing.contentHash
            existing.syncFrom(listRecord(overview = null), now)

            Then("병합이 개요를 지키므로 해시·시각이 그대로다 — source 가 아니라 병합 결과로 계산한다") {
                existing.overview shouldBe "조선의 법궁"
                existing.contentHash shouldBe before
                existing.contentUpdatedAt shouldBe earlier
            }
        }
        When("source 에 해시·시각을 넣어 보내면") {
            val existing = stamped()
            val before = existing.contentHash
            val incoming = listRecord().apply { stampNew(LocalDateTime.of(2030, 1, 1, 0, 0)) }
            existing.syncFrom(incoming, now)

            Then("무시한다 — 자기 계산값이다") {
                existing.contentHash shouldBe before
                existing.contentUpdatedAt shouldBe earlier
            }
        }
    }
})
