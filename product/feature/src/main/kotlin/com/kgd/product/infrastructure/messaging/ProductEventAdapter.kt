package com.kgd.product.infrastructure.messaging

import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.product.application.product.port.ProductEventPort
import com.kgd.product.domain.product.model.Product
import com.kgd.product.infrastructure.messaging.event.ProductCreatedEvent
import com.kgd.product.infrastructure.messaging.event.ProductUpdatedEvent
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper

/**
 * 상품 이벤트를 product_db 의 아웃박스에 적는다. 호출자의 트랜잭션(상품 저장)과 함께 커밋되고,
 * Kafka 발행은 `productOutboxPollingPublisher` 가 한다. 키는 상품 id.
 */
@Component
class ProductEventAdapter(
    @Qualifier("productOutboxPort") private val outboxPort: OutboxPort,
    private val objectMapper: ObjectMapper,
    @Value("\${kafka.topics.product-created}") private val createdTopic: String,
    @Value("\${kafka.topics.product-updated}") private val updatedTopic: String
) : ProductEventPort {

    override fun publishProductCreated(product: Product) {
        val event = ProductCreatedEvent(
            productId = product.id!!,
            name = product.name,
            price = product.price.amount,
            status = product.status.name,
            sellerId = product.sellerId,
            brand = product.brand,
            description = product.description,
            category = product.category,
            energyKcal = product.energyKcal,
            carbohydrateG = product.carbohydrateG,
            proteinG = product.proteinG,
            fatG = product.fatG,
            sugarG = product.sugarG,
            sodiumMg = product.sodiumMg,
            ingredients = product.ingredients,
            originCountry = product.originCountry,
            itemReportNo = product.itemReportNo
        )
        outboxPort.save(AGGREGATE_TYPE, event.productId, createdTopic, objectMapper.writeValueAsString(event))
    }

    override fun publishProductUpdated(product: Product) {
        val event = ProductUpdatedEvent(
            productId = product.id!!,
            name = product.name,
            price = product.price.amount,
            status = product.status.name,
            sellerId = product.sellerId,
            brand = product.brand,
            description = product.description,
            category = product.category,
            energyKcal = product.energyKcal,
            carbohydrateG = product.carbohydrateG,
            proteinG = product.proteinG,
            fatG = product.fatG,
            sugarG = product.sugarG,
            sodiumMg = product.sodiumMg,
            ingredients = product.ingredients,
            originCountry = product.originCountry,
            itemReportNo = product.itemReportNo
        )
        outboxPort.save(AGGREGATE_TYPE, event.productId, updatedTopic, objectMapper.writeValueAsString(event))
    }

    private companion object {
        const val AGGREGATE_TYPE = "Product"
    }
}
