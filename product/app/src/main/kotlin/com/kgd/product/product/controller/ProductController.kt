package com.kgd.product.presentation.product.controller

import com.kgd.common.response.ApiResponse
import com.kgd.product.application.product.usecase.CreateProductUseCase
import com.kgd.product.application.product.usecase.GetAllProductsUseCase
import com.kgd.product.application.product.usecase.GetProductUseCase
import com.kgd.product.application.product.usecase.UpdateProductUseCase
import com.kgd.product.presentation.product.dto.BulkCreateProductRequest
import com.kgd.product.presentation.product.dto.BulkCreateProductResponse
import com.kgd.product.presentation.product.dto.CreateProductRequest
import com.kgd.product.presentation.product.dto.ProductListResponse
import com.kgd.product.presentation.product.dto.ProductResponse
import com.kgd.product.presentation.product.dto.UpdateProductRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/products")
class ProductController(
    private val createProductUseCase: CreateProductUseCase,
    private val getProductUseCase: GetProductUseCase,
    private val updateProductUseCase: UpdateProductUseCase,
    private val getAllProductsUseCase: GetAllProductsUseCase
) {
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    fun createProduct(@Valid @RequestBody request: CreateProductRequest): ApiResponse<ProductResponse> {
        val result = createProductUseCase.execute(request.toCommand())
        return ApiResponse.success(ProductResponse.from(result))
    }

    /** 대량 적재 — ETL 시드 경로. 청크 단위 N건을 한 트랜잭션으로 저장 후 건별 이벤트 발행. */
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/bulk")
    fun createProductsBulk(@Valid @RequestBody request: BulkCreateProductRequest): ApiResponse<BulkCreateProductResponse> {
        val results = createProductUseCase.executeBulk(request.products.map { it.toCommand() })
        return ApiResponse.success(BulkCreateProductResponse.from(results))
    }

    @GetMapping
    fun getProducts(
        @RequestParam(defaultValue = "0") @Min(0) page: Int,
        @RequestParam(defaultValue = "100") @Min(1) @Max(500) size: Int
    ): ApiResponse<ProductListResponse> {
        val result = getAllProductsUseCase.execute(GetAllProductsUseCase.Query(page, size))
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
        @Valid @RequestBody request: UpdateProductRequest
    ): ApiResponse<ProductResponse> {
        val result = updateProductUseCase.execute(request.toCommand(id))
        return ApiResponse.success(ProductResponse.from(result))
    }
}
