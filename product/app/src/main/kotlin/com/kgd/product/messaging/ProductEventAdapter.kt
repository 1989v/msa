package com.kgd.product.infrastructure.messaging

import com.kgd.product.application.product.port.ProductEventPort
import com.kgd.product.domain.product.model.Product
import com.kgd.product.infrastructure.messaging.event.ProductCreatedEvent
import com.kgd.product.infrastructure.messaging.event.ProductUpdatedEvent
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

@Component
class ProductEventAdapter(
    private val kafkaTemplate: KafkaTemplate<String, Any>,
    @Value("\${kafka.topics.product-created}") private val createdTopic: String,
    @Value("\${kafka.topics.product-updated}") private val updatedTopic: String
) : ProductEventPort {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun publishProductCreated(product: Product) {
        val event = ProductCreatedEvent(
            productId = product.id!!,
            name = product.name,
            price = product.price.amount,
            status = product.status.name
        )
        kafkaTemplate.send(createdTopic, product.id.toString(), event)
            .whenComplete { _, ex ->
                if (ex != null) log.error("Failed to publish ProductCreatedEvent: productId={}", product.id, ex)
                else log.info("Published ProductCreatedEvent: productId={}", product.id)
            }
    }

    override fun publishProductUpdated(product: Product) {
        val event = ProductUpdatedEvent(
            productId = product.id!!,
            name = product.name,
            price = product.price.amount,
            status = product.status.name
        )
        kafkaTemplate.send(updatedTopic, product.id.toString(), event)
            .whenComplete { _, ex ->
                if (ex != null) log.error("Failed to publish ProductUpdatedEvent: productId={}", product.id, ex)
                else log.info("Published ProductUpdatedEvent: productId={}", product.id)
            }
    }
}
