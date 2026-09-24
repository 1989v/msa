package com.kgd.ads.presentation.admin.controller

import com.kgd.ads.application.advertiser.dto.AdvertiserAdminView
import com.kgd.ads.application.advertiser.usecase.ManageAdvertiserUseCase
import com.kgd.ads.application.category.dto.ContextMappingView
import com.kgd.ads.application.category.dto.HostCategoryView
import com.kgd.ads.application.category.usecase.ManageContextMappingUseCase
import com.kgd.ads.application.creative.usecase.PreviewCreativeImageUseCase
import com.kgd.ads.application.creative.usecase.ReviewCreativeUseCase
import com.kgd.ads.application.ledger.usecase.CheckLedgerUseCase
import com.kgd.ads.application.placement.dto.PlacementView
import com.kgd.ads.application.placement.dto.UnregisteredPlacementView
import com.kgd.ads.application.placement.usecase.ManagePlacementUseCase
import com.kgd.ads.application.report.usecase.GetPublisherReportUseCase
import com.kgd.ads.presentation.admin.dto.AdminCreativeResponse
import com.kgd.ads.presentation.admin.dto.ContextMappingRequest
import com.kgd.ads.presentation.admin.dto.CreatePlacementRequest
import com.kgd.ads.presentation.admin.dto.HostCategoryRequest
import com.kgd.ads.presentation.admin.dto.LedgerCheckResponse
import com.kgd.ads.presentation.admin.dto.RejectCreativeRequest
import com.kgd.ads.presentation.admin.dto.SuspendAdvertiserRequest
import com.kgd.ads.presentation.admin.dto.UpdatePlacementRequest
import com.kgd.ads.presentation.support.ImageResponses
import com.kgd.ads.presentation.support.RequestIdentity
import com.kgd.common.response.ApiResponse
import jakarta.validation.Valid
import org.springframework.format.annotation.DateTimeFormat
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.LocalDate

/**
 * 광고 백오피스 API — 심사·광고주·지면·문맥 매핑·퍼블리셔 리포트·원장 검사.
 * 게이트웨이가 ROLE_ADMIN 을 확인하고, 행위자는 `X-User-Id`(운영자 회원 id)다. 모든 변경은 행위자·시각을 남긴다.
 * 승인·정지·지면·매핑 변경은 다음 후보 인덱스 갱신(1분 안)에 결정에 반영된다.
 */
@RestController
@RequestMapping("/api/v1/admin/ads")
class AdsAdminController(
    private val review: ReviewCreativeUseCase,
    private val preview: PreviewCreativeImageUseCase,
    private val advertisers: ManageAdvertiserUseCase,
    private val placements: ManagePlacementUseCase,
    private val mappings: ManageContextMappingUseCase,
    private val publisherReport: GetPublisherReportUseCase,
    private val checkLedger: CheckLedgerUseCase,
) {
    // ─── 심사 ──────────────────────────────────────────────────────────────

    @GetMapping("/creatives/pending")
    fun pending(@RequestHeader(USER, required = false) userId: String?, @RequestHeader(ROLES, required = false) roles: String?): ApiResponse<List<AdminCreativeResponse>> {
        RequestIdentity.admin(userId, roles)
        return ApiResponse.success(review.pending().map(AdminCreativeResponse::from))
    }

    @PostMapping("/creatives/{creativeId}/approve")
    fun approve(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @PathVariable creativeId: Long,
    ): ApiResponse<AdminCreativeResponse> =
        ApiResponse.success(AdminCreativeResponse.from(review.approve(RequestIdentity.admin(userId, roles), creativeId)))

    @PostMapping("/creatives/{creativeId}/reject")
    fun reject(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @PathVariable creativeId: Long,
        @RequestBody request: RejectCreativeRequest,
    ): ApiResponse<AdminCreativeResponse> =
        ApiResponse.success(AdminCreativeResponse.from(review.reject(RequestIdentity.admin(userId, roles), creativeId, request.reason)))

    @GetMapping("/creatives/{creativeId}/image")
    fun image(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @PathVariable creativeId: Long,
    ): ResponseEntity<ByteArray> {
        RequestIdentity.admin(userId, roles)
        return ImageResponses.preview(preview.ofAnyCreative(creativeId))
    }

    // ─── 광고주 ────────────────────────────────────────────────────────────

    @GetMapping("/advertisers")
    fun advertisers(@RequestHeader(USER, required = false) userId: String?, @RequestHeader(ROLES, required = false) roles: String?): ApiResponse<List<AdvertiserAdminView>> {
        RequestIdentity.admin(userId, roles)
        return ApiResponse.success(advertisers.list())
    }

    @PostMapping("/advertisers/{advertiserId}/suspend")
    fun suspend(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @PathVariable advertiserId: Long,
        @Valid @RequestBody request: SuspendAdvertiserRequest,
    ): ApiResponse<AdvertiserAdminView> =
        ApiResponse.success(advertisers.suspend(ManageAdvertiserUseCase.Suspend(advertiserId, request.reason, RequestIdentity.admin(userId, roles))))

    @PostMapping("/advertisers/{advertiserId}/unsuspend")
    fun unsuspend(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @PathVariable advertiserId: Long,
    ): ApiResponse<AdvertiserAdminView> =
        ApiResponse.success(advertisers.unsuspend(ManageAdvertiserUseCase.Unsuspend(advertiserId, RequestIdentity.admin(userId, roles))))

    // ─── 지면 ──────────────────────────────────────────────────────────────

    @GetMapping("/placements")
    fun placements(@RequestHeader(USER, required = false) userId: String?, @RequestHeader(ROLES, required = false) roles: String?): ApiResponse<List<PlacementView>> {
        RequestIdentity.admin(userId, roles)
        return ApiResponse.success(placements.list())
    }

    @PostMapping("/placements")
    fun createPlacement(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @Valid @RequestBody request: CreatePlacementRequest,
    ): ApiResponse<PlacementView> = ApiResponse.success(
        placements.create(
            ManagePlacementUseCase.Create(
                key = request.key,
                host = request.host,
                format = request.format,
                aspectRatios = request.aspectRatios,
                floorMicros = request.floorMicros,
                active = request.active,
                paidAllowed = request.paidAllowed,
                description = request.description,
                actorMemberId = RequestIdentity.admin(userId, roles),
            ),
        ),
    )

    @PatchMapping("/placements/{placementKey}")
    fun updatePlacement(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @PathVariable placementKey: String,
        @Valid @RequestBody request: UpdatePlacementRequest,
    ): ApiResponse<PlacementView> = ApiResponse.success(
        placements.update(
            ManagePlacementUseCase.Update(
                key = placementKey,
                floorMicros = request.floorMicros,
                active = request.active,
                paidAllowed = request.paidAllowed,
                description = request.description,
                actorMemberId = RequestIdentity.admin(userId, roles),
            ),
        ),
    )

    @GetMapping("/placements/unregistered")
    fun unregistered(@RequestHeader(USER, required = false) userId: String?, @RequestHeader(ROLES, required = false) roles: String?): ApiResponse<List<UnregisteredPlacementView>> {
        RequestIdentity.admin(userId, roles)
        return ApiResponse.success(placements.unregistered())
    }

    // ─── 문맥 매핑 ─────────────────────────────────────────────────────────

    @GetMapping("/context-mappings")
    fun contextMappings(@RequestHeader(USER, required = false) userId: String?, @RequestHeader(ROLES, required = false) roles: String?): ApiResponse<List<ContextMappingView>> {
        RequestIdentity.admin(userId, roles)
        return ApiResponse.success(mappings.mappings())
    }

    /** 문맥 키에 `:` 가 들어가 경로 대신 본문으로 받는다. */
    @PutMapping("/context-mappings")
    fun putContextMapping(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @Valid @RequestBody request: ContextMappingRequest,
    ): ApiResponse<ContextMappingView> = ApiResponse.success(
        mappings.putMapping(ManageContextMappingUseCase.PutMapping(request.contextKey, request.categoryCode, RequestIdentity.admin(userId, roles))),
    )

    @DeleteMapping("/context-mappings")
    fun deleteContextMapping(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @RequestParam contextKey: String,
    ): ApiResponse<Unit> {
        mappings.deleteMapping(ManageContextMappingUseCase.DeleteMapping(contextKey, RequestIdentity.admin(userId, roles)))
        return ApiResponse.success(Unit)
    }

    @GetMapping("/host-categories")
    fun hostCategories(@RequestHeader(USER, required = false) userId: String?, @RequestHeader(ROLES, required = false) roles: String?): ApiResponse<List<HostCategoryView>> {
        RequestIdentity.admin(userId, roles)
        return ApiResponse.success(mappings.hostCategories())
    }

    @PutMapping("/host-categories")
    fun putHostCategory(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @Valid @RequestBody request: HostCategoryRequest,
    ): ApiResponse<HostCategoryView> = ApiResponse.success(
        mappings.putHostCategory(ManageContextMappingUseCase.PutHostCategory(request.host, request.categoryCode, RequestIdentity.admin(userId, roles))),
    )

    // ─── 리포트·원장 ───────────────────────────────────────────────────────

    @GetMapping("/reports/publisher")
    fun publisherReport(
        @RequestHeader(USER, required = false) userId: String?,
        @RequestHeader(ROLES, required = false) roles: String?,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) from: LocalDate,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) to: LocalDate,
    ): ApiResponse<GetPublisherReportUseCase.PublisherReport> {
        RequestIdentity.admin(userId, roles)
        return ApiResponse.success(publisherReport.execute(from, to))
    }

    /** 전체 분개 합 검사를 지금 돌린 결과. 0 이 아니면 서버 로그에 ERROR 가 함께 남는다. */
    @GetMapping("/ledger/check")
    fun ledgerCheck(@RequestHeader(USER, required = false) userId: String?, @RequestHeader(ROLES, required = false) roles: String?): ApiResponse<LedgerCheckResponse> {
        RequestIdentity.admin(userId, roles)
        val result = checkLedger.check()
        return ApiResponse.success(LedgerCheckResponse(result.imbalanceMicros, result.balanced, result.checkedAt))
    }

    private companion object {
        const val USER = RequestIdentity.USER_HEADER
        const val ROLES = RequestIdentity.ROLES_HEADER
    }
}
