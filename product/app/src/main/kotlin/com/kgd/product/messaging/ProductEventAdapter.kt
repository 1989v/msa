package com.kgd.product.infrastructure.messaging

import com.kgd.product.application.product.port.ProductEventPort
import com.kgd.product.domain.product.model.Product
import com.kgd.product.infrastructure.messaging.event.ProductCreatedEvent
import com.kgd.product.infrastructure.messaging.event.ProductUpdatedEvent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.kafka.core.KafkaTemplate
import org.springframework.stereotype.Component

@Component
class ProductEventAdapter(
    private val kafkaTemplate: KafkaTemplate<String, Any>,
    @Value("\${kafka.topics.product-created}") private val createdTopic: String,
    @Value("\${kafka.topics.product-updated}") private val updatedTopic: String
) : ProductEventPort {

    private val log = KotlinLogging.logger {}

    override fun publishProductCreated(product: Product) {
        val event = ProductCreatedEvent(
            productId = product.id!!,
            name = product.name,
            price = product.price.amount,
            status = product.status.name,
            brand = product.brand
        )
        kafkaTemplate.send(createdTopic, product.id.toString(), event)
            .whenComplete { _, ex ->
                if (ex != null) log.error(ex) { "Failed to publish ProductCreatedEvent: productId=${product.id}" }
                else log.info { "Published ProductCreatedEvent: productId=${product.id}" }
            }
    }

    override fun publishProductUpdated(product: Product) {
        val event = ProductUpdatedEvent(
            productId = product.id!!,
            name = product.name,
            price = product.price.amount,
            status = product.status.name,
            brand = product.brand
        )
        kafkaTemplate.send(updatedTopic, product.id.toString(), event)
            .whenComplete { _, ex ->
                if (ex != null) log.error(ex) { "Failed to publish ProductUpdatedEvent: productId=${product.id}" }
                else log.info { "Published ProductUpdatedEvent: productId=${product.id}" }
            }
    }
}
