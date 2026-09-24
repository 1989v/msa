package com.kgd.product.application.seller.service

import com.kgd.product.application.seller.port.ProductSellerRepositoryPort
import com.kgd.product.application.seller.usecase.SyncProductSellerUseCase
import com.kgd.product.domain.seller.model.ProductSeller
import com.kgd.product.domain.seller.model.ProductSellerStatus
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

private val log = KotlinLogging.logger {}

@Service
class ProductSellerSyncService(
    private val sellers: ProductSellerRepositoryPort,
) : SyncProductSellerUseCase {

    @Transactional(transactionManager = "productTransactionManager")
    override fun execute(command: SyncProductSellerUseCase.Command) {
        val incoming = ProductSeller(
            sellerId = command.sellerId,
            memberId = command.memberId,
            status = ProductSellerStatus.valueOf(command.status),
            occurredAt = command.occurredAt,
        )
        val current = sellers.findById(command.sellerId)
        if (current != null && !current.isSupersededBy(incoming)) {
            log.info {
                "판매자 읽기 모델: 옛 이벤트 무시 sellerId=${command.sellerId} " +
                    "incoming=${command.occurredAt} current=${current.occurredAt}"
            }
            return
        }
        sellers.save(incoming)
    }
}
