package com.kgd.product.presentation.product.controller

import com.kgd.common.response.ApiResponse
import com.kgd.product.application.product.usecase.CreateProductUseCase
import com.kgd.product.presentation.product.dto.BulkCreateProductRequest
import com.kgd.product.presentation.product.dto.BulkCreateProductResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/**
 * 클러스터 안 배치 전용 — search-batch 시드 Job 이 게이트웨이를 거치지 않고 직접 부른다.
 *
 * 신원 검사가 없다. 게이트웨이에 `/internal` 하위 라우트가 없고 ingress 도 이 경로를 열지 않아
 * 밖에서는 닿지 않는다(NetworkPolicy `allow-search-batch-to-commerce`). 이 경로를 게이트웨이에
 * 라우트하면 누구나 상품을 넣을 수 있게 된다.
 */
@RestController
@RequestMapping("/internal/products")
class ProductInternalController(
    private val createProductUseCase: CreateProductUseCase,
) {
    /** 대량 적재 — 청크 단위 N건을 한 트랜잭션으로 저장, 건별 이벤트는 같은 트랜잭션의 아웃박스로. */
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/bulk")
    fun createProductsBulk(@Valid @RequestBody request: BulkCreateProductRequest): ApiResponse<BulkCreateProductResponse> {
        val results = createProductUseCase.executeBulk(request.products.map { it.toCommand() })
        return ApiResponse.success(BulkCreateProductResponse.from(results))
    }
}
