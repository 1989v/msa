package com.kgd.product.presentation.product.controller

import com.kgd.common.response.ApiResponse
import com.kgd.product.application.product.usecase.ProductRequester
import com.kgd.product.application.product.usecase.RepublishProductsUseCase
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 상품 어드민 — 게이트웨이(ROLE_ADMIN)와 서비스가 두 번 판정한다 */
@RestController
@RequestMapping("/api/v1/admin/products")
class ProductAdminController(
    private val republishProductsUseCase: RepublishProductsUseCase,
) {
    /** 전 상품 `product.item.updated` 재발행 — order 읽기 모델 채우기(배포 뒤 1회) */
    @PostMapping("/republish")
    fun republish(
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<RepublishResponse> =
        ApiResponse.success(RepublishResponse(republishProductsUseCase.execute(ProductRequester.of(userId, roles))))
}

data class RepublishResponse(val published: Int)
