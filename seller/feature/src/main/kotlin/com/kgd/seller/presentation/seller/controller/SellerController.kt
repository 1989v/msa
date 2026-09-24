package com.kgd.seller.presentation.seller.controller

import com.kgd.common.exception.BusinessException
import com.kgd.common.response.ApiResponse
import com.kgd.seller.application.seller.usecase.ApplySellerUseCase
import com.kgd.seller.application.seller.usecase.GetMySellerApplicationUseCase
import com.kgd.seller.application.seller.usecase.GetMySellerUseCase
import com.kgd.seller.presentation.seller.dto.ApplySellerRequest
import com.kgd.seller.presentation.seller.dto.MySellerApplicationResponse
import com.kgd.seller.presentation.seller.dto.SellerResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * 입점 신청·내 신청 상태(`/api/v1/sellers/apply`·`/api/v1/sellers/me`, ROLE_USER)와
 * 판매자 포털(`/api/v1/seller/` 하위, ROLE_SELLER).
 * 판매자 포털은 매 요청 X-User-Id 로 판매자 행을 찾아 ACTIVE 인지 본다.
 */
@RestController
class SellerController(
    private val applySellerUseCase: ApplySellerUseCase,
    private val getMySellerUseCase: GetMySellerUseCase,
    private val getMySellerApplicationUseCase: GetMySellerApplicationUseCase,
) {
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/api/v1/sellers/apply")
    fun apply(
        @Valid @RequestBody request: ApplySellerRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
    ): ApiResponse<SellerResponse> {
        val memberId = SellerRequestIdentity.requireUser(userId)
        return ApiResponse.success(SellerResponse.from(applySellerUseCase.execute(request.toCommand(memberId))))
    }

    @GetMapping("/api/v1/sellers/me")
    fun myApplication(
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
    ): ApiResponse<MySellerApplicationResponse> = ApiResponse.success(
        MySellerApplicationResponse.from(getMySellerApplicationUseCase.execute(SellerRequestIdentity.requireUser(userId))),
    )

    @GetMapping("/api/v1/seller/me")
    fun me(
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
    ): ApiResponse<SellerResponse> =
        ApiResponse.success(SellerResponse.from(getMySellerUseCase.execute(SellerRequestIdentity.requireUser(userId))))

    @ExceptionHandler(BusinessException::class)
    fun handle(e: BusinessException): ResponseEntity<ApiResponse<Nothing>> = SellerErrorResponses.of(e)
}
