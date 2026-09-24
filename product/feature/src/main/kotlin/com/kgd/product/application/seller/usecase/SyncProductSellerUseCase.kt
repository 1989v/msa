package com.kgd.product.application.seller.usecase

import java.time.Instant

/** seller.seller.* 이벤트를 판매자 읽기 모델에 반영한다 */
interface SyncProductSellerUseCase {
    fun execute(command: Command)

    data class Command(
        val sellerId: Long,
        val memberId: String,
        val status: String,
        val occurredAt: Instant,
    )
}
