package com.kgd.product.presentation.product.dto

import jakarta.validation.Valid
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Size

/**
 * 상품 대량 적재 요청.
 * ETL(search:batch ProductSeedIngest) 이 정규화한 JSONL 을 청크 단위로 전송한다.
 * 한 요청 = 한 트랜잭션 = N건 저장 후 건별 Kafka(product.item.created) 발행.
 */
data class BulkCreateProductRequest(
    @field:NotEmpty(message = "상품 목록은 비어있을 수 없습니다")
    @field:Size(max = 1000, message = "한 번에 최대 1000건까지 적재할 수 있습니다")
    @field:Valid
    val products: List<CreateProductRequest>
)
