package com.kgd.deal.application.offer.dto

import com.kgd.deal.application.category.dto.DealCategoryResponse
import com.kgd.deal.domain.model.DisplayStatus
import com.kgd.deal.domain.model.LinkStatus
import com.kgd.deal.domain.model.RevenueType
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.LocalDate
import java.time.LocalDateTime

// ─── 공개 ───

/**
 * 공개 오퍼 응답.
 *
 * `targetUrl` 은 **넣지 않는다.** 넣는 순간 프론트가 직접 링크를 걸 수 있게 되고, 그러면
 * 클릭이 리다이렉터를 우회해 계측이 비고 링크 교체가 반영되지 않는다.
 */
data class DealOfferResponse(
    val slug: String,
    val merchant: String,
    val title: String,
    val benefit: String,
    val summary: String?,
    val revenueType: RevenueType,
    /** 공정위 표시·광고 심사지침상 고지 대상 — FE 의 배지·rel 분기 기준 */
    val disclosureRequired: Boolean,
    val validUntil: LocalDateTime?,
)

data class DealCategorySection(
    val category: DealCategoryResponse,
    val offers: List<DealOfferResponse>,
)

// ─── 어드민 ───

data class DealOfferAdminResponse(
    val id: Long,
    val slug: String,
    val categoryId: Long,
    val categoryCode: String,
    val merchant: String,
    val title: String,
    val benefit: String,
    val summary: String?,
    val targetUrl: String,
    val revenueType: RevenueType,
    val network: String?,
    val status: DisplayStatus,
    val validFrom: LocalDateTime?,
    val validUntil: LocalDateTime?,
    val orderNo: Int,
    val clickCount: Long,
    val linkStatus: LinkStatus,
    val linkStatusCode: Int?,
    val linkCheckedAt: LocalDateTime?,
    val updatedAt: LocalDateTime?,
)

data class DealOfferRequest(
    @field:NotBlank @field:Size(max = 60) val slug: String,
    val categoryId: Long,
    @field:NotBlank @field:Size(max = 60) val merchant: String,
    @field:NotBlank @field:Size(max = 120) val title: String,
    @field:NotBlank @field:Size(max = 80) val benefit: String,
    @field:Size(max = 300) val summary: String? = null,
    @field:NotBlank @field:Size(max = 1000) val targetUrl: String,
    val revenueType: RevenueType,
    @field:Size(max = 40) val network: String? = null,
    val status: DisplayStatus = DisplayStatus.PREOPEN,
    val validFrom: LocalDateTime? = null,
    val validUntil: LocalDateTime? = null,
    val orderNo: Int = 0,
)

/** 어드민이 손봐야 하는 것들 — 방치를 막는 유일한 장치라 한 화면에 모은다 */
data class DealAttentionResponse(
    val expiringSoon: List<DealOfferAdminResponse>,
    val stale: List<DealOfferAdminResponse>,
    val broken: List<DealOfferAdminResponse>,
)

data class DealClickDaily(
    val date: LocalDate,
    val count: Long,
)
