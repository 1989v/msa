package com.kgd.ads.presentation.advertiser.dto

import com.kgd.ads.application.campaign.dto.CampaignAction
import com.kgd.ads.application.campaign.dto.PaidCampaignDraft
import com.kgd.ads.application.creative.dto.CreativeView
import com.kgd.ads.domain.campaign.model.BidType
import com.kgd.ads.domain.creative.model.CreativeRejectReason
import com.kgd.ads.domain.creative.model.CreativeStatus
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Positive
import jakarta.validation.constraints.Size
import java.time.LocalDateTime

data class RegisterAdvertiserRequest(
    @field:NotBlank
    @field:Size(max = 100)
    val displayName: String,
)

data class RegisterAdvertiserResponse(val advertiserId: Long)

/**
 * 셀프 충전. [idempotencyKey] 는 화면이 충전 시도마다 만드는 값 — 서버가 회원 id 로 이름공간을 붙여 저장하므로
 * 다른 회원이 같은 값을 보내도 남의 거래를 돌려받지 않는다.
 */
data class TopUpRequest(
    @field:Positive
    val amountMicros: Long,
    @field:NotBlank
    @field:Pattern(regexp = "^[A-Za-z0-9_-]{1,64}$")
    val idempotencyKey: String,
)

data class TopUpResponse(val transactionId: Long, val balanceMicros: Long)

/**
 * 유료 캠페인 입력. 우선순위·심사 상태·원장 계정 필드는 없다 — 본문에 실려 와도 읽지 않는다.
 * 상태는 [CampaignStatusRequest] 의 전이 명령으로만 바뀐다.
 */
data class CampaignRequest(
    @field:NotBlank
    @field:Size(max = 100)
    val name: String,
    val bidType: BidType,
    @field:Positive
    val bidMicros: Long,
    @field:Positive
    val dailyBudgetMicros: Long,
    @field:Positive
    val totalBudgetMicros: Long? = null,
    val startAt: LocalDateTime,
    val endAt: LocalDateTime? = null,
    @field:Positive
    val frequencyCapPerDay: Int? = null,
    @field:Size(min = 1, max = MAX_TARGETS)
    val placementKeys: List<@Size(min = 1, max = 64) String>,
    @field:Size(max = MAX_TARGETS)
    val categoryCodes: List<@Size(min = 1, max = 32) String> = emptyList(),
) {
    fun toDraft() = PaidCampaignDraft(
        name = name,
        bidType = bidType,
        bidMicros = bidMicros,
        dailyBudgetMicros = dailyBudgetMicros,
        totalBudgetMicros = totalBudgetMicros,
        startAt = startAt,
        endAt = endAt,
        frequencyCapPerDay = frequencyCapPerDay,
        placementKeys = placementKeys.toSet(),
        categoryCodes = categoryCodes.toSet(),
    )

    companion object {
        const val MAX_TARGETS = 20
    }
}

data class CampaignStatusRequest(val action: CampaignAction)

/**
 * 소재 응답. [imageUrl] 은 로그인한 광고주 본인만 볼 수 있는 미리보기 주소다(심사 상태와 무관).
 * 반려면 [rejectReason] 이 있다.
 */
data class CreativeResponse(
    val id: Long,
    val campaignId: Long,
    val status: CreativeStatus,
    val title: String,
    val body: String,
    val landingUrl: String,
    val imageUrl: String?,
    val rejectReason: CreativeRejectReason?,
    val reviewedAt: LocalDateTime?,
) {
    companion object {
        fun from(view: CreativeView) = CreativeResponse(
            id = view.id,
            campaignId = view.campaignId,
            status = view.status,
            title = view.title,
            body = view.body,
            landingUrl = view.link,
            imageUrl = view.imageHash?.let { "/api/v1/ads/advertiser/creatives/${view.id}/image" },
            rejectReason = view.rejectReason,
            reviewedAt = view.reviewedAt,
        )
    }
}
