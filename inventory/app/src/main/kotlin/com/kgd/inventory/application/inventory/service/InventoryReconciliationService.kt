package com.kgd.inventory.application.inventory.service

import com.kgd.inventory.application.inventory.port.InventoryCachePort
import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class InventoryReconciliationService(
    private val inventoryRepository: InventoryRepositoryPort,
    @param:Autowired(required = false)
    private val cachePort: InventoryCachePort? = null,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(fixedDelayString = "\${inventory.reconciliation.interval-ms:300000}")
    @Transactional(readOnly = true)
    fun reconcile() {
        if (cachePort == null) return

        val allInventory = inventoryRepository.findAll()
        var corrected = 0

        for (inventory in allInventory) {
            val cached = cachePort.getStock(inventory.productId, inventory.warehouseId)
            if (cached == null) {
                cachePort.setStock(
                    inventory.productId,
                    inventory.warehouseId,
                    inventory.getAvailableQty(),
                    inventory.getReservedQty(),
                )
                corrected++
            } else if (cached.availableQty != inventory.getAvailableQty() || cached.reservedQty != inventory.getReservedQty()) {
                log.warn(
                    "Reconciliation mismatch: productId={}, warehouseId={}, redis=({},{}), db=({},{})",
                    inventory.productId, inventory.warehouseId,
                    cached.availableQty, cached.reservedQty,
                    inventory.getAvailableQty(), inventory.getReservedQty(),
                )
                cachePort.setStock(
                    inventory.productId,
                    inventory.warehouseId,
                    inventory.getAvailableQty(),
                    inventory.getReservedQty(),
                )
                corrected++
            }
        }

        if (corrected > 0) {
            log.info("Reconciliation completed: {} inventory records corrected", corrected)
        }
    }
}
