package com.kgd.place.domain.attraction.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/** 운영 표본(2026-10-04 videos.list, maxWidth=640) 값 그대로다. */
class VideoFormatTest : BehaviorSpec({
    given("길이와 플레이어 비율로 형태를 가른다") {
        `when`("세로이고 3분 이하면") {
            then("쇼츠다") {
                VideoFormat.classify("PT58S", 360, 640) shouldBe VideoFormat.SHORT
                VideoFormat.classify("PT3M", 360, 640) shouldBe VideoFormat.SHORT
            }
        }
        `when`("세로라도 3분을 넘으면") {
            then("일반 영상이다") {
                VideoFormat.classify("PT3M1S", 360, 640) shouldBe VideoFormat.LONG
            }
        }
        `when`("가로면 짧아도") {
            then("일반 영상이다 — 짧은 가로 클립은 쇼츠가 아니다") {
                VideoFormat.classify("PT45S", 640, 360) shouldBe VideoFormat.LONG
                VideoFormat.classify("PT44M15S", 640, 360) shouldBe VideoFormat.LONG
            }
        }
        `when`("원천 값이 하나라도 없거나 읽을 수 없으면") {
            then("모른다(null) — 일반 영상으로 단정하지 않는다") {
                VideoFormat.classify(null, 360, 640) shouldBe null
                VideoFormat.classify("PT58S", null, 640) shouldBe null
                VideoFormat.classify("58초", 360, 640) shouldBe null
                VideoFormat.classify("PT58S", 0, 640) shouldBe null
            }
        }
    }

    given("링크는 저장된 원천 값에서 형태를 얻는다") {
        then("create 로 받은 길이·비율이 그대로 format 이 된다") {
            AttractionLink.create(
                1, AttractionLinkSource.YOUTUBE, "v1", "제목", "https://youtu.be/v1",
                duration = "PT30S", embedWidth = 360, embedHeight = 640,
            ).format shouldBe VideoFormat.SHORT
            AttractionLink.create(1, AttractionLinkSource.YOUTUBE, "v2", "제목", "https://youtu.be/v2").format shouldBe null
        }
    }
})
