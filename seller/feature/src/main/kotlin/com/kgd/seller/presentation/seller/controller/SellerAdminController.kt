package com.kgd.seller.presentation.seller.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.seller.application.seller.usecase.ManageSellerUseCase
import com.kgd.seller.application.seller.usecase.QuerySellersUseCase
import com.kgd.seller.domain.seller.model.SellerStatus
import com.kgd.seller.presentation.seller.dto.ApproveSellerRequest
import com.kgd.seller.presentation.seller.dto.ChangeCommissionRequest
import com.kgd.seller.presentation.seller.dto.ReactivateSellerRequest
import com.kgd.seller.presentation.seller.dto.SellerPageResponse
import com.kgd.seller.presentation.seller.dto.SellerReasonRequest
import com.kgd.seller.presentation.seller.dto.SellerResponse
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/** 판매자 관리 (ROLE_ADMIN). 상태·수수료율 조치는 행위자(X-User-Id)·사유가 이력으로 남는다. */
@RestController
@RequestMapping("/api/v1/admin/sellers")
class SellerAdminController(
    private val querySellersUseCase: QuerySellersUseCase,
    private val manageSellerUseCase: ManageSellerUseCase,
) {
    @GetMapping
    fun list(
        @RequestParam(required = false) status: SellerStatus?,
        @RequestParam(defaultValue = "0") @Min(0) page: Int,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) size: Int,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<SellerPageResponse> {
        SellerRequestIdentity.requireAdmin(userId, roles)
        return ApiResponse.success(SellerPageResponse.from(querySellersUseCase.list(QuerySellersUseCase.Query(status, page, size))))
    }

    @GetMapping("/{id}")
    fun get(
        @PathVariable id: Long,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<SellerResponse> {
        SellerRequestIdentity.requireAdmin(userId, roles)
        return ApiResponse.success(SellerResponse.from(querySellersUseCase.get(id)))
    }

    @PostMapping("/{id}/approve")
    fun approve(
        @PathVariable id: Long,
        @Valid @RequestBody request: ApproveSellerRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<SellerResponse> {
        val actor = SellerRequestIdentity.requireAdmin(userId, roles)
        return ok(manageSellerUseCase.approve(ManageSellerUseCase.Approve(id, actor, request.commissionRateBp, request.reason)))
    }

    @PostMapping("/{id}/reject")
    fun reject(
        @PathVariable id: Long,
        @Valid @RequestBody request: SellerReasonRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<SellerResponse> {
        val actor = SellerRequestIdentity.requireAdmin(userId, roles)
        return ok(manageSellerUseCase.reject(ManageSellerUseCase.Reject(id, actor, request.reason)))
    }

    @PostMapping("/{id}/suspend")
    fun suspend(
        @PathVariable id: Long,
        @Valid @RequestBody request: SellerReasonRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<SellerResponse> {
        val actor = SellerRequestIdentity.requireAdmin(userId, roles)
        return ok(manageSellerUseCase.suspend(ManageSellerUseCase.Suspend(id, actor, request.reason)))
    }

    @PostMapping("/{id}/reactivate")
    fun reactivate(
        @PathVariable id: Long,
        @Valid @RequestBody(required = false) request: ReactivateSellerRequest?,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<SellerResponse> {
        val actor = SellerRequestIdentity.requireAdmin(userId, roles)
        return ok(manageSellerUseCase.reactivate(ManageSellerUseCase.Reactivate(id, actor, request?.reason)))
    }

    @PatchMapping("/{id}/commission")
    fun changeCommission(
        @PathVariable id: Long,
        @Valid @RequestBody request: ChangeCommissionRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<SellerResponse> {
        val actor = SellerRequestIdentity.requireAdmin(userId, roles)
        return ok(
            manageSellerUseCase.changeCommission(
                ManageSellerUseCase.ChangeCommission(id, actor, request.commissionRateBp, request.reason),
            ),
        )
    }

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> = SellerErrorResponses.of(e)

    private fun ok(view: com.kgd.seller.application.seller.usecase.SellerView) =
        ApiResponse.success(SellerResponse.from(view))
}
