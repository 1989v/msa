package com.kgd.ads.presentation.admin.dto

import com.kgd.ads.application.campaign.dto.CampaignAction
import com.kgd.ads.application.campaign.dto.HouseCampaignDraft
import com.kgd.ads.application.creative.dto.CreativeView
import com.kgd.ads.domain.creative.model.CreativeRejectReason
import com.kgd.ads.domain.creative.model.CreativeStatus
import com.kgd.ads.domain.placement.model.PlacementFormat
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.LocalDateTime

data class RejectCreativeRequest(val reason: CreativeRejectReason)

data class SuspendAdvertiserRequest(
    @field:NotBlank
    @field:Size(max = 255)
    val reason: String,
)

data class CreatePlacementRequest(
    @field:NotBlank
    @field:Size(max = 64)
    val key: String,
    @field:NotBlank
    @field:Size(max = 128)
    val host: String,
    val format: PlacementFormat,
    @field:Size(min = 1, max = 8)
    val aspectRatios: List<@Size(min = 3, max = 16) String>,
    val floorMicros: Long,
    val active: Boolean = true,
    val paidAllowed: Boolean = true,
    @field:NotBlank
    @field:Size(max = 255)
    val description: String,
)

/** 비운 필드는 바꾸지 않는다. */
data class UpdatePlacementRequest(
    val floorMicros: Long? = null,
    val active: Boolean? = null,
    val paidAllowed: Boolean? = null,
    @field:Size(min = 1, max = 255)
    val description: String? = null,
)

data class ContextMappingRequest(
    @field:NotBlank
    @field:Size(max = 128)
    val contextKey: String,
    @field:NotBlank
    @field:Size(max = 32)
    val categoryCode: String,
)

data class HostCategoryRequest(
    @field:NotBlank
    @field:Size(max = 128)
    val host: String,
    @field:NotBlank
    @field:Size(max = 32)
    val categoryCode: String,
)

data class HouseCampaignRequest(
    @field:NotBlank
    @field:Size(max = 100)
    val name: String,
    val startAt: LocalDateTime,
    val endAt: LocalDateTime? = null,
    @field:Size(min = 1, max = 20)
    val placementKeys: List<@Size(min = 1, max = 64) String>,
    @field:Size(max = 20)
    val categoryCodes: List<@Size(min = 1, max = 32) String> = emptyList(),
) {
    fun toDraft() = HouseCampaignDraft(name, startAt, endAt, placementKeys.toSet(), categoryCodes.toSet())
}

data class CampaignActionRequest(val action: CampaignAction)

/** 운영자가 보는 소재. [imageUrl] 은 어드민 미리보기 주소(심사 상태와 무관). */
data class AdminCreativeResponse(
    val id: Long,
    val campaignId: Long,
    val advertiserId: Long,
    val status: CreativeStatus,
    val title: String,
    val body: String,
    val link: String,
    val emoji: String?,
    val imageUrl: String?,
    val rejectReason: CreativeRejectReason?,
    val reviewedAt: LocalDateTime?,
) {
    companion object {
        fun from(view: CreativeView) = AdminCreativeResponse(
            id = view.id,
            campaignId = view.campaignId,
            advertiserId = view.advertiserId,
            status = view.status,
            title = view.title,
            body = view.body,
            link = view.link,
            emoji = view.emoji,
            imageUrl = view.imageHash?.let { "/api/v1/admin/ads/creatives/${view.id}/image" },
            rejectReason = view.rejectReason,
            reviewedAt = view.reviewedAt,
        )
    }
}

data class LedgerCheckResponse(val imbalanceMicros: Long, val balanced: Boolean, val checkedAt: LocalDateTime)
