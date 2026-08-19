package com.kgd.place.domain.attraction.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.LocalDateTime

class AttractionLinkTest : BehaviorSpec({
    val now = LocalDateTime.of(2026, 8, 20, 4, 0)

    given("AttractionLink 생성 시") {
        `when`("https 가 아닌 링크면") {
            then("거부해야 한다 — 혼합 콘텐츠는 화면에서 조용히 막힌다") {
                shouldThrow<IllegalArgumentException> {
                    AttractionLink.create(1, AttractionLinkSource.YOUTUBE, "v1", "제목",
                        "http://youtube.com/watch?v=v1")
                }
            }
        }
        `when`("빈 문자열 썸네일이 오면") {
            then("null 로 정규화해야 한다") {
                val link = AttractionLink.create(1, AttractionLinkSource.YOUTUBE, "v1", "제목",
                    "https://youtu.be/v1", thumbnailUrl = "  ")
                link.thumbnailUrl shouldBe null
            }
        }
    }

    given("수집 상태(AttractionLinkRequest)") {
        `when`("한 번도 시도하지 않았으면") {
            then("바로 수집 대상이다") {
                AttractionLinkRequest.create(1, AttractionLinkSource.YOUTUBE, now).isDue(now) shouldBe true
            }
        }
        `when`("수집에 성공하면") {
            then("90일간 다시 부르지 않는다") {
                val req = AttractionLinkRequest.create(1, AttractionLinkSource.YOUTUBE, now)
                req.markCollected(now)
                req.isDue(now.plusDays(89)) shouldBe false
                req.isDue(now.plusDays(91)) shouldBe true
            }
        }
        `when`("원천이 0건을 주면") {
            then("30일 뒤 다시 본다 — 영영 제외하지 않는다 (새 영상이 올라온다)") {
                val req = AttractionLinkRequest.create(1, AttractionLinkSource.YOUTUBE, now)
                req.markEmpty(now)
                req.isDue(now.plusDays(29)) shouldBe false
                req.isDue(now.plusDays(31)) shouldBe true
            }
        }
        `when`("429·네트워크로 실패하면") {
            then("다음 날 예산으로 넘길 뿐 제외되지 않는다") {
                val req = AttractionLinkRequest.create(1, AttractionLinkSource.YOUTUBE, now)
                req.markFailed(now)
                req.isDue(now.plusHours(23)) shouldBe false
                req.isDue(now.plusDays(2)) shouldBe true
            }
        }
        `when`("실패든 성공이든 시도했으면") {
            then("lastAttemptAt 이 남아 그날 소진량을 셀 수 있어야 한다") {
                val req = AttractionLinkRequest.create(1, AttractionLinkSource.YOUTUBE, now)
                req.markFailed(now)
                req.lastAttemptAt shouldBe now
            }
        }
        `when`("여러 번 조회되면") {
            then("우선순위가 올라간다") {
                val req = AttractionLinkRequest.create(1, AttractionLinkSource.YOUTUBE, now)
                req.markViewed()
                req.markViewed()
                req.viewCount shouldBe 3
            }
        }
    }
})
