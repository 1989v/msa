package com.kgd.product.presentation.product.controller

import com.kgd.common.response.ApiResponse
import com.kgd.product.application.product.usecase.CreateProductUseCase
import com.kgd.product.application.product.usecase.GetAllProductsUseCase
import com.kgd.product.application.product.usecase.GetProductUseCase
import com.kgd.product.application.product.usecase.ProductRequester
import com.kgd.product.application.product.usecase.UpdateProductUseCase
import com.kgd.product.presentation.product.dto.CreateProductRequest
import com.kgd.product.presentation.product.dto.ProductListResponse
import com.kgd.product.presentation.product.dto.ProductResponse
import com.kgd.product.presentation.product.dto.UpdateProductRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

/**
 * 상품 공개 API. 조회는 공개, 쓰기는 게이트웨이(ROLE_SELLER|ROLE_ADMIN)와 서비스가 두 번 판정한다.
 * 일괄 등록은 여기 없다 — 클러스터 안 배치 전용 [ProductInternalController] 에 있다.
 */
@RestController
@RequestMapping("/api/v1/products")
class ProductController(
    private val createProductUseCase: CreateProductUseCase,
    private val getProductUseCase: GetProductUseCase,
    private val updateProductUseCase: UpdateProductUseCase,
    private val getAllProductsUseCase: GetAllProductsUseCase
) {
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    fun createProduct(
        @Valid @RequestBody request: CreateProductRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<ProductResponse> {
        val result = createProductUseCase.execute(request.toCommand(), ProductRequester.of(userId, roles))
        return ApiResponse.success(ProductResponse.from(result))
    }

    @GetMapping
    fun getProducts(
        @RequestParam(defaultValue = "0") @Min(0) page: Int,
        @RequestParam(defaultValue = "100") @Min(1) @Max(500) size: Int,
        @RequestParam(required = false) sellerId: Long?,
    ): ApiResponse<ProductListResponse> {
        val result = getAllProductsUseCase.execute(GetAllProductsUseCase.Query(page, size, sellerId))
        return ApiResponse.success(ProductListResponse.from(result))
    }

    @GetMapping("/{id}")
    fun getProduct(@PathVariable id: Long): ApiResponse<ProductResponse> {
        val result = getProductUseCase.execute(id)
        return ApiResponse.success(ProductResponse.from(result))
    }

    @PutMapping("/{id}")
    fun updateProduct(
        @PathVariable id: Long,
        @Valid @RequestBody request: UpdateProductRequest,
        @RequestHeader(value = "X-User-Id", required = false) userId: String?,
        @RequestHeader(value = "X-User-Roles", required = false) roles: String?,
    ): ApiResponse<ProductResponse> {
        val result = updateProductUseCase.execute(request.toCommand(id), ProductRequester.of(userId, roles))
        return ApiResponse.success(ProductResponse.from(result))
    }
}
