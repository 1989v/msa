package com.kgd.ads.presentation.admin.dto

import com.kgd.ads.application.campaign.dto.CampaignAction
import com.kgd.ads.application.campaign.dto.HouseCampaignDraft
import com.kgd.ads.application.creative.dto.CreativeView
import com.kgd.ads.application.placement.usecase.ManagePlacementUseCase
import com.kgd.ads.domain.creative.model.CreativeRejectReason
import com.kgd.ads.domain.creative.model.CreativeStatus
import com.kgd.ads.domain.placement.model.PlacementFormat
import jakarta.validation.Valid
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
    @field:Size(min = 1, max = MAX_FORMATS)
    val formats: List<@Valid FormatSpecRequest>,
    val active: Boolean = true,
    val paidAllowed: Boolean = true,
    @field:NotBlank
    @field:Size(max = 255)
    val description: String,
)

/** 형태 규격 하나 — 지면 등록과 규격 추가에 쓴다. */
data class FormatSpecRequest(
    val format: PlacementFormat,
    @field:Size(min = 1, max = 8)
    val aspectRatios: List<@Size(min = 3, max = 16) String>,
    val floorMicros: Long,
) {
    fun toInput() = ManagePlacementUseCase.FormatSpecInput(format, aspectRatios, floorMicros)
}

data class ChangeFormatFloorRequest(val floorMicros: Long)

/** 비운 필드는 바꾸지 않는다. 형태별 최저가는 `PATCH /placements/{key}/formats/{format}` 으로 바꾼다. */
data class UpdatePlacementRequest(
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

/**
 * 운영자가 보는 소재. [imageUrl] 은 어드민 미리보기 주소(심사 상태와 무관).
 * [format] 은 유료 소재의 광고 형태(HOUSE 는 null) — 띠배너면 [title] 이 대체 텍스트이고 [body] 는 빈 문자열이다.
 */
data class AdminCreativeResponse(
    val id: Long,
    val campaignId: Long,
    val advertiserId: Long,
    val status: CreativeStatus,
    val format: PlacementFormat?,
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
            format = view.format,
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

/** 지면이 가질 수 있는 형태 규격 수 — 형태가 둘이다. */
private const val MAX_FORMATS = 2
