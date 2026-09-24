package com.kgd.ads.application.creative.dto

import com.kgd.ads.domain.creative.model.Creative
import com.kgd.ads.domain.creative.model.CreativeRejectReason
import com.kgd.ads.domain.creative.model.CreativeStatus
import com.kgd.ads.domain.creative.model.HouseCreativeContent
import com.kgd.ads.domain.creative.model.PaidCreativeContent
import java.time.LocalDateTime

/**
 * 소재 한 건. [link] 는 유료면 랜딩 URL, HOUSE 면 앱 안 경로 또는 https URL.
 * 반려면 [rejectReason] 이 있다 — 광고주가 무엇을 고쳐야 하는지 아는 유일한 단서다.
 */
data class CreativeView(
    val id: Long,
    val campaignId: Long,
    val advertiserId: Long,
    val status: CreativeStatus,
    val title: String,
    val body: String,
    val link: String,
    val emoji: String?,
    val imageHash: String?,
    val rejectReason: CreativeRejectReason?,
    val reviewedAt: LocalDateTime?,
) {
    companion object {
        fun from(creative: Creative): CreativeView {
            val (link, emoji) = when (val c = creative.content) {
                is PaidCreativeContent -> c.landingUrl.value to null
                is HouseCreativeContent -> c.link.value to c.emoji
            }
            return CreativeView(
                id = requireNotNull(creative.id),
                campaignId = creative.campaignId,
                advertiserId = creative.advertiserId,
                status = creative.status,
                title = creative.content.title,
                body = creative.content.body,
                link = link,
                emoji = emoji,
                imageHash = creative.content.imageHash,
                rejectReason = creative.rejectReason,
                reviewedAt = creative.reviewedAt,
            )
        }
    }
}

/** 광고주 소재 입력. 심사 상태는 입력이 아니다 — 올리거나 고치면 항상 심사 대기다. [image] 가 null 이면 이미지를 그대로 둔다. */
data class PaidCreativeDraft(val title: String, val body: String, val landingUrl: String, val image: ByteArray?)

data class HouseCreativeDraft(val title: String, val body: String, val emoji: String?, val link: String, val image: ByteArray?)
