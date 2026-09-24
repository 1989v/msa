package com.kgd.ads.presentation.advertiser.controller

import com.kgd.ads.application.campaign.dto.CampaignView
import com.kgd.ads.application.campaign.usecase.ManageCampaignUseCase
import com.kgd.ads.application.creative.dto.PaidCreativeDraft
import com.kgd.ads.application.creative.usecase.ManageCreativeUseCase
import com.kgd.ads.application.creative.usecase.PreviewCreativeImageUseCase
import com.kgd.ads.presentation.advertiser.dto.CampaignRequest
import com.kgd.ads.presentation.advertiser.dto.CampaignStatusRequest
import com.kgd.ads.presentation.advertiser.dto.CreativeResponse
import com.kgd.ads.presentation.support.ImageResponses
import com.kgd.ads.presentation.support.RequestIdentity
import com.kgd.common.response.ApiResponse
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
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
 * 광고주의 캠페인·소재. 모든 경로의 id 는 요청 회원의 광고주 범위 안에서만 찾는다 — 남의 것은 404.
 * 소재는 multipart(제목·문구·랜딩 URL·이미지)로 받고, 올리거나 고치면 심사 대기가 된다.
 */
@RestController
@RequestMapping("/api/v1/ads/advertiser")
class AdvertiserCampaignController(
    private val campaigns: ManageCampaignUseCase,
    private val creatives: ManageCreativeUseCase,
    private val preview: PreviewCreativeImageUseCase,
) {
    @GetMapping("/campaigns")
    fun campaigns(@RequestHeader(USER, required = false) userId: String?): ApiResponse<List<CampaignView>> =
        ApiResponse.success(campaigns.list(RequestIdentity.member(userId)))

    @GetMapping("/campaigns/{campaignId}")
    fun campaign(@RequestHeader(USER, required = false) userId: String?, @PathVariable campaignId: Long): ApiResponse<CampaignView> =
        ApiResponse.success(campaigns.get(RequestIdentity.member(userId), campaignId))

    @PostMapping("/campaigns")
    fun create(@RequestHeader(USER, required = false) userId: String?, @Valid @RequestBody request: CampaignRequest): ApiResponse<CampaignView> =
        ApiResponse.success(campaigns.create(RequestIdentity.member(userId), request.toDraft()))

    @PutMapping("/campaigns/{campaignId}")
    fun update(
        @RequestHeader(USER, required = false) userId: String?,
        @PathVariable campaignId: Long,
        @Valid @RequestBody request: CampaignRequest,
    ): ApiResponse<CampaignView> = ApiResponse.success(campaigns.update(RequestIdentity.member(userId), campaignId, request.toDraft()))

    @PutMapping("/campaigns/{campaignId}/status")
    fun changeStatus(
        @RequestHeader(USER, required = false) userId: String?,
        @PathVariable campaignId: Long,
        @RequestBody request: CampaignStatusRequest,
    ): ApiResponse<CampaignView> = ApiResponse.success(campaigns.changeStatus(RequestIdentity.member(userId), campaignId, request.action))

    @GetMapping("/campaigns/{campaignId}/creatives")
    fun creatives(@RequestHeader(USER, required = false) userId: String?, @PathVariable campaignId: Long): ApiResponse<List<CreativeResponse>> =
        ApiResponse.success(creatives.list(RequestIdentity.member(userId), campaignId).map(CreativeResponse::from))

    @PostMapping("/campaigns/{campaignId}/creatives", consumes = ["multipart/form-data"])
    fun submit(
        @RequestHeader(USER, required = false) userId: String?,
        @PathVariable campaignId: Long,
        @RequestParam title: String,
        @RequestParam body: String,
        @RequestParam landingUrl: String,
        @RequestPart("image") image: MultipartFile,
    ): ApiResponse<CreativeResponse> {
        val memberId = RequestIdentity.member(userId)
        return ApiResponse.success(CreativeResponse.from(creatives.create(memberId, campaignId, PaidCreativeDraft(title, body, landingUrl, image.bytes))))
    }

    @GetMapping("/creatives/{creativeId}")
    fun creative(@RequestHeader(USER, required = false) userId: String?, @PathVariable creativeId: Long): ApiResponse<CreativeResponse> =
        ApiResponse.success(CreativeResponse.from(creatives.get(RequestIdentity.member(userId), creativeId)))

    /** 이미지 파트가 없으면 이미지는 그대로 두고 문구만 고친다. 어느 쪽이든 다시 심사 대기다. */
    @PutMapping("/creatives/{creativeId}", consumes = ["multipart/form-data"])
    fun revise(
        @RequestHeader(USER, required = false) userId: String?,
        @PathVariable creativeId: Long,
        @RequestParam title: String,
        @RequestParam body: String,
        @RequestParam landingUrl: String,
        @RequestPart("image", required = false) image: MultipartFile?,
    ): ApiResponse<CreativeResponse> {
        val memberId = RequestIdentity.member(userId)
        val draft = PaidCreativeDraft(title, body, landingUrl, image?.takeUnless { it.isEmpty }?.bytes)
        return ApiResponse.success(CreativeResponse.from(creatives.revise(memberId, creativeId, draft)))
    }

    @DeleteMapping("/creatives/{creativeId}")
    fun archive(@RequestHeader(USER, required = false) userId: String?, @PathVariable creativeId: Long): ApiResponse<CreativeResponse> =
        ApiResponse.success(CreativeResponse.from(creatives.archive(RequestIdentity.member(userId), creativeId)))

    @GetMapping("/creatives/{creativeId}/image")
    fun image(@RequestHeader(USER, required = false) userId: String?, @PathVariable creativeId: Long): ResponseEntity<ByteArray> =
        ImageResponses.preview(preview.ofAdvertiser(RequestIdentity.member(userId), creativeId))

    private companion object {
        const val USER = RequestIdentity.USER_HEADER
    }
}
