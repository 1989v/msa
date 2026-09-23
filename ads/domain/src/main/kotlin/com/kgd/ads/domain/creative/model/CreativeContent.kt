package com.kgd.ads.domain.creative.model

import com.kgd.ads.domain.creative.exception.InvalidCreativeException

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
            if (imageHash != null && !IMAGE_HASH.matches(imageHash)) throw InvalidCreativeException("이미지 해시 형식이 올바르지 않습니다")
        }
    }
}

/** 유료 소재 — 제목·문구·랜딩 URL·이미지 1장(필수). */
data class PaidCreativeContent(
    override val title: String,
    override val body: String,
    val landingUrl: LandingUrl,
    override val imageHash: String,
) : CreativeContent {
    init {
        CreativeContent.requireText(title, body, imageHash)
    }
}

/** HOUSE 소재 — 제목·문구·이모지·링크, 이미지는 선택. */
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
