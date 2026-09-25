package com.kgd.inventory.application.ownership.service

import com.kgd.inventory.application.ownership.port.OwnershipRepositoryPort
import com.kgd.inventory.application.ownership.usecase.SyncOwnershipUseCase
import com.kgd.inventory.domain.ownership.model.OwnerSeller
import com.kgd.inventory.domain.ownership.model.OwnerSellerStatus
import com.kgd.inventory.domain.ownership.model.ProductOwner
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

private val log = KotlinLogging.logger {}

@Service
class InventoryOwnershipSyncService(
    private val ownership: OwnershipRepositoryPort,
) : SyncOwnershipUseCase {

    @Transactional(transactionManager = "inventoryTransactionManager")
    override fun syncSeller(command: SyncOwnershipUseCase.Seller) {
        val incoming = OwnerSeller(command.sellerId, command.memberId, OwnerSellerStatus.valueOf(command.status), command.occurredAt)
        val current = ownership.findSeller(command.sellerId)
        if (current != null && !current.isSupersededBy(incoming)) {
            log.info { "소유 판매자 읽기 모델: 옛 이벤트 무시 sellerId=${command.sellerId}" }
            return
        }
        ownership.saveSeller(incoming)
    }

    @Transactional(transactionManager = "inventoryTransactionManager")
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
