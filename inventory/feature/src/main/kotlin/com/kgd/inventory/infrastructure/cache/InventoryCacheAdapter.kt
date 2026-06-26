package com.kgd.inventory.infrastructure.cache

import com.kgd.inventory.application.inventory.port.InventoryCachePort
import org.springframework.core.io.ClassPathResource
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.core.script.DefaultRedisScript
import org.springframework.stereotype.Component

@Component
class InventoryCacheAdapter(
    private val redisTemplate: StringRedisTemplate,
) : InventoryCachePort {

    private val reserveScript = loadScript("scripts/reserve-stock.lua")
    private val releaseScript = loadScript("scripts/release-stock.lua")
    private val confirmScript = loadScript("scripts/confirm-stock.lua")
    private val receiveScript = loadScript("scripts/receive-stock.lua")

    private fun key(productId: Long, warehouseId: Long) = "inventory:$productId:$warehouseId"

    override fun reserveStock(productId: Long, warehouseId: Long, qty: Int): Int? {
        val result = redisTemplate.execute(reserveScript, listOf(key(productId, warehouseId)), qty.toString())
        return result?.toLongOrNull()?.takeIf { it >= 0 }?.toInt()
    }

    override fun releaseStock(productId: Long, warehouseId: Long, qty: Int): Int? {
        val result = redisTemplate.execute(releaseScript, listOf(key(productId, warehouseId)), qty.toString())
        return result?.toLongOrNull()?.takeIf { it >= 0 }?.toInt()
    }

    override fun confirmStock(productId: Long, warehouseId: Long, qty: Int): Int? {
        val result = redisTemplate.execute(confirmScript, listOf(key(productId, warehouseId)), qty.toString())
        return result?.toLongOrNull()?.takeIf { it >= 0 }?.toInt()
    }

    override fun receiveStock(productId: Long, warehouseId: Long, qty: Int): Int? {
        val result = redisTemplate.execute(receiveScript, listOf(key(productId, warehouseId)), qty.toString())
        return result?.toLongOrNull()?.toInt()
    }

    override fun getStock(productId: Long, warehouseId: Long): InventoryCachePort.CachedInventory? {
        val hash = redisTemplate.opsForHash<String, String>().entries(key(productId, warehouseId))
        if (hash.isEmpty()) return null
        return InventoryCachePort.CachedInventory(
            availableQty = hash["availableQty"]?.toIntOrNull() ?: 0,
            reservedQty = hash["reservedQty"]?.toIntOrNull() ?: 0,
        )
    }

    override fun setStock(productId: Long, warehouseId: Long, availableQty: Int, reservedQty: Int) {
        redisTemplate.opsForHash<String, String>().putAll(
            key(productId, warehouseId),
            mapOf("availableQty" to availableQty.toString(), "reservedQty" to reservedQty.toString()),
        )
    }

    private fun loadScript(path: String): DefaultRedisScript<String> {
        val script = DefaultRedisScript<String>()
        script.setLocation(ClassPathResource(path))
        script.resultType = String::class.java
        return script
    }
}
