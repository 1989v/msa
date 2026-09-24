package com.kgd.ads.presentation.admin.controller

import com.kgd.ads.application.campaign.dto.CampaignView
import com.kgd.ads.application.campaign.usecase.ManageHouseCampaignUseCase
import com.kgd.ads.application.creative.dto.HouseCreativeDraft
import com.kgd.ads.application.creative.usecase.ManageHouseCreativeUseCase
import com.kgd.ads.presentation.admin.dto.AdminCreativeResponse
import com.kgd.ads.presentation.admin.dto.CampaignActionRequest
import com.kgd.ads.presentation.admin.dto.HouseCampaignRequest
import com.kgd.ads.presentation.support.RequestIdentity
import com.kgd.common.response.ApiResponse
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

/**
 * HOUSE(자체 홍보) 캠페인·소재 — 소유자는 항상 「1989v 하우스」. 예산·지갑·최저가·빈도·원장에서 면제되고,
 * 광고주 API 로는 만들 수 없다. 소재 링크는 앱 안 경로 또는 https URL, 이미지는 선택이다.
 */
@RestController
@RequestMapping("/api/v1/admin/ads/house")
class AdsHouseAdminController(
    private val campaigns: ManageHouseCampaignUseCase,
    private val creatives: ManageHouseCreativeUseCase,
) {
    @GetMapping("/campaigns")
    fun campaigns(@RequestHeader(USER, required = false) userId: String?, @RequestHeader(ROLES, required = false) roles: String?): ApiResponse<List<CampaignView>> {
        RequestIdentity.admin(userId, roles)
        return ApiResponse.success(campaigns.list())
    }

    @PostMapping("/campaigns")
    fun create(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @Valid @RequestBody request: HouseCampaignRequest,
    ): ApiResponse<CampaignView> = ApiResponse.success(campaigns.create(RequestIdentity.admin(userId, roles), request.toDraft()))

    @PutMapping("/campaigns/{campaignId}/status")
    fun changeStatus(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @PathVariable campaignId: Long,
        @RequestBody request: CampaignActionRequest,
    ): ApiResponse<CampaignView> = ApiResponse.success(campaigns.changeStatus(RequestIdentity.admin(userId, roles), campaignId, request.action))

    @GetMapping("/campaigns/{campaignId}/creatives")
    fun creatives(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @PathVariable campaignId: Long,
    ): ApiResponse<List<AdminCreativeResponse>> {
        RequestIdentity.admin(userId, roles)
        return ApiResponse.success(creatives.list(campaignId).map(AdminCreativeResponse::from))
    }

    @PostMapping("/campaigns/{campaignId}/creatives", consumes = ["multipart/form-data"])
    fun createCreative(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @PathVariable campaignId: Long,
        @RequestParam title: String,
        @RequestParam body: String,
        @RequestParam link: String,
        @RequestParam(required = false) emoji: String?,
        @RequestPart("image", required = false) image: MultipartFile?,
    ): ApiResponse<AdminCreativeResponse> {
        val actor = RequestIdentity.admin(userId, roles)
        val draft = HouseCreativeDraft(title, body, emoji, link, image?.takeUnless { it.isEmpty }?.bytes)
        return ApiResponse.success(AdminCreativeResponse.from(creatives.create(actor, campaignId, draft)))
    }

    @DeleteMapping("/creatives/{creativeId}")
    fun archive(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @PathVariable creativeId: Long,
    ): ApiResponse<AdminCreativeResponse> =
        ApiResponse.success(AdminCreativeResponse.from(creatives.archive(RequestIdentity.admin(userId, roles), creativeId)))

    private companion object {
        const val USER = RequestIdentity.USER_HEADER
        const val ROLES = RequestIdentity.ROLES_HEADER
    }
}
