package com.kgd.fulfillment.application.ownership.service

import com.kgd.fulfillment.application.ownership.port.OwnershipRepositoryPort
import com.kgd.fulfillment.application.ownership.usecase.SyncOwnershipUseCase
import com.kgd.fulfillment.domain.ownership.model.OwnerSeller
import com.kgd.fulfillment.domain.ownership.model.OwnerSellerStatus
import com.kgd.fulfillment.domain.ownership.model.ProductOwner
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

private val log = KotlinLogging.logger {}

@Service
class FulfillmentOwnershipSyncService(
    private val ownership: OwnershipRepositoryPort,
) : SyncOwnershipUseCase {

    @Transactional(transactionManager = "fulfillmentTransactionManager")
    override fun syncSeller(command: SyncOwnershipUseCase.Seller) {
        val incoming = OwnerSeller(command.sellerId, command.memberId, OwnerSellerStatus.valueOf(command.status), command.occurredAt)
        val current = ownership.findSeller(command.sellerId)
        if (current != null && !current.isSupersededBy(incoming)) {
            log.info { "소유 판매자 읽기 모델: 옛 이벤트 무시 sellerId=${command.sellerId}" }
            return
        }
        ownership.saveSeller(incoming)
    }

    @Transactional(transactionManager = "fulfillmentTransactionManager")
    override fun syncProduct(command: SyncOwnershipUseCase.Product) {
        val incoming = ProductOwner(command.productId, command.sellerId, command.occurredAt)
        val current = ownership.findProductOwner(command.productId)
        if (current != null && !current.isSupersededBy(incoming)) {
            log.info { "상품 소유 읽기 모델: 옛 이벤트 무시 productId=${command.productId}" }
            return
        }
        ownership.saveProductOwner(incoming)
    }
}
