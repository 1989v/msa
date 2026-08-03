package com.kgd.inventory.application.inventory.service

import com.kgd.inventory.application.inventory.port.InventoryCachePort
import com.kgd.inventory.application.inventory.port.InventoryRepositoryPort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service

@Service
class InventoryReconciliationService(
    private val inventoryRepository: InventoryRepositoryPort,
    @param:Autowired(required = false)
    private val cachePort: InventoryCachePort? = null,
) {
    private val log = KotlinLogging.logger {}

    @Scheduled(fixedDelayString = "\${inventory.reconciliation.interval-ms:300000}")
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
                log.warn {
                    "Reconciliation mismatch: productId=${inventory.productId}, warehouseId=${inventory.warehouseId}, " +
                        "redis=(${cached.availableQty},${cached.reservedQty}), db=(${inventory.getAvailableQty()},${inventory.getReservedQty()})"
                }
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
            log.info { "Reconciliation completed: $corrected inventory records corrected" }
        }
    }
}
