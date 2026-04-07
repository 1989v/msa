package com.kgd.product.application.product.service

import com.kgd.product.application.product.port.ProductRepositoryPort
import com.kgd.product.application.product.usecase.SyncProductStockUseCase
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional
class ProductStockSyncService(
    private val productRepository: ProductRepositoryPort,
) : SyncProductStockUseCase {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun execute(command: SyncProductStockUseCase.Command) {
        val product = productRepository.findById(command.productId) ?: run {
            log.warn("Product not found for stock sync: productId={}", command.productId)
            return
        }
        product.syncStock(command.availableQty)
        productRepository.save(product)
        log.info("Stock synced: productId={}, availableQty={}", command.productId, command.availableQty)
    }
}
