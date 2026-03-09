package com.kgd.product.presentation.product.controller

import com.kgd.common.response.ApiResponse
import com.kgd.product.application.product.usecase.CreateProductUseCase
import com.kgd.product.application.product.usecase.GetAllProductsUseCase
import com.kgd.product.application.product.usecase.GetProductUseCase
import com.kgd.product.application.product.usecase.UpdateProductUseCase
import com.kgd.product.presentation.product.dto.CreateProductRequest
import com.kgd.product.presentation.product.dto.ProductListResponse
import com.kgd.product.presentation.product.dto.ProductResponse
import com.kgd.product.presentation.product.dto.UpdateProductRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/products")
class ProductController(
    private val createProductUseCase: CreateProductUseCase,
    private val getProductUseCase: GetProductUseCase,
    private val updateProductUseCase: UpdateProductUseCase,
    private val getAllProductsUseCase: GetAllProductsUseCase
) {
    @PostMapping
    fun createProduct(@Valid @RequestBody request: CreateProductRequest): ResponseEntity<ApiResponse<ProductResponse>> {
        val result = createProductUseCase.execute(request.toCommand())
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success(ProductResponse.from(result)))
    }

    @GetMapping
    fun getProducts(
        @RequestParam(defaultValue = "0") @Min(0) page: Int,
        @RequestParam(defaultValue = "100") @Min(1) @Max(500) size: Int
    ): ResponseEntity<ApiResponse<ProductListResponse>> {
        val result = getAllProductsUseCase.execute(GetAllProductsUseCase.Query(page, size))
        return ResponseEntity.ok(ApiResponse.success(ProductListResponse.from(result)))
    }

    @GetMapping("/{id}")
    fun getProduct(@PathVariable id: Long): ResponseEntity<ApiResponse<ProductResponse>> {
        val result = getProductUseCase.execute(id)
        return ResponseEntity.ok(ApiResponse.success(ProductResponse.from(result)))
    }

    @PutMapping("/{id}")
    fun updateProduct(
        @PathVariable id: Long,
        @Valid @RequestBody request: UpdateProductRequest
    ): ResponseEntity<ApiResponse<ProductResponse>> {
        val result = updateProductUseCase.execute(request.toCommand(id))
        return ResponseEntity.ok(ApiResponse.success(ProductResponse.from(result)))
    }
}
