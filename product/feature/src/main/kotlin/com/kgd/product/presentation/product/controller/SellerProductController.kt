package com.kgd.product.presentation.product.controller

import com.kgd.common.response.ApiResponse
import com.kgd.product.application.product.usecase.GetSellerProductsUseCase
import com.kgd.product.application.product.usecase.ProductRequester
import com.kgd.product.presentation.product.dto.ProductListResponse
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 판매자 포털의 내 상품 — 게이트웨이 seller-portal 라우트(ROLE_SELLER)를 지나 서비스가 ACTIVE 판매자 행으로 다시 판정한다.
 * 판매 중지 상품까지 전부, 최근 등록순.
 */
@RestController
@RequestMapping("/api/v1/seller/products")
class SellerProductController(
    private val getSellerProductsUseCase: GetSellerProductsUseCase,
) {
    @GetMapping
    fun getMyProducts(
        @RequestParam(defaultValue = "0") @Min(0) page: Int,
        @RequestParam(defaultValue = "20") @Min(1) @Max(100) size: Int,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<ProductListResponse> {
        val result = getSellerProductsUseCase.execute(GetSellerProductsUseCase.Query(page, size), ProductRequester.of(userId, roles))
        return ApiResponse.success(ProductListResponse.from(result))
    }
}
