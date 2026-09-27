package com.kgd.ads.domain.creative.model

import com.kgd.ads.domain.creative.exception.InvalidCreativeException
import com.kgd.ads.domain.placement.model.PlacementFormat

/** 소재 내용. 유료와 HOUSE 는 필드가 달라 종류로 가른다. */
sealed interface CreativeContent {
    val title: String
    val body: String
    val imageHash: String?

    companion object {
        const val MAX_TITLE_LENGTH = 40
        const val MAX_BODY_LENGTH = 90
        private val IMAGE_HASH = Regex("^[0-9a-f]{64}$")

        internal fun requireText(title: String, body: String, imageHash: String?) {
            if (title.isBlank() || title.length > MAX_TITLE_LENGTH) throw InvalidCreativeException("제목은 1~${MAX_TITLE_LENGTH}자여야 합니다")
            if (body.isBlank() || body.length > MAX_BODY_LENGTH) throw InvalidCreativeException("문구는 1~${MAX_BODY_LENGTH}자여야 합니다")
            requireImageHash(imageHash)
        }

        internal fun requireImageHash(imageHash: String?) {
            if (imageHash != null && !IMAGE_HASH.matches(imageHash)) throw InvalidCreativeException("이미지 해시 형식이 올바르지 않습니다")
        }
    }
}

/**
 * 유료 소재 내용 — 광고 형태마다 종류가 하나다. 랜딩 URL 과 이미지 1장(필수)은 형태와 무관하게 같다.
 * 캠페인 형태와 종류가 맞는지는 [Creative.submit] 이 본다.
 */
sealed interface PaidContent : CreativeContent {
    val format: PlacementFormat
    val landingUrl: LandingUrl
    override val imageHash: String
}

/** 카드 — 제목·설명·랜딩 URL·이미지 1장. */
data class PaidCreativeContent(
    override val title: String,
    override val body: String,
    override val landingUrl: LandingUrl,
    override val imageHash: String,
) : PaidContent {
    override val format: PlacementFormat get() = PlacementFormat.CARD

    init {
        CreativeContent.requireText(title, body, imageHash)
    }
}

/**
 * 띠배너 — 이미지 한 장과 대체 텍스트. 문구는 이미지 안에 있어 설명이 없다.
 * 대체 텍스트는 화면에 보이지 않고 이미지 `alt` 와 심사 화면에 쓴다. 저장은 제목 칸에 대체 텍스트, 설명 칸은 빈 문자열이다.
 */
data class BannerCreativeContent(
    val altText: String,
    override val landingUrl: LandingUrl,
    override val imageHash: String,
) : PaidContent {
    override val format: PlacementFormat get() = PlacementFormat.BANNER
    override val title: String get() = altText
    override val body: String get() = ""

    init {
        if (altText.isBlank() || altText.length > MAX_ALT_TEXT_LENGTH) {
            throw InvalidCreativeException("대체 텍스트는 1~${MAX_ALT_TEXT_LENGTH}자여야 합니다")
        }
        CreativeContent.requireImageHash(imageHash)
    }

    companion object {
        const val MAX_ALT_TEXT_LENGTH = CreativeContent.MAX_TITLE_LENGTH
    }
}

/** HOUSE 소재 — 제목·문구·이모지·링크, 이미지는 선택. 캠페인 형태와 무관하다. */
data class HouseCreativeContent(
    override val title: String,
    override val body: String,
    val emoji: String?,
    val link: HouseLink,
    override val imageHash: String?,
) : CreativeContent {
    init {
        CreativeContent.requireText(title, body, imageHash)
        if (emoji != null && (emoji.isBlank() || emoji.length > MAX_EMOJI_LENGTH)) {
            throw InvalidCreativeException("이모지는 ${MAX_EMOJI_LENGTH}자 이하여야 합니다")
        }
    }

    companion object {
        const val MAX_EMOJI_LENGTH = 16
    }
}
